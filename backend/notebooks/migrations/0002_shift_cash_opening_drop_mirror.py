import django.db.models.deletion
from decimal import Decimal

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Cash box by shift (P-01, P-02).

    - Every entry gets a shift. Entries loaded before this change had none: they become "morning".
      Only demo data exists at this point (no production yet).
    - The mirror link goes away: the haber is calculated from the payment method (ADR-0008).
    """

    dependencies = [
        ("core", "0003_audit_entry_append_only"),
        ("notebooks", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="entry",
            name="shift",
            field=models.CharField(
                choices=[("morning", "Mañana"), ("night", "Noche")],
                default="morning",
                max_length=10,
                verbose_name="turno",
            ),
            preserve_default=False,
        ),
        migrations.RemoveField(model_name="entry", name="mirror_of"),
        migrations.CreateModel(
            name="CashOpening",
            fields=[
                (
                    "tenant",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        primary_key=True,
                        related_name="cash_opening",
                        serialize=False,
                        to="core.tenant",
                        verbose_name="local",
                    ),
                ),
                ("date", models.DateField(verbose_name="fecha")),
                (
                    "shift",
                    models.CharField(
                        choices=[("morning", "Mañana"), ("night", "Noche")], max_length=10, verbose_name="turno"
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14, verbose_name="haber")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="cargado por",
                    ),
                ),
            ],
            options={
                "verbose_name": "haber inicial",
                "verbose_name_plural": "haberes iniciales",
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("amount__gte", Decimal("0"))), name="cash_opening_not_negative"
                    )
                ],
            },
        ),
    ]
