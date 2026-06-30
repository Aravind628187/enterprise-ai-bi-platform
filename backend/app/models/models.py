from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum as SAEnum, BigInteger, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    ANALYST = "analyst"
    VIEWER = "viewer"


class DatasetStatus(str, enum.Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.ANALYST, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    avatar_url = Column(String, nullable=True)
    preferences = Column(JSON, default={})
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    datasets = relationship("Dataset", back_populates="owner", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="owner", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_size = Column(BigInteger, default=0)
    file_type = Column(String, nullable=False)
    status = Column(SAEnum(DatasetStatus), default=DatasetStatus.UPLOADING)
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    columns_info = Column(JSON, default={})
    data_quality_score = Column(Float, default=0.0)
    missing_values = Column(JSON, default={})
    outliers_detected = Column(Integer, default=0)
    schema_info = Column(JSON, default={})
    preview_data = Column(JSON, default=[])
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="datasets")
    reports = relationship("Report", back_populates="dataset")
    predictions = relationship("Prediction", back_populates="dataset")
    chat_sessions = relationship("ChatSession", back_populates="dataset")

    __table_args__ = (Index("idx_dataset_owner", "owner_id"),)


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    report_type = Column(String, default="comprehensive")
    status = Column(SAEnum(ReportStatus), default=ReportStatus.PENDING)
    file_path = Column(String, nullable=True)
    file_type = Column(String, default="pdf")
    config = Column(JSON, default={})
    ai_summary = Column(Text, nullable=True)
    insights = Column(JSON, default=[])
    charts_data = Column(JSON, default=[])
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="reports")
    dataset = relationship("Dataset", back_populates="reports")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    model_type = Column(String, nullable=False)
    target_column = Column(String, nullable=False)
    feature_columns = Column(JSON, default=[])
    model_config = Column(JSON, default={})
    metrics = Column(JSON, default={})
    feature_importance = Column(JSON, default={})
    shap_values = Column(JSON, default={})
    predictions_data = Column(JSON, default=[])
    forecast_data = Column(JSON, default=[])
    status = Column(String, default="pending")
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dataset = relationship("Dataset", back_populates="predictions")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=True)
    messages = Column(JSON, default=[])
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="chat_sessions")
    dataset = relationship("Dataset", back_populates="chat_sessions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=True)
    details = Column(JSON, default={})
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (Index("idx_audit_user", "user_id"), Index("idx_audit_created", "created_at"),)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String, default="info")
    is_read = Column(Boolean, default=False)
    data = Column(JSON, default={})
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")


class KPI(Base):
    __tablename__ = "kpis"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    previous_value = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    category = Column(String, nullable=True)
    trend = Column(String, default="stable")
    change_percent = Column(Float, default=0.0)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
