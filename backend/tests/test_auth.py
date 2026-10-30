import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Role
from tests.conftest import PASSWORD, log_in

pytestmark = pytest.mark.django_db


def test_session_when_nobody_is_logged_in_hands_out_the_csrf_cookie(api):
    response = api.get("/api/auth/session/")

    assert response.status_code == 200
    assert response.json() == {"user": None, "tenants": [], "active_tenant": None}
    assert "csrftoken" in response.cookies


def test_person_with_one_shop_goes_straight_in(api, tomas, norte):
    response = log_in(api, "tomas")

    body = response.json()
    assert response.status_code == 200
    assert body["active_tenant"]["id"] == str(norte.id)
    assert body["active_tenant"]["role"] == Role.EDITOR
    assert "notebooks.add_entry" in body["active_tenant"]["permissions"]
    assert "notebooks.manage_categories" not in body["active_tenant"]["permissions"]


def test_person_with_two_shops_has_to_choose(api, lucia):
    body = log_in(api, "lucia").json()

    assert body["active_tenant"] is None
    assert [t["name"] for t in body["tenants"]] == ["Local Centro", "Local Norte"]


def test_inactive_memberships_do_not_count(api, make_person, centro, norte):
    make_person("ana", (centro, Role.VIEWER, True), (norte, Role.VIEWER, False))

    body = log_in(api, "ana").json()

    assert [t["name"] for t in body["tenants"]] == ["Local Centro"]
    assert body["active_tenant"]["name"] == "Local Centro"


def test_person_without_active_memberships_logs_in_with_no_shop(api, make_person, centro):
    make_person("sin-acceso", (centro, Role.VIEWER, False))

    body = log_in(api, "sin-acceso").json()

    assert body["user"]["username"] == "sin-acceso"
    assert body["tenants"] == []
    assert body["active_tenant"] is None


@pytest.mark.parametrize(("username", "password"), [("tomas", "otra-clave"), ("nadie", PASSWORD)])
def test_wrong_credentials_do_not_say_which_part_failed(api, tomas, username, password):
    response = log_in(api, username, password)

    assert response.status_code == 400
    assert response.json() == {"detail": "Usuario o contraseña incorrectos."}


def test_login_requires_the_csrf_token(tomas):
    client = APIClient(enforce_csrf_checks=True)

    response = log_in(client, "tomas")

    assert response.status_code == 403


def test_login_works_with_the_csrf_token_from_the_session_endpoint(tomas):
    client = APIClient(enforce_csrf_checks=True)
    token = client.get("/api/auth/session/").cookies["csrftoken"].value

    response = client.post(
        "/api/auth/login/", {"username": "tomas", "password": PASSWORD}, format="json", HTTP_X_CSRFTOKEN=token
    )

    assert response.status_code == 200


def test_too_many_attempts_are_slowed_down(api, tomas, settings):
    for _ in range(10):
        log_in(api, "tomas", "mal")

    assert log_in(api, "tomas", "mal").status_code == 429


def test_choose_one_of_my_shops(api, lucia, norte):
    log_in(api, "lucia")

    response = api.post("/api/auth/tenant/", {"tenant_id": str(norte.id)}, format="json")

    assert response.status_code == 200
    assert response.json()["active_tenant"]["name"] == "Local Norte"


def test_switch_shop_without_logging_in_again(api, lucia, centro, norte):
    log_in(api, "lucia")
    api.post("/api/auth/tenant/", {"tenant_id": str(norte.id)}, format="json")

    body = api.post("/api/auth/tenant/", {"tenant_id": str(centro.id)}, format="json").json()

    assert body["active_tenant"]["name"] == "Local Centro"


def test_a_shop_i_do_not_belong_to_is_not_found(api, tomas, centro):
    log_in(api, "tomas")

    response = api.post("/api/auth/tenant/", {"tenant_id": str(centro.id)}, format="json")

    assert response.status_code == 404
    assert api.get("/api/auth/session/").json()["active_tenant"]["name"] == "Local Norte"


def test_deactivated_membership_closes_the_shop_for_the_current_session(api, tomas, norte):
    log_in(api, "tomas")
    Membership.objects.filter(user=tomas, tenant=norte).update(is_active=False)

    body = api.get("/api/auth/session/").json()

    assert body["active_tenant"] is None
    assert body["tenants"] == []


def test_logout(api, tomas):
    log_in(api, "tomas")

    body = api.post("/api/auth/logout/").json()

    assert body["user"] is None
    assert api.get("/api/auth/session/").json()["user"] is None


def test_choosing_a_shop_needs_a_session(api, norte):
    response = api.post("/api/auth/tenant/", {"tenant_id": str(norte.id)}, format="json")

    assert response.status_code == 403
