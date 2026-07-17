from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserSettings(BaseModel):
    theme: str = "system"                 # light | dark | system
    accent_color: str = "#7c5cff"
    timezone: str = "America/New_York"
    date_format: str = "MMM D, YYYY"
    default_calendar_view: str = "month"  # day | week | month
    weather_location: Optional[str] = "New York"
    weather_location_key: Optional[str] = None
    notifications: dict = Field(
        default_factory=lambda: {
            "task_created": True,
            "task_completed": True,
            "invitations": True,
            "email_reminders": False,
        }
    )


class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None


class UserPublic(UserBase):
    id: str
    settings: UserSettings = Field(default_factory=UserSettings)
    default_calendar_id: Optional[str] = None
    created_at: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None
    settings: Optional[UserSettings] = None
