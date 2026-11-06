"""Suggestions for the description while loading (HU-030)."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from accounts.models import Role
from notebooks.models import Entry, Kind
from notebooks.suggestions import description_suggestions, normalize

pytestmark = pytest.mark.django_db

URL = "/api/notebooks/descriptions/"


@pytest.fixture
def add(categories):
    """Writes entries straight to the table: these tests are about reading them."""
    user = get_user_model().objects.create(username="quien-carga")

    def add(text, *, shop="Local Norte", kind=Kind.EXPENSE, day=10, **extra):
        category = categories[shop, kind]
        return Entry.objects.create(
            tenant=category.tenant,
            category=category,
            kind=kind,
            date=date(2026, 10, day),
            description=text,
            amount=Decimal("1000.00"),
            payment_method="cash",
            shift="night",
            created_by=user,
            **extra,
        )

    return add


def suggest(norte, text, kind=Kind.EXPENSE):
    return description_suggestions(norte, kind, text)


def test_normalize_drops_accents_case_and_extra_spaces():
    assert normalize("  Carnicería   DON José ") == "carniceria don jose"


def test_it_finds_the_start_of_any_word_without_accents_or_case(add, norte):
    add("Carnicería")
    add("Pago carnicería del mes")
    add("Escarcha")  # "carn" is inside a word, not at its start

    assert suggest(norte, "CARNI") == ["Carnicería", "Pago carnicería del mes"]
    assert suggest(norte, "carniceri") == ["Carnicería", "Pago carnicería del mes"]


def test_texts_that_start_with_the_query_come_first_then_the_most_used(add, norte):
    add("Pan de campo")
    for _ in range(3):
        add("Proveedor de pan")
    add("Pan")
    add("Pan")

    assert suggest(norte, "pan") == ["Pan", "Pan de campo", "Proveedor de pan"]


def test_with_the_same_uses_the_most_recent_goes_first(add, norte):
    add("Verdulería", day=1)
    add("Verdu", day=20)

    assert suggest(norte, "ver") == ["Verdu", "Verdulería"]


def test_the_same_text_with_other_case_counts_once_with_its_most_used_spelling(add, norte):
    add("verdu")
    add("Verdu")
    add("Verdu")

    assert suggest(norte, "ve") == ["Verdu"]


def test_only_the_same_kind_and_the_same_shop(add, norte):
    add("Venta mostrador", kind=Kind.INCOME)
    add("Verdu", shop="Local Centro")
    add("Verdu de la esquina")

    assert suggest(norte, "ve") == ["Verdu de la esquina"]
    assert suggest(norte, "ve", Kind.INCOME) == ["Venta mostrador"]


def test_voided_entries_and_sales_made_from_a_cost_are_left_out(add, norte):
    cost = add("Luz")
    add("Luz vieja", is_voided=True, void_reason="mal cargado")
    add("Gasto con débito: Servicios (Luz)", kind=Kind.INCOME, from_expense=cost)

    assert suggest(norte, "luz") == ["Luz"]
    assert suggest(norte, "luz", Kind.INCOME) == []


def test_at_most_eight_and_nothing_for_an_empty_query(add, norte):
    for n in range(12):
        add(f"Proveedor {n:02}")

    assert len(suggest(norte, "prov")) == 8
    assert suggest(norte, "   ") == []


# ---------- the API ----------


def test_the_api_answers_with_the_list(as_role, add):
    add("Carnicería")

    response = as_role(Role.EDITOR).get(URL, {"kind": "expense", "q": "carn"})

    assert response.status_code == 200
    assert response.data == {"results": ["Carnicería"]}


def test_the_kind_is_required(as_role):
    response = as_role(Role.EDITOR).get(URL, {"q": "carn"})
    assert response.status_code == 400


def test_who_only_looks_does_not_need_suggestions(as_role):
    response = as_role(Role.VIEWER).get(URL, {"kind": "expense", "q": "carn"})
    assert response.status_code == 403
