"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


class Settings:
    """Centralised settings – never hard-code secrets or URLs."""

    OSRM_BASE_URL: str = os.getenv("OSRM_BASE_URL", "http://router.project-osrm.org")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    SOLVER_TIME_LIMIT: int = int(os.getenv("SOLVER_TIME_LIMIT", "20"))

    # Derived
    IS_DEV: bool = APP_ENV == "development"


settings = Settings()
