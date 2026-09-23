from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class CommitmentBase(BaseModel):
    action: str
    actor: str = "user"
    recipient: Optional[str] = None
    context: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: str = "MEDIUM" # LOW, MEDIUM, HIGH, URGENT
    confidence: float = 1.0
    dependencies: List[str] = Field(default_factory=list)
    consequences: Optional[str] = None
    evidence: Optional[str] = None
    completion_condition: Optional[str] = None
    autonomy_level: int = 2
    mission_id: Optional[str] = None


class CommitmentCreate(CommitmentBase):
    pass


class CommitmentUpdate(BaseModel):
    action: Optional[str] = None
    recipient: Optional[str] = None
    context: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    dependencies: Optional[List[str]] = None
    consequences: Optional[str] = None
    completion_condition: Optional[str] = None
    autonomy_level: Optional[int] = None


class CommitmentEventResponse(BaseModel):
    id: str
    from_status: Optional[str]
    to_status: str
    reason: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CommitmentResponse(CommitmentBase):
    id: str
    user_id: str
    status: str
    risk_score: float
    risk_level: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    events: List[CommitmentEventResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
