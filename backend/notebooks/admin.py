from django import forms
from django.contrib import admin, messages
from django.db.models import Count, Q
from django.template.response import TemplateResponse

from notebooks import services
from notebooks.models import CashOpening, Category, Entry, ShopNotebooks, ShopSettings


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Owners will manage categories from the portal (HU-022). For now the team loads them here."""

    list_display = ["name", "kind", "tenant", "is_active"]
    list_filter = ["tenant", "kind", "is_active"]
    search_fields = ["name"]
    # "is_system" was for mirror entries, gone since ADR-0008. Hidden so nobody ticks it by mistake.
    exclude = ["is_system"]


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    """Read only: entries change through the portal, so every change is audited."""

    list_display = ["date", "shift", "tenant", "kind", "category", "amount", "payment_method", "is_voided"]
    list_filter = ["tenant", "kind", "shift", "payment_method", "is_voided"]
    date_hierarchy = "date"

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(CashOpening)
class CashOpeningAdmin(admin.ModelAdmin):
    """Read only: the owner loads it from the portal, with a reason when it changes (audited)."""

    list_display = ["tenant", "date", "shift", "amount", "updated_by", "updated_at"]

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(ShopSettings)
class ShopSettingsAdmin(admin.ModelAdmin):
    """Read only: the owner changes them from the portal, and the change is audited."""

    list_display = ["tenant", "sale_methods", "updated_by", "updated_at"]

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


class EmptyNotebooksForm(forms.Form):
    confirm_name = forms.CharField(label="Nombre del local", max_length=120)
    reason = forms.CharField(label="Motivo", max_length=200)

    def __init__(self, *args, shop, **kwargs):
        super().__init__(*args, **kwargs)
        self.shop = shop

    def clean_confirm_name(self) -> str:
        name = self.cleaned_data["confirm_name"].strip()
        if name != self.shop.name:
            raise forms.ValidationError("El nombre no coincide. No se borró nada.")
        return name


@admin.register(ShopNotebooks)
class ShopNotebooksAdmin(admin.ModelAdmin):
    """How many entries each shop has, and the action to empty them to start from zero (ADR-0015).

    Only superusers see it. Nothing here is edited by hand: the action goes through the service,
    in one transaction and audited.
    """

    list_display = ["name", "live_entries", "voided_entries", "has_opening"]
    actions = ["empty_notebooks"]

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(
                live=Count("entries", filter=Q(entries__is_voided=False)),
                voided=Count("entries", filter=Q(entries__is_voided=True)),
            )
        )

    @admin.display(description="movimientos", ordering="live")
    def live_entries(self, obj) -> int:
        return obj.live

    @admin.display(description="anulados", ordering="voided")
    def voided_entries(self, obj) -> int:
        return obj.voided

    @admin.display(description="haber inicial", boolean=True)
    def has_opening(self, obj) -> bool:
        return CashOpening.objects.filter(tenant=obj).exists()

    def has_module_permission(self, request) -> bool:
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None) -> bool:
        return request.user.is_superuser

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False

    def has_empty_permission(self, request) -> bool:
        return request.user.is_superuser

    @admin.action(description="Vaciar los cuadernos (movimientos y caja)", permissions=["empty"])
    def empty_notebooks(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Elegí un solo local por vez.", messages.ERROR)
            return None
        shop = queryset.get()
        data = request.POST if "confirmar" in request.POST else None
        form = EmptyNotebooksForm(data, shop=shop)
        if form.is_valid():
            try:
                done = services.empty_notebooks(shop, request.user, form.cleaned_data["reason"])
            except services.RuleError as exc:
                form.add_error(None, str(exc))
            else:
                self.message_user(
                    request,
                    f"Cuadernos de {shop.name} vaciados: se borraron {done['entries']} movimientos"
                    f" y {done['voided']} anulados.",
                    messages.SUCCESS,
                )
                return None
        return TemplateResponse(
            request,
            "admin/notebooks/vaciar_cuadernos.html",
            {
                **self.admin_site.each_context(request),
                "shop": shop,
                "form": form,
                "counts": {"entries": shop.live, "voided": shop.voided},
                "has_opening": self.has_opening(shop),
                "volver": request.get_full_path(),
                "opts": self.model._meta,
            },
        )
