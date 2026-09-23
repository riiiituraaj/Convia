import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lifeos.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    desired_outcome: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE")  # ACTIVE, PAUSED, COMPLETED, AT_RISK
    priority: Mapped[str] = mapped_column(String(20), default="HIGH")   # LOW, MEDIUM, HIGH, CRITICAL
    progress: Mapped[float] = mapped_column(Float, default=0.0)         # 0.0 to 100.0

    target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    budget_limit: Mapped[float] = mapped_column(Float, nullable=True)
    budget_currency: Mapped[str] = mapped_column(String(10), default="INR")
    constraints: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    user = relationship("User", back_populates="missions")
    nodes = relationship("MissionNode", back_populates="mission", cascade="all, delete-orphan")
    edges = relationship("MissionEdge", back_populates="mission", cascade="all, delete-orphan")
    commitments = relationship("Commitment", back_populates="mission")
    risks = relationship("Risk", back_populates="mission")


class MissionNode(Base):
    __tablename__ = "mission_nodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mission_id: Mapped[str] = mapped_column(String(36), ForeignKey("missions.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    node_type: Mapped[str] = mapped_column(String(50), default="OBJECTIVE") # OBJECTIVE, TASK, MILESTONE, EXTERNAL
    status: Mapped[str] = mapped_column(String(50), default="PENDING")     # PENDING, IN_PROGRESS, COMPLETED, BLOCKED
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    position_x: Mapped[float] = mapped_column(Float, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, default=0.0)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    mission = relationship("Mission", back_populates="nodes")


class MissionEdge(Base):
    __tablename__ = "mission_edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mission_id: Mapped[str] = mapped_column(String(36), ForeignKey("missions.id"), index=True, nullable=False)
    source_node_id: Mapped[str] = mapped_column(String(36), nullable=False)
    target_node_id: Mapped[str] = mapped_column(String(36), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), default="BLOCKS") # BLOCKS, FEEDS_INTO, RELIES_ON

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    mission = relationship("Mission", back_populates="edges")

