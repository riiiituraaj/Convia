import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lifeos.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Risk(Base):
    __tablename__ = "risks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    mission_id: Mapped[str] = mapped_column(String(36), ForeignKey("missions.id"), nullable=True)
    commitment_id: Mapped[str] = mapped_column(String(36), ForeignKey("commitments.id"), nullable=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    score: Mapped[float] = mapped_column(Float, default=0.5)

    evidence: Mapped[list] = mapped_column(JSON, default=list) # List of observations / data points
    affected_commitments: Mapped[list] = mapped_column(JSON, default=list)
    recovery_strategies: Mapped[list] = mapped_column(JSON, default=list) # List of alternative options A, B, C...

    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_notes: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    user = relationship("User", back_populates="risks")
    mission = relationship("Mission", back_populates="risks")

