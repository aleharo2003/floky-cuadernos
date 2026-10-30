from django.contrib import admin

from core.models import Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ["name", "timezone", "created_at"]
    search_fields = ["name"]
