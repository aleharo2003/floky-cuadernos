"""The owner adds categories from the load form (HU-022)."""

import pytest

from accounts.models import Role
from core.models import AuditEntry
from notebooks.models import Category, Kind

pytestmark = pytest.mark.django_db

URL = "/api/notebooks/categories/"


def add(api, name, kind="expense"):
    return api.post(URL, {"name": name, "kind": kind}, format="json")


def test_owner_adds_a_category_and_it_is_audited(as_role, norte):
    api = as_role(Role.OWNER)

    response = add(api, "  Carnicería   del  barrio ")

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Carnicería del barrio"  # extra spaces cleaned
    assert body["kind"] == "expense"
    category = Category.objects.get(id=body["id"])
    assert category.tenant == norte
    assert AuditEntry.objects.filter(
        entity="category", entity_id=category.id, action="category.create"
    ).exists()
    assert any(c["name"] == "Carnicería del barrio" for c in api.get(URL).json())


@pytest.mark.parametrize("role", [Role.EDITOR, Role.VIEWER])
def test_only_the_owner_adds_categories(as_role, role):
    api = as_role(role)

    assert add(api, "Hielo").status_code == 403
    assert not Category.objects.filter(name="Hielo").exists()


def test_same_name_ignoring_case_is_rejected(as_role, categories):
    api = as_role(Role.OWNER)  # Local Norte already has "Proveedores" (expense) and "Ventas" (income)

    response = add(api, "proveedores")

    assert response.status_code == 400
    assert "Ya existe" in response.json()["detail"]
    assert add(api, "Proveedores", kind="income").status_code == 201  # same name, other kind: fine


def test_a_deactivated_category_comes_back_instead_of_a_twin(as_role, categories):
    old = categories["Local Norte", Kind.EXPENSE]
    old.is_active = False
    old.save()
    api = as_role(Role.OWNER)

    response = add(api, "PROVEEDORES")

    assert response.status_code == 200
    assert response.json()["id"] == str(old.id)
    old.refresh_from_db()
    assert old.is_active
    assert (
        Category.objects.filter(tenant=old.tenant, kind=Kind.EXPENSE, name__iexact="proveedores").count() == 1
    )


def test_the_new_category_belongs_to_the_active_shop_only(as_role, centro):
    api = as_role(Role.OWNER)

    add(api, "Solo Norte")

    assert not Category.objects.filter(tenant=centro, name="Solo Norte").exists()


@pytest.mark.parametrize(
    ("name", "kind"), [("", "expense"), ("   ", "expense"), ("x" * 61, "expense"), ("Ok", "otro")]
)
def test_invalid_input_is_rejected(as_role, name, kind):
    api = as_role(Role.OWNER)

    assert add(api, name, kind).status_code == 400
