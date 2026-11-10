"""Emptying the notebooks of a shop to start from zero (ADR-0015)."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from accounts.models import Membership
from core.models import AuditEntry
from notebooks import services
from notebooks.models import CashOpening, Category, Entry, ShopNotebooks, ShopSettings
from tests.conftest import PASSWORD, entry

pytestmark = pytest.mark.django_db

ENTRIES = "/api/notebooks/entries/"
ADMIN = "/admin/notebooks/shopnotebooks/"


def test_it_deletes_entries_and_opening_and_keeps_the_rest(loaded, norte, centro):
    _, user = loaded
    audit_before = AuditEntry.objects.filter(tenant=norte).count()

    done = services.empty_notebooks(norte, user, "arrancamos de verdad")

    assert done == {"entries": 2, "voided": 1, "cash_opening": True}
    assert not Entry.objects.filter(tenant=norte).exists()
    assert not CashOpening.objects.filter(tenant=norte).exists()
    # What stays.
    assert Category.objects.filter(tenant=norte).count() == 2
    assert Membership.objects.filter(tenant=norte).exists()
    assert ShopSettings.objects.get(tenant=norte).sale_methods == ["debit"]
    assert Entry.objects.filter(tenant=centro).count() == 1, "the other shop is not touched"
    # The audit keeps everything, plus one row that tells what happened.
    assert AuditEntry.objects.filter(tenant=norte).count() == audit_before + 1
    row = AuditEntry.objects.get(action="notebooks.empty")
    assert row.actor == user and row.reason == "arrancamos de verdad"
    assert row.before == {
        "entries": 2,
        "voided": 1,
        "cash_opening": {"amount": "500000.00"},
    }


def test_the_reason_is_required(loaded, norte):
    _, user = loaded
    with pytest.raises(services.RuleError):
        services.empty_notebooks(norte, user, "  ")
    assert Entry.objects.filter(tenant=norte).exists()


def test_recent_changes_start_again_after_emptying(loaded, norte, categories):
    owner, user = loaded
    assert owner.get("/api/notebooks/changes/").data

    services.empty_notebooks(norte, user, "arrancamos de verdad")
    assert owner.get("/api/notebooks/changes/").data == []

    owner.post(ENTRIES, entry(categories, description="primero real"), format="json")
    changes = owner.get("/api/notebooks/changes/").data
    assert len(changes) == 1


def test_the_box_starts_with_no_opening(loaded, norte):
    owner, user = loaded
    services.empty_notebooks(norte, user, "arrancamos de verdad")
    body = owner.get("/api/notebooks/cash/", {"from": "2026-10-01", "to": "2026-10-31"}).data
    assert body["opening"] is None and body["closes"] == []


# ---------- the admin page ----------


def act(client, shop, **extra):
    return client.post(ADMIN, {"action": "empty_notebooks", "_selected_action": [str(shop.pk)], **extra})


def test_the_page_lists_shops_with_their_counts(admin_client, loaded):
    response = admin_client.get(ADMIN)
    assert response.status_code == 200
    assert "Local Norte" in response.content.decode()


def test_the_action_first_asks_for_confirmation(admin_client, loaded, norte):
    response = act(admin_client, norte)

    assert response.status_code == 200
    page = response.content.decode()
    assert "Esto no se puede deshacer" in page
    assert "2 movimientos" in page
    assert Entry.objects.filter(tenant=norte).exists()


def test_a_wrong_name_deletes_nothing(admin_client, loaded, norte):
    response = act(admin_client, norte, confirmar="1", confirm_name="Local Nort", reason="arrancamos")

    assert "El nombre no coincide" in response.content.decode()
    assert Entry.objects.filter(tenant=norte).exists()


def test_the_right_name_and_a_reason_empty_the_shop(admin_client, loaded, norte):
    response = act(
        admin_client, norte, confirmar="1", confirm_name="Local Norte", reason="arrancamos de verdad"
    )

    assert response.status_code == 302
    assert not Entry.objects.filter(tenant=norte).exists()
    assert AuditEntry.objects.get(action="notebooks.empty").actor.username == "admin"


def test_one_shop_at_a_time(admin_client, loaded, norte, centro):
    response = admin_client.post(
        ADMIN,
        {"action": "empty_notebooks", "_selected_action": [str(norte.pk), str(centro.pk)]},
        follow=True,
    )
    assert "Elegí un solo local por vez" in response.content.decode()
    assert Entry.objects.filter(tenant=norte).exists()


def test_staff_who_is_not_superuser_cannot_see_it(db, loaded, norte):
    staff = get_user_model().objects.create_user("ayuda", password=PASSWORD, is_staff=True)
    client = Client()
    client.force_login(staff)

    assert client.get(ADMIN).status_code == 403
    act(client, norte, confirmar="1", confirm_name="Local Norte", reason="x")
    assert Entry.objects.filter(tenant=norte).exists()
    assert ShopNotebooks.objects.count() == 2
