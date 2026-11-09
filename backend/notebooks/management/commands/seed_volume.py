"""Load a lot of made up entries to measure speed (review of 05/11/2026).

Default: 3 years of a busy shop, 60 entries a day (about 65.000). Only for a test database: it
refuses to run when DEBUG is off, so it never touches production by mistake.
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Membership, Role
from core.models import Tenant
from notebooks.cash import set_opening
from notebooks.models import Category, Entry, Kind, PaymentMethod, Shift

INCOME = ["Ventas"]
EXPENSES = ["Proveedores", "Verdulería", "Carnicería", "Servicios", "Sueldos y adelantos", "Varios"]


class Command(BaseCommand):
    help = "A shop with many made up entries, to measure speed. Test databases only."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=3 * 365)
        parser.add_argument("--per-day", type=int, default=60)
        parser.add_argument("--today", type=date.fromisoformat, default=None)
        parser.add_argument("--user", default="lucia", help="Owner of the new shop, so it can be opened.")

    @transaction.atomic
    def handle(self, *args, days, per_day, today, user, **options):
        if not settings.DEBUG:
            raise CommandError("Solo con DJANGO_DEBUG=1: es para una base de pruebas.")
        owner = get_user_model().objects.filter(username=user).first()
        if owner is None:
            raise CommandError(f"No existe el usuario {user}. Corré antes seed_demo.")
        today = today or date.today()
        shop = Tenant.objects.create(name=f"Local Volumen {Tenant.objects.count() + 1}")
        membership = Membership.objects.create(user=owner, tenant=shop, role=Role.OWNER)
        categories = {
            kind: [Category.objects.create(tenant=shop, kind=kind, name=n) for n in names]
            for kind, names in ((Kind.INCOME, INCOME), (Kind.EXPENSE, EXPENSES))
        }
        start = today - timedelta(days=days - 1)
        set_opening(membership, amount=Decimal("500000"), reason="")

        rng = random.Random(2026)  # noqa: S311 - made up data, the same every time; not security
        methods = [PaymentMethod.CASH] * 6 + [PaymentMethod.DEBIT, PaymentMethod.QR, PaymentMethod.TRANSFER]
        batch: list[Entry] = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            for n in range(per_day):
                kind = Kind.INCOME if n % 3 == 0 else Kind.EXPENSE
                batch.append(
                    Entry(
                        tenant=shop,
                        category=rng.choice(categories[kind]),
                        kind=kind,
                        date=day,
                        description=f"Renglón {n + 1}",
                        amount=Decimal(rng.randrange(1_000, 300_000)),
                        payment_method=rng.choice(methods),
                        shift=Shift.MORNING if n < per_day // 2 else Shift.NIGHT,
                        created_by=owner,
                    )
                )
            if len(batch) >= 5_000:
                Entry.objects.bulk_create(batch)
                batch.clear()
        Entry.objects.bulk_create(batch)
        total = days * per_day
        self.stdout.write(self.style.SUCCESS(f"{shop.name}: {total} movimientos, dueño {user}."))
