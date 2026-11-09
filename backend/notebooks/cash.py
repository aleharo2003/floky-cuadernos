"""The cash box (haber) by shift (P-01, P-02, ADR-0008).

The haber is the cash on hand when a shift closes:

    haber = previous haber + sales paid in cash - expenses paid in cash

Sales paid with Mercado Pago, cards or transfers are real sales, but that money is not in the
box. On paper the shop writes every sale and then subtracts those as a "cost" (the mirror rule).
Here nothing extra is written: the payment method says where the money went, and the haber is
calculated. Correcting or voiding an entry fixes the haber by itself.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum

from accounts.models import Membership
from core.models import Tenant, record
from notebooks.models import SHIFT_ORDER, CashOpening, Entry, Kind, PaymentMethod
from notebooks.services import RuleError

ZERO = Decimal("0.00")


@dataclass(frozen=True)
class Close:
    """One shift closing, as the paper notebook shows it."""

    date: date
    shift: str
    sales: Decimal  # every sale, any payment method
    sales_not_cash: Decimal  # Mercado Pago, cards, transfers: sold, but not in the box
    expenses_cash: Decimal  # what left the box
    expenses_not_cash: Decimal  # paid by transfer or card: an expense, but the box did not move
    before: Decimal
    after: Decimal

    @property
    def negative(self) -> bool:
        return self.after < 0


def _key(day: date, shift: str) -> tuple[date, int]:
    return day, SHIFT_ORDER[shift]


def closes(tenant: Tenant, opening: CashOpening, until: date) -> list[Close]:
    """Every shift with entries up to `until`, with the haber carried forward from the opening.

    Every entry counts, whatever its date (ADR-0017): the opening is one amount, not a moment.
    """
    cash = Q(payment_method=PaymentMethod.CASH)
    income, expense = Q(kind=Kind.INCOME), Q(kind=Kind.EXPENSE)
    rows = (
        Entry.objects.filter(tenant=tenant, is_voided=False, date__lte=until)
        .values("date", "shift")
        .annotate(
            sales=Sum("amount", filter=income, default=ZERO),
            sales_cash=Sum("amount", filter=income & cash, default=ZERO),
            expenses_cash=Sum("amount", filter=expense & cash, default=ZERO),
            expenses=Sum("amount", filter=expense, default=ZERO),
        )
    )
    haber = opening.amount
    result = []
    for r in sorted(rows, key=lambda r: _key(r["date"], r["shift"])):
        before = haber
        haber = before + r["sales_cash"] - r["expenses_cash"]
        result.append(
            Close(
                date=r["date"],
                shift=r["shift"],
                sales=r["sales"],
                sales_not_cash=r["sales"] - r["sales_cash"],
                expenses_cash=r["expenses_cash"],
                expenses_not_cash=r["expenses"] - r["expenses_cash"],
                before=before,
                after=haber,
            )
        )
    return result


def set_opening(membership: Membership, *, amount: Decimal, reason: str) -> CashOpening:
    """Load or change the opening haber. Changing it moves every haber after it, so it needs a reason."""
    if amount < 0:
        raise RuleError("El haber inicial no puede ser negativo.")
    with transaction.atomic():
        current = CashOpening.objects.select_for_update().filter(tenant=membership.tenant).first()
        before = current.snapshot() if current else None
        reason = (reason or "").strip()
        if current and not reason:
            raise RuleError("Escribí por qué cambiás el haber inicial.")
        opening, _ = CashOpening.objects.update_or_create(
            tenant=membership.tenant,
            defaults={"date": None, "shift": None, "amount": amount, "updated_by": membership.user},
        )
        if before == opening.snapshot():
            raise RuleError("No cambiaste nada.")
        record(
            tenant=membership.tenant,
            actor=membership.user,
            action="cash_opening.set",
            entity="cash_opening",
            entity_id=membership.tenant.id,
            before=before,
            after=opening.snapshot(),
            reason=reason,
        )
    return opening
