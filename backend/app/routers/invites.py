"""Invitation workflow.

Flow:
  1. Admin creates an invite  -> status "pending", link with token returned.
  2. Recipient logs in (Google) and accepts the token -> "awaiting_approval".
  3. Admin approves -> recipient added as calendar member with the role.
     (or rejects -> "rejected")
"""

from __future__ import annotations

import secrets
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status

from .. import crud
from .. import database as dbm
from ..config import settings
from ..deps import get_current_user
from ..models.enums import Role
from ..models.misc import InvitationCreate, InvitationOut

router = APIRouter(prefix="/invites", tags=["invites"])


async def _require_admin(user: dict, calendar_id: str) -> dict:
    cal = await crud.get_calendar(calendar_id)
    if cal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Calendar not found")
    if crud.role_in_calendar(cal, user["id"]) != Role.admin.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an admin can manage invitations")
    return cal


def _out(inv: dict, calendar_name: Optional[str] = None) -> InvitationOut:
    return InvitationOut(calendar_name=calendar_name, **inv)


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_invite(body: InvitationCreate, user: dict = Depends(get_current_user)):
    calendar_id = body.calendar_id or user.get("default_calendar_id")
    cal = await _require_admin(user, calendar_id)

    token = secrets.token_urlsafe(24)
    inv = {
        "_id": crud.new_id(),
        "calendar_id": calendar_id,
        "email": body.email.lower(),
        "role": body.role.value,
        "status": "pending",
        "token": token,
        "invited_by": user["id"],
        "claimed_by": None,
        "created_at": crud.now(),
    }
    await dbm.col(dbm.INVITATIONS).insert_one(inv)
    await crud.log_activity(
        calendar_id, user, "invited", "user",
        f'Invited {body.email} as {body.role.value}', inv["_id"],
    )
    link = f"{settings.frontend_url}/invite/accept?token={token}"
    return {"invitation": _out(crud.doc(inv), cal["name"]).model_dump(mode="json"), "link": link}


@router.get("", response_model=List[InvitationOut])
async def list_invites(user: dict = Depends(get_current_user), calendar_id: Optional[str] = None):
    cal_ids = (
        [calendar_id]
        if calendar_id
        else [c["id"] for c in await crud.list_user_calendars(user["id"]) if c.get("owner_id") == user["id"]]
    )
    out: List[InvitationOut] = []
    for cid in cal_ids:
        cal = await crud.get_calendar(cid)
        if not cal or crud.role_in_calendar(cal, user["id"]) != Role.admin.value:
            continue
        cursor = dbm.col(dbm.INVITATIONS).find({"calendar_id": cid})
        async for inv in cursor:
            out.append(_out(crud.doc(inv), cal["name"]))
    out.sort(key=lambda i: i.created_at, reverse=True)
    return out


@router.post("/accept", response_model=InvitationOut)
async def accept_invite(token: str = Body(..., embed=True), user: dict = Depends(get_current_user)):
    inv = await dbm.col(dbm.INVITATIONS).find_one({"token": token})
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    if inv["status"] not in ("pending",):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Invitation already {inv['status']}")
    await dbm.col(dbm.INVITATIONS).update_one(
        {"_id": inv["_id"]},
        {"$set": {"status": "awaiting_approval", "claimed_by": user["id"], "email": user["email"]}},
    )
    await crud.log_activity(
        inv["calendar_id"], user, "requested_access", "user",
        f'{user["name"]} accepted an invitation and awaits approval', inv["_id"],
    )
    inv = await dbm.col(dbm.INVITATIONS).find_one({"_id": inv["_id"]})
    return _out(crud.doc(inv))


@router.post("/{invite_id}/approve", response_model=InvitationOut)
async def approve_invite(invite_id: str, user: dict = Depends(get_current_user)):
    inv = await dbm.col(dbm.INVITATIONS).find_one({"_id": invite_id})
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    await _require_admin(user, inv["calendar_id"])
    if inv["status"] != "awaiting_approval" or not inv.get("claimed_by"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Invitation is not awaiting approval")

    claimant = await crud.get_user(inv["claimed_by"])
    if claimant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Claiming user not found")
    await crud.add_member(inv["calendar_id"], claimant, Role(inv["role"]))
    await dbm.col(dbm.INVITATIONS).update_one({"_id": invite_id}, {"$set": {"status": "approved"}})
    await crud.log_activity(
        inv["calendar_id"], user, "approved", "user",
        f'Approved {claimant["name"]} as {inv["role"]}', invite_id,
    )
    inv = await dbm.col(dbm.INVITATIONS).find_one({"_id": invite_id})
    return _out(crud.doc(inv))


@router.post("/{invite_id}/reject", response_model=InvitationOut)
async def reject_invite(invite_id: str, user: dict = Depends(get_current_user)):
    inv = await dbm.col(dbm.INVITATIONS).find_one({"_id": invite_id})
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    await _require_admin(user, inv["calendar_id"])
    await dbm.col(dbm.INVITATIONS).update_one({"_id": invite_id}, {"$set": {"status": "rejected"}})
    inv = await dbm.col(dbm.INVITATIONS).find_one({"_id": invite_id})
    return _out(crud.doc(inv))


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: str, user: dict = Depends(get_current_user), calendar_id: Optional[str] = None
):
    cid = calendar_id or user.get("default_calendar_id")
    cal = await _require_admin(user, cid)
    if member_id == cal["owner_id"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot remove the calendar owner")
    await crud.remove_member(cid, member_id)
    await crud.log_activity(cid, user, "removed", "user", "Removed a member", member_id)
    return None
