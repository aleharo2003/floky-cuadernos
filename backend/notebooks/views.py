from decimal import Decimal

from django.db.models import Count, Q, Sum
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Perm
from accounts.permissions import HasTenantPermission
from core.models import AuditEntry
from notebooks import services
from notebooks.models import Category, Entry, Kind
from notebooks.serializers import (
    CategorySerializer,
    CorrectionSerializer,
    EntryInputSerializer,
    EntrySerializer,
    RangeSerializer,
    VoidSerializer,
)


class TenantView(APIView):
    """Every notebook view works inside the active shop only (ADR-0003)."""

    permission_classes = [HasTenantPermission]

    def entries(self):
        return Entry.objects.filter(tenant=self.request.membership.tenant).select_related(
            "category", "created_by"
        )

    def range(self) -> tuple:
        params = RangeSerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        return params.range


def rule_error(exc: services.RuleError) -> ValidationError:
    return ValidationError({"detail": str(exc)})


class CategoryListView(TenantView):
    required_permissions = {"GET": Perm.VIEW}

    def get(self, request: Request) -> Response:
        categories = Category.objects.filter(
            tenant=request.membership.tenant, is_active=True, is_system=False
        )
        return Response(CategorySerializer(categories, many=True).data)


class EntryListView(TenantView):
    required_permissions = {"GET": Perm.VIEW, "POST": Perm.ADD_ENTRY}

    def get(self, request: Request) -> Response:
        start, end = self.range()
        entries = self.entries().filter(date__range=(start, end))
        if request.query_params.get("voided") != "1":
            entries = entries.filter(is_voided=False)
        return Response(EntrySerializer(entries, many=True).data)

    def post(self, request: Request) -> Response:
        data = EntryInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        key = request.headers.get("Idempotency-Key")
        try:
            entry = services.create_entry(request.membership, data.to_data(), idempotency_key=key or None)
        except services.RuleError as exc:
            raise rule_error(exc) from exc
        except ValueError as exc:  # a malformed idempotency key
            raise ValidationError({"detail": "Clave de idempotencia inválida."}) from exc
        return Response(EntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class EntryDetailView(TenantView):
    required_permissions = {"PUT": Perm.CHANGE_ENTRY}

    def put(self, request: Request, entry_id) -> Response:
        data = CorrectionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            entry = services.correct_entry(
                request.membership, entry_id, data.to_data_without_reason(), data.validated_data["reason"]
            )
        except Entry.DoesNotExist as exc:
            raise NotFound("No encontramos ese movimiento.") from exc
        except services.RuleError as exc:
            raise rule_error(exc) from exc
        return Response(EntrySerializer(entry).data)


class EntryVoidView(TenantView):
    required_permissions = {"POST": Perm.VOID_ENTRY}

    def post(self, request: Request, entry_id) -> Response:
        data = VoidSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            entry = services.void_entry(request.membership, entry_id, data.validated_data["reason"])
        except Entry.DoesNotExist as exc:
            raise NotFound("No encontramos ese movimiento.") from exc
        except services.RuleError as exc:
            raise rule_error(exc) from exc
        return Response(EntrySerializer(entry).data)


def audit_row(row: AuditEntry) -> dict:
    return {
        "id": str(row.id),
        "at": row.created_at,
        "who": (row.actor.get_full_name() or row.actor.get_username()) if row.actor else "Sistema",
        "action": row.action,
        "entity_id": str(row.entity_id),
        "before": row.before,
        "after": row.after,
        "reason": row.reason,
    }


class EntryHistoryView(TenantView):
    required_permissions = {"GET": Perm.VIEW}

    def get(self, request: Request, entry_id) -> Response:
        if not self.entries().filter(id=entry_id).exists():
            raise NotFound("No encontramos ese movimiento.")
        rows = AuditEntry.objects.filter(tenant=request.membership.tenant, entity="entry", entity_id=entry_id)
        return Response([audit_row(r) for r in rows.select_related("actor").order_by("created_at")])


class RecentChangesView(TenantView):
    required_permissions = {"GET": Perm.VIEW}
    LIMIT = 20

    def get(self, request: Request) -> Response:
        rows = AuditEntry.objects.filter(tenant=request.membership.tenant, entity="entry").select_related(
            "actor"
        )
        return Response([audit_row(r) for r in rows.order_by("-created_at")[: self.LIMIT]])


CENT = Decimal("0.01")


def money(value) -> str:
    """Amounts travel as text with two decimals, never as floats (CONTRIBUTING, money rules)."""
    return str(Decimal(value).quantize(CENT))


class SummaryView(TenantView):
    required_permissions = {"GET": Perm.VIEW}

    def get(self, request: Request) -> Response:
        start, end = self.range()
        live = self.entries().filter(date__range=(start, end), is_voided=False)
        totals = live.aggregate(
            income=Sum("amount", filter=Q(kind=Kind.INCOME), default=0),
            expense=Sum("amount", filter=Q(kind=Kind.EXPENSE), default=0),
        )
        by_category = (
            live.values("category__name", "kind")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("kind", "-total")
        )
        return Response(
            {
                "income": money(totals["income"]),
                "expense": money(totals["expense"]),
                "balance": money(totals["income"] - totals["expense"]),
                "by_category": [
                    {
                        "category": r["category__name"],
                        "kind": r["kind"],
                        "total": r["total"],
                        "count": r["count"],
                    }
                    for r in by_category
                ],
            }
        )
