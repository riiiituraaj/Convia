import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Text, JSON, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lifeos.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Commitment(Base):
    __tablename__ = "commitments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    mission_id: Mapped[str] = mapped_column(String(36), ForeignKey("missions.id"), nullable=True)

    actor: Mapped[str] = mapped_column(String(255), default="user")
    recipient: Mapped[str] = mapped_column(String(255), nullable=True)  # e.g. "Rahul", "Team", "Self"
    action: Mapped[str] = mapped_column(Text, nullable=False)           # e.g. "Send Phoenix design"
    context: Mapped[str] = mapped_column(String(255), nullable=True)   # e.g. "Phoenix project"
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM") # LOW, MEDIUM, HIGH, URGENT
    status: Mapped[str] = mapped_column(String(50), default="DETECTED")
    # DETECTED, PENDING_CONFIRMATION, CONFIRMED, PLANNED, IN_PROGRESS, AT_RISK, RECOVERY, COMPLETED, VERIFIED, CLOSED

    confidence: Mapped[float] = mapped_column(Float, default=1.0)       # 0.0 to 1.0
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)       # 0.0 to 1.0 (LOW, MEDIUM, HIGH, CRITICAL)
    risk_level: Mapped[str] = mapped_column(String(20), default="LOW")

    dependencies: Mapped[list] = mapped_column(JSON, default=list)      # List of commitment IDs or external requirements
    consequences: Mapped[str] = mapped_column(Text, nullable=True)     # Who is blocked / what happens if slipped
    evidence: Mapped[str] = mapped_column(Text, nullable=True)         # Source message/voice quote
    completion_condition: Mapped[str] = mapped_column(Text, nullable=True)
    autonomy_level: Mapped[int] = mapped_column(Integer, default=2)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="commitments")
    mission = relationship("Mission", back_populates="commitments")
    events = relationship("CommitmentEvent", back_populates="commitment", cascade="all, delete-orphan")


class CommitmentEvent(Base):
    __tablename__ = "commitment_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    commitment_id: Mapped[str] = mapped_column(String(36), ForeignKey("commitments.id"), index=True, nullable=False)
    from_status: Mapped[str] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    commitment = relationship("Commitment", back_populates="events")

