# The admin page "cuadernos por local" (ADR-0015). A proxy of the shops: no table, no SQL.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_audit_entry_append_only"),
        ("notebooks", "0006_sale_methods_ticked_by_default"),
    ]

    operations = [
        migrations.CreateModel(
            name="ShopNotebooks",
            fields=[],
            options={
                "verbose_name": "cuadernos de un local",
                "verbose_name_plural": "cuadernos por local",
                "proxy": True,
                "indexes": [],
                "constraints": [],
            },
            bases=("core.tenant",),
        ),
    ]
