from datetime import datetime, timedelta, timezone

from app.models.enums import RecurrenceFrequency
from app.services.recurrence import HARD_CAP, generate_occurrences


def _dt(*args, **kwargs):
    return datetime(*args, tzinfo=timezone.utc, **kwargs)


def test_daily_spacing():
    due = _dt(2030, 1, 1, 9, 0)
    occ = generate_occurrences(None, due, RecurrenceFrequency.daily, interval=2, count=4)
    assert [d.day for _, d in occ] == [1, 3, 5, 7]


def test_weekly_spacing():
    due = _dt(2030, 1, 1, 9, 0)
    occ = generate_occurrences(None, due, RecurrenceFrequency.weekly, interval=1, count=3)
    days = [d.day for _, d in occ]
    assert days == [1, 8, 15]


def test_monthly_clamps_short_months():
    due = _dt(2030, 1, 31, 9, 0)  # 2030 is not a leap year
    occ = generate_occurrences(None, due, RecurrenceFrequency.monthly, interval=1, count=3)
    assert [(d.month, d.day) for _, d in occ] == [(1, 31), (2, 28), (3, 31)]


def test_preserves_start_due_offset_and_time_of_day():
    start = _dt(2030, 1, 1, 8, 30)
    due = _dt(2030, 1, 1, 9, 0)
    occ = generate_occurrences(start, due, RecurrenceFrequency.daily, interval=1, count=3)
    for occ_start, occ_due in occ:
        assert occ_due - occ_start == timedelta(minutes=30)
        assert occ_due.time() == due.time()


def test_until_boundary_excludes_first_occurrence_past_it():
    due = _dt(2030, 1, 1, 9, 0)
    until = _dt(2030, 1, 10, 9, 0)  # exactly 9 days out
    occ = generate_occurrences(None, due, RecurrenceFrequency.daily, interval=3, until=until)
    # Days 1, 4, 7, 10 all <= until; day 13 would exceed it.
    assert [d.day for _, d in occ] == [1, 4, 7, 10]


def test_until_always_includes_original_even_if_past_until():
    due = _dt(2030, 1, 1, 9, 0)
    until = _dt(2029, 12, 1, 9, 0)  # before due, degenerate input
    occ = generate_occurrences(None, due, RecurrenceFrequency.daily, interval=1, until=until)
    assert len(occ) == 1
    assert occ[0][1] == due


def test_hard_cap_enforced_with_count():
    due = _dt(2030, 1, 1, 9, 0)
    occ = generate_occurrences(
        None, due, RecurrenceFrequency.daily, interval=1, count=HARD_CAP + 50
    )
    assert len(occ) == HARD_CAP


def test_hard_cap_enforced_with_far_until():
    due = _dt(2030, 1, 1, 9, 0)
    until = _dt(2040, 1, 1, 9, 0)
    occ = generate_occurrences(None, due, RecurrenceFrequency.daily, interval=1, until=until)
    assert len(occ) == HARD_CAP
