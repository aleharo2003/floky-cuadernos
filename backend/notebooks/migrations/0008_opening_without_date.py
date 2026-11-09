# The opening haber has no date or shift any more (ADR-0017). Nullable for one version; dropped later.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notebooks", "0007_shop_notebooks_admin"),
    ]

    operations = [
        migrations.AlterField(
            model_name="cashopening",
            name="date",
            field=models.DateField(
                blank=True, null=True, verbose_name="fecha (ya no se usa)"
            ),
        ),
        migrations.AlterField(
            model_name="cashopening",
            name="shift",
            field=models.CharField(
                blank=True,
                choices=[("morning", "Mañana"), ("night", "Noche")],
                max_length=10,
                null=True,
                verbose_name="turno (ya no se usa)",
            ),
        ),
    ]
