"""One place that turns the query string into a filtered queryset (HU-028).

The list, the summary and the export use the same filters, so they can never show different things.
"""

from django.db.models import Q, QuerySet
from rest_framework import serializers

from notebooks.models import Kind, PaymentMethod
from notebooks.serializers import RangeSerializer


class FilterSerializer(RangeSerializer):
    def get_fields(self):
        fields = super().get_fields()
        fields |= {
            "kind": serializers.ChoiceField(choices=Kind.choices, required=False),
            "category_id": serializers.UUIDField(required=False),
            "payment_method": serializers.ChoiceField(choices=PaymentMethod.choices, required=False),
            "q": serializers.CharField(required=False, allow_blank=True, max_length=60),
            "voided": serializers.BooleanField(required=False, default=False),
        }
        return fields


def apply_filters(entries: QuerySet, params, *, voided: bool | None = None) -> tuple[QuerySet, dict]:
    """Return the filtered entries and the validated filters.

    `voided` overrides the query string: the summary never counts voided entries.
    """
    data = FilterSerializer(data=params)
    data.is_valid(raise_exception=True)
    f = data.validated_data
    entries = entries.filter(date__range=(f["from"], f["to"]))
    if f.get("kind"):
        entries = entries.filter(kind=f["kind"])
    if f.get("category_id"):
        entries = entries.filter(category_id=f["category_id"])
    if f.get("payment_method"):
        entries = entries.filter(payment_method=f["payment_method"])
    if text := f.get("q", "").strip():
        entries = entries.filter(Q(description__icontains=text) | Q(category__name__icontains=text))
    include_voided = f["voided"] if voided is None else voided
    if not include_voided:
        entries = entries.filter(is_voided=False)
    return entries, f
