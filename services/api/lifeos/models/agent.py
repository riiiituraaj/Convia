import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, JSON, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lifeos.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False) # ORCHESTRATOR, CONTEXT, COMMITMENT, PLANNER, RESEARCH, RISK, EXECUTION, VERIFICATION, CRITIC
    task_description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="RUNNING") # RUNNING, COMPLETED, FAILED, WAITING_APPROVAL
    
    model_used: Mapped[str] = mapped_column(String(100), default="nvidia/nemotron-4-340b-instruct")
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)

    input_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    output_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    events: Mapped[list] = mapped_column(JSON, default=list) # List of sub-steps/logs

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

