"""Task CRUD with role-based access control, filtering, sorting, pagination."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from .. import crud
from .. import database as dbm
from ..deps import get_current_user
from ..models.enums import Role, Severity, TaskStatus
from ..models.task import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])

_ROLE_RANK = {Role.viewer: 0, Role.contributor: 1, Role.admin: 2}
_SEVERITY_ORDER = {Severity.critical.value: 0, Severity.high.value: 1, Severity.low.value: 2}


def _utc(d: Optional[datetime]) -> Optional[datetime]:
    """Stored datetimes are always tz-aware UTC; naive input is assumed UTC."""
    if d is not None and d.tzinfo is None:
        return d.replace(tzinfo=timezone.utc)
    return d


def _serialize(t: dict) -> TaskOut:
    return TaskOut(**crud.doc(t) if "_id" in t else t)


async def _member_calendar_ids(user: dict) -> List[str]:
    cals = await crud.list_user_calendars(user["id"])
    return [c["id"] for c in cals]


async def _require_write(user: dict, calendar_id: str, minimum: Role = Role.contributor) -> dict:
    calendar = await crud.get_calendar(calendar_id)
    if calendar is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Calendar not found")
    role = crud.role_in_calendar(calendar, user["id"])
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this calendar")
    if _ROLE_RANK[Role(role)] < _ROLE_RANK[minimum]:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Your role '{role}' cannot perform this action (needs '{minimum.value}').",
        )
    return calendar


@router.get("", response_model=dict)
async def list_tasks(
    user: dict = Depends(get_current_user),
    calendar_id: Optional[str] = None,
    search: Optional[str] = Query(default=None, description="Match on task name"),
    severity: Optional[Severity] = None,
    task_status: Optional[TaskStatus] = Query(default=None, alias="status"),
    due_from: Optional[datetime] = None,
    due_to: Optional[datetime] = None,
    sort: str = Query(default="due_at", pattern="^(due_at|start_at|severity|name)$"),
    order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    cal_ids = [calendar_id] if calendar_id else await _member_calendar_ids(user)
    query: dict = {"calendar_id": {"$in": cal_ids}}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if severity:
        query["severity"] = severity.value
    if task_status:
        query["status"] = task_status.value
    if due_from or due_to:
        rng: dict = {}
        if due_from:
            rng["$gte"] = due_from
        if due_to:
            rng["$lte"] = due_to
        query["due_at"] = rng

    total = await dbm.col(dbm.TASKS).count_documents(query)
    cursor = dbm.col(dbm.TASKS).find(query)
    items = [crud.doc(t) async for t in cursor]

    # Sort in Python for consistent behaviour across Motor & mongomock.
    reverse = order == "desc"
    if sort == "severity":
        items.sort(key=lambda t: (_SEVERITY_ORDER.get(t["severity"], 9), t["due_at"]), reverse=reverse)
    elif sort == "name":
        items.sort(key=lambda t: t["name"].lower(), reverse=reverse)
    elif sort == "start_at":
        # Tasks without a start date sort by their due date instead.
        items.sort(key=lambda t: t.get("start_at") or t["due_at"], reverse=reverse)
    else:  # due_at (default): earliest date, then earliest time
        items.sort(key=lambda t: t["due_at"], reverse=reverse)

    start = (page - 1) * page_size
    page_items = items[start : start + page_size]
    return {
        "items": [TaskOut(**t).model_dump(mode="json") for t in page_items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, user: dict = Depends(get_current_user)):
    calendar_id = body.calendar_id or user.get("default_calendar_id")
    if not calendar_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No calendar available")
    await _require_write(user, calendar_id, Role.contributor)

    now = crud.now()
    due = _utc(body.due_at)
    task = {
        "_id": crud.new_id(),
        "calendar_id": calendar_id,
        "name": body.name,
        "severity": body.severity.value,
        "status": TaskStatus.pending.value,
        "start_at": _utc(body.start_at),
        "due_at": due,
        "notes": body.notes or "",
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }
    await dbm.col(dbm.TASKS).insert_one(task)
    await crud.log_activity(
        calendar_id, user, "created", "task", f'Created task "{body.name}"', task["_id"]
    )
    return _serialize(task)


async def _get_owned_task(task_id: str, user: dict) -> dict:
    task = await dbm.col(dbm.TASKS).find_one({"_id": task_id})
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return crud.doc(task)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    task = await _get_owned_task(task_id, user)
    # Any member (incl. viewer) may read.
    calendar = await crud.get_calendar(task["calendar_id"])
    if calendar is None or crud.role_in_calendar(calendar, user["id"]) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this calendar")
    return TaskOut(**task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, body: TaskUpdate, user: dict = Depends(get_current_user)):
    task = await _get_owned_task(task_id, user)
    await _require_write(user, task["calendar_id"], Role.contributor)

    changes: dict = {"updated_at": crud.now()}
    if body.name is not None:
        changes["name"] = body.name.strip()
    if body.severity is not None:
        changes["severity"] = body.severity.value
    if body.due_at is not None:
        changes["due_at"] = _utc(body.due_at)
    # Sent explicitly as null -> clear the start date; omitted -> leave as is.
    if "start_at" in body.model_fields_set:
        changes["start_at"] = _utc(body.start_at)
    # Compare against whichever of the pair is not being changed in this request.
    start = changes.get("start_at", _utc(task.get("start_at")))
    due = changes.get("due_at", _utc(task["due_at"]))
    if start is not None and start > due:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Start date cannot be after the due date"
        )
    if body.notes is not None:
        changes["notes"] = body.notes
    if body.status is not None:
        changes["status"] = body.status.value
        changes["completed_at"] = crud.now() if body.status == TaskStatus.completed else None

    await dbm.col(dbm.TASKS).update_one({"_id": task_id}, {"$set": changes})
    await crud.log_activity(
        task["calendar_id"], user, "updated", "task", f'Updated task "{task["name"]}"', task_id
    )
    return TaskOut(**await _get_owned_task(task_id, user))


@router.post("/{task_id}/complete", response_model=TaskOut)
async def complete_task(
    task_id: str,
    completed: bool = Query(default=True),
    user: dict = Depends(get_current_user),
):
    task = await _get_owned_task(task_id, user)
    await _require_write(user, task["calendar_id"], Role.contributor)
    changes = {
        "status": TaskStatus.completed.value if completed else TaskStatus.pending.value,
        "completed_at": crud.now() if completed else None,
        "updated_at": crud.now(),
    }
    await dbm.col(dbm.TASKS).update_one({"_id": task_id}, {"$set": changes})
    verb = "completed" if completed else "reopened"
    await crud.log_activity(
        task["calendar_id"], user, verb, "task", f'{verb.title()} task "{task["name"]}"', task_id
    )
    return TaskOut(**await _get_owned_task(task_id, user))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    task = await _get_owned_task(task_id, user)
    await _require_write(user, task["calendar_id"], Role.contributor)
    await dbm.col(dbm.TASKS).delete_one({"_id": task_id})
    await crud.log_activity(
        task["calendar_id"], user, "deleted", "task", f'Deleted task "{task["name"]}"', task_id
    )
    return None
