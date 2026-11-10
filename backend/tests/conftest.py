import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APIClient

from accounts.models import Membership, Role
from core.models import Tenant
from notebooks.models import Category, Entry, Kind

PASSWORD = "una-clave-de-prueba-larga"  # noqa: S105 - test data, not a secret


@pytest.fixture(autouse=True)
def fast_password_hasher(settings):
    """Production hashes are slow on purpose. Tests do not need that."""
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def plain_static_files(settings):
    """Tests never depend on collectstatic: pages that link static files (the admin) render
    without the manifest, like on a fresh CI machine."""
    settings.STORAGES = {
        **settings.STORAGES,
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }


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


@pytest.fixture
def categories(centro, norte):
    made = {}
    for tenant in (centro, norte):
        made[tenant.name, Kind.INCOME] = Category.objects.create(
            tenant=tenant, kind=Kind.INCOME, name="Ventas"
        )
        made[tenant.name, Kind.EXPENSE] = Category.objects.create(
            tenant=tenant, kind=Kind.EXPENSE, name="Proveedores"
        )
    return made


@pytest.fixture
def as_role(api, make_person, norte, categories):
    """Logs in a person with the given role in Local Norte only."""

    def login(role: str):
        make_person(f"u-{role}", (norte, role, True))
        log_in(api, f"u-{role}")
        return api

    return login


ENTRIES = "/api/notebooks/entries/"


def entry(categories, shop="Local Norte", **overrides):
    data = {
        "date": "2026-10-10",
        "kind": Kind.EXPENSE,
        "category_id": str(categories[shop, Kind.EXPENSE].id),
        "description": "algo",
        "amount": "1000.00",
        "payment_method": "cash",
        "shift": "night",
    }
    return data | overrides


@pytest.fixture
def loaded(as_role, categories, norte, centro):
    """Local Norte with a debit cost and its sale, a voided entry, an opening haber and settings.
    Local Centro with one entry of its own."""
    owner = as_role(Role.OWNER)
    owner.post(ENTRIES, entry(categories, payment_method="debit", add_sale=True), format="json")
    voided = owner.post(ENTRIES, entry(categories, description="mal"), format="json").data["id"]
    owner.post(f"{ENTRIES}{voided}/void/", {"reason": "cargado dos veces"}, format="json")
    owner.put(
        "/api/notebooks/cash/opening/",
        {"amount": "500000"},
        format="json",
    )
    owner.put("/api/notebooks/settings/", {"sale_methods": ["debit"]}, format="json")
    user = get_user_model().objects.get(memberships__tenant=norte)
    Entry.objects.create(
        tenant=centro,
        category=categories["Local Centro", Kind.EXPENSE],
        kind=Kind.EXPENSE,
        date="2026-10-10",
        amount="5.00",
        payment_method="cash",
        shift="night",
        created_by=user,
    )
    return owner, user


@pytest.fixture
def admin_client(db):
    user = get_user_model().objects.create_superuser("admin", password=PASSWORD)
    client = Client()
    client.force_login(user)
    return client
