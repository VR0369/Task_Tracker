from enum import Enum


class Role(str, Enum):
    admin = "admin"
    contributor = "contributor"
    viewer = "viewer"


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    low = "low"


class TaskStatus(str, Enum):
    pending = "pending"
    completed = "completed"


class RecurrenceFrequency(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class DashboardBucket(str, Enum):
    past_due = "past_due"
    due_today = "due_today"
    upcoming = "upcoming"
    completed_yesterday = "completed_yesterday"
