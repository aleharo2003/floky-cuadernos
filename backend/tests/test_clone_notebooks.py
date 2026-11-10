"""Copying the notebooks of a shop into a test shop, to reproduce a problem (ADR-0017)."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APIClient

from accounts.models import Membership, Role
from core.models import AuditEntry, Tenant, record
from notebooks import services
from notebooks.models import CashOpening, Category, Entry, Kind, ShopSettings
from tests.conftest import PASSWORD, log_in

pytestmark = pytest.mark.django_db

ADMIN = "/admin/notebooks/shopnotebooks/"
PERIOD = {"from": "2026-10-01", "to": "2026-10-31"}


@pytest.fixture
def pruebas(make_person):
    """The team's test shop, with old data of its own and one developer as its only member."""
    shop = Tenant.objects.create(name="AB-Sistemas", is_test=True)
    dev = make_person("dev", (shop, Role.OWNER, True))
    old = Category.objects.create(tenant=shop, kind=Kind.EXPENSE, name="Viejo")
    Entry.objects.create(
        tenant=shop,
        category=old,
        kind=Kind.EXPENSE,
        date="2026-09-01",
        amount="1.00",
        payment_method="cash",
        shift="night",
        created_by=dev,
    )
    CashOpening.objects.create(tenant=shop, amount="7.00", updated_by=dev)
    ShopSettings.objects.create(tenant=shop, sale_methods=["transfer"], updated_by=dev)
    return shop


@pytest.fixture
def dev_api(pruebas) -> APIClient:
    client = APIClient()
    log_in(client, "dev")
    return client


def lines(tenant):
    """What a person sees of each entry, without the ids, which are new in the copy."""
    return sorted(
        (
            e.date,
            e.kind,
            e.category.name,
            e.description,
            e.amount,
            e.payment_method,
            e.shift,
            e.is_voided,
            e.void_reason,
            e.created_by_id,
            e.created_at,
            e.updated_at,
            e.from_expense.description if e.from_expense else None,
        )
        for e in Entry.objects.filter(tenant=tenant).select_related("category", "from_expense")
    )


def test_the_test_shop_ends_up_equal_to_the_source(loaded, norte, pruebas):
    _, user = loaded
    source_before = lines(norte)

    done = services.clone_notebooks(norte, pruebas, user, "Ema no ve la venta del débito")

    assert done == {"entries": 2, "voided": 1, "categories": 2, "cash_opening": True, "settings": True}
    assert lines(pruebas) == source_before
    # The sale points to the copy of its cost, never to the cost in the real shop.
    sale = Entry.objects.get(tenant=pruebas, from_expense__isnull=False)
    assert sale.from_expense.tenant == pruebas
    # What the test shop had is gone, and it has the same categories, box and settings.
    assert sorted(Category.objects.filter(tenant=pruebas).values_list("kind", "name")) == sorted(
        Category.objects.filter(tenant=norte).values_list("kind", "name")
    )
    opening = CashOpening.objects.get(tenant=pruebas)
    original = CashOpening.objects.get(tenant=norte)
    assert (opening.amount, opening.updated_by, opening.updated_at) == (
        original.amount,
        original.updated_by,
        original.updated_at,
    )
    copied, original = ShopSettings.objects.get(tenant=pruebas), ShopSettings.objects.get(tenant=norte)
    assert (copied.sale_methods, copied.updated_by, copied.updated_at) == (
        ["debit"],
        original.updated_by,
        original.updated_at,
    )
    # The real shop is only read.
    assert lines(norte) == source_before


def test_nobody_gets_access_to_the_test_shop(loaded, norte, pruebas):
    _, user = loaded
    members_before = list(Membership.objects.filter(tenant=pruebas).values_list("user__username", flat=True))

    services.clone_notebooks(norte, pruebas, user, "revisar")

    assert list(Membership.objects.filter(tenant=pruebas).values_list("user__username", flat=True)) == (
        members_before
    )
    assert not Membership.objects.filter(tenant=pruebas, user=user).exists()


def test_the_test_shop_shows_the_same_box_totals_and_entries(loaded, norte, pruebas, dev_api):
    owner, user = loaded
    services.clone_notebooks(norte, pruebas, user, "revisar")

    for url in ("/api/notebooks/cash/", "/api/notebooks/summary/"):
        assert dev_api.get(url, PERIOD).data == owner.get(url, PERIOD).data, url

    def shown(client):
        rows = client.get("/api/notebooks/entries/", {**PERIOD, "voided": "true"}).data
        rows = rows["results"] if isinstance(rows, dict) else rows
        # The ids are new in the copy; everything else has to match.
        return [{k: v for k, v in row.items() if k != "id" and not k.endswith("_id")} for row in rows]

    assert shown(dev_api) == shown(owner)


