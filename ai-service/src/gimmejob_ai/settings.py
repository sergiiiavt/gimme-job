from __future__ import annotations

import os
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the isolated AI service."""

    model_config = SettingsConfigDict(
        env_prefix="GIMMEJOB_AI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-5.4-mini"
    service_token: SecretStr | None = None
    content_root: Path = Path("../content")
    request_timeout_seconds: float = 45.0

    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key and self.openai_api_key.get_secret_value().strip())

    @property
    def service_auth_configured(self) -> bool:
        return bool(self.service_token and self.service_token.get_secret_value().strip())


def langfuse_configured() -> bool:
    """Langfuse's SDK reads its own standard LANGFUSE_* environment variables."""

    return bool(
        os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
        and os.getenv("LANGFUSE_SECRET_KEY", "").strip()
    )
