from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field

from .enums import Role


class CalendarMember(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    role: Role


class CalendarOut(BaseModel):
    id: str
    name: str
    owner_id: str
    members: List[CalendarMember] = Field(default_factory=list)
    my_role: Optional[Role] = None
    created_at: Optional[datetime] = None


class InvitationCreate(BaseModel):
    email: EmailStr
    role: Role = Role.contributor
    calendar_id: Optional[str] = None


class InvitationOut(BaseModel):
    id: str
    calendar_id: str
    calendar_name: Optional[str] = None
    email: EmailStr
    role: Role
    status: str  # pending | awaiting_approval | approved | rejected
    token: str
    invited_by: str
    created_at: datetime


class ActivityLogOut(BaseModel):
    id: str
    calendar_id: str
    actor_id: str
    actor_name: str
    action: str
    target_type: str
    target_id: Optional[str] = None
    summary: str
    created_at: datetime


class DashboardCard(BaseModel):
    total: int = 0
    critical: int = 0
    high: int = 0
    low: int = 0


class DashboardResponse(BaseModel):
    past_due: DashboardCard
    due_today: DashboardCard
    upcoming: DashboardCard
    completed_yesterday: DashboardCard
    generated_at: datetime


class Quote(BaseModel):
    text: str
    author: str
    category: str


class WeatherResponse(BaseModel):
    location: str
    temperature_c: float
    temperature_f: float
    humidity: int
    wind_kph: float
    condition: str
    icon: str
    is_mock: bool = False
    forecast: List[dict] = Field(default_factory=list)


class HistoryEvent(BaseModel):
    year: str
    text: str
    is_mock: bool = False
