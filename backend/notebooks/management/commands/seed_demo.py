"""Made up data for local development and the test environment. Never real data (the repo is public)."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Membership, Role
from core.models import Tenant
from notebooks.cash import set_opening
from notebooks.models import Category, Kind, Shift
from notebooks.services import EntryData, create_entry

PASSWORD = "clave-de-prueba-123"  # noqa: S105 - demo data, documented in the README

CATEGORIES = {
    Kind.INCOME: ["Ventas", "Otros ingresos"],
    Kind.EXPENSE: ["Proveedores", "Sueldos y adelantos", "Alquiler", "Servicios", "Varios"],
}


class Command(BaseCommand):
    help = "Two made up shops, people with each role and some entries. Refuses to run if shops exist."

    def add_arguments(self, parser):
        # The browser tests pin "today" so their numbers do not depend on the day of the month.
        parser.add_argument("--today", type=date.fromisoformat, help="Use this date as today (YYYY-MM-DD).")

    @transaction.atomic
    def handle(self, *args, **options):
        if Tenant.objects.exists():
            raise CommandError("There are shops already. The seed only runs on an empty database.")
        centro = Tenant.objects.create(name="Local Centro")
        norte = Tenant.objects.create(name="Local Norte")
        for tenant in (centro, norte):
            for kind, names in CATEGORIES.items():
                for name in names:
                    Category.objects.create(tenant=tenant, kind=kind, name=name)

        user_model = get_user_model()

        def person(username: str, first_name: str, *memberships):
            user = user_model.objects.create_user(username=username, password=PASSWORD, first_name=first_name)
            for tenant, role in memberships:
                Membership.objects.create(user=user, tenant=tenant, role=role)
            return user

        person("lucia", "Lucía", (centro, Role.OWNER), (norte, Role.OWNER))
        person("tomas", "Tomás", (norte, Role.EDITOR))
        person("ana", "Ana", (centro, Role.VIEWER))
        user_model.objects.create_superuser(username="admin", password=PASSWORD)

        lucia_norte = Membership.objects.get(user__username="lucia", tenant=norte)
        today = options.get("today") or date.today()
        samples = [
            (0, Shift.NIGHT, Kind.INCOME, "Ventas", "Ventas de la noche", "320000", "cash"),
            (0, Shift.MORNING, Kind.EXPENSE, "Proveedores", "Verdura", "45000", "cash"),
            (1, Shift.NIGHT, Kind.INCOME, "Ventas", "Ventas de la noche", "280000", "cash"),
            (1, Shift.MORNING, Kind.EXPENSE, "Servicios", "Luz", "95000", "debit"),
            (2, Shift.MORNING, Kind.EXPENSE, "Sueldos y adelantos", "Adelanto", "60000", "cash"),
        ]
        # Every sample stays inside the current month, so "Este mes" shows them all on any date.
        first_of_month = today.replace(day=1)

        def day_for(days_ago: int) -> date:
            return max(today - timedelta(days=days_ago), first_of_month)

        # The cash the shop starts with (P-01, ADR-0017).
        set_opening(lucia_norte, amount=Decimal("500000"), reason="")
        for days_ago, shift, kind, category, description, amount, method in samples:
            create_entry(
                lucia_norte,
                EntryData(
                    date=day_for(days_ago),
                    kind=kind,
                    category_id=Category.objects.get(tenant=norte, kind=kind, name=category).id,
                    description=description,
                    amount=Decimal(amount),
                    payment_method=method,
                    shift=shift,
                ),
            )
        self.stdout.write(
            self.style.SUCCESS(f"Seed ready. Users lucia, tomas, ana and admin, password {PASSWORD}")
        )
