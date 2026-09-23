import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lifeos.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class ActionPassport(Base):
    __tablename__ = "action_passports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    commitment_id: Mapped[str] = mapped_column(String(36), ForeignKey("commitments.id"), nullable=True)
    mission_id: Mapped[str] = mapped_column(String(36), ForeignKey("missions.id"), nullable=True)

    action_name: Mapped[str] = mapped_column(String(255), nullable=False) # e.g. "Send follow-up email", "Book ticket"
    why: Mapped[str] = mapped_column(Text, nullable=False)                 # e.g. "Commitment #1042 is at risk"
    evidence: Mapped[list] = mapped_column(JSON, default=list)            # e.g. ["Deadline in 9 hours", "Dependency unresolved"]
    expected_impact: Mapped[str] = mapped_column(Text, nullable=False)     # e.g. "Reduces project blockage"
    risk_level: Mapped[str] = mapped_column(String(20), default="LOW")     # LOW, MEDIUM, HIGH
    is_reversible: Mapped[bool] = mapped_column(Boolean, default=True)
    approval_required: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING_APPROVAL") # PENDING_APPROVAL, APPROVED, REJECTED, EXECUTED, VERIFIED

    execution_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    execution_result: Mapped[dict] = mapped_column(JSON, default=dict)
    verification_record: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

