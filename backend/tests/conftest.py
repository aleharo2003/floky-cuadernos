import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import Membership, Role
from core.models import Tenant

PASSWORD = "una-clave-de-prueba-larga"  # noqa: S105 - test data, not a secret


@pytest.fixture(autouse=True)
def fast_password_hasher(settings):
    """Production hashes are slow on purpose. Tests do not need that."""
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def clean_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def centro(db) -> Tenant:
    return Tenant.objects.create(name="Local Centro")


@pytest.fixture
def norte(db) -> Tenant:
    return Tenant.objects.create(name="Local Norte")


@pytest.fixture
def make_person(db):
    def make(username: str, *memberships: tuple[Tenant, str, bool]):
        user = get_user_model().objects.create_user(username=username, password=PASSWORD)
        for tenant, role, active in memberships:
            Membership.objects.create(user=user, tenant=tenant, role=role, is_active=active)
        return user

    return make


@pytest.fixture
def lucia(make_person, centro, norte):
    """Owner of two shops: has to choose one after logging in."""
    return make_person("lucia", (centro, Role.OWNER, True), (norte, Role.OWNER, True))


@pytest.fixture
def tomas(make_person, norte):
    """Editor in one shop only: goes straight in."""
    return make_person("tomas", (norte, Role.EDITOR, True))


@pytest.fixture
def api() -> APIClient:
    return APIClient()


def log_in(client: APIClient, username: str, password: str = PASSWORD):
    return client.post("/api/auth/login/", {"username": username, "password": password}, format="json")
