"""Invitation workflow (parent–child membership).

Flow:
  1. Admin creates an invite -> status "pending" (+ expiry), link is emailed.
  2. Recipient signs in (Google) with the *invited* email and accepts the
     token -> the signed-in email must match the invitation, and they are
     immediately added as a member of the admin's calendar (a child member;
     no new workspace is created) and their default calendar switches to it.
  Admins can also revoke a still-pending invite, or remove a member later.
  Tokens are single-use and expire; expired ones are lazily marked "expired".
"""

from __future__ import annotations

import secrets
from datetime import timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status

from .. import crud
from .. import database as dbm
from ..config import settings
from ..deps import get_current_user
from ..models.enums import Role
from ..models.misc import InvitationCreate, InvitationOut, InvitationPreview, MemberRoleUpdate
from ..services import mailer

router = APIRouter(prefix="/invites", tags=["invites"])


def _is_expired(inv: dict) -> bool:
    exp = inv.get("expires_at")
    if not exp:
        return False
    if exp.tzinfo is None:  # mock DB returns naive datetimes; treat as UTC
        exp = exp.replace(tzinfo=timezone.utc)
    return crud.now() > exp


async def _maybe_expire(inv: dict) -> dict:
    """Lazily flip a stale pending invite to 'expired'."""
    if inv.get("status") == "pending" and _is_expired(inv):
        await dbm.col(dbm.INVITATIONS).update_one(
            {"_id": inv["_id"]}, {"$set": {"status": "expired"}}
        )
        inv["status"] = "expired"
    return inv


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

    email = body.email.lower()
    if any(m.get("email", "").lower() == email for m in cal.get("members", [])):
        raise HTTPException(status.HTTP_409_CONFLICT, "That email is already a member")

    now = crud.now()
    token = secrets.token_urlsafe(32)  # ~43 chars, single-use
    inv = {
        "_id": crud.new_id(),
        "calendar_id": calendar_id,
        "email": email,
        "role": body.role.value,
        "status": "pending",
        "token": token,
        "invited_by": user["id"],
        "claimed_by": None,
        "created_at": now,
        "expires_at": now + timedelta(days=settings.invite_expiry_days),
    }
    await dbm.col(dbm.INVITATIONS).insert_one(inv)
    await crud.log_activity(
        calendar_id, user, "invited", "user",
        f'Invited {email} as {body.role.value}', inv["_id"],
    )
    link = f"{settings.frontend_url}/invite/accept?token={token}"
    email_sent = await mailer.send_invite_email(
        to=email, link=link, inviter_name=user.get("name", "A teammate"),
        calendar_name=cal["name"], role=body.role.value,
    )
    return {
        "invitation": _out(crud.doc(inv), cal["name"]).model_dump(mode="json"),
        "link": link,
        "email_sent": email_sent,
    }


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
        async for inv in dbm.col(dbm.INVITATIONS).find({"calendar_id": cid}):
            inv = await _maybe_expire(inv)
            out.append(_out(crud.doc(inv), cal["name"]))
    out.sort(key=lambda i: i.created_at, reverse=True)
    return out


@router.get("/token/{token}", response_model=InvitationPreview)
async def preview_invite(token: str):
    """Public preview for the accept page — no auth, non-sensitive fields only."""
    inv = await dbm.col(dbm.INVITATIONS).find_one({"token": token})
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    inv = await _maybe_expire(inv)
    cal = await crud.get_calendar(inv["calendar_id"])
    inviter = await crud.get_user(inv["invited_by"])
    return InvitationPreview(
        calendar_id=inv["calendar_id"],
        calendar_name=cal["name"] if cal else "a workspace",
        email=inv["email"],
        role=Role(inv["role"]),
        status=inv["status"],
        inviter_name=inviter["name"] if inviter else "A teammate",
        expires_at=inv.get("expires_at"),
        expired=_is_expired(inv),
    )


@router.post("/accept", response_model=InvitationOut)
async def accept_invite(token: str = Body(..., embed=True), user: dict = Depends(get_current_user)):
    inv = await dbm.col(dbm.INVITATIONS).find_one({"token": token})
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    inv = await _maybe_expire(inv)
    if inv["status"] == "expired" or _is_expired(inv):
        raise HTTPException(status.HTTP_410_GONE, "This invitation has expired")
    if inv["status"] != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Invitation already {inv['status']}")
    # Security: the signed-in user must be the person who was invited.
    if user["email"].lower() != inv["email"].lower():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"This invitation was sent to {inv['email']}. Sign in with that Google account to accept.",
        )
    # The email match above is the only vetting this app does, so join immediately
    # rather than leaving the member stranded on their own calendar awaiting approval.
    await crud.add_member(inv["calendar_id"], user, Role(inv["role"]), invited_by=inv["invited_by"])
    await crud.update_user(user["id"], {"default_calendar_id": inv["calendar_id"]})
    await dbm.col(dbm.INVITATIONS).update_one(
        {"_id": inv["_id"]},
        {"$set": {"status": "approved", "claimed_by": user["id"], "accepted_at": crud.now()}},
    )
    await crud.log_activity(
        inv["calendar_id"], user, "joined", "user",
        f'{user["name"]} joined as {inv["role"]}', inv["_id"],
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
    await crud.add_member(inv["calendar_id"], claimant, Role(inv["role"]), invited_by=inv["invited_by"])
    await dbm.col(dbm.INVITATIONS).update_one(
        {"_id": invite_id}, {"$set": {"status": "approved", "accepted_at": crud.now()}}
    )
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


@router.post("/{invite_id}/revoke", response_model=InvitationOut)
async def revoke_invite(invite_id: str, user: dict = Depends(get_current_user)):
    inv = await dbm.col(dbm.INVITATIONS).find_one({"_id": invite_id})
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    await _require_admin(user, inv["calendar_id"])
    if inv["status"] not in ("pending", "awaiting_approval", "expired"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot revoke a {inv['status']} invitation")
    await dbm.col(dbm.INVITATIONS).update_one({"_id": invite_id}, {"$set": {"status": "revoked"}})
    await crud.log_activity(
        inv["calendar_id"], user, "revoked", "user",
        f'Revoked invitation to {inv["email"]}', invite_id,
    )
    inv = await dbm.col(dbm.INVITATIONS).find_one({"_id": invite_id})
    return _out(crud.doc(inv))


@router.patch("/members/{member_id}", response_model=dict)
async def update_member_role(
    member_id: str,
    body: MemberRoleUpdate,
    user: dict = Depends(get_current_user),
    calendar_id: Optional[str] = None,
):
    cid = calendar_id or user.get("default_calendar_id")
    cal = await _require_admin(user, cid)
    if member_id == cal["owner_id"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot change the calendar owner's role")
    if crud.role_in_calendar(cal, member_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    await crud.update_member_role(cid, member_id, body.role)
    await crud.log_activity(
        cid, user, "role_changed", "user", f"Changed a member's role to {body.role.value}", member_id,
    )
    return {"member_id": member_id, "role": body.role.value}


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
