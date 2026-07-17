"""Calendars: list the user's calendars and their members."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from .. import crud
from ..deps import get_current_user
from ..models.enums import Role
from ..models.misc import CalendarOut

router = APIRouter(prefix="/calendars", tags=["calendars"])


def _with_role(cal: dict, user_id: str) -> CalendarOut:
    role = crud.role_in_calendar(cal, user_id)
    return CalendarOut(**cal, my_role=Role(role) if role else None)


@router.get("", response_model=List[CalendarOut])
async def list_calendars(user: dict = Depends(get_current_user)):
    cals = await crud.list_user_calendars(user["id"])
    return [_with_role(c, user["id"]) for c in cals]


@router.get("/{calendar_id}", response_model=CalendarOut)
async def get_calendar(calendar_id: str, user: dict = Depends(get_current_user)):
    cal = await crud.get_calendar(calendar_id)
    if cal is None or crud.role_in_calendar(cal, user["id"]) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Calendar not found")
    return _with_role(cal, user["id"])
