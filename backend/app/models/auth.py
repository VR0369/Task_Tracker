from typing import Optional

from pydantic import BaseModel, EmailStr

from .user import UserPublic


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic


class DevLoginRequest(BaseModel):
    """Only accepted when MOCK_AUTH=true — a shortcut so you can log in
    without a Google project during development."""

    email: EmailStr
    name: Optional[str] = None


class GoogleLoginRequest(BaseModel):
    id_token: str


class SamplePromptRequest(BaseModel):
    add: bool  # user's answer to "add sample tasks?" — True = Yes, False = No


class RefreshRequest(BaseModel):
    refresh_token: str
