# Only the label changes: the list now says which methods come ticked (ADR-0014). No SQL.

import django.contrib.postgres.fields
import notebooks.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notebooks", "0005_sale_methods"),
    ]

    operations = [
        migrations.AlterField(
            model_name="shopsettings",
            name="sale_methods",
            field=django.contrib.postgres.fields.ArrayField(
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
                verbose_name="medios que vienen marcados para sumar venta",
            ),
        ),
    ]
