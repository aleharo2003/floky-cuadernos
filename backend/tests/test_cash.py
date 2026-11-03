"""The cash box by shift (P-01, P-02, ADR-0008). The paper method with debit costs: test_debit_sale.py.

The haber is cash on hand, and money is never a float.
"""

from datetime import date
from decimal import Decimal
from io import BytesIO

import pytest
from openpyxl import load_workbook

from accounts.models import Membership, Role
from core.models import AuditEntry
from notebooks import cash
from notebooks.export import CASH_HEADERS
from notebooks.models import CashOpening, Entry, Kind
from notebooks.services import RuleError
from tests.conftest import log_in

pytestmark = pytest.mark.django_db

D = Decimal
JAN = {"from": "2026-01-01", "to": "2026-01-31"}


@pytest.fixture
def owner(make_person, norte):
    user = make_person("duena", (norte, Role.OWNER, True))
    return Membership.objects.get(user=user, tenant=norte)


@pytest.fixture
def add(norte, categories, owner):
    sales, costs = categories["Local Norte", Kind.INCOME], categories["Local Norte", Kind.EXPENSE]

    def add(day, shift, kind, amount, method="cash", voided=False, tenant=norte, category=None):
        category = category or (sales if kind == Kind.INCOME else costs)
        return Entry.objects.create(
            tenant=tenant,
            category=category,
            kind=kind,
            date=date(2026, 1, day),
            shift=shift,
            amount=D(amount),
            payment_method=method,
            is_voided=voided,
            created_by=owner.user,
        )

    return add


def opening(owner, day=1, shift="night", amount="1000000.00"):
    return cash.set_opening(owner, day=date(2026, 1, day), shift=shift, amount=D(amount), reason="")


# ---------- the rule ----------


def test_haber_counts_only_cash(owner, add):
    start = opening(owner)
    add(2, "morning", Kind.INCOME, "500000.00", "cash")
    add(2, "morning", Kind.INCOME, "200000.00", "qr")  # Mercado Pago: sold, not in the box
    add(2, "morning", Kind.EXPENSE, "300000.00", "cash")
    add(2, "morning", Kind.EXPENSE, "50000.00", "transfer")  # paid from the bank: the box does not move

    [close] = cash.closes(owner.tenant, start, until=date(2026, 1, 31))

    assert close.sales == D("700000.00")
    assert close.sales_not_cash == D("200000.00")
    assert close.expenses_cash == D("300000.00")
    assert close.expenses_not_cash == D("50000.00")
    assert close.after == D("1200000.00")


def test_shifts_carry_forward_in_order(owner, add):
    start = opening(owner, day=6, shift="morning", amount="100.00")
    add(7, "morning", Kind.INCOME, "10.00")
    add(6, "night", Kind.INCOME, "1.00")  # same day as the opening, later shift: counts
    add(7, "night", Kind.EXPENSE, "5.00")
    add(8, "morning", Kind.INCOME, "1000.00")

    rows = cash.closes(owner.tenant, start, until=date(2026, 1, 31))

    assert [(r.date.day, r.shift, r.before, r.after) for r in rows] == [
        (6, "night", D("100.00"), D("101.00")),
        (7, "morning", D("101.00"), D("111.00")),
        (7, "night", D("111.00"), D("106.00")),
        (8, "morning", D("106.00"), D("1106.00")),
    ]


def test_entries_up_to_the_opening_shift_are_already_in_the_opening(owner, add):
    start = opening(owner, day=6, shift="night", amount="100.00")
    add(5, "night", Kind.INCOME, "999.00")
    add(6, "morning", Kind.INCOME, "999.00")
    add(6, "night", Kind.INCOME, "999.00")  # the opening is this shift's close

    assert cash.closes(owner.tenant, start, until=date(2026, 1, 31)) == []


def test_voided_entries_and_other_shops_do_not_count(owner, add, centro, categories):
    start = opening(owner)
    add(2, "morning", Kind.INCOME, "10.00")
    add(2, "morning", Kind.INCOME, "500.00", voided=True)
    add(2, "morning", Kind.INCOME, "700.00", tenant=centro, category=categories["Local Centro", Kind.INCOME])

    [close] = cash.closes(owner.tenant, start, until=date(2026, 1, 31))

    assert close.after == D("1000010.00")


def test_a_negative_box_is_flagged_not_blocked(owner, add):
    start = opening(owner, amount="100.00")
    add(2, "morning", Kind.EXPENSE, "150.00")

    [close] = cash.closes(owner.tenant, start, until=date(2026, 1, 31))

    assert close.after == D("-50.00")
    assert close.negative


# ---------- opening haber ----------


