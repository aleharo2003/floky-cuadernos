from django.contrib import admin

from notebooks.models import CashOpening, Category, Entry


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
