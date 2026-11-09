"""Rules for loading, correcting and voiding entries.

Every change runs in one transaction together with its audit row (CONTRIBUTING, money rules).
Views only translate HTTP; the rules live here so they can be tested without HTTP.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction

from accounts.models import Membership
from core.models import Tenant, record
from notebooks.models import (
    SALE_METHOD_CHOICES,
    CashOpening,
    Category,
    Entry,
    Kind,
    PaymentMethod,
    ShopSettings,
)


class RuleError(ValueError):
    """A business rule said no. The message is shown to the person as is."""


@dataclass(frozen=True)
class EntryData:
    date: date
    kind: str
    category_id: uuid.UUID
    description: str
    amount: Decimal
    payment_method: str
    shift: str


def _category_for(membership: Membership, data: EntryData) -> Category:
    category = Category.objects.filter(id=data.category_id, tenant=membership.tenant, is_active=True).first()
    if category is None:
        raise RuleError("Elegí una categoría de este local.")
    if category.kind != data.kind:
        raise RuleError("La categoría no corresponde al tipo de movimiento.")
    if category.is_system:
        raise RuleError("Esa categoría la usa el sistema y no se puede elegir.")
    return category


def _reason(text: str) -> str:
    text = (text or "").strip()
    if not text:
        raise RuleError("Escribí el motivo.")
    return text


# How a sale names the method of its cost: "Gasto con débito: Proveedores".
_PAID_WITH = {
    PaymentMethod.DEBIT: "con débito",
    PaymentMethod.CREDIT: "con crédito",
    PaymentMethod.QR: "con Mercado Pago",
    PaymentMethod.TRANSFER: "por transferencia",
}


def paid_with(method: str) -> str:
    return _PAID_WITH.get(method, "")


def _sale_category(membership: Membership) -> Category:
    """Where the sale of a cost goes: the income category "Ventas", or the first income one."""
    incomes = Category.objects.filter(
        tenant=membership.tenant, kind=Kind.INCOME, is_active=True, is_system=False
    )
    category = incomes.filter(name__iexact="Ventas").first() or incomes.order_by("name").first()
    if category is None:
        raise RuleError("Para sumarlo a la venta hace falta una categoría de ingreso.")
    return category


def _sale_description(expense: Entry) -> str:
    text = f"Gasto {paid_with(expense.payment_method)}: {expense.category.name}"
    if expense.description:
        text += f" ({expense.description})"
    return text[:120]


def _can_add_sale(kind: str, method: str) -> bool:
    """Any cost not paid in cash can add its sale (ADR-0014). Cash cannot: both would move the box."""
    return kind == Kind.EXPENSE and method != PaymentMethod.CASH


def _check_add_sale(data: "EntryData") -> None:
    if not _can_add_sale(data.kind, data.payment_method):
        raise RuleError("Solo un gasto que no sea en efectivo se puede sumar a la venta.")


def _create_sale(membership: Membership, expense: Entry) -> Entry:
    sale = Entry.objects.create(
        tenant=membership.tenant,
        category=_sale_category(membership),
        kind=Kind.INCOME,
        date=expense.date,
        description=_sale_description(expense),
        amount=expense.amount,
        payment_method=expense.payment_method,
        shift=expense.shift,
        from_expense=expense,
        created_by=membership.user,
    )
    record(
        tenant=membership.tenant,
        actor=membership.user,
        action="entry.create",
        entity="entry",
        entity_id=sale.id,
        after=sale.snapshot(),
        reason=f"Venta del gasto {paid_with(expense.payment_method)}",
    )
    return sale


def create_entry(
    membership: Membership,
    data: EntryData,
    idempotency_key: uuid.UUID | None = None,
    add_sale: bool = False,
) -> Entry:
    """Load an entry. The same idempotency key returns the first entry instead of a duplicate (HU-021).

    add_sale: a cost not paid in cash also adds a sale with that method for the same amount, as on
    paper (ADR-0010, ADR-0014). Both are created in the same transaction.
    """
    if idempotency_key:
        existing = Entry.objects.filter(tenant=membership.tenant, idempotency_key=idempotency_key).first()
        if existing:
            return existing
    category = _category_for(membership, data)
    if add_sale:
        _check_add_sale(data)
    try:
        with transaction.atomic():
            entry = Entry.objects.create(
                tenant=membership.tenant,
                category=category,
                kind=data.kind,
                date=data.date,
                description=data.description.strip(),
                amount=data.amount,
                payment_method=data.payment_method,
                shift=data.shift,
                idempotency_key=idempotency_key,
                created_by=membership.user,
            )
            record(
                tenant=membership.tenant,
                actor=membership.user,
                action="entry.create",
                entity="entry",
                entity_id=entry.id,
                after=entry.snapshot(),
            )
            if add_sale:
                _create_sale(membership, entry)
    except IntegrityError:
        # Two identical requests at the same time: the other one won, return it.
        if idempotency_key:
            return Entry.objects.get(tenant=membership.tenant, idempotency_key=idempotency_key)
        raise
    return entry


def _locked(membership: Membership, entry_id) -> Entry:
    entry = (
        Entry.objects.select_for_update()
        .select_related("category")
        .filter(tenant=membership.tenant, id=entry_id)
        .first()
    )
    if entry is None:
        raise Entry.DoesNotExist
    if entry.is_voided:
        raise RuleError("El movimiento está anulado: no se puede cambiar.")
    return entry


def _not_a_linked_sale(entry: Entry) -> None:
    if entry.from_expense_id:
        raise RuleError("Esta venta sale de un gasto: corregí o anulá el gasto.")


def _linked_sale(entry: Entry) -> Entry | None:
    """The sale of a cost, locked, if it is still standing."""
    return Entry.objects.select_for_update().filter(from_expense=entry, is_voided=False).first()


def _void(membership: Membership, entry: Entry, reason: str) -> None:
    before = entry.snapshot()
    entry.is_voided = True
    entry.void_reason = reason[:200]
    entry.save(update_fields=["is_voided", "void_reason", "updated_at"])
    record(
        tenant=membership.tenant,
        actor=membership.user,
        action="entry.void",
        entity="entry",
        entity_id=entry.id,
        before=before,
        after=entry.snapshot(),
        reason=entry.void_reason,
    )


def correct_entry(
    membership: Membership, entry_id, data: EntryData, reason: str, add_sale: bool = False
) -> Entry:
    """Correct an entry. If it is a cost with its sale, the sale follows in the same transaction.

    add_sale: a cost that has no standing sale gets one, as when it is loaded (ADR-0012).
    It covers the round trip: debit to cash voids the sale, and back to debit brings a new one.

    The sale is voided only when the cost stops being a cost or moves to cash (ADR-0014). Between
    other methods (debit to transfer) the sale follows and changes its method.
    """
    reason = _reason(reason)
    category = _category_for(membership, data)
    if add_sale:
        _check_add_sale(data)
    with transaction.atomic():
        entry = _locked(membership, entry_id)
        _not_a_linked_sale(entry)
        before = entry.snapshot()
        entry.category = category
        entry.kind = data.kind
        entry.date = data.date
        entry.description = data.description.strip()
        entry.amount = data.amount
        entry.payment_method = data.payment_method
        entry.shift = data.shift
        sale = _linked_sale(entry)
        if entry.snapshot() == before and not (add_sale and sale is None):
            raise RuleError("No cambiaste nada.")
        if entry.snapshot() != before:
            entry.save()
            record(
                tenant=membership.tenant,
                actor=membership.user,
                action="entry.correct",
                entity="entry",
                entity_id=entry.id,
                before=before,
                after=entry.snapshot(),
                reason=reason,
            )
        if sale and not _can_add_sale(entry.kind, entry.payment_method):
            # Now it is cash (or not a cost): the sale has no reason to be there.
            _void(membership, sale, f"El gasto ya no suma venta. {reason}"[:200])
        elif sale:
            sale_before = sale.snapshot()
            sale.date, sale.shift, sale.amount = entry.date, entry.shift, entry.amount
            sale.payment_method = entry.payment_method
            sale.description = _sale_description(entry)
            if sale.snapshot() != sale_before:
                sale.save()
                record(
                    tenant=membership.tenant,
                    actor=membership.user,
                    action="entry.correct",
                    entity="entry",
                    entity_id=sale.id,
                    before=sale_before,
                    after=sale.snapshot(),
                    reason=f"Acompaña la corrección de su gasto. {reason}"[:200],
                )
        elif add_sale:
            _create_sale(membership, entry)
    return entry


def void_entry(membership: Membership, entry_id, reason: str) -> Entry:
    """Void an entry. A cost takes its sale with it."""
    reason = _reason(reason)
    with transaction.atomic():
        entry = _locked(membership, entry_id)
        _not_a_linked_sale(entry)
        _void(membership, entry, reason)
        sale = _linked_sale(entry)
        if sale:
            _void(membership, sale, f"Se anuló su gasto. {reason}"[:200])
    return entry


def create_category(membership: Membership, name: str, kind: str) -> tuple[Category, bool]:
    """Owner adds a category from the form (HU-022). Returns (category, created).

    Names are compared without caring about upper or lower case, so "ventas" and "Ventas" are the same.
    A deactivated one with the same name comes back instead of creating a twin.
    """
    if kind not in Kind.values:
        raise RuleError("Elegí si es de ingreso o de gasto.")
    name = " ".join((name or "").split())
    if not name:
        raise RuleError("Escribí el nombre de la categoría.")
    if len(name) > 60:
        raise RuleError("El nombre puede tener hasta 60 letras.")
    with transaction.atomic():
        existing = (
            Category.objects.select_for_update()
            .filter(tenant=membership.tenant, kind=kind, name__iexact=name)
            .first()
        )
        if existing and existing.is_active:
            raise RuleError(f"Ya existe la categoría {existing.name}.")
        if existing:
            existing.is_active = True
            existing.save(update_fields=["is_active"])
            category, created, action = existing, False, "category.reactivate"
        else:
            category = Category.objects.create(tenant=membership.tenant, kind=kind, name=name)
            created, action = True, "category.create"
        record(
            tenant=membership.tenant,
            actor=membership.user,
            action=action,
            entity="category",
            entity_id=category.id,
            after={"name": category.name, "kind": category.kind, "is_active": True},
        )
    return category, created


def set_sale_methods(membership: Membership, methods: list[str]) -> list[str]:
    """The owner picks which payment methods come with the sale already ticked (ADR-0013, ADR-0014).

    It only changes what the form proposes: any cost not in cash can still add its sale. Audited.
    """
    allowed = [value for value, _ in SALE_METHOD_CHOICES]
    if any(m not in allowed for m in methods):
        raise RuleError("Elegí medios de pago que no sean efectivo.")
    chosen = [m for m in allowed if m in set(methods)]  # always in the same order, no repeats
    with transaction.atomic():
        row, _ = ShopSettings.objects.select_for_update().get_or_create(tenant=membership.tenant)
        before = list(row.sale_methods)
        if before == chosen:
            return chosen
        row.sale_methods = chosen
        row.updated_by = membership.user
        row.save()
        record(
            tenant=membership.tenant,
            actor=membership.user,
            action="settings.change",
            entity="settings",
            entity_id=membership.tenant_id,
            before={"sale_methods": before},
            after={"sale_methods": chosen},
        )
    return chosen


def empty_notebooks(tenant: Tenant, actor, reason: str) -> dict:
    """Delete every entry and the opening haber of one shop, to start from zero (ADR-0015).

    Categories, people, memberships and settings stay. The audit is not deleted (the database does
    not allow it): one more row records who emptied the notebooks, when, why and how much there was.
    Recent changes start again from that row.
    """
    reason = _reason(reason)
    with transaction.atomic():
        entries = Entry.objects.filter(tenant=tenant)
        counts = {
            "entries": entries.filter(is_voided=False).count(),
            "voided": entries.filter(is_voided=True).count(),
        }
        opening = CashOpening.objects.filter(tenant=tenant).first()
        before = dict(counts)
        if opening:
            before["cash_opening"] = opening.snapshot()
        # The sales first: they point to their cost, and that link does not let the cost go first.
        entries.exclude(from_expense=None).delete()
        entries.delete()
        if opening:
            opening.delete()
        record(
            tenant=tenant,
            actor=actor,
            action="notebooks.empty",
            entity="shop",
            entity_id=tenant.id,
            before=before,
            after={"entries": 0, "voided": 0},
            reason=reason[:200],
        )
    return {**counts, "cash_opening": opening is not None}
