"""The demo seed: made up data for local development and the browser tests."""

from datetime import date
from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from notebooks.models import CashOpening, Entry

pytestmark = pytest.mark.django_db


def test_seed_can_pin_today_so_browser_tests_do_not_depend_on_the_calendar():
    call_command("seed_demo", today=date(2026, 3, 11), stdout=StringIO())
    days = sorted({e.date for e in Entry.objects.all()})
    assert days == [date(2026, 3, 9), date(2026, 3, 10), date(2026, 3, 11)]
    assert CashOpening.objects.get().date == date(2026, 3, 8)


def test_seed_keeps_every_sample_inside_the_month_on_the_first_day():
    call_command("seed_demo", today=date(2026, 3, 1), stdout=StringIO())
    assert {e.date for e in Entry.objects.all()} == {date(2026, 3, 1)}


def test_seed_refuses_to_run_twice():
    call_command("seed_demo", today=date(2026, 3, 11), stdout=StringIO())
    with pytest.raises(CommandError):
        call_command("seed_demo", stdout=StringIO())
