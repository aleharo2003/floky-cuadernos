import uuid

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
