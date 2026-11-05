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
from core.models import record
from notebooks.models import Category, Entry, Kind, PaymentMethod


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


def _sale_category(membership: Membership) -> Category:
    """Where the sale of a debit cost goes: the income category "Ventas", or the first income one."""
    incomes = Category.objects.filter(
        tenant=membership.tenant, kind=Kind.INCOME, is_active=True, is_system=False
    )
    category = incomes.filter(name__iexact="Ventas").first() or incomes.order_by("name").first()
    if category is None:
        raise RuleError("Para sumarlo a la venta hace falta una categoría de ingreso.")
    return category


def _sale_description(expense: Entry) -> str:
    text = f"Gasto con débito: {expense.category.name}"
    if expense.description:
        text += f" ({expense.description})"
    return text[:120]


def _is_debit_expense(entry: Entry) -> bool:
    return entry.kind == Kind.EXPENSE and entry.payment_method == PaymentMethod.DEBIT


def _create_debit_sale(membership: Membership, expense: Entry) -> Entry:
    sale = Entry.objects.create(
        tenant=membership.tenant,
        category=_sale_category(membership),
        kind=Kind.INCOME,
        date=expense.date,
        description=_sale_description(expense),
        amount=expense.amount,
        payment_method=PaymentMethod.DEBIT,
        shift=expense.shift,
        from_debit_expense=expense,
        created_by=membership.user,
    )
    record(
        tenant=membership.tenant,
        actor=membership.user,
        action="entry.create",
        entity="entry",
        entity_id=sale.id,
        after=sale.snapshot(),
        reason="Venta del gasto con débito",
    )
    return sale


def create_entry(
    membership: Membership,
    data: EntryData,
    idempotency_key: uuid.UUID | None = None,
    add_sale: bool = False,
) -> Entry:
    """Load an entry. The same idempotency key returns the first entry instead of a duplicate (HU-021).

    add_sale: a cost paid with debit also adds a sale with debit for the same amount, as on paper
    (ADR-0010). Both are created in the same transaction.
    """
    if idempotency_key:
        existing = Entry.objects.filter(tenant=membership.tenant, idempotency_key=idempotency_key).first()
        if existing:
            return existing
    category = _category_for(membership, data)
    if add_sale and not (data.kind == Kind.EXPENSE and data.payment_method == PaymentMethod.DEBIT):
        raise RuleError("Solo un gasto con débito se puede sumar a la venta.")
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
                _create_debit_sale(membership, entry)
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


def _not_a_debit_sale(entry: Entry) -> None:
    if entry.from_debit_expense_id:
        raise RuleError("Esta venta sale de un gasto con débito: corregí o anulá el gasto.")


def _linked_sale(entry: Entry) -> Entry | None:
    """The sale of a debit cost, locked, if it is still standing."""
    return Entry.objects.select_for_update().filter(from_debit_expense=entry, is_voided=False).first()


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
    """Correct an entry. If it is a debit cost with its sale, the sale follows in the same transaction.

    add_sale: a debit cost that has no standing sale gets one, as when it is loaded (ADR-0012).
    It covers the round trip: debit to cash voids the sale, and back to debit brings a new one.
    """
    reason = _reason(reason)
    category = _category_for(membership, data)
    if add_sale and not (data.kind == Kind.EXPENSE and data.payment_method == PaymentMethod.DEBIT):
        raise RuleError("Solo un gasto con débito se puede sumar a la venta.")
    with transaction.atomic():
        entry = _locked(membership, entry_id)
        _not_a_debit_sale(entry)
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
        if sale and not _is_debit_expense(entry):
            # It is no longer a cost paid with debit, so the sale has no reason to be there.
            _void(membership, sale, f"El gasto ya no es con débito. {reason}")
        elif sale:
            sale_before = sale.snapshot()
            sale.date, sale.shift, sale.amount = entry.date, entry.shift, entry.amount
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
                    reason=f"Acompaña la corrección del gasto con débito. {reason}"[:200],
                )
        elif add_sale:
            _create_debit_sale(membership, entry)
    return entry


def void_entry(membership: Membership, entry_id, reason: str) -> Entry:
    """Void an entry. A debit cost takes its sale with it."""
    reason = _reason(reason)
    with transaction.atomic():
        entry = _locked(membership, entry_id)
        _not_a_debit_sale(entry)
        _void(membership, entry, reason)
        sale = _linked_sale(entry)
        if sale:
            _void(membership, sale, f"Se anuló el gasto con débito. {reason}")
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
