"""Authentication: Google OAuth (real + mock), dev login, token refresh, profile."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError

from .. import crud
from ..config import settings
from ..deps import get_current_user
from ..models.auth import DevLoginRequest, GoogleLoginRequest, RefreshRequest, Token
from ..models.user import UserProfileUpdate, UserPublic
from ..security import (
    REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_google_id_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _issue_tokens(user: dict) -> Token:
    access = create_access_token(user["id"], extra={"email": user["email"]})
    refresh = create_refresh_token(user["id"])
    return Token(access_token=access, refresh_token=refresh, user=UserPublic(**user))


async def _get_or_create(email: str, name: str, picture: str, sub: str) -> dict:
    user = await crud.get_user_by_email(email)
    if user is None:
        user = await crud.create_user(email=email, name=name, picture=picture, provider_sub=sub)
    return user


@router.get("/config", tags=["auth"])
async def auth_config():
    """Lets the frontend know which login modes are available."""
    return {
        "mock_auth": settings.mock_auth,
        "google_client_id": settings.google_client_id or None,
        "google_redirect_uri": settings.google_redirect_uri,
    }


@router.post("/dev-login", response_model=Token)
async def dev_login(body: DevLoginRequest):
    """Passwordless shortcut for development. Disabled unless MOCK_AUTH=true."""
    if not settings.mock_auth:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Dev login is disabled")
    name = body.name or body.email.split("@")[0].replace(".", " ").title()
    picture = f"https://api.dicebear.com/7.x/initials/svg?seed={name}"
    user = await _get_or_create(body.email, name, picture, f"dev-{body.email}")
    return await _issue_tokens(user)


@router.post("/google", response_model=Token)
async def google_login(body: GoogleLoginRequest):
    """Exchange a Google id_token for app tokens.

    In mock mode pass ``mock:email@example.com:Full Name`` as the id_token.
    """
    try:
        info = await verify_google_id_token(body.id_token)
    except Exception as exc:
        logging.getLogger("task_tracker.auth").warning(
            "Google token verification failed: %s: %s", type(exc).__name__, exc
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")
    if not info.get("email_verified"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google email not verified")
    user = await _get_or_create(info["email"], info["name"], info.get("picture", ""), info["sub"])
    return await _issue_tokens(user)


@router.post("/refresh", response_model=Token)
async def refresh(body: RefreshRequest):
    try:
        payload = decode_token(body.refresh_token, expected_type=REFRESH)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = await crud.get_user(payload["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return await _issue_tokens(user)


@router.post("/logout")
async def logout(_: dict = Depends(get_current_user)):
    # Stateless JWT: the client discards its tokens. (A token denylist would
    # live here in a deployment that needs hard revocation.)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**user)


@router.patch("/me", response_model=UserPublic)
async def update_me(body: UserProfileUpdate, user: dict = Depends(get_current_user)):
    changes: dict = {}
    if body.name is not None:
        changes["name"] = body.name
    if body.picture is not None:
        changes["picture"] = body.picture
    if body.settings is not None:
        changes["settings"] = body.settings.model_dump()
    updated = await crud.update_user(user["id"], changes)
    return UserPublic(**updated)
