"""A person changes their own password."""

import pytest
from rest_framework.test import APIClient

from tests.conftest import PASSWORD, log_in

pytestmark = pytest.mark.django_db

URL = "/api/auth/password/"
NEW = "otra-clave-bien-larga-2026"


def change(api, current=PASSWORD, new=NEW):
    return api.post(URL, {"current": current, "new": new}, format="json")


def test_change_password_keeps_this_device_and_closes_the_others(api, tomas):
    other_device = APIClient()
    log_in(other_device, "tomas")
    log_in(api, "tomas")

    assert change(api).status_code == 204

    assert api.get("/api/auth/session/").json()["user"]["username"] == "tomas"  # still in here
    assert other_device.get("/api/auth/session/").json()["user"] is None  # signed out there
    api.post("/api/auth/logout/")
    assert log_in(api, "tomas").status_code == 400  # the old password no longer works
    assert log_in(api, "tomas", NEW).status_code == 200


def test_wrong_current_password_is_rejected(api, tomas):
    log_in(api, "tomas")

    response = change(api, current="no-es-esta")

    assert response.status_code == 400
    assert "current" in response.json()
    assert log_in(APIClient(), "tomas").status_code == 200  # nothing changed


@pytest.mark.parametrize("weak", ["123", "12345678901", "password123"])
def test_weak_new_password_is_rejected_in_spanish(api, tomas, weak):
    log_in(api, "tomas")

    response = change(api, new=weak)

    assert response.status_code == 400
    messages = " ".join(response.json()["new"])
    assert "contraseña" in messages.lower()


def test_needs_to_be_signed_in(api):
    assert change(api).status_code == 403
