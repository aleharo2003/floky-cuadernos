from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import ExtractMonth
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Perm
from accounts.permissions import HasTenantPermission
from core.models import AuditEntry
from notebooks import cash, services
from notebooks.export import build_workbook
from notebooks.filters import apply_filters
from notebooks.models import CashOpening, Category, Entry, Kind
from notebooks.serializers import (
    CashOpeningInputSerializer,
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
        entries, _ = apply_filters(self.entries(), request.query_params)
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
        live, _ = apply_filters(self.entries(), request.query_params, voided=False)
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
                        "total": money(r["total"]),
                        "count": r["count"],
                    }
                    for r in by_category
                ],
            }
        )


class MonthlyView(TenantView):
    """The year month by month: income, expense and balance (HU-023)."""

    required_permissions = {"GET": Perm.VIEW}

    def get(self, request: Request) -> Response:
        try:
            year = int(request.query_params.get("year", ""))
        except ValueError as exc:
            raise ValidationError({"year": "Indicá el año."}) from exc
        if not 2000 <= year <= 2100:
            raise ValidationError({"year": "Año fuera de rango."})
        rows = (
            self.entries()
            .filter(date__year=year, is_voided=False)
            .annotate(month=ExtractMonth("date"))
            .values("month")
            .annotate(
                income=Sum("amount", filter=Q(kind=Kind.INCOME), default=0),
                expense=Sum("amount", filter=Q(kind=Kind.EXPENSE), default=0),
            )
        )
        by_month = {r["month"]: r for r in rows}
        months = []
        for month in range(1, 13):
            r = by_month.get(month, {"income": 0, "expense": 0})
            months.append(
                {
                    "month": month,
                    "income": money(r["income"]),
                    "expense": money(r["expense"]),
                    "balance": money(r["income"] - r["expense"]),
                }
            )
        return Response({"year": year, "months": months})


class ExportView(TenantView):
    """Excel file of exactly what is on screen (HU-027). Voided entries, if shown, never add up."""

    required_permissions = {"GET": Perm.EXPORT}

    def get(self, request: Request) -> HttpResponse:
        entries, filters = apply_filters(self.entries(), request.query_params)
        shop = request.membership.tenant
        category = ""
        if filters.get("category_id"):
            names = Category.objects.filter(tenant=shop, id=filters["category_id"]).values_list(
                "name", flat=True
            )
            category = names.first() or ""
        # The cash sheet is the whole box for the period: it does not follow the list filters.
        opening = CashOpening.objects.filter(tenant=shop).first()
        closes = None
        if opening is not None:
            closes = [c for c in cash.closes(shop, opening, until=filters["to"]) if c.date >= filters["from"]]
        content = build_workbook(
            shop=shop.name,
            filters=filters,
            entries=entries,
            issued_at=timezone.localtime(),
            category=category,
            closes=closes,
        )
        name = f"cuadernos-{filters['from']:%Y%m%d}-{filters['to']:%Y%m%d}.xlsx"
        response = HttpResponse(
            content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{name}"'
        return response


def opening_payload(opening: CashOpening | None) -> dict | None:
    if opening is None:
        return None
    return {
        "date": opening.date,
        "shift": opening.shift,
        "amount": money(opening.amount),
        "updated_by": opening.updated_by.get_full_name() or opening.updated_by.get_username(),
        "updated_at": opening.updated_at,
    }


class CashView(TenantView):
    """The cash box by shift for the period on screen (P-01, ADR-0008).

    It does not follow the list filters: the haber is the whole box, whatever the filters show.
    """

    required_permissions = {"GET": Perm.VIEW}

    def get(self, request: Request) -> Response:
        period = RangeSerializer(data=request.query_params)
        period.is_valid(raise_exception=True)
        start, end = period.range
        opening = (
            CashOpening.objects.select_related("updated_by").filter(tenant=request.membership.tenant).first()
        )
        if opening is None:
            return Response({"opening": None, "closes": [], "haber_at_end": None})
        rows = cash.closes(request.membership.tenant, opening, until=end)
        # The haber when the period ends: the last close up to the end, or the opening if none yet.
        haber_at_end = rows[-1].after if rows else opening.amount
        if opening.date > end:
            haber_at_end = None
        return Response(
            {
                "opening": opening_payload(opening),
                "haber_at_end": None if haber_at_end is None else money(haber_at_end),
                "closes": [
                    {
                        "date": c.date,
                        "shift": c.shift,
                        "sales": money(c.sales),
                        "sales_not_cash": money(c.sales_not_cash),
                        "expenses_cash": money(c.expenses_cash),
                        "expenses_not_cash": money(c.expenses_not_cash),
                        "before": money(c.before),
                        "after": money(c.after),
                        "negative": c.negative,
                    }
                    for c in rows
                    if c.date >= start
                ],
            }
        )


class CashOpeningView(TenantView):
    """Load or change the opening haber. Only the owner (Perm.SET_CASH_OPENING)."""

    required_permissions = {"PUT": Perm.SET_CASH_OPENING}

    def put(self, request: Request) -> Response:
        data = CashOpeningInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        try:
            opening = cash.set_opening(
                request.membership, day=v["date"], shift=v["shift"], amount=v["amount"], reason=v["reason"]
            )
        except services.RuleError as exc:
            raise rule_error(exc) from exc
        return Response(opening_payload(opening))
