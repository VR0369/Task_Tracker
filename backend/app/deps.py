"""Auth & RBAC dependencies."""

from __future__ import annotations

from typing import Iterable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from . import crud
from .models.enums import Role
from .security import ACCESS, decode_token

bearer = HTTPBearer(auto_error=False)

# Role capability ordering (higher index == more privilege).
_ROLE_RANK = {Role.viewer: 0, Role.contributor: 1, Role.admin: 2}


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(creds.credentials, expected_type=ACCESS)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = await crud.get_user(payload["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return user


async def resolve_calendar(calendar_id: str, user: dict) -> dict:
    calendar = await crud.get_calendar(calendar_id)
    if calendar is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Calendar not found")
    if crud.role_in_calendar(calendar, user["id"]) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this calendar")
    return calendar


def require_calendar_role(minimum: Role):
    """Dependency factory enforcing a minimum role on a calendar.

    The calendar id is taken from the ``calendar_id`` query/path param, falling
    back to the user's default calendar.
    """

    async def _dep(
        calendar_id: Optional[str] = None,
        user: dict = Depends(get_current_user),
    ) -> dict:
        cal_id = calendar_id or user.get("default_calendar_id")
        if not cal_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No calendar specified")
        calendar = await resolve_calendar(cal_id, user)
        role = Role(crud.role_in_calendar(calendar, user["id"]))
        if _ROLE_RANK[role] < _ROLE_RANK[minimum]:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires '{minimum.value}' role; you are '{role.value}'.",
            )
        return {"user": user, "calendar": calendar, "role": role}

    return _dep
