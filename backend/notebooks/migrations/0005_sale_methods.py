# Transfer costs add their sale too, and the owner picks the methods per shop (ADR-0013).
# The link is renamed, not dropped and added: a drop would lose which cost each sale comes from.

import django.contrib.postgres.fields
import django.db.models.deletion
import notebooks.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_audit_entry_append_only"),
        ("notebooks", "0004_debit_sales_history"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RenameField(model_name="entry", old_name="from_debit_expense", new_name="from_expense"),
        migrations.AlterField(
            model_name="entry",
            name="from_expense",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="linked_sales",
                to="notebooks.entry",
                verbose_name="gasto del que sale esta venta",
            ),
        ),
        migrations.CreateModel(
            name="ShopSettings",
            fields=[
                (
                    "tenant",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        primary_key=True,
                        related_name="notebook_settings",
                        serialize=False,
                        to="core.tenant",
                        verbose_name="local",
                    ),
                ),
                (
                    "sale_methods",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(
                            choices=[
                                ("debit", "Débito"),
                                ("credit", "Crédito"),
                                ("qr", "QR / Mercado Pago"),
                                ("transfer", "Transferencia"),
                            ],
                            max_length=10,
                        ),
                        blank=True,
                        default=notebooks.models.default_sale_methods,
                        size=None,
                        verbose_name="medios que suman venta",
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="cambiado por",
                    ),
                ),
            ],
            options={
                "verbose_name": "ajustes del local",
                "verbose_name_plural": "ajustes de los locales",
            },
        ),
    ]
