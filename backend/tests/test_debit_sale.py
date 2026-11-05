"""A cost paid with debit also adds a sale with debit, as the owner does on paper (ADR-0010)."""

from datetime import date
from decimal import Decimal

import pytest

from accounts.models import Membership, Role
from core.models import AuditEntry
from notebooks import cash
from notebooks.models import Category, Entry, Kind

pytestmark = pytest.mark.django_db

URL = "/api/notebooks/entries/"


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
    assert response.data["debit_sale_id"] == str(sale.id)
    assert sale.from_debit_expense == cost
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


def test_only_a_debit_cost_can_add_a_sale(as_role, categories):
    api = as_role(Role.EDITOR)

    cash_cost = api.post(URL, body(categories, payment_method="cash"), format="json")
    income = api.post(
        URL,
        body(categories, kind=Kind.INCOME, category_id=str(categories["Local Norte", Kind.INCOME].id)),
        format="json",
    )

    assert cash_cost.status_code == 400 and income.status_code == 400
    assert "Solo un gasto con débito" in str(cash_cost.data)
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
    assert audit.reason.startswith("Acompaña la corrección del gasto con débito")


def test_if_the_cost_stops_being_debit_its_sale_is_voided(as_role, categories):
    api = as_role(Role.EDITOR)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    api.put(f"{URL}{cost.id}/", correction(cost, payment_method="cash"), format="json")

    sale = Entry.objects.get(kind=Kind.INCOME)
    assert sale.is_voided
    assert sale.void_reason.startswith("El gasto ya no es con débito")


def test_voiding_the_cost_voids_its_sale(as_role, categories):
    api = as_role(Role.OWNER)
    api.post(URL, body(categories), format="json")
    cost = Entry.objects.get(kind=Kind.EXPENSE)

    response = api.post(f"{URL}{cost.id}/void/", {"reason": "cargado dos veces"}, format="json")

    assert response.status_code == 200
    sale = Entry.objects.get(kind=Kind.INCOME)
    assert sale.is_voided and sale.void_reason == "Se anuló el gasto con débito. cargado dos veces"


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
    assert api.get(URL, {"from": "2026-10-01", "to": "2026-10-31"}).json()[0]["debit_sale_id"] is None

    response = api.put(
        f"{URL}{cost.id}/", correction(cost, payment_method="debit", add_sale=True), format="json"
    )

    assert response.status_code == 200
    old, new = Entry.objects.filter(kind=Kind.INCOME).order_by("created_at")
    assert old.is_voided and not new.is_voided
    assert new.from_debit_expense == cost and new.amount == cost.amount
    assert response.data["debit_sale_id"] == str(new.id)


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

    listed = api.get(URL, {"from": "2026-10-01", "to": "2026-10-31", "voided": "1"}).json()

    assert [e["debit_sale_id"] for e in listed if e["kind"] == Kind.EXPENSE] == [None]
