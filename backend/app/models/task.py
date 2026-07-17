from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from .enums import Severity, TaskStatus


class TaskCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    severity: Severity = Severity.low
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


class TaskUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    severity: Optional[Severity] = None
    due_at: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[TaskStatus] = None


class TaskOut(BaseModel):
    id: str
    calendar_id: str
    name: str
    severity: Severity
    status: TaskStatus
    due_at: datetime
    notes: str = ""
    created_by: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
