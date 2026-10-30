import uuid
from datetime import date

import pytest
from django.db import DatabaseError, transaction

from accounts.models import Role
from core.models import AuditEntry
from notebooks.models import Category, Entry, Kind
from tests.conftest import log_in

pytestmark = pytest.mark.django_db

RANGE = {"from": "2026-10-01", "to": "2026-10-31"}


@pytest.fixture
def categories(centro, norte):
    made = {}
    for tenant in (centro, norte):
        made[tenant.name, Kind.INCOME] = Category.objects.create(
            tenant=tenant, kind=Kind.INCOME, name="Ventas"
        )
        made[tenant.name, Kind.EXPENSE] = Category.objects.create(
            tenant=tenant, kind=Kind.EXPENSE, name="Proveedores"
        )
    return made


@pytest.fixture
def as_role(api, make_person, norte, categories):
    """Logs in a person with the given role in Local Norte only."""

    def login(role: str):
        make_person(f"u-{role}", (norte, role, True))
        log_in(api, f"u-{role}")
        return api

    return login


def entry_body(categories, tenant="Local Norte", kind=Kind.EXPENSE, **overrides):
    body = {
        "date": "2026-10-10",
        "kind": kind,
        "category_id": str(categories[tenant, kind].id),
        "description": "Verdura",
        "amount": "45000.50",
        "payment_method": "cash",
    }
    return body | overrides


def create(api, categories, **overrides):
    return api.post("/api/notebooks/entries/", entry_body(categories, **overrides), format="json")


# ---------- load ----------


def test_editor_loads_an_entry_and_it_is_audited(as_role, categories):
    api = as_role(Role.EDITOR)

    response = create(api, categories)

    assert response.status_code == 201
    entry = Entry.objects.get(id=response.json()["id"])
    assert str(entry.amount) == "45000.50"
    audit = AuditEntry.objects.get(entity_id=entry.id)
    assert audit.action == "entry.create"
    assert audit.after["amount"] == "45000.50"


def test_viewer_cannot_load(as_role, categories):
    api = as_role(Role.VIEWER)

    assert create(api, categories).status_code == 403
    assert Entry.objects.count() == 0


def test_same_request_twice_saves_one_entry(as_role, categories):
    api = as_role(Role.EDITOR)
    key = str(uuid.uuid4())

    first = api.post(
        "/api/notebooks/entries/", entry_body(categories), format="json", HTTP_IDEMPOTENCY_KEY=key
    )
    second = api.post(
        "/api/notebooks/entries/", entry_body(categories), format="json", HTTP_IDEMPOTENCY_KEY=key
    )

    assert first.json()["id"] == second.json()["id"]
    assert Entry.objects.count() == 1


@pytest.mark.parametrize(
    ("overrides", "fragment"),
    [
        ({"amount": "0"}, "amount"),
        ({"amount": "-10"}, "amount"),
        ({"date": ""}, "date"),
        ({"payment_method": "cheque"}, "payment_method"),
    ],
)
def test_invalid_data_saves_nothing(as_role, categories, overrides, fragment):
    api = as_role(Role.EDITOR)

    response = create(api, categories, **overrides)

    assert response.status_code == 400
    assert fragment in response.json()
    assert Entry.objects.count() == 0


def test_category_of_another_shop_is_rejected(as_role, categories):
    api = as_role(Role.EDITOR)
    foreign = str(categories["Local Centro", Kind.EXPENSE].id)

    response = create(api, categories, category_id=foreign)

    assert response.status_code == 400
    assert response.json()["detail"] == "Elegí una categoría de este local."


def test_category_of_the_other_kind_is_rejected(as_role, categories):
    api = as_role(Role.EDITOR)
    income_category = str(categories["Local Norte", Kind.INCOME].id)

    response = create(api, categories, category_id=income_category)

    assert response.status_code == 400


# ---------- list and shops ----------


