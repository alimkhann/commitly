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
    )

    api_v1_str: str = Field("/api/v1", validation_alias="API_V1_STR")
    project_name: str = Field("Commitly Backend", validation_alias="PROJECT_NAME")
    debug: bool = Field(False, validation_alias="DEBUG")

    supabase_url: HttpUrl = Field(..., validation_alias="SUPABASE_URL")
    supabase_anon_key: str = Field(..., validation_alias="SUPABASE_ANON_KEY")
    database_url: str = Field(..., validation_alias="DATABASE_URL")

    # Polar (donations) configuration
    polar_access_token: Optional[str] = Field(default=None, validation_alias="POLAR_ACCESS_TOKEN")
    polar_success_url: Optional[HttpUrl] = Field(default=None, validation_alias="POLAR_SUCCESS_URL")
    polar_server: str = Field("production", validation_alias="POLAR_SERVER")  # "production" | "sandbox"
    polar_product_id: Optional[str] = Field(default=None, validation_alias=("POLAR_PRODUCT_ID"))

    allowed_origins: List[str] = Field(default_factory=lambda: ["*"], validation_alias="ALLOWED_ORIGINS")

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: Any) -> List[str]:
        match value:
            case None:
                return ["*"]
            case str() as raw:
                cleaned = raw.strip()
                if not cleaned:
                    return ["*"]
                if cleaned.startswith("["):
                    try:
                        import json

                        data = json.loads(cleaned)
                        if isinstance(data, list):
                            cleaned_list = [origin.strip() for origin in data if isinstance(origin, str) and origin.strip()]
                            return cleaned_list or ["*"]
                    except json.JSONDecodeError:
                        pass
                parts = [origin.strip() for origin in cleaned.split(",") if origin.strip()]
                return parts or ["*"]
            case list() as sequence:
                cleaned_list = [origin.strip() for origin in sequence if isinstance(origin, str) and origin.strip()]
                return cleaned_list or ["*"]
        return ["*"]


@lru_cache
def get_settings() -> Settings:
    """Return a cached instance of the application settings."""
    return Settings()


settings = get_settings()
