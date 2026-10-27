from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from lifeos.schemas.commitment import CommitmentResponse


class MissionNodeBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    node_type: Literal["OBJECTIVE", "TASK", "MILESTONE", "EXTERNAL"] = "OBJECTIVE"
    status: Literal["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"] = "PENDING"
    progress: float = Field(default=0.0, ge=0, le=100)
    position_x: float = 0.0
    position_y: float = 0.0
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class MissionNodeResponse(MissionNodeBase):
    id: str
    mission_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MissionEdgeBase(BaseModel):
    source_node_id: str = Field(min_length=1, max_length=64)
    target_node_id: str = Field(min_length=1, max_length=64)
    relationship_type: Literal["BLOCKS", "FEEDS_INTO", "RELIES_ON"] = "BLOCKS"


class MissionNodeCreate(MissionNodeBase):
    client_id: str = Field(min_length=1, max_length=64)


class MissionEdgeCreate(MissionEdgeBase):
    pass


class MissionEdgeResponse(MissionEdgeBase):
    id: str
    mission_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MissionBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10000)
    desired_outcome: Optional[str] = Field(default=None, max_length=10000)
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "HIGH"
    target_date: Optional[datetime] = None
    budget_limit: Optional[float] = Field(default=None, ge=0)
    budget_currency: str = Field(default="INR", min_length=3, max_length=10)
    constraints: Dict[str, Any] = Field(default_factory=dict)


class MissionCreate(MissionBase):
    nodes: Optional[List[MissionNodeCreate]] = None
    edges: Optional[List[MissionEdgeCreate]] = None


class MissionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    desired_outcome: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    progress: Optional[float] = None
    target_date: Optional[datetime] = None
    budget_limit: Optional[float] = None
    constraints: Optional[Dict[str, Any]] = None


class MissionResponse(MissionBase):
    id: str
    user_id: str
    status: str
    progress: float
    created_at: datetime
    updated_at: datetime
    nodes: List[MissionNodeResponse] = Field(default_factory=list)
    edges: List[MissionEdgeResponse] = Field(default_factory=list)
    commitments: List[CommitmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class MissionGraphResponse(BaseModel):
    mission: MissionResponse
    nodes: List[MissionNodeResponse]
    edges: List[MissionEdgeResponse]