def test_list_shows_only_the_active_shop_and_hides_voided(api, make_person, centro, norte, categories):
    make_person("lucia", (centro, Role.OWNER, True), (norte, Role.OWNER, True))
    log_in(api, "lucia")
    api.post("/api/auth/tenant/", {"tenant_id": str(norte.id)}, format="json")
    kept = create(api, categories).json()["id"]
    voided = create(api, categories, description="Error").json()["id"]
    api.post(f"/api/notebooks/entries/{voided}/void/", {"reason": "cargado dos veces"}, format="json")
    api.post("/api/auth/tenant/", {"tenant_id": str(centro.id)}, format="json")
    create(api, categories, tenant="Local Centro")
    api.post("/api/auth/tenant/", {"tenant_id": str(norte.id)}, format="json")

    default = api.get("/api/notebooks/entries/", RANGE).json()
    with_voided = api.get("/api/notebooks/entries/", RANGE | {"voided": "1"}).json()

    assert [e["id"] for e in default] == [kept]
    assert {e["id"] for e in with_voided} == {kept, voided}


@pytest.mark.parametrize(
    "params", [{}, {"from": "2026-10-31", "to": "2026-10-01"}, {"from": "2025-01-01", "to": "2026-10-31"}]
)
def test_the_period_is_required_valid_and_at_most_a_year(as_role, params):
    api = as_role(Role.VIEWER)

    assert api.get("/api/notebooks/entries/", params).status_code == 400


# ---------- correct and void ----------


def test_correct_with_reason_keeps_before_and_after(as_role, categories):
    api = as_role(Role.EDITOR)
    entry_id = create(api, categories).json()["id"]

    response = api.put(
        f"/api/notebooks/entries/{entry_id}/",
        entry_body(categories, amount="50000") | {"reason": "era otro monto"},
        format="json",
    )

    assert response.status_code == 200
    audit = AuditEntry.objects.get(entity_id=entry_id, action="entry.correct")
    assert (audit.before["amount"], audit.after["amount"], audit.reason) == (
        "45000.50",
        "50000.00",
        "era otro monto",
    )


def test_correct_without_reason_is_rejected(as_role, categories):
    api = as_role(Role.EDITOR)
    entry_id = create(api, categories).json()["id"]

    response = api.put(
        f"/api/notebooks/entries/{entry_id}/", entry_body(categories, amount="1"), format="json"
    )

    assert response.status_code == 400
    assert "reason" in response.json()


