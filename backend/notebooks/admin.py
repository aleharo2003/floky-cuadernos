from django.contrib import admin

from notebooks.models import Category, Entry


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Owners will manage categories from the portal (HU-022). For now the team loads them here."""

    list_display = ["name", "kind", "tenant", "is_active", "is_system"]
    list_filter = ["tenant", "kind", "is_active"]
    search_fields = ["name"]


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    """Read only: entries change through the portal, so every change is audited."""

    list_display = ["date", "tenant", "kind", "category", "amount", "payment_method", "is_voided"]
    list_filter = ["tenant", "kind", "payment_method", "is_voided"]
    date_hierarchy = "date"

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
