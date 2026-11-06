"""A cost paid with debit or transfer also adds its sale, as the owner does on paper (ADR-0010, ADR-0013)."""

from datetime import date
from decimal import Decimal

import pytest

from accounts.models import Membership, Role
from core.models import AuditEntry
from notebooks import cash
from notebooks.models import Category, Entry, Kind, ShopSettings, sale_methods_of

pytestmark = pytest.mark.django_db

URL = "/api/notebooks/entries/"
SETTINGS = "/api/notebooks/settings/"


def body(categories, **overrides):
    data = {
        "date": "2026-10-10",
        "kind": Kind.EXPENSE,
        "category_id": str(categories["Local Norte", Kind.EXPENSE].id),
        "description": "don José",
        "amount": "100000.00",
        "payment_method": "debit",
        "shift": "night",
        "add_sale": True,
    }
    return data | overrides


def correction(entry, **overrides):
    data = {
        "date": entry.date.isoformat(),
        "kind": entry.kind,
        "category_id": str(entry.category_id),
        "description": entry.description,
        "amount": str(entry.amount),
        "payment_method": entry.payment_method,
        "shift": entry.shift,
        "reason": "el ticket decía otra cosa",
    }
    return data | overrides


def test_a_debit_cost_with_add_sale_creates_both_in_one_go(as_role, categories):
    api = as_role(Role.EDITOR)

    response = api.post(URL, body(categories), format="json")

    assert response.status_code == 201
    cost = Entry.objects.get(kind=Kind.EXPENSE)
    sale = Entry.objects.get(kind=Kind.INCOME)
    assert response.data["sale_id"] == str(sale.id)
    assert sale.from_expense == cost
    assert (sale.date, sale.shift, sale.amount, sale.payment_method) == (
        cost.date,
        "night",
        Decimal("100000.00"),
        "debit",
    )
    assert sale.category == categories["Local Norte", Kind.INCOME]
    assert sale.description == "Gasto con débito: Proveedores (don José)"
    assert AuditEntry.objects.filter(action="entry.create").count() == 2


def test_the_pair_does_not_move_the_haber_and_matches_the_paper(as_role, categories, norte):
    api = as_role(Role.OWNER)
    owner = Membership.objects.get(user__username="u-owner")
    start = cash.set_opening(owner, day=date(2026, 10, 9), shift="night", amount=Decimal("500000"), reason="")
    api.post(
        URL,
        body(
            categories,
            payment_method="cash",
            kind=Kind.INCOME,
            add_sale=False,
            category_id=str(categories["Local Norte", Kind.INCOME].id),
            amount="300000.00",
        ),
        format="json",
    )
    api.post(URL, body(categories), format="json")

    [close] = cash.closes(norte, start, until=date(2026, 10, 31))

    # On paper: previous haber + sales (the D line included) - costs (the D cost included).
    paper = Decimal("500000") + (Decimal("300000") + Decimal("100000")) - Decimal("100000")
    assert close.after == paper
    assert close.sales == Decimal("400000.00")


def test_cash_costs_and_incomes_cannot_add_a_sale(as_role, categories):
    api = as_role(Role.EDITOR)

    cash_cost = api.post(URL, body(categories, payment_method="cash"), format="json")
    income = api.post(
        URL,
        body(categories, kind=Kind.INCOME, category_id=str(categories["Local Norte", Kind.INCOME].id)),
        format="json",
    )

    assert cash_cost.status_code == 400 and income.status_code == 400
    assert "no se suma a la venta" in str(cash_cost.data)
    assert Entry.objects.count() == 0


def test_without_add_sale_a_debit_cost_is_just_a_cost(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories, add_sale=False), format="json")
    assert list(Entry.objects.values_list("kind", flat=True)) == [Kind.EXPENSE]


def test_the_same_idempotency_key_does_not_duplicate_the_pair(as_role, categories):
    api = as_role(Role.EDITOR)
    key = "6f1c2d4e-1111-4222-8333-944455556666"
    api.post(URL, body(categories), format="json", HTTP_IDEMPOTENCY_KEY=key)
    api.post(URL, body(categories), format="json", HTTP_IDEMPOTENCY_KEY=key)
    assert Entry.objects.count() == 2


def test_without_income_categories_it_says_so_and_saves_nothing(as_role, categories):
    api = as_role(Role.EDITOR)
    Category.objects.filter(kind=Kind.INCOME).update(is_active=False)

    response = api.post(URL, body(categories), format="json")

    assert response.status_code == 400
    assert "categoría de ingreso" in str(response.data)
    assert Entry.objects.count() == 0


