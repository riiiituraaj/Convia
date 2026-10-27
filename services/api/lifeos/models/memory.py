import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lifeos.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    mission_id: Mapped[str] = mapped_column(String(36), ForeignKey("missions.id"), nullable=True)

    category: Mapped[str] = mapped_column(String(50), default="EXPLICIT")
    # EXPLICIT, MISSION, TEMPORARY, DERIVED_PREFERENCE, EXTERNAL_KNOWLEDGE

    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(100), default="user_speech")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    retention_rule: Mapped[str] = mapped_column(String(50), default="PERSISTENT") # PERSISTENT, SESSION, MISSION_LIFETIME
    user_visible: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="memories")


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False) # google_workspace, tavily, nvidia_nim
    status: Mapped[str] = mapped_column(String(50), default="NOT_CONNECTED") # CONNECTED, NOT_CONNECTED, COMING_SOON, ERROR
    credentials_present: Mapped[bool] = mapped_column(Boolean, default=False)
    # Provider credentials must never be placed in metadata_json because that
    # object is returned by the integrations status API.
    credentials_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    actor: Mapped[str] = mapped_column(String(100), default="CONVIA")
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="system")
    approval_id: Mapped[str] = mapped_column(String(36), nullable=True)
    result_status: Mapped[str] = mapped_column(String(50), default="SUCCESS")
    details: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="audit_logs")

