from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from accounts.session import get_active_membership


class NoActiveTenant(PermissionDenied):
    default_detail = "Elegí un local para seguir."
    default_code = "no_active_tenant"


class HasTenantPermission(BasePermission):
    """Allows the request only inside the active shop and only with the permission the view asks for.

    Views declare `required_permissions = {"GET": Perm.VIEW, "POST": Perm.ADD_ENTRY, ...}`.
    The active membership is left on `request.membership` for the view to scope its queries.
    """

    message = "Tu rol no permite hacer esto en este local."

    def has_permission(self, request, view) -> bool:
        membership = get_active_membership(request)
        if membership is None:
            raise NoActiveTenant()
        request.membership = membership
        required = getattr(view, "required_permissions", {}).get(request.method)
        if required is None:
            return False  # a method the view did not declare is not allowed
        return membership.can(required)
