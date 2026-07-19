"""Sample data seeding.

- ``seed_demo_data`` runs on startup: creates the shared demo account
  (demo@example.com) plus a teammate, populated with sample tasks.
- ``seed_sample_tasks`` populates one calendar with the sample set; the auth
  router calls it when a new user answers "Yes" to the sample-tasks prompt.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from . import crud
from . import database as dbm
from .models.enums import Role, Severity, TaskStatus

logger = logging.getLogger("task_tracker.seed")

DEMO_EMAIL = "demo@example.com"


async def _task(cal_id, user_id, name, severity, due_at, status=TaskStatus.pending, completed_at=None, notes=""):
    now = crud.now()
    await dbm.col(dbm.TASKS).insert_one(
        {
            "_id": crud.new_id(),
            "calendar_id": cal_id,
            "name": name,
            "severity": severity.value,
            "status": status.value,
            "due_at": due_at,
            "notes": notes,
            "created_by": user_id,
            "created_at": now,
            "updated_at": now,
            "completed_at": completed_at,
        }
    )


async def seed_sample_tasks(cal_id, uid, actor) -> None:
    """Populate one calendar with the standard set of sample tasks (relative
    to today, so the dashboard's Past Due / Due Today / Upcoming / Completed
    cards are all populated) plus a starter activity entry."""
    now = crud.now()
    at = lambda days, h=9, m=0: (now + timedelta(days=days)).replace(hour=h, minute=m, second=0, microsecond=0)

    # --- Past due (pending, due < today) ---
    await _task(cal_id, uid, "Submit quarterly tax documents", Severity.critical, at(-3, 17), notes="Attach receipts and mileage log.")
    await _task(cal_id, uid, "Reply to vendor contract email", Severity.high, at(-2, 11))
    await _task(cal_id, uid, "Renew domain subscription", Severity.high, at(-1, 14))
    await _task(cal_id, uid, "Water the office plants", Severity.low, at(-1, 8))

    # --- Due today ---
    await _task(cal_id, uid, "Finish sprint planning deck", Severity.critical, at(0, 15), notes="- Roadmap slide\n- Capacity table\n- Risks")
    await _task(cal_id, uid, "1:1 with Alex", Severity.high, at(0, 13))
    await _task(cal_id, uid, "Order new keyboard", Severity.low, at(0, 18))

    # --- Upcoming (tomorrow + next few days) ---
    await _task(cal_id, uid, "Prepare investor update", Severity.critical, at(1, 10))
    await _task(cal_id, uid, "Design review for onboarding flow", Severity.high, at(2, 14))
    await _task(cal_id, uid, "Book team lunch", Severity.low, at(3, 12))
    await _task(cal_id, uid, "Draft blog post on productivity", Severity.low, at(5, 9))

    # --- Completed yesterday ---
    y = now - timedelta(days=1)
    await _task(cal_id, uid, "Ship v1.2 release notes", Severity.high, at(-1, 16), TaskStatus.completed, y.replace(hour=16, minute=30))
    await _task(cal_id, uid, "Fix login redirect bug", Severity.critical, at(-1, 10), TaskStatus.completed, y.replace(hour=11))
    await _task(cal_id, uid, "Clean up Downloads folder", Severity.low, at(-1, 9), TaskStatus.completed, y.replace(hour=9, minute=15))

    await crud.log_activity(cal_id, actor, "created", "task", 'Created task "Prepare investor update"')


async def seed_demo_data() -> None:
    existing = await crud.get_user_by_email(DEMO_EMAIL)
    if existing:
        logger.info("Seed skipped — demo user already present.")
        return

    demo = await crud.create_user(
        email=DEMO_EMAIL,
        name="Demo User",
        picture="https://api.dicebear.com/7.x/initials/svg?seed=Demo User",
        provider_sub="seed-demo",
    )
    cal_id = demo["default_calendar_id"]

    # A contributor teammate to make collaboration/activity feel real.
    mate = await crud.create_user(
        email="alex@example.com",
        name="Alex Rivera",
        picture="https://api.dicebear.com/7.x/initials/svg?seed=Alex Rivera",
        provider_sub="seed-alex",
    )
    await crud.add_member(cal_id, mate, Role.contributor)

    await seed_sample_tasks(cal_id, demo["id"], demo)
    await crud.log_activity(cal_id, mate, "completed", "task", 'Completed task "Ship v1.2 release notes"')
    logger.info("Seeded demo user (%s) with sample tasks.", DEMO_EMAIL)
