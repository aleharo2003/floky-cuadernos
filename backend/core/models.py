import uuid

from django.conf import settings
from django.db import models


class Tenant(models.Model):
    """A shop. Every business row in the system belongs to one (ADR-0003)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField("nombre", max_length=120)
    timezone = models.CharField("zona horaria", max_length=64, default="America/Argentina/Buenos_Aires")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "local"
        verbose_name_plural = "locales"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class AuditEntry(models.Model):
    """Append only record of important changes, written in the same transaction (HU-014).

    The database rejects UPDATE and DELETE on this table (trigger in migration 0003),
    so not even a bug in the code can rewrite history.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT, related_name="audit_entries")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.PROTECT,
        related_name="audit_entries",
        verbose_name="persona",
    )
    action = models.CharField("acción", max_length=40)
    entity = models.CharField("entidad", max_length=40)
    entity_id = models.UUIDField("id de la entidad")
    before = models.JSONField("antes", null=True, blank=True)
    after = models.JSONField("después", null=True, blank=True)
    reason = models.CharField("motivo", max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "registro de auditoría"
        verbose_name_plural = "registros de auditoría"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "-created_at"]),
            models.Index(fields=["tenant", "entity", "entity_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.created_at:%d/%m/%Y %H:%M} {self.action} {self.entity}"


def record(
    *,
    tenant: Tenant,
    actor,
    action: str,
    entity: str,
    entity_id,
    before: dict | None = None,
    after: dict | None = None,
    reason: str = "",
) -> AuditEntry:
    """Write one audit row. Call it inside the same transaction as the change."""
    return AuditEntry.objects.create(
        tenant=tenant,
        actor=actor,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before=before,
        after=after,
        reason=reason,
    )
