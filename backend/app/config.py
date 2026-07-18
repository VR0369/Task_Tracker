"""Application configuration.

Every external integration is written against its *real* API but ships with a
mock toggle so the whole stack runs with zero credentials out of the box.
Flip the ``MOCK_*`` flags to ``false`` and supply the matching keys to go live.
"""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- General ---
    app_name: str = "Task Tracker API"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = True

    # --- CORS / frontend ---
    frontend_url: str = "http://localhost:5173"
    cors_origins: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:4173", "http://localhost"]
    )

    # --- Database ---
    # When True, an in-memory mongomock-motor client is used (no MongoDB needed).
    mock_db: bool = True
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db_name: str = "task_tracker"
    seed_on_startup: bool = True

    # --- JWT ---
    jwt_secret: str = "CHANGE_ME_super_secret_dev_key_do_not_use_in_prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    # --- Google OAuth ---
    mock_auth: bool = True
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5173/auth/callback"

    # --- Weather (Open-Meteo — keyless, no API key required) ---
    # MOCK_WEATHER=false enables live Open-Meteo data; provider URLs are
    # constants in app/services/weather.py, so there is nothing else to set.
    mock_weather: bool = True

    # --- On This Day (byabbe.se, keyless) ---
    mock_history: bool = True

    # --- Quotes (ZenQuotes, keyless) ---
    mock_quotes: bool = True

    # --- Rate limiting (simple in-memory) ---
    rate_limit_requests: int = 240
    rate_limit_window_seconds: int = 60

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
