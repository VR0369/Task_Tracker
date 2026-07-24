"""Pure date-generation logic for recurring task series."""

from __future__ import annotations

import calendar
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from ..models.enums import RecurrenceFrequency

HARD_CAP = 100


def _add_months(d: datetime, months: int) -> datetime:
    """Add calendar months, clamping to the last valid day of the target month
    (e.g. Jan 31 + 1 month -> Feb 28/29, not an error or a roll into March)."""
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(d.day, last_day)
    return d.replace(year=year, month=month, day=day)


def generate_occurrences(
    start_at: Optional[datetime],
    due_at: datetime,
    frequency: RecurrenceFrequency,
    interval: int,
    until: Optional[datetime] = None,
    count: Optional[int] = None,
    hard_cap: int = HARD_CAP,
) -> List[Tuple[Optional[datetime], datetime]]:
    """Return [(start_at, due_at), ...] for a recurring series.

    The first item is always the original occurrence as given. Each
    occurrence preserves the same time-of-day and the same start->due offset
    as the original. The series stops at ``min(count, hard_cap)`` occurrences,
    or as soon as a generated due date would exceed ``until``.
    """
    offset = (due_at - start_at) if start_at is not None else None
    max_n = min(count, hard_cap) if count is not None else hard_cap

    def nth_due(n: int) -> datetime:
        if frequency == RecurrenceFrequency.daily:
            return due_at + timedelta(days=interval * n)
        if frequency == RecurrenceFrequency.weekly:
            return due_at + timedelta(weeks=interval * n)
        return _add_months(due_at, interval * n)

    occurrences: List[Tuple[Optional[datetime], datetime]] = []
    for n in range(max_n):
        next_due = nth_due(n)
        if until is not None and n > 0 and next_due > until:
            break
        next_start = (next_due - offset) if offset is not None else None
        occurrences.append((next_start, next_due))
    return occurrences
