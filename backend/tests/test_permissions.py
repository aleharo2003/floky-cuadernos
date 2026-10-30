import pytest
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from accounts.models import ROLE_PERMISSIONS, Membership, Perm, Role
from accounts.permissions import HasTenantPermission
from accounts.session import ACTIVE_TENANT_KEY

pytestmark = pytest.mark.django_db


def test_roles_stack_up():
    viewer, editor, owner = (ROLE_PERMISSIONS[r] for r in (Role.VIEWER, Role.EDITOR, Role.OWNER))

    assert viewer == {Perm.VIEW, Perm.EXPORT}
    assert viewer < editor < owner
    assert Perm.MANAGE_CATEGORIES in owner - editor


class EntriesView(APIView):
    """A stand-in for the notebooks views that arrive with HU-021."""

    permission_classes = [HasTenantPermission]
    required_permissions = {"GET": Perm.VIEW, "POST": Perm.ADD_ENTRY}

    def get(self, request):
        return Response({"tenant": str(request.membership.tenant_id)})

    def post(self, request):
        return Response(status=201)

    def delete(self, request):
        return Response(status=204)


def call(method: str, user, tenant=None):
    request = getattr(APIRequestFactory(), method)("/x/")
    request.session = {ACTIVE_TENANT_KEY: str(tenant.id)} if tenant else {}
    force_authenticate(request, user=user)
    return EntriesView.as_view()(request)


def test_without_an_active_shop_nothing_is_allowed(make_person, norte):
    user = make_person("u", (norte, Role.OWNER, True))

    response = call("get", user)

    assert response.status_code == 403
    assert response.data["detail"].code == "no_active_tenant"


@pytest.mark.parametrize(
    ("role", "method", "expected"),
    [
        (Role.VIEWER, "get", 200),
        (Role.VIEWER, "post", 403),
        (Role.EDITOR, "post", 201),
        (Role.OWNER, "post", 201),
        (Role.OWNER, "delete", 403),  # the view did not declare DELETE: nobody gets it
    ],
)
def test_each_role_does_only_its_part(make_person, norte, role, method, expected):
    user = make_person("u", (norte, role, True))

    assert call(method, user, norte).status_code == expected


def test_the_view_sees_only_the_active_shop(make_person, centro, norte):
    user = make_person("u", (centro, Role.VIEWER, True), (norte, Role.VIEWER, True))

    assert call("get", user, norte).data == {"tenant": str(norte.id)}


def test_a_shop_from_another_person_in_the_session_does_not_open(make_person, centro, norte):
    user = make_person("u", (norte, Role.OWNER, True))

    response = call("get", user, centro)

    assert response.status_code == 403
    assert Membership.objects.filter(user=user, tenant=centro).exists() is False