def test_correcting_the_cost_carries_the_sale_along(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    response = api.put(
        f"{URL}{cost.id}/",
        correction(cost, amount="120000.00", date="2026-10-11", shift="morning"),
        format="json",
    )

    assert response.status_code == 200
    sale = Entry.objects.get(kind=Kind.INCOME)
    assert (sale.amount, sale.date, sale.shift) == (Decimal("120000.00"), date(2026, 10, 11), "morning")
    audit = AuditEntry.objects.get(entity_id=sale.id, action="entry.correct")
    assert audit.reason.startswith("Acompaña la corrección de su gasto")


def test_if_the_cost_moves_to_cash_its_sale_is_voided(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    api.put(f"{URL}{cost.id}/", correction(cost, payment_method="cash"), format="json")

    sale = Entry.objects.get(kind=Kind.INCOME)
    assert sale.is_voided
    assert sale.void_reason.startswith("El gasto ya no suma venta")


def test_voiding_the_cost_voids_its_sale(as_role, categories):
    api = as_role(Role.OWNER)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    response = api.post(f"{URL}{cost.id}/void/", {"reason": "cargado dos veces"}, format="json")

    assert response.status_code == 200
    sale = Entry.objects.get(kind=Kind.INCOME)
    assert sale.is_voided and sale.void_reason == "Se anuló su gasto. cargado dos veces"


def test_the_sale_cannot_be_changed_or_voided_on_its_own(as_role, categories):
    api = as_role(Role.OWNER)
    api.post(URL, body(categories), format="json")
    sale = Entry.objects.get(kind=Kind.INCOME)

    fix = api.put(f"{URL}{sale.id}/", correction(sale, amount="1.00"), format="json")
    void = api.post(f"{URL}{sale.id}/void/", {"reason": "no va"}, format="json")

    assert fix.status_code == 400 and void.status_code == 400
    assert "corregí o anulá el gasto" in str(fix.data)
    sale.refresh_from_db()
    assert sale.amount == Decimal("100000.00") and not sale.is_voided


# ---------- round trip (review of 05/11/2026, ADR-0012) ----------


def test_back_to_debit_with_add_sale_brings_a_new_sale(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)
    api.put(f"{URL}{cost.id}/", correction(cost, payment_method="cash"), format="json")
    cost.refresh_from_db()
    listed = api.get(URL, {"from": "2026-10-01", "to": "2026-10-31"}).json()["results"]
    assert listed[0]["sale_id"] is None

    response = api.put(
        f"{URL}{cost.id}/", correction(cost, payment_method="debit", add_sale=True), format="json"
    )

    assert response.status_code == 200
    old, new = Entry.objects.filter(kind=Kind.INCOME).order_by("created_at")
    assert old.is_voided and not new.is_voided
    assert new.from_expense == cost and new.amount == cost.amount
    assert response.data["sale_id"] == str(new.id)


def test_without_add_sale_back_to_debit_stays_without_sale(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)
    api.put(f"{URL}{cost.id}/", correction(cost, payment_method="cash"), format="json")
    cost.refresh_from_db()

    api.put(f"{URL}{cost.id}/", correction(cost, payment_method="debit"), format="json")

    assert not Entry.objects.filter(kind=Kind.INCOME, is_voided=False).exists()


def test_add_sale_never_makes_a_second_standing_sale(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    api.put(f"{URL}{cost.id}/", correction(cost, amount="150000.00", add_sale=True), format="json")

    assert Entry.objects.filter(kind=Kind.INCOME, is_voided=False).count() == 1
    assert Entry.objects.get(kind=Kind.INCOME).amount == Decimal("150000.00")


def test_a_debit_cost_loaded_without_sale_can_get_it_later(as_role, categories):
    """Only the sale is added: nothing else changes, and that is not "No cambiaste nada"."""
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories, add_sale=False), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    response = api.put(f"{URL}{cost.id}/", correction(cost, add_sale=True), format="json")

    assert response.status_code == 200
    assert Entry.objects.filter(kind=Kind.INCOME, is_voided=False).count() == 1


def test_add_sale_on_a_cash_correction_is_refused(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    response = api.put(
        f"{URL}{cost.id}/", correction(cost, payment_method="cash", add_sale=True), format="json"
    )

    assert response.status_code == 400
    assert not Entry.objects.get(kind=Kind.INCOME).is_voided, "nothing changed"


def test_a_voided_sale_does_not_count_as_the_standing_one(as_role, categories):
    api = as_role(Role.OWNER)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)
    api.post(f"{URL}{cost.id}/void/", {"reason": "error"}, format="json")

    listed = api.get(URL, {"from": "2026-10-01", "to": "2026-10-31", "voided": "1"}).json()["results"]

    assert [e["sale_id"] for e in listed if e["kind"] == Kind.EXPENSE] == [None]


# ---------- transfer and the shop's own list (ADR-0013) ----------


def test_a_transfer_cost_adds_a_transfer_sale(as_role, categories):
    api = as_role(Role.EDITOR)

    response = api.post(URL, body(categories, payment_method="transfer"), format="json")

    assert response.status_code == 201
    sale = Entry.objects.get(kind=Kind.INCOME)
    assert sale.payment_method == "transfer"
    assert sale.description == "Gasto por transferencia: Proveedores (don José)"
    audit = AuditEntry.objects.get(entity_id=sale.id)
    assert audit.reason == "Venta del gasto por transferencia"


def test_credit_adds_a_sale_only_after_the_owner_turns_it_on(as_role, categories):
    owner = as_role(Role.OWNER)

    before = owner.post(URL, body(categories, payment_method="credit"), format="json")
    owner.put(SETTINGS, {"sale_methods": ["debit", "transfer", "credit"]}, format="json")
    after = owner.post(URL, body(categories, payment_method="credit"), format="json")

    assert before.status_code == 400
    assert after.status_code == 201
    assert Entry.objects.get(kind=Kind.INCOME).payment_method == "credit"


def test_debit_to_transfer_keeps_the_sale_and_changes_its_method(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    api.put(f"{URL}{cost.id}/", correction(cost, payment_method="transfer"), format="json")

    sale = Entry.objects.get(kind=Kind.INCOME)
    assert not sale.is_voided
    assert sale.payment_method == "transfer"
    assert sale.description.startswith("Gasto por transferencia")


def test_taking_a_method_off_the_list_does_not_touch_old_sales(as_role, categories):
    """The setting is for what comes next. Fixing the amount of an old cost keeps its sale."""
    owner = as_role(Role.OWNER)
    owner.post(URL, body(categories, payment_method="transfer"), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)
    owner.put(SETTINGS, {"sale_methods": ["debit"]}, format="json")

    owner.put(f"{URL}{cost.id}/", correction(cost, amount="90000.00"), format="json")

    sale = Entry.objects.get(kind=Kind.INCOME)
    assert not sale.is_voided and sale.amount == Decimal("90000.00")
    refused = owner.post(URL, body(categories, payment_method="transfer"), format="json")
    assert refused.status_code == 400


def test_moving_to_a_method_off_the_list_voids_the_sale(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    api.put(f"{URL}{cost.id}/", correction(cost, payment_method="qr"), format="json")

    assert Entry.objects.get(kind=Kind.INCOME).is_voided


# ---------- the settings themselves ----------


def test_a_shop_without_settings_uses_debit_and_transfer(as_role):
    response = as_role(Role.VIEWER).get(SETTINGS)
    assert response.status_code == 200
    assert response.data == {"sale_methods": ["debit", "transfer"]}


def test_the_owner_changes_the_list_and_it_is_audited(as_role):
    owner = as_role(Role.OWNER)

    response = owner.put(SETTINGS, {"sale_methods": ["transfer", "qr", "transfer"]}, format="json")

    assert response.status_code == 200
    # Same order every time, no repeats.
    assert response.data == {"sale_methods": ["qr", "transfer"]}
    assert ShopSettings.objects.get().sale_methods == ["qr", "transfer"]
    audit = AuditEntry.objects.get(action="settings.change")
    assert audit.before == {"sale_methods": ["debit", "transfer"]}
    assert audit.after == {"sale_methods": ["qr", "transfer"]}


def test_saving_the_same_list_writes_no_audit(as_role):
    as_role(Role.OWNER).put(SETTINGS, {"sale_methods": ["debit", "transfer"]}, format="json")
    assert not AuditEntry.objects.filter(action="settings.change").exists()


def test_an_empty_list_turns_the_sale_off(as_role, categories):
    owner = as_role(Role.OWNER)
    owner.put(SETTINGS, {"sale_methods": []}, format="json")
    assert owner.post(URL, body(categories), format="json").status_code == 400


@pytest.mark.parametrize("role", [Role.EDITOR, Role.VIEWER])
def test_only_the_owner_changes_the_settings(as_role, role):
    response = as_role(role).put(SETTINGS, {"sale_methods": []}, format="json")
    assert response.status_code == 403
    assert not ShopSettings.objects.exists()


def test_cash_cannot_add_a_sale(as_role):
    response = as_role(Role.OWNER).put(SETTINGS, {"sale_methods": ["cash"]}, format="json")
    assert response.status_code == 400
    assert "no sean efectivo" in str(response.data)


def test_settings_are_per_shop(as_role, centro, norte):
    """Changing them in one shop leaves the other with the defaults (ADR-0003)."""
    as_role(Role.OWNER).put(SETTINGS, {"sale_methods": []}, format="json")
    assert sale_methods_of(norte) == []
    assert sale_methods_of(centro) == ["debit", "transfer"]
