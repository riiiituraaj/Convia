from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "CONVIA"
    API_V1_STR: str = "/api"
    LIFEOS_DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./convia.db"
    REDIS_URL: Optional[str] = "redis://localhost:6379/0"

    # AI & Nemotron (Nebius Token Factory / NVIDIA NIM)
    NEBIUS_API_KEY: Optional[str] = None
    NEBIUS_BASE_URL: str = "https://api.tokenfactory.nebius.com/v1"
    NEBIUS_NEMOTRON_MODEL: str = "nvidia/nemotron-4-340b-instruct"
    NEBIUS_FAST_MODEL: str = "nvidia/nemotron-mini-4b-instruct"
    NEBIUS_REASONING_MODEL: str = "nvidia/nemotron-4-340b-instruct"

    # NVIDIA NIM chat and voice
    NVIDIA_API_KEY: Optional[str] = None
    NVIDIA_NIM_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_NIM_MODEL: str = "nvidia/nemotron-3.5-lightning-30b-a3b"
    NVIDIA_NIM_FAST_MODEL: str = "nvidia/nemotron-3.5-lightning-30b-a3b"
    NVIDIA_NIM_REASONING_MODEL: str = "nvidia/nemotron-3.5-lightning-30b-a3b"
    NVIDIA_NIM_ASR_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_NIM_TTS_URL: str = "https://integrate.api.nvidia.com/v1"

    # Tavily Research
    TAVILY_API_KEY: Optional[str] = None

    # Auth & Security
    AUTH_SECRET: str = "convia-master-continuity-key-never-drop-the-thread-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
