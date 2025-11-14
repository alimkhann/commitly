from functools import lru_cache
from typing import Any, List, Optional

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    api_v1_str: str = Field("/api/v1", validation_alias="API_V1_STR")
    project_name: str = Field("Commitly Backend", validation_alias="PROJECT_NAME")
    debug: bool = Field(False, validation_alias="DEBUG")

    supabase_url: HttpUrl = Field(..., validation_alias="SUPABASE_URL")
    supabase_anon_key: str = Field(..., validation_alias="SUPABASE_ANON_KEY")
    database_url: str = Field(..., validation_alias="DATABASE_URL")

    # Clerk (authentication) configuration
    clerk_jwks_url: HttpUrl = Field(..., validation_alias="CLERK_JWKS_URL")
    clerk_issuer: str = Field(..., validation_alias="CLERK_ISSUER")
    clerk_audience: str = Field(..., validation_alias="CLERK_AUDIENCE")
    clerk_authorized_parties: List[str] = Field(
        default_factory=list, validation_alias="CLERK_AUTHORIZED_PARTIES"
    )
    clerk_jwks_cache_seconds: int = Field(
        300, validation_alias="CLERK_JWKS_CACHE_SECONDS"
    )

    # Polar (donations) configuration
    polar_access_token: Optional[str] = Field(
        default=None, validation_alias="POLAR_ACCESS_TOKEN"
    )
    polar_success_url: Optional[HttpUrl] = Field(
        default=None, validation_alias="POLAR_SUCCESS_URL"
    )
    polar_server: str = Field(
        "production", validation_alias="POLAR_SERVER"
    )  # "production" | "sandbox" | truthy for sandbox
    polar_product_id: Optional[str] = Field(
        default=None, validation_alias="POLAR_PRODUCT_ID"
    )

    # Sandbox-specific overrides
    polar_sandbox_access_token: Optional[str] = Field(
        default=None, validation_alias="POLAR_SANDBOX_ACCESS_TOKEN"
    )
    polar_sandbox_success_url: Optional[HttpUrl] = Field(
        default=None, validation_alias="POLAR_SANDBOX_SUCCESS_URL"
    )
    polar_sandbox_product_id: Optional[str] = Field(
        default=None, validation_alias="POLAR_SANDBOX_PRODUCT_ID"
    )
    polar_sandbox_enabled: bool = Field(False, validation_alias="POLAR_SANDBOX_SERVER")

    allowed_origins: List[str] = Field(
        default_factory=lambda: ["*"], validation_alias="ALLOWED_ORIGINS"
    )

    @staticmethod
    def _coerce_list(value: Any) -> List[str]:
        match value:
            case None:
                return []
            case str() as raw:
                cleaned = raw.strip()
                if not cleaned:
                    return []
                if cleaned.startswith("["):
                    try:
                        import json

                        data = json.loads(cleaned)
                        if isinstance(data, list):
                            return [
                                item.strip()
                                for item in data
                                if isinstance(item, str) and item.strip()
                            ]
                    except json.JSONDecodeError:
                        pass
                return [item.strip() for item in cleaned.split(",") if item.strip()]
            case list() as sequence:
                return [
                    item.strip()
                    for item in sequence
                    if isinstance(item, str) and item.strip()
                ]
        return []

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: Any) -> List[str]:
        parsed = cls._coerce_list(value)
        return parsed or ["*"]

    @field_validator("clerk_authorized_parties", mode="before")
    @classmethod
    def parse_authorized_parties(cls, value: Any) -> List[str]:
        return cls._coerce_list(value)


@lru_cache
def get_settings() -> Settings:
    """Return a cached instance of the application settings."""
    return Settings()


settings = get_settings()
