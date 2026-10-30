from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

from accounts.models import Membership


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 1
    fields = ["tenant", "role", "is_active"]
    autocomplete_fields = ["tenant"]


User = get_user_model()
admin.site.unregister(User)


@admin.register(User)
class PersonAdmin(UserAdmin):
    """People are created by the team during rollout (HU-013), with their memberships on the same page."""

    inlines = [MembershipInline]
    list_display = ["username", "first_name", "last_name", "is_active"]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "tenant", "role", "is_active", "created_at"]
    list_filter = ["role", "is_active", "tenant"]
    search_fields = ["user__username", "user__first_name", "user__last_name", "tenant__name"]
    autocomplete_fields = ["user", "tenant"]
