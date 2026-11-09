from datetime import date, timedelta
from decimal import Decimal

from rest_framework import serializers

from notebooks.models import SALE_METHOD_CHOICES, CashOpening, Category, Entry, Kind, PaymentMethod, Shift
from notebooks.services import EntryData

MAX_RANGE = timedelta(days=366)


# DRF's own messages are in "usted"; the portal talks with "vos". Up to 12 whole digits: 999.999.999.999,99.
AMOUNT_ERRORS = {
    "invalid": "Escribí un monto válido.",
    "max_digits": "El monto es demasiado grande.",
    "max_whole_digits": "El monto es demasiado grande.",
    "max_decimal_places": "El monto puede tener hasta 2 decimales.",
    "min_value": "El monto tiene que ser mayor que cero.",
    "max_string_length": "El monto es demasiado grande.",
}


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "kind"]


class CategoryInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    kind = serializers.ChoiceField(choices=Kind.choices)


class EntrySerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(source="category.id")
    category_name = serializers.CharField(source="category.name")
    created_by = serializers.SerializerMethodField()
    sale_id = serializers.SerializerMethodField()
    from_expense_id = serializers.UUIDField(read_only=True, allow_null=True)

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
            "shift",
            "is_voided",
            "void_reason",
            "created_by",
            "created_at",
            "sale_id",
            "from_expense_id",
        ]

    def get_created_by(self, entry: Entry) -> str:
        return entry.created_by.get_full_name() or entry.created_by.get_username()

    def get_sale_id(self, entry: Entry) -> str | None:
        """The standing sale of a cost. A voided one does not count (ADR-0012)."""
        sales = getattr(entry, "standing_sales", None)
        if sales is None:  # not prefetched: a single entry, after saving it
            sales = list(entry.linked_sales.filter(is_voided=False)[:1])
        return str(sales[0].id) if sales else None


class EntryInputSerializer(serializers.Serializer):
    date = serializers.DateField()
    kind = serializers.ChoiceField(choices=Kind.choices)
    category_id = serializers.UUIDField()
    description = serializers.CharField(max_length=120, allow_blank=True, default="")
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), error_messages=AMOUNT_ERRORS
    )
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    shift = serializers.ChoiceField(choices=Shift.choices)

    def to_data(self) -> EntryData:
        fields = {k: v for k, v in self.validated_data.items() if k != "add_sale"}
        return EntryData(**fields)


class NewEntrySerializer(EntryInputSerializer):
    # A cost paid with one of the shop's sale methods also adds the sale, as on paper (ADR-0010, ADR-0013).
    add_sale = serializers.BooleanField(default=False)


class CorrectionSerializer(EntryInputSerializer):
    reason = serializers.CharField(max_length=200)
    # A cost without a standing sale can get one when corrected (ADR-0012).
    add_sale = serializers.BooleanField(default=False)

    def to_data_without_reason(self) -> EntryData:
        fields = {k: v for k, v in self.validated_data.items() if k not in ("reason", "add_sale")}
        return EntryData(**fields)


class CashOpeningSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashOpening
        fields = ["date", "shift", "amount"]


class CashOpeningInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0"), error_messages=AMOUNT_ERRORS
    )
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


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


class SettingsSerializer(serializers.Serializer):
    sale_methods = serializers.ListField(
        child=serializers.ChoiceField(
            choices=SALE_METHOD_CHOICES,
            error_messages={"invalid_choice": "Elegí medios de pago que no sean efectivo."},
        ),
        allow_empty=True,
        max_length=len(SALE_METHOD_CHOICES),
    )
