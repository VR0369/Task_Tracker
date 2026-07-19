from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field

from .enums import Role


class CalendarMember(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    role: Role
    invited_by: Optional[str] = None
    joined_at: Optional[datetime] = None


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
    status: str  # pending | awaiting_approval | approved | rejected | revoked | expired
    token: str
    invited_by: str
    created_at: datetime
    expires_at: Optional[datetime] = None


class InvitationPreview(BaseModel):
    """Public, non-sensitive view of an invitation (looked up by token)."""
    calendar_id: str
    calendar_name: str
    email: EmailStr
    role: Role
    status: str
    inviter_name: str
    expires_at: Optional[datetime] = None
    expired: bool = False


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


class WeatherHour(BaseModel):
    time: str  # ISO-ish "YYYY-MM-DD HH:MM"
    label: str  # short display label e.g. "3 PM"
    temp_c: float
    temp_f: float
    condition: str
    icon: str = ""  # provider icon URL; empty -> frontend falls back by text
    code: int = 0
    chance_of_rain: int = 0
    is_day: int = 1


class WeatherDay(BaseModel):
    date: str
    day_name: str  # "Mon"
    max_c: float
    max_f: float
    min_c: float
    min_f: float
    condition: str
    icon: str = ""
    code: int = 0
    chance_of_rain: int = 0


class AirQuality(BaseModel):
    us_epa_index: int = 0  # 1..6
    pm2_5: Optional[float] = None
    pm10: Optional[float] = None
    o3: Optional[float] = None


class WeatherSearchResult(BaseModel):
    name: str
    region: str = ""
    country: str = ""
    lat: float
    lon: float


class WeatherResponse(BaseModel):
    location: str
    region: str = ""
    country: str = ""
    lat: Optional[float] = None
    lon: Optional[float] = None
    localtime: str = ""
    temperature_c: float
    temperature_f: float
    feelslike_c: float
    feelslike_f: float
    condition: str
    condition_code: int = 0
    icon: str = ""
    humidity: int
    wind_kph: float
    wind_dir: str = ""
    wind_degree: int = 0
    pressure_mb: float = 0
    visibility_km: float = 0
    uv: float = 0
    cloud: int = 0
    is_day: int = 1
    sunrise: str = ""
    sunset: str = ""
    last_updated: str = ""
    aqi: Optional[AirQuality] = None
    hourly: List[WeatherHour] = Field(default_factory=list)
    daily: List[WeatherDay] = Field(default_factory=list)
    is_mock: bool = False


class HistoryEvent(BaseModel):
    year: str
    text: str
    is_mock: bool = False