def test_changing_the_opening_needs_a_reason_and_is_audited(owner):
    opening(owner, amount="100.00")

    with pytest.raises(RuleError, match="por qué"):
        cash.set_opening(owner, day=date(2026, 1, 1), shift="night", amount=D("120.00"), reason="")
    cash.set_opening(owner, day=date(2026, 1, 1), shift="night", amount=D("120.00"), reason="mal copiado")

    rows = AuditEntry.objects.filter(entity="cash_opening").order_by("created_at")
    assert [r.reason for r in rows] == ["", "mal copiado"]
    assert rows[1].before["amount"] == "100.00"
    assert rows[1].after["amount"] == "120.00"
    assert CashOpening.objects.get().amount == D("120.00")


def test_same_opening_again_is_rejected(owner):
    opening(owner, amount="100.00")

    with pytest.raises(RuleError, match="No cambiaste"):
        cash.set_opening(owner, day=date(2026, 1, 1), shift="night", amount=D("100.00"), reason="igual")


# ---------- API ----------


def test_without_opening_the_api_says_so(as_role):
    api = as_role(Role.VIEWER)

    body = api.get("/api/notebooks/cash/", JAN).json()

    assert body == {"opening": None, "closes": [], "haber_at_end": None}


@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR])
def test_only_the_owner_sets_the_opening(as_role, role):
    api = as_role(role)

    response = api.put(
        "/api/notebooks/cash/opening/",
        {"date": "2026-01-01", "shift": "night", "amount": "10"},
        format="json",
    )

    assert response.status_code == 403
    assert not CashOpening.objects.exists()


def test_owner_sets_the_opening_and_everyone_sees_the_box(api, owner, add, make_person, norte):
    log_in(api, "duena")
    response = api.put(
        "/api/notebooks/cash/opening/",
        {"date": "2026-01-01", "shift": "night", "amount": "1000.50"},
        format="json",
    )
    assert response.status_code == 200, response.content
    add(2, "morning", Kind.INCOME, "100.00")
    add(2, "night", Kind.EXPENSE, "40.00", "qr")
    api.post("/api/auth/logout/")
    make_person("mira", (norte, Role.VIEWER, True))
    log_in(api, "mira")

    body = api.get("/api/notebooks/cash/", JAN | {"kind": "expense"}).json()  # list filters do not apply

    assert body["opening"]["amount"] == "1000.50"
    assert body["opening"]["updated_by"] == "duena"
    assert [(c["shift"], c["after"]) for c in body["closes"]] == [
        ("morning", "1100.50"),
        ("night", "1100.50"),
    ]
    assert body["closes"][1]["expenses_cash"] == "0.00"
    assert body["haber_at_end"] == "1100.50"


def test_opening_cannot_be_negative(api, owner):
    log_in(api, "duena")

    response = api.put(
        "/api/notebooks/cash/opening/",
        {"date": "2026-01-01", "shift": "night", "amount": "-1"},
        format="json",
    )

    assert response.status_code == 400


def test_period_shows_its_closes_but_the_haber_comes_from_the_opening(as_role, owner, add):
    opening(owner, amount="100.00")
    add(2, "morning", Kind.INCOME, "10.00")
    add(20, "morning", Kind.INCOME, "1.00")
    api = as_role(Role.VIEWER)

    body = api.get("/api/notebooks/cash/", {"from": "2026-01-15", "to": "2026-01-31"}).json()
    before_any = api.get("/api/notebooks/cash/", {"from": "2025-12-01", "to": "2025-12-31"}).json()

    assert [(c["date"], c["before"], c["after"]) for c in body["closes"]] == [
        ("2026-01-20", "110.00", "111.00")
    ]
    assert body["haber_at_end"] == "111.00"
    assert before_any["closes"] == []
    assert before_any["haber_at_end"] is None


def test_an_entry_needs_a_shift(as_role, categories):
    api = as_role(Role.EDITOR)
    body = {
        "date": "2026-01-02",
        "kind": "income",
        "category_id": str(categories["Local Norte", Kind.INCOME].id),
        "amount": "10.00",
        "payment_method": "cash",
    }

    response = api.post("/api/notebooks/entries/", body, format="json")

    assert response.status_code == 400
    assert "shift" in response.json()


def test_excel_has_a_cash_sheet_when_there_is_an_opening(as_role, owner, add):
    api = as_role(Role.VIEWER)
    without = load_workbook(BytesIO(api.get("/api/notebooks/export/", JAN).content))
    opening(owner, amount="100.00")
    add(2, "morning", Kind.INCOME, "10.00", "qr")
    add(2, "morning", Kind.INCOME, "5.00")

    book = load_workbook(BytesIO(api.get("/api/notebooks/export/", JAN).content))

    assert "Caja" not in without.sheetnames
    sheet = book["Caja"]
    assert next(sheet.iter_rows(max_row=1, values_only=True)) == tuple(CASH_HEADERS)
    [row] = list(sheet.iter_rows(min_row=2, values_only=True))
    assert row[1] == "Mañana"
    assert row[2:] == (100, 15, 10, 0, 105)
