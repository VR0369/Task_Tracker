from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from .enums import RecurrenceFrequency, Severity, TaskStatus
from ..services.recurrence import HARD_CAP


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

    # --- Recurrence (create-only; each generated occurrence is independent afterward) ---
    recurrence_frequency: Optional[RecurrenceFrequency] = None
    recurrence_interval: int = Field(default=1, ge=1, le=365)
    recurrence_until: Optional[datetime] = None
    recurrence_count: Optional[int] = None

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

    @model_validator(mode="after")
    def _validate_recurrence(self):
        if self.recurrence_frequency is None:
            return self
        has_until = self.recurrence_until is not None
        has_count = self.recurrence_count is not None
        if has_until == has_count:  # neither or both provided
            raise ValueError("Provide exactly one of recurrence_until or recurrence_count")
        if has_until and _as_utc(self.recurrence_until) <= _as_utc(self.due_at):
            raise ValueError("recurrence_until must be after the due date")
        if has_count and not (1 <= self.recurrence_count <= HARD_CAP):
            raise ValueError(f"recurrence_count must be between 1 and {HARD_CAP}")
        return self


class TaskUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    severity: Optional[Severity] = None
    start_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[TaskStatus] = None

    # --- Recurrence (editable: can turn a task into a series, change, or clear it) ---
    recurrence_frequency: Optional[RecurrenceFrequency] = None
    recurrence_interval: int = Field(default=1, ge=1, le=365)
    recurrence_until: Optional[datetime] = None
    recurrence_count: Optional[int] = None

    @model_validator(mode="after")
    def _start_before_due(self):
        if (
            self.start_at is not None
            and self.due_at is not None
            and _as_utc(self.start_at) > _as_utc(self.due_at)
        ):
            raise ValueError("Start date cannot be after the due date")
        return self

    @model_validator(mode="after")
    def _validate_recurrence(self):
        if self.recurrence_frequency is None:
            return self
        has_until = self.recurrence_until is not None
        has_count = self.recurrence_count is not None
        if has_until == has_count:  # neither or both provided
            raise ValueError("Provide exactly one of recurrence_until or recurrence_count")
        if has_count and not (1 <= self.recurrence_count <= HARD_CAP):
            raise ValueError(f"recurrence_count must be between 1 and {HARD_CAP}")
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
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    series_id: Optional[str] = None
    recurrence_frequency: Optional[RecurrenceFrequency] = None
    recurrence_interval: int = 1
    recurrence_until: Optional[datetime] = None
    recurrence_count: Optional[int] = None
