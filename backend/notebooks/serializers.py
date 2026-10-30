from datetime import date, timedelta
from decimal import Decimal

from rest_framework import serializers

from notebooks.models import Category, Entry, Kind, PaymentMethod
from notebooks.services import EntryData

MAX_RANGE = timedelta(days=366)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "kind"]


class EntrySerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(source="category.id")
    category_name = serializers.CharField(source="category.name")
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Entry
        fields = [
            "id",
            "date",
            "kind",
            "category_id",
            "category_name",
            "description",
            "amount",
            "payment_method",
            "is_voided",
            "void_reason",
            "mirror_of",
            "created_by",
            "created_at",
        ]

    def get_created_by(self, entry: Entry) -> str:
        return entry.created_by.get_full_name() or entry.created_by.get_username()


class EntryInputSerializer(serializers.Serializer):
    date = serializers.DateField()
    kind = serializers.ChoiceField(choices=Kind.choices)
    category_id = serializers.UUIDField()
    description = serializers.CharField(max_length=120, allow_blank=True, default="")
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)

    def to_data(self) -> EntryData:
        return EntryData(**self.validated_data)


class CorrectionSerializer(EntryInputSerializer):
    reason = serializers.CharField(max_length=200)

    def to_data_without_reason(self) -> EntryData:
        fields = {k: v for k, v in self.validated_data.items() if k != "reason"}
        return EntryData(**fields)


class VoidSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=200)


class RangeSerializer(serializers.Serializer):
    """?from=aaaa-mm-dd&to=aaaa-mm-dd. At most a year, so a query can never read everything."""

    def get_fields(self):
        # "from" is a Python keyword, so the fields are declared here instead of as attributes.
        return {"from": serializers.DateField(), "to": serializers.DateField()}

    def validate(self, attrs):
        start, end = attrs["from"], attrs["to"]
        if start > end:
            raise serializers.ValidationError("La fecha desde no puede ser posterior a la fecha hasta.")
        if end - start > MAX_RANGE:
            raise serializers.ValidationError("El período puede ser de un año como máximo.")
        return attrs

    @property
    def range(self) -> tuple[date, date]:
        return self.validated_data["from"], self.validated_data["to"]
