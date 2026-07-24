"""Activity log — recent actions across the user's calendars."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from .. import crud
from .. import database as dbm
from ..deps import get_current_user
from ..models.misc import ActivityLogOut

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=List[ActivityLogOut])
async def list_activity(
    user: dict = Depends(get_current_user),
    calendar_id: Optional[str] = None,
    scope: Optional[str] = Query(default=None, pattern="^(personal|shared|all)$"),
    limit: int = Query(default=25, ge=1, le=200),
):
    if calendar_id:
        query: dict = {"calendar_id": {"$in": [calendar_id]}}
    else:
        cals = await crud.list_user_calendars(user["id"])
        query = crud.scope_filter(cals, user["id"], scope)
    cursor = dbm.col(dbm.ACTIVITY_LOGS).find(query)
    items = [crud.doc(a) async for a in cursor]
    items.sort(key=lambda a: a["created_at"], reverse=True)
    return [ActivityLogOut(**a) for a in items[:limit]]
