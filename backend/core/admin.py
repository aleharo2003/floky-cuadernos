from django.contrib import admin

from core.models import AuditEntry, Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ["name", "timezone", "created_at"]
    search_fields = ["name"]


@admin.register(AuditEntry)
class AuditEntryAdmin(admin.ModelAdmin):
    """Read only: the audit is never edited, not even from the admin."""

    list_display = ["created_at", "tenant", "actor", "action", "entity", "reason"]
    list_filter = ["tenant", "action", "entity"]
    search_fields = ["reason", "entity_id"]
    readonly_fields = [f.name for f in AuditEntry._meta.fields]

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
