# A shop can be marked as a test shop, to receive a copy of a real one (ADR-0017).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_audit_entry_append_only"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="is_test",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Solo para el equipo. Se le pueden copiar los cuadernos de otro local,"
                    " y eso borra lo que tenga."
                ),
                verbose_name="local de pruebas",
            ),
        ),
    ]
