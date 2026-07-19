"""Data-access helpers shared across routers.

Documents use string UUIDs for ``_id`` (portable JSON, no ObjectId juggling).
``doc()`` renames ``_id`` -> ``id`` on the way out.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import database as dbm
from .models.enums import Role

# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def doc(d: Optional[dict]) -> Optional[dict]:
    if d is None:
        return None
    d = dict(d)
    if "_id" in d:
        d["id"] = d.pop("_id")
    return d


# --------------------------------------------------------------------------- #
# users
# --------------------------------------------------------------------------- #

async def get_user_by_email(email: str) -> Optional[dict]:
    return doc(await dbm.col(dbm.USERS).find_one({"email": email.lower()}))


async def get_user(user_id: str) -> Optional[dict]:
    return doc(await dbm.col(dbm.USERS).find_one({"_id": user_id}))


async def create_user(email: str, name: str, picture: str, provider_sub: str) -> dict:
    user_id = new_id()
    default_settings = {
        "theme": "system",
        "accent_color": "#7c5cff",
        "timezone": "America/New_York",
        "date_format": "MMM D, YYYY",
        "default_calendar_view": "month",
        "weather_location": "New York",
        "weather_location_key": None,
        "notifications": {
            "task_created": True,
            "task_completed": True,
            "invitations": True,
            "email_reminders": False,
        },
    }
    user = {
        "_id": user_id,
        "email": email.lower(),
        "name": name,
        "picture": picture,
        "provider": "google",
        "provider_sub": provider_sub,
        "settings": default_settings,
        "default_calendar_id": None,
        "sample_prompt_seen": False,  # new user → show the one-time sample-tasks prompt
        "created_at": now(),
    }
    await dbm.col(dbm.USERS).insert_one(user)

    # Give every user a personal calendar where they are admin.
    cal = await create_calendar(f"{name.split()[0]}'s Calendar", doc(user))
    await dbm.col(dbm.USERS).update_one(
        {"_id": user_id}, {"$set": {"default_calendar_id": cal["id"]}}
    )
    user["default_calendar_id"] = cal["id"]
    return doc(user)


async def update_user(user_id: str, changes: Dict[str, Any]) -> Optional[dict]:
    if changes:
        await dbm.col(dbm.USERS).update_one({"_id": user_id}, {"$set": changes})
    return await get_user(user_id)


# --------------------------------------------------------------------------- #
# calendars & membership
# --------------------------------------------------------------------------- #

async def create_calendar(name: str, owner: dict) -> dict:
    cal_id = new_id()
    cal = {
        "_id": cal_id,
        "name": name,
        "owner_id": owner["id"],
        "members": [
            {
                "user_id": owner["id"],
                "email": owner["email"],
                "name": owner["name"],
                "role": Role.admin.value,
            }
        ],
        "created_at": now(),
    }
    await dbm.col(dbm.CALENDARS).insert_one(cal)
    return doc(cal)


async def get_calendar(cal_id: str) -> Optional[dict]:
    return doc(await dbm.col(dbm.CALENDARS).find_one({"_id": cal_id}))


async def list_user_calendars(user_id: str) -> List[dict]:
    cur = dbm.col(dbm.CALENDARS).find({"members.user_id": user_id})
    return [doc(c) async for c in cur]


def role_in_calendar(calendar: dict, user_id: str) -> Optional[str]:
    for m in calendar.get("members", []):
        if m["user_id"] == user_id:
            return m["role"]
    return None


async def add_member(cal_id: str, user: dict, role: Role) -> None:
    member = {
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": role.value,
    }
    # Remove any prior membership row, then add fresh.
    await dbm.col(dbm.CALENDARS).update_one(
        {"_id": cal_id}, {"$pull": {"members": {"user_id": user["id"]}}}
    )
    await dbm.col(dbm.CALENDARS).update_one(
        {"_id": cal_id}, {"$push": {"members": member}}
    )


async def remove_member(cal_id: str, user_id: str) -> None:
    await dbm.col(dbm.CALENDARS).update_one(
        {"_id": cal_id}, {"$pull": {"members": {"user_id": user_id}}}
    )


# --------------------------------------------------------------------------- #
# activity log
# --------------------------------------------------------------------------- #

async def log_activity(
    calendar_id: str,
    actor: dict,
    action: str,
    target_type: str,
    summary: str,
    target_id: Optional[str] = None,
) -> None:
    await dbm.col(dbm.ACTIVITY_LOGS).insert_one(
        {
            "_id": new_id(),
            "calendar_id": calendar_id,
            "actor_id": actor["id"],
            "actor_name": actor["name"],
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "summary": summary,
            "created_at": now(),
        }
    )
