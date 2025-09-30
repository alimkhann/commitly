from functools import lru_cache
from typing import Any, List, Optional
from uuid import UUID

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    api_v1_str: str = Field("/api/v1", validation_alias="API_V1_STR")
    project_name: str = Field("Commitly Backend", validation_alias="PROJECT_NAME")
    debug: bool = Field(False, validation_alias="DEBUG")

    supabase_url: HttpUrl = Field(..., validation_alias="SUPABASE_URL")
    supabase_anon_key: str = Field(..., validation_alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: Optional[str] = Field(default=None, validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    database_url: str = Field(..., validation_alias="DATABASE_URL")

    openai_api_key: Optional[str] = Field(default=None, validation_alias="OPENAI_API_KEY")
    openai_model: Optional[str] = Field(default=None, validation_alias="OPENAI_MODEL")

    github_default_token: Optional[str] = Field(default=None, validation_alias="GITHUB_DEFAULT_TOKEN")

    public_user_id: UUID = Field(default=UUID("00000000-0000-0000-0000-000000000000"), validation_alias="PUBLIC_USER_ID")

    # Polar (donations) configuration
    polar_access_token: Optional[str] = Field(default=None, validation_alias="POLAR_ACCESS_TOKEN")
    polar_success_url: Optional[HttpUrl] = Field(default=None, validation_alias="POLAR_SUCCESS_URL")
    polar_server: str = Field("production", validation_alias="POLAR_SERVER")  # "production" | "sandbox" | truthy for sandbox
    polar_product_id: Optional[str] = Field(default=None, validation_alias="POLAR_PRODUCT_ID")

    # Sandbox-specific overrides
    polar_sandbox_access_token: Optional[str] = Field(default=None, validation_alias="POLAR_SANDBOX_ACCESS_TOKEN")
    polar_sandbox_success_url: Optional[HttpUrl] = Field(default=None, validation_alias="POLAR_SANDBOX_SUCCESS_URL")
    polar_sandbox_product_id: Optional[str] = Field(default=None, validation_alias="POLAR_SANDBOX_PRODUCT_ID")
    polar_sandbox_enabled: bool = Field(False, validation_alias="POLAR_SANDBOX_SERVER")

    allowed_origins: List[str] = Field(default_factory=lambda: ["*"], validation_alias="ALLOWED_ORIGINS")

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _parse_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            try:
                # Accept JSON-like list string
                import json
                return json.loads(v)
            except Exception:
                return [v]
        return v


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
