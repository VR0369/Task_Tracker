"""Dashboard aggregation — the four cards, computed in the user's timezone."""

from __future__ import annotations

from datetime import timedelta, timezone
from typing import Dict

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

from fastapi import APIRouter, Depends

from .. import crud
from .. import database as dbm
from ..deps import get_current_user
from ..models.enums import TaskStatus
from ..models.misc import DashboardCard, DashboardResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _tz(user: dict):
    name = (user.get("settings") or {}).get("timezone", "UTC")
    if ZoneInfo is None:
        return None
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("UTC")


def _bump(card: Dict[str, int], severity: str) -> None:
    card["total"] += 1
    if severity in ("critical", "high", "low"):
        card[severity] += 1


@router.get("", response_model=DashboardResponse)
async def get_dashboard(user: dict = Depends(get_current_user)):
    tz = _tz(user)
    cals = await crud.list_user_calendars(user["id"])
    cal_ids = [c["id"] for c in cals]

    now = crud.now()
    today = now.astimezone(tz).date() if tz else now.date()
    yesterday = today - timedelta(days=1)
    upcoming_end = today + timedelta(days=3)  # tomorrow + next two days

    empty = lambda: {"total": 0, "critical": 0, "high": 0, "low": 0}
    past_due, due_today, upcoming, completed_yesterday = empty(), empty(), empty(), empty()

    cursor = dbm.col(dbm.TASKS).find({"calendar_id": {"$in": cal_ids}})
    async for t in cursor:
        sev = t.get("severity", "low")
        status = t.get("status")
        if status == TaskStatus.pending.value and t.get("due_at"):
            due = t["due_at"]
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            due_date = due.astimezone(tz).date() if tz else due.date()
            if due_date < today:
                _bump(past_due, sev)
            elif due_date == today:
                _bump(due_today, sev)
            elif today < due_date <= upcoming_end:
                _bump(upcoming, sev)
        elif status == TaskStatus.completed.value and t.get("completed_at"):
            comp = t["completed_at"]
            if comp.tzinfo is None:
                comp = comp.replace(tzinfo=timezone.utc)
            comp_date = comp.astimezone(tz).date() if tz else comp.date()
            if comp_date == yesterday:
                _bump(completed_yesterday, sev)

    return DashboardResponse(
        past_due=DashboardCard(**past_due),
        due_today=DashboardCard(**due_today),
        upcoming=DashboardCard(**upcoming),
        completed_yesterday=DashboardCard(**completed_yesterday),
        generated_at=now,
    )
