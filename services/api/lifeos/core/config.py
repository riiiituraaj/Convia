from pathlib import Path
from typing import Literal, Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    PROJECT_NAME: str = "CONVIA"
    API_V1_STR: str = "/api"
    APP_ENV: Literal["development", "test", "production"] = "development"
    LIFEOS_DEBUG: bool = True

    # Database and external service configuration
    DATABASE_URL: str = "sqlite+aiosqlite:///./convia.db"
    REDIS_URL: Optional[str] = None

    # Select one inference route explicitly. A configured key never changes routing.
    AI_PROVIDER: Literal["nebius", "nvidia", "disabled"] = "nebius"
    AI_REQUEST_TIMEOUT_SECONDS: float = Field(default=45.0, ge=1, le=180)
    AI_MAX_RETRIES: int = Field(default=1, ge=0, le=3)
    NEBIUS_API_KEY: Optional[str] = None
    NEBIUS_BASE_URL: str = "https://api.tokenfactory.nebius.com/v1"
    NEBIUS_NEMOTRON_MODEL: str = ""
    NEBIUS_FAST_MODEL: str = ""
    NEBIUS_REASONING_MODEL: str = ""
    NVIDIA_API_KEY: Optional[str] = None
    NVIDIA_NIM_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_NIM_MODEL: str = ""
    NVIDIA_NIM_FAST_MODEL: str = ""
    NVIDIA_NIM_REASONING_MODEL: str = ""

    # Tavily is optional; search requests fail explicitly when it is not configured.
    TAVILY_API_KEY: Optional[str] = None
    TAVILY_TIMEOUT_SECONDS: float = Field(default=20.0, ge=1, le=60)
    TAVILY_MAX_RESULTS: int = Field(default=5, ge=1, le=10)

    # Local document storage; mount this path to durable storage in deployments.
    DOCUMENT_STORAGE_DIR: str = str(REPOSITORY_ROOT / "local_data" / "documents")
    DOCUMENT_MAX_UPLOAD_BYTES: int = Field(default=15 * 1024 * 1024, ge=1024, le=50 * 1024 * 1024)
    DOCUMENT_MAX_USER_BYTES: int = Field(default=250 * 1024 * 1024, ge=1024 * 1024, le=10 * 1024 * 1024 * 1024)
    DOCUMENT_MAX_USER_FILES: int = Field(default=100, ge=1, le=10000)

    # Authentication
    AUTH_SECRET: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 24, ge=5, le=60 * 24 * 30)

    # Browser origins allowed to call the API. Use JSON list syntax in environment files.
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        env_file=str(REPOSITORY_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    @model_validator(mode="after")
    def validate_production_configuration(self):
        if self.APP_ENV == "production":
            if not self.AUTH_SECRET or len(self.AUTH_SECRET.strip()) < 32:
                raise ValueError("AUTH_SECRET must be set to at least 32 characters in production")
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError("Production requires a durable database; SQLite is not supported")
            if not self.CORS_ORIGINS or "*" in self.CORS_ORIGINS or all(
                origin.startswith(("http://localhost", "http://127.0.0.1")) for origin in self.CORS_ORIGINS
            ):
                raise ValueError("Production CORS_ORIGINS must list trusted frontend origins")
            if self.LIFEOS_DEBUG:
                raise ValueError("LIFEOS_DEBUG must be false in production")
        return self


settings = Settings()