def test_correct_without_changes_is_rejected(as_role, categories):
    api = as_role(Role.EDITOR)
    entry_id = create(api, categories).json()["id"]

    response = api.put(
        f"/api/notebooks/entries/{entry_id}/", entry_body(categories) | {"reason": "nada"}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No cambiaste nada."


def test_voided_entry_cannot_be_corrected_or_voided_again(as_role, categories):
    api = as_role(Role.EDITOR)
    entry_id = create(api, categories).json()["id"]
    api.post(f"/api/notebooks/entries/{entry_id}/void/", {"reason": "error"}, format="json")

    corrected = api.put(
        f"/api/notebooks/entries/{entry_id}/",
        entry_body(categories, amount="9") | {"reason": "x"},
        format="json",
    )
    voided_again = api.post(f"/api/notebooks/entries/{entry_id}/void/", {"reason": "otra vez"}, format="json")

    assert corrected.status_code == 400
    assert voided_again.status_code == 400


def test_void_needs_a_reason(as_role, categories):
    api = as_role(Role.EDITOR)
    entry_id = create(api, categories).json()["id"]

    assert (
        api.post(f"/api/notebooks/entries/{entry_id}/void/", {"reason": "  "}, format="json").status_code
        == 400
    )


def test_viewer_cannot_correct_or_void(as_role, categories, api, make_person, norte):
    editor = as_role(Role.EDITOR)
    entry_id = create(editor, categories).json()["id"]
    editor.post("/api/auth/logout/")
    make_person("mira", (norte, Role.VIEWER, True))
    log_in(api, "mira")

    corrected = api.put(
        f"/api/notebooks/entries/{entry_id}/",
        entry_body(categories, amount="9") | {"reason": "x"},
        format="json",
    )
    voided = api.post(f"/api/notebooks/entries/{entry_id}/void/", {"reason": "x"}, format="json")

    assert (corrected.status_code, voided.status_code) == (403, 403)


def test_entry_of_another_shop_is_not_found(api, make_person, centro, norte, categories):
    make_person("lucia", (centro, Role.OWNER, True), (norte, Role.OWNER, True))
    make_person("tomas", (norte, Role.OWNER, True))
    log_in(api, "lucia")
    api.post("/api/auth/tenant/", {"tenant_id": str(centro.id)}, format="json")
    centro_entry = create(api, categories, tenant="Local Centro").json()["id"]
    api.post("/api/auth/logout/")
    log_in(api, "tomas")

    urls = [f"/api/notebooks/entries/{centro_entry}/void/", f"/api/notebooks/entries/{centro_entry}/history/"]
    responses = [api.post(urls[0], {"reason": "x"}, format="json"), api.get(urls[1])]

    assert [r.status_code for r in responses] == [404, 404]


# ---------- history, summary and audit ----------


def test_history_tells_what_happened_in_order(as_role, categories):
    api = as_role(Role.EDITOR)
    entry_id = create(api, categories).json()["id"]
    api.put(
        f"/api/notebooks/entries/{entry_id}/",
        entry_body(categories, amount="50000") | {"reason": "monto"},
        format="json",
    )
    api.post(f"/api/notebooks/entries/{entry_id}/void/", {"reason": "duplicado"}, format="json")

    history = api.get(f"/api/notebooks/entries/{entry_id}/history/").json()

    assert [h["action"] for h in history] == ["entry.create", "entry.correct", "entry.void"]
    assert [h["reason"] for h in history] == ["", "monto", "duplicado"]


def test_summary_counts_live_entries_only(as_role, categories):
    api = as_role(Role.EDITOR)
    create(api, categories, kind=Kind.INCOME, amount="1000")
    create(api, categories, kind=Kind.INCOME, amount="500.25")
    create(api, categories, amount="300")
    voided = create(api, categories, amount="99999").json()["id"]
    api.post(f"/api/notebooks/entries/{voided}/void/", {"reason": "error"}, format="json")

    summary = api.get("/api/notebooks/summary/", RANGE).json()

    assert (summary["income"], summary["expense"], summary["balance"]) == ("1500.25", "300.00", "1200.25")
    assert {(r["category"], r["count"]) for r in summary["by_category"]} == {
        ("Ventas", 2),
        ("Proveedores", 1),
    }


def test_audit_rows_cannot_be_changed_or_deleted(norte, make_person):
    user = make_person("u")
    row = AuditEntry.objects.create(
        tenant=norte, actor=user, action="x", entity="entry", entity_id=uuid.uuid4()
    )

    with pytest.raises(DatabaseError), transaction.atomic():
        AuditEntry.objects.filter(id=row.id).update(reason="cambiado")
    with pytest.raises(DatabaseError), transaction.atomic():
        AuditEntry.objects.filter(id=row.id).delete()


def test_categories_list_hides_system_and_inactive(as_role, norte, categories):
    Category.objects.create(tenant=norte, kind=Kind.INCOME, name="Espejo", is_system=True)
    Category.objects.create(tenant=norte, kind=Kind.EXPENSE, name="Vieja", is_active=False)
    api = as_role(Role.VIEWER)

    names = {c["name"] for c in api.get("/api/notebooks/categories/").json()}

    assert names == {"Ventas", "Proveedores"}


def test_dates_are_plain_dates(as_role, categories):
    api = as_role(Role.EDITOR)

    body = create(api, categories).json()

    assert body["date"] == date(2026, 10, 10).isoformat()
