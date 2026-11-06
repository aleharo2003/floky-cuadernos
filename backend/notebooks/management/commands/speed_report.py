"""How long the heavy screens take on the "Local Volumen" shop (see seed_volume).

Run it before a release that touches lists, totals or the Excel, and compare with the last time.
Reference on a laptop, 65.700 entries (05/11/2026): a year of entries 0,03 s, summary 0,02 s,
cash 0,05 s, Excel 3,5 s. Suggestions (06/11/2026): 0,025 s with the seed's 60 different texts;
0,12 to 0,28 s in the worst case, every entry with its own text.
"""

import time
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.test import Client
from django.test.utils import override_settings

from accounts.models import Membership, Role
from notebooks.models import Entry

URLS = {
    "lista": "/api/notebooks/entries/",
    "resumen": "/api/notebooks/summary/",
    "caja": "/api/notebooks/cash/",
    "excel": "/api/notebooks/export/",
}


class Command(BaseCommand):
    help = "Times the list, summary, cash, Excel and suggestions on the Local Volumen shop. Test DBs only."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Solo con DJANGO_DEBUG=1: es para una base de pruebas.")
        owner = Membership.objects.filter(tenant__name__startswith="Local Volumen", role=Role.OWNER).first()
        if owner is None:
            raise CommandError("No hay un Local Volumen. Corré antes seed_volume.")
        shop = owner.tenant
        last = Entry.objects.filter(tenant=shop).order_by("-date").values_list("date", flat=True).first()
        self.stdout.write(f"{shop.name}: {Entry.objects.filter(tenant=shop).count()} movimientos")
        with override_settings(ALLOWED_HOSTS=["testserver"]):
            client = Client()
            client.force_login(owner.user)
            client.post("/api/auth/tenant/", {"tenant_id": str(shop.id)}, content_type="application/json")
            for label, days in (("1 mes", 30), ("6 meses", 182), ("1 año", 364)):
                params = {"from": (last - timedelta(days=days)).isoformat(), "to": last.isoformat()}
                parts = []
                for name, url in URLS.items():
                    start = time.perf_counter()
                    response = client.get(url, params)
                    took = time.perf_counter() - start
                    parts.append(f"{name} {took:5.2f} s ({len(response.content) // 1024} KB)")
                self.stdout.write(f"{label:8} " + " | ".join(parts))
            # The suggestions do not depend on the period: they read every entry of the shop.
            parts = []
            for text in ("p", "prov", "luz"):
                start = time.perf_counter()
                client.get("/api/notebooks/descriptions/", {"kind": "expense", "q": text})
                parts.append(f"'{text}' {time.perf_counter() - start:5.3f} s")
            self.stdout.write("sugerencias " + " | ".join(parts))
