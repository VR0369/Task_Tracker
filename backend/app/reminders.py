"""APScheduler job that scans for tasks nearing their deadline.

In this build it logs reminders (and would enqueue email/push in production).
"""

from __future__ import annotations

import logging
from datetime import timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from . import crud
from . import database as dbm
from .models.enums import TaskStatus

logger = logging.getLogger("task_tracker.reminders")
scheduler = AsyncIOScheduler()


async def scan_due_soon() -> None:
    now = crud.now()
    window = now + timedelta(hours=24)
    cursor = dbm.col(dbm.TASKS).find(
        {"status": TaskStatus.pending.value, "due_at": {"$gte": now, "$lte": window}}
    )
    count = 0
    async for _ in cursor:
        count += 1
    if count:
        logger.info("Reminder scan: %d task(s) due within 24h.", count)


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(scan_due_soon, "interval", minutes=30, id="due_soon", replace_existing=True)
        scheduler.start()
        logger.info("Reminder scheduler started.")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
