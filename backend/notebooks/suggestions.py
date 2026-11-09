"""Descriptions already used in a shop, to suggest them while loading an entry (HU-030).

The whole list of a shop is small (a few hundred different texts), so the grouping and the match
run in Python over one aggregate query. That keeps accents and case out of the database, which
would need an extension, and it stays in milliseconds at the volume the reviewer used.
"""

import unicodedata
from dataclasses import dataclass
from datetime import date

from django.db.models import Count, Max

from core.models import Tenant
from notebooks.models import Entry

LIMIT = 8


def normalize(text: str) -> str:
    """Lower case, no accents, single spaces: "  Carnicería " -> "carniceria"."""
    plain = unicodedata.normalize("NFKD", text)
    plain = "".join(c for c in plain if not unicodedata.combining(c))
    return " ".join(plain.lower().split())


@dataclass
class _Group:
    text: str  # the spelling used most, shown as is
    text_uses: int
    uses: int
    last: date


def description_suggestions(tenant: Tenant, kind: str, query: str, limit: int = LIMIT) -> list[str]:
    """Descriptions of this kind where some word starts with what was typed.

    Same text with other case or accents counts as one ("verdu", "Verdu"). Order: the ones that
    start with the query first, then the most used, then the most recent. Voided entries and the
    sales made from a cost ("Gasto con débito: ...") are left out: nobody types those.
    """
    wanted = normalize(query)
    if not wanted:
        return []
    rows = (
        Entry.objects.filter(tenant=tenant, kind=kind, is_voided=False, from_expense__isnull=True)
        .exclude(description="")
        .values("description")
        .annotate(uses=Count("id"), last=Max("date"))
    )
    groups: dict[str, _Group] = {}
    for row in rows:
        key = normalize(row["description"])
        if not (key.startswith(wanted) or f" {wanted}" in key):
            continue
        group = groups.get(key)
        if group is None:
            groups[key] = _Group(row["description"].strip(), row["uses"], row["uses"], row["last"])
            continue
        group.uses += row["uses"]
        group.last = max(group.last, row["last"])
        if row["uses"] > group.text_uses:
            group.text, group.text_uses = row["description"].strip(), row["uses"]
    ranked = sorted(
        groups.items(),
        key=lambda item: (not item[0].startswith(wanted), -item[1].uses, -item[1].last.toordinal(), item[0]),
    )
    return [group.text for _, group in ranked[:limit]]
