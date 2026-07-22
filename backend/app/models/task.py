from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from .enums import Severity, TaskStatus


def _as_utc(d: Optional[datetime]) -> Optional[datetime]:
    """Treat naive datetimes as UTC so start/due comparisons never mix awareness."""
    if d is not None and d.tzinfo is None:
        return d.replace(tzinfo=timezone.utc)
    return d


class TaskCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    severity: Severity = Severity.low
    start_at: Optional[datetime] = Field(
        default=None, description="Optional start date+time in UTC (ISO 8601)."
    )
    due_at: datetime = Field(..., description="Due date+time in UTC (ISO 8601).")
    notes: str = ""
    calendar_id: Optional[str] = None  # defaults to caller's default calendar

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Task name cannot be empty")
        return v

    @model_validator(mode="after")
    def _start_before_due(self):
        if self.start_at is not None and _as_utc(self.start_at) > _as_utc(self.due_at):
            raise ValueError("Start date cannot be after the due date")
        return self


class TaskUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    severity: Optional[Severity] = None
    start_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[TaskStatus] = None

    @model_validator(mode="after")
    def _start_before_due(self):
        if (
            self.start_at is not None
            and self.due_at is not None
            and _as_utc(self.start_at) > _as_utc(self.due_at)
        ):
            raise ValueError("Start date cannot be after the due date")
        return self


class TaskOut(BaseModel):
    id: str
    calendar_id: str
    name: str
    severity: Severity
    status: TaskStatus
    start_at: Optional[datetime] = None
    due_at: datetime
    notes: str = ""
    created_by: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
