from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.models import UserRole


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    role: UserRole = UserRole.ANALYST

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


# ─── Dataset Schemas ──────────────────────────────────────────────────────────

class DatasetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    file_name: str
    file_size: int
    file_type: str
    # FIX 1: status returned as str so both "READY" and "ready" work on frontend
    status: str
    row_count: int
    column_count: int
    columns_info: Dict[str, Any] = Field(default_factory=dict)
    data_quality_score: float
    missing_values: Dict[str, Any] = Field(default_factory=dict)
    outliers_detected: int
    preview_data: List[Dict[str, Any]] = Field(default_factory=list)
    schema_info: Dict[str, Any] = Field(default_factory=dict)
    owner_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ─── Prediction Schemas ───────────────────────────────────────────────────────

class PredictionCreate(BaseModel):
    name: str
    model_type: str
    target_column: str
    feature_columns: List[str]
    dataset_id: str

    config: Dict[str, Any] = Field(default_factory=dict)

class PredictionResponse(BaseModel):
    id: str
    name: str
    model_type: str
    target_column: str
    feature_columns: List[str]
    metrics: Dict[str, Any] = Field(default_factory=dict)
    feature_importance: Dict[str, Any] = Field(default_factory=dict)
    predictions_data: List[Any] = Field(default_factory=list)
    forecast_data: List[Any] = Field(default_factory=list)
    # FIX 3: added shap_values field that was missing from response schema
    shap_values: Dict[str, Any] = Field(default_factory=dict)
    # FIX 4: added model_config field that was missing from response schema
    model_config_used: Dict[str, Any] = Field(default_factory=dict)
    status: str
    dataset_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Report Schemas ───────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    name: str
    description: Optional[str] = None
    report_type: str = "comprehensive"
    file_type: str = "pdf"
    dataset_id: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)

class ReportResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    report_type: str
    status: str
    file_type: str
    ai_summary: Optional[str] = None
    insights: Optional[List[Any]] = []
    dataset_id: Optional[str] = None
    file_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Chat Schemas ─────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # user | assistant
    content: str


class ChatCreate(BaseModel):
    message: str
    dataset_id: Optional[str] = None
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    message: str
    role: str = "assistant"
    sources: List[str] = Field(default_factory=list)
    charts: List[Dict[str, Any]] = Field(default_factory=list)


# ─── Notification Schemas ─────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    notification_type: str
    is_read: bool
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Analytics Schemas ────────────────────────────────────────────────────────

class AnalyticsQuery(BaseModel):
    dataset_id: str
    columns: Optional[List[str]] = None
    aggregation: Optional[str] = None
    group_by: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    limit: int = 1000


class KPIResponse(BaseModel):
    id: str
    name: str
    value: float
    previous_value: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    trend: str
    change_percent: float
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Pagination ───────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    per_page: int
    pages: int