def test_recent_changes_of_the_test_shop_start_after_the_copy(loaded, norte, pruebas, dev_api):
    _, user = loaded
    old = Entry.objects.get(tenant=pruebas)
    record(tenant=pruebas, actor=old.created_by, action="entry.create", entity="entry", entity_id=old.id)
    assert len(dev_api.get("/api/notebooks/changes/").data) == 1

    services.clone_notebooks(norte, pruebas, user, "revisar")

    assert dev_api.get("/api/notebooks/changes/").data == []


def test_copying_again_replaces_the_first_copy(loaded, norte, pruebas):
    _, user = loaded
    services.clone_notebooks(norte, pruebas, user, "primera")
    services.clone_notebooks(norte, pruebas, user, "segunda")

    assert lines(pruebas) == lines(norte)
    assert Category.objects.filter(tenant=pruebas).count() == 2


def test_only_into_a_test_shop(loaded, norte, centro):
    _, user = loaded
    centro_before = lines(centro)

    with pytest.raises(services.RuleError, match="no está marcado como local de pruebas"):
        services.clone_notebooks(norte, centro, user, "revisar")

    assert lines(centro) == centro_before
    assert not AuditEntry.objects.filter(action__startswith="notebooks.c").exists()


def test_not_into_itself(loaded, pruebas):
    _, user = loaded
    with pytest.raises(services.RuleError):
        services.clone_notebooks(pruebas, pruebas, user, "revisar")
    assert Entry.objects.filter(tenant=pruebas).count() == 1


def test_the_reason_is_required(loaded, norte, pruebas):
    _, user = loaded
    with pytest.raises(services.RuleError):
        services.clone_notebooks(norte, pruebas, user, "  ")
    assert Entry.objects.filter(tenant=pruebas).count() == 1


def test_both_shops_record_who_copied_it_and_why(loaded, norte, pruebas):
    _, user = loaded
    services.clone_notebooks(norte, pruebas, user, "Ema no ve la venta del débito")

    into = AuditEntry.objects.get(tenant=pruebas, action="notebooks.clone")
    assert into.actor == user and into.reason == "Ema no ve la venta del débito"
    assert into.before == {"entries": 1, "voided": 0, "categories": 1}
    assert into.after["from"] == "Local Norte"
    assert into.after["cash_opening"] == {"amount": "500000.00"}

    out = AuditEntry.objects.get(tenant=norte, action="notebooks.copied")
    assert out.actor == user and out.after == {"to": "AB-Sistemas"}


# ---------- the admin page ----------


def act(client, shop, follow=False, **extra):
    data = {"action": "clone_notebooks", "_selected_action": [str(shop.pk)], **extra}
    return client.post(ADMIN, data, follow=follow)


def test_without_a_test_shop_it_says_how_to_mark_one(admin_client, loaded, norte):
    page = act(admin_client, norte).content.decode()

    assert "No hay ningún local marcado como de pruebas" in page
    assert 'name="target"' not in page


def test_the_page_tells_what_is_copied_and_what_is_deleted(admin_client, loaded, norte, pruebas):
    page = act(admin_client, norte).content.decode()

    assert "2 movimientos" in page and "1 anulados" in page
    assert "Esto borra todo lo que tenga el local de pruebas" in page
    assert "AB-Sistemas" in page
    assert Entry.objects.filter(tenant=pruebas).count() == 1, "nothing is copied before confirming"


def test_only_test_shops_can_be_chosen(admin_client, loaded, norte, centro, pruebas):
    page = act(admin_client, norte).content.decode()
    assert f'value="{pruebas.pk}"' in page
    assert f'value="{centro.pk}"' not in page

    response = act(admin_client, norte, confirmar="1", target=str(centro.pk), reason="revisar")

    assert response.status_code == 200
    assert Entry.objects.filter(tenant=centro).count() == 1


def test_choosing_a_test_shop_and_a_reason_copies(admin_client, loaded, norte, pruebas):
    response = act(admin_client, norte, confirmar="1", target=str(pruebas.pk), reason="revisar", follow=True)

    assert "AB-Sistemas ahora es una copia de Local Norte" in response.content.decode()
    assert lines(pruebas) == lines(norte)
    assert AuditEntry.objects.get(action="notebooks.clone").actor.username == "admin"


def test_one_shop_at_a_time(admin_client, loaded, norte, centro, pruebas):
    response = admin_client.post(
        ADMIN,
        {"action": "clone_notebooks", "_selected_action": [str(norte.pk), str(centro.pk)]},
        follow=True,
    )
    assert "Elegí un solo local por vez" in response.content.decode()
    assert Entry.objects.filter(tenant=pruebas).count() == 1


def test_staff_who_is_not_superuser_cannot_copy(db, loaded, norte, pruebas):
    staff = get_user_model().objects.create_user("ayuda", password=PASSWORD, is_staff=True)
    client = Client()
    client.force_login(staff)

    act(client, norte, confirmar="1", target=str(pruebas.pk), reason="x")

    assert Entry.objects.filter(tenant=pruebas).count() == 1
