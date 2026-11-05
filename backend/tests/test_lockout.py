"""Limit on failed sign ins (ADR-0011, security review of 05/11/2026)."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, RequestFactory
from django.utils import timezone
from rest_framework.test import APIClient

from accounts import lockout
from accounts.models import FailedLogin
from tests.conftest import PASSWORD, log_in

pytestmark = pytest.mark.django_db


def fail(client: APIClient, username="tomas", **headers):
    return client.post(
        "/api/auth/login/", {"username": username, "password": "mal"}, format="json", **headers
    )


def test_made_up_forwarded_for_values_do_not_reset_the_limit(api, tomas):
    for n in range(10):
        fail(api, HTTP_X_FORWARDED_FOR=f"10.0.0.{n}")

    response = fail(api, HTTP_X_FORWARDED_FOR="10.0.0.99")

    assert response.status_code == 429
    assert response.json()["detail"] == lockout.TOO_MANY


def test_the_count_is_shared_by_every_client_and_server_copy(tomas):
    for _ in range(10):
        fail(APIClient())  # a new client each time, as if each request hit another copy

    # Even with the right password, the user stays locked for now.
    assert log_in(APIClient(), "tomas").status_code == 429


def test_the_lock_ends_after_the_window(api, tomas):
    for _ in range(10):
        fail(api)
    FailedLogin.objects.update(at=timezone.now() - lockout.WINDOW - timedelta(seconds=1))

    assert log_in(api, "tomas").status_code == 200


def test_a_good_sign_in_clears_the_count(api, tomas):
    for _ in range(9):
        fail(api)
    assert log_in(api, "tomas").status_code == 200

    assert not FailedLogin.objects.filter(username="tomas").exists()


def test_upper_and_lower_case_count_as_the_same_user(api, tomas):
    for n in range(10):
        fail(api, username="TOMAS" if n % 2 else "tomas")
    assert fail(api).status_code == 429


def test_the_admin_login_has_the_same_limit():
    get_user_model().objects.create_superuser("jefa", password=PASSWORD)
    client = Client()
    for _ in range(10):
        client.post("/admin/login/", {"username": "jefa", "password": "mal"})

    client.post("/admin/login/", {"username": "jefa", "password": PASSWORD})

    assert "_auth_user_id" not in client.session
    assert FailedLogin.objects.filter(username="jefa").count() >= 10


def test_a_wrong_current_password_counts_too(api, tomas):
    log_in(api, "tomas")
    for _ in range(10):
        api.post("/api/auth/password/", {"current": "mal", "new": "otra-clave-larga-2026"}, format="json")

    response = api.post(
        "/api/auth/password/", {"current": PASSWORD, "new": "otra-clave-larga-2026"}, format="json"
    )

    assert response.status_code == 429


# ---------- the caller's IP ----------


def request_with(xff=None, remote="10.1.1.1"):
    extra = {"REMOTE_ADDR": remote}
    if xff is not None:
        extra["HTTP_X_FORWARDED_FOR"] = xff
    return RequestFactory().get("/", **extra)


def test_without_proxies_the_forwarded_header_is_ignored(monkeypatch):
    monkeypatch.setattr(lockout, "TRUSTED_PROXY_HOPS", 0)
    assert lockout.client_ip(request_with("1.2.3.4")) == "10.1.1.1"


def test_behind_cloud_run_only_the_last_entry_counts(monkeypatch):
    monkeypatch.setattr(lockout, "TRUSTED_PROXY_HOPS", 1)
    # Whatever the caller wrote comes first; Cloud Run adds the real address at the end.
    assert lockout.client_ip(request_with("6.6.6.6, 203.0.113.7")) == "203.0.113.7"
    assert lockout.client_ip(request_with("no-es-una-ip")) is None
    assert lockout.client_ip(request_with(None)) is None


def test_with_a_load_balancer_the_second_from_the_end_counts(monkeypatch):
    monkeypatch.setattr(lockout, "TRUSTED_PROXY_HOPS", 2)
    assert lockout.client_ip(request_with("6.6.6.6, 203.0.113.7, 35.1.1.1")) == "203.0.113.7"


def test_one_ip_trying_many_users_is_stopped_only_when_the_ip_can_be_trusted(api, monkeypatch, tomas):
    monkeypatch.setattr(lockout, "MAX_PER_IP", 3)
    monkeypatch.setattr(lockout, "TRUSTED_PROXY_HOPS", 0)
    for n in range(3):
        fail(api, username=f"nadie{n}")
    assert log_in(api, "tomas").status_code == 200, (
        "without trusted proxies, every caller may share one address"
    )

    monkeypatch.setattr(lockout, "TRUSTED_PROXY_HOPS", 1)
    for n in range(3):
        fail(api, username=f"otro{n}", HTTP_X_FORWARDED_FOR=f"9.9.9.{n}, 203.0.113.7")
    response = api.post(
        "/api/auth/login/",
        {"username": "tomas", "password": PASSWORD},
        format="json",
        HTTP_X_FORWARDED_FOR="1.1.1.1, 203.0.113.7",
    )
    assert response.status_code == 429
