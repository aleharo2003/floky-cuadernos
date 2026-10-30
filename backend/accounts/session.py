"""Which shop a person is working in. The choice lives in the server session, never in the browser."""

from django.http import HttpRequest

from accounts.models import Membership

ACTIVE_TENANT_KEY = "active_tenant_id"


def active_memberships(user) -> list[Membership]:
    if not user.is_authenticated or not user.is_active:
        return []
    return list(
        Membership.objects.filter(user=user, is_active=True).select_related("tenant").order_by("tenant__name")
    )


def get_active_membership(request: HttpRequest) -> Membership | None:
    """The membership for the shop chosen in this session, if it is still active."""
    tenant_id = request.session.get(ACTIVE_TENANT_KEY)
    if not tenant_id:
        return None
    return next((m for m in active_memberships(request.user) if str(m.tenant_id) == tenant_id), None)


def set_active_tenant(request: HttpRequest, membership: Membership | None) -> None:
    if membership is None:
        request.session.pop(ACTIVE_TENANT_KEY, None)
    else:
        request.session[ACTIVE_TENANT_KEY] = str(membership.tenant_id)


def choose_tenant_after_login(request: HttpRequest) -> None:
    """One shop: go straight in. Several or none: the person has to choose (FUN-01)."""
    memberships = active_memberships(request.user)
    set_active_tenant(request, memberships[0] if len(memberships) == 1 else None)


def session_payload(request: HttpRequest) -> dict:
    user = request.user
    if not user.is_authenticated:
        return {"user": None, "tenants": [], "active_tenant": None}
    memberships = active_memberships(user)
    active = get_active_membership(request)
    return {
        "user": {
            "id": user.pk,
            "username": user.get_username(),
            "name": user.get_full_name() or user.get_username(),
        },
        "tenants": [{"id": str(m.tenant_id), "name": m.tenant.name, "role": m.role} for m in memberships],
        "active_tenant": None
        if active is None
        else {
            "id": str(active.tenant_id),
            "name": active.tenant.name,
            "role": active.role,
            "permissions": sorted(active.permissions),
        },
    }
