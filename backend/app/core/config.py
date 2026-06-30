from pydantic_settings import BaseSettings
from typing import List, Optional
import secrets


class Settings(BaseSettings):
    PROJECT_NAME: str = "Enterprise AI BI Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://aravindkumar@localhost:5432/enterprise_bi"
    DATABASE_URL_SYNC: str = "postgresql://aravindkumar@localhost:5432/enterprise_bi"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
    ]

    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB

    # AI APIs
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None

    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: str = "noreply@enterprise-bi.com"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
