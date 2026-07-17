"""JWT issuing/verification and Google id_token verification."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt

from .config import settings

ACCESS = "access"
REFRESH = "refresh"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_token(subject: str, token_type: str, expires: timedelta, extra: Optional[dict] = None) -> str:
    payload: Dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": _now(),
        "exp": _now() + expires,
        "jti": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, extra: Optional[dict] = None) -> str:
    return _create_token(
        subject, ACCESS, timedelta(minutes=settings.access_token_expire_minutes), extra
    )


def create_refresh_token(subject: str) -> str:
    return _create_token(subject, REFRESH, timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
    """Raises jose.JWTError on any problem (expired, bad signature, wrong type)."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if expected_type and payload.get("type") != expected_type:
        raise JWTError(f"Expected token type {expected_type!r}, got {payload.get('type')!r}")
    return payload


async def verify_google_id_token(id_token: str) -> Dict[str, Any]:
    """Verify a Google id_token and return normalised profile info.

    In ``mock_auth`` mode we accept a self-describing fake token of the form
    ``mock:email@example.com:Full Name`` so the OAuth flow is exercisable
    end-to-end without a Google project. In real mode we verify the signature
    against Google's public certs using ``google-auth``.
    """
    if settings.mock_auth:
        if id_token.startswith("mock:"):
            parts = id_token.split(":", 2)
            email = parts[1] if len(parts) > 1 else "demo@example.com"
            name = parts[2] if len(parts) > 2 else email.split("@")[0].title()
        else:
            email, name = "demo@example.com", "Demo User"
        return {
            "sub": f"mock-{email}",
            "email": email,
            "name": name,
            "picture": f"https://api.dicebear.com/7.x/initials/svg?seed={name}",
            "email_verified": True,
        }

    # --- Real verification path ---
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    request = google_requests.Request()
    info = google_id_token.verify_oauth2_token(
        id_token, request, settings.google_client_id
    )
    return {
        "sub": info["sub"],
        "email": info["email"],
        "name": info.get("name", info["email"]),
        "picture": info.get("picture", ""),
        "email_verified": info.get("email_verified", False),
    }
