import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from core.models import Tenant


class Kind(models.TextChoices):
    INCOME = "income", "Ingreso"
    EXPENSE = "expense", "Gasto"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Efectivo"
    DEBIT = "debit", "Débito"
    CREDIT = "credit", "Crédito"
    QR = "qr", "QR / Mercado Pago"
    TRANSFER = "transfer", "Transferencia"


class Shift(models.TextChoices):
    """The shop closes the cash box twice a day (P-01). A night shift that ends after midnight
    keeps the date it started on."""

    MORNING = "morning", "Mañana"
    NIGHT = "night", "Noche"


SHIFT_ORDER = {Shift.MORNING: 0, Shift.NIGHT: 1}


class Category(models.Model):
    """Each shop has its own categories (ADR-0003). One with entries is deactivated, never deleted."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.PROTECT, related_name="categories", verbose_name="local"
    )
    name = models.CharField("nombre", max_length=60)
    kind = models.CharField("tipo", max_length=10, choices=Kind.choices)
    is_active = models.BooleanField("activa", default=True)
    is_system = models.BooleanField("del sistema", default=False)

    class Meta:
        verbose_name = "categoría"
        verbose_name_plural = "categorías"
        ordering = ["kind", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "kind", "name"], name="unique_category_name_per_tenant_and_kind"
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_kind_display()})"


class Entry(models.Model):
    """One line of the notebook. Nothing is deleted: it is corrected or voided with a reason."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT, related_name="entries", verbose_name="local")
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="entries", verbose_name="categoría"
    )
    kind = models.CharField("tipo", max_length=10, choices=Kind.choices)
    date = models.DateField("fecha")
    description = models.CharField("descripción", max_length=120, blank=True)
    amount = models.DecimalField("importe", max_digits=14, decimal_places=2)
    payment_method = models.CharField("medio de pago", max_length=10, choices=PaymentMethod.choices)
    shift = models.CharField("turno", max_length=10, choices=Shift.choices)

    is_voided = models.BooleanField("anulado", default=False)
    void_reason = models.CharField("motivo de anulación", max_length=200, blank=True)

    # The sale that a cost paid with debit adds to the shift, as the owner does on paper (ADR-0010).
    # It lives on the sale and points to its cost. It is changed and voided only through the cost.
    from_debit_expense = models.OneToOneField(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="debit_sale",
        verbose_name="venta del gasto con débito",
    )

    idempotency_key = models.UUIDField(null=True, blank=True, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", verbose_name="cargado por"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "movimiento"
        verbose_name_plural = "movimientos"
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["tenant", "date"])]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=Decimal("0")), name="entry_amount_positive"),
            models.UniqueConstraint(
                fields=["tenant", "idempotency_key"], name="unique_idempotency_key_per_tenant"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.date} {self.get_kind_display()} {self.amount}"

    def snapshot(self) -> dict:
        """What the audit stores as before and after. Plain values, so the history can be read later."""
        return {
            "date": self.date.isoformat(),
            "kind": self.kind,
            "category": self.category.name,
            "description": self.description,
            "amount": str(self.amount),
            "payment_method": self.payment_method,
            "shift": self.shift,
            "is_voided": self.is_voided,
        }


class CashOpening(models.Model):
    """The cash on hand when the shop starts using the system: the last haber written on paper (P-01).

    Only entries after that shift count for the cash box. One per shop; changing it is audited.
    """

    tenant = models.OneToOneField(
        Tenant, on_delete=models.PROTECT, primary_key=True, related_name="cash_opening", verbose_name="local"
    )
    date = models.DateField("fecha")
    shift = models.CharField("turno", max_length=10, choices=Shift.choices)
    amount = models.DecimalField("haber", max_digits=14, decimal_places=2)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", verbose_name="cargado por"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "haber inicial"
        verbose_name_plural = "haberes iniciales"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=Decimal("0")), name="cash_opening_not_negative"
            )
        ]

    def __str__(self) -> str:
        return f"{self.tenant} {self.date} {self.get_shift_display()} {self.amount}"

    def snapshot(self) -> dict:
        return {"date": self.date.isoformat(), "shift": self.shift, "amount": str(self.amount)}
