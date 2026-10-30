import uuid

from django.conf import settings
from django.db import models

from core.models import Tenant


class Role(models.TextChoices):
    OWNER = "owner", "Dueño"
    EDITOR = "editor", "Carga"
    VIEWER = "viewer", "Consulta"


class Perm(models.TextChoices):
    """What a person can do inside one shop. Code checks these, never role names (ADR-0003)."""

    VIEW = "notebooks.view", "Ver movimientos, historial y reportes"
    EXPORT = "notebooks.export", "Exportar reportes"
    ADD_ENTRY = "notebooks.add_entry", "Cargar movimientos"
    CHANGE_ENTRY = "notebooks.change_entry", "Corregir movimientos"
    VOID_ENTRY = "notebooks.void_entry", "Anular movimientos"
    MANAGE_CATEGORIES = "notebooks.manage_categories", "Administrar categorías"


_VIEWER = frozenset({Perm.VIEW, Perm.EXPORT})
_EDITOR = _VIEWER | {Perm.ADD_ENTRY, Perm.CHANGE_ENTRY, Perm.VOID_ENTRY}
_OWNER = _EDITOR | {Perm.MANAGE_CATEGORIES}

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    Role.VIEWER: _VIEWER,
    Role.EDITOR: frozenset(_EDITOR),
    Role.OWNER: frozenset(_OWNER),
}


class Membership(models.Model):
    """A person, a shop and a role. The only door into a shop (ADR-0003)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="memberships", verbose_name="persona"
    )
    tenant = models.ForeignKey(
        Tenant, on_delete=models.PROTECT, related_name="memberships", verbose_name="local"
    )
    role = models.CharField("rol", max_length=16, choices=Role.choices)
    is_active = models.BooleanField("activa", default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "membresía"
        verbose_name_plural = "membresías"
        constraints = [
            models.UniqueConstraint(fields=["user", "tenant"], name="one_membership_per_user_and_tenant")
        ]
        indexes = [models.Index(fields=["user", "is_active"])]

    def __str__(self) -> str:
        return f"{self.user} · {self.tenant} · {self.get_role_display()}"

    @property
    def permissions(self) -> frozenset[str]:
        return ROLE_PERMISSIONS.get(self.role, frozenset())

    def can(self, perm: str) -> bool:
        return perm in self.permissions
