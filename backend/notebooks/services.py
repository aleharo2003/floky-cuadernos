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
from notebooks.models import Category, Entry


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


def create_entry(membership: Membership, data: EntryData, idempotency_key: uuid.UUID | None = None) -> Entry:
    """Load an entry. The same idempotency key returns the first entry instead of a duplicate (HU-021)."""
    if idempotency_key:
        existing = Entry.objects.filter(tenant=membership.tenant, idempotency_key=idempotency_key).first()
        if existing:
            return existing
    category = _category_for(membership, data)
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
    if entry.mirror_of_id:
        raise RuleError("Este movimiento lo creó el sistema y sigue a su gasto: corregí el gasto.")
    return entry


def correct_entry(membership: Membership, entry_id, data: EntryData, reason: str) -> Entry:
    reason = _reason(reason)
    category = _category_for(membership, data)
    with transaction.atomic():
        entry = _locked(membership, entry_id)
        before = entry.snapshot()
        entry.category = category
        entry.kind = data.kind
        entry.date = data.date
        entry.description = data.description.strip()
        entry.amount = data.amount
        entry.payment_method = data.payment_method
        if entry.snapshot() == before:
            raise RuleError("No cambiaste nada.")
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
    return entry


def void_entry(membership: Membership, entry_id, reason: str) -> Entry:
    reason = _reason(reason)
    with transaction.atomic():
        entry = _locked(membership, entry_id)
        before = entry.snapshot()
        entry.is_voided = True
        entry.void_reason = reason
        entry.save(update_fields=["is_voided", "void_reason", "updated_at"])
        record(
            tenant=membership.tenant,
            actor=membership.user,
            action="entry.void",
            entity="entry",
            entity_id=entry.id,
            before=before,
            after=entry.snapshot(),
            reason=reason,
        )
    return entry
