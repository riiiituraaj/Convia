from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from lifeos.schemas.commitment import CommitmentResponse


class MissionNodeBase(BaseModel):
    title: str
    node_type: str = "OBJECTIVE" # OBJECTIVE, TASK, MILESTONE, EXTERNAL
    status: str = "PENDING"
    progress: float = 0.0
    position_x: float = 0.0
    position_y: float = 0.0
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class MissionNodeResponse(MissionNodeBase):
    id: str
    mission_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MissionEdgeBase(BaseModel):
    source_node_id: str
    target_node_id: str
    relationship_type: str = "BLOCKS"


class MissionEdgeResponse(MissionEdgeBase):
    id: str
    mission_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MissionBase(BaseModel):
    title: str
    description: Optional[str] = None
    desired_outcome: Optional[str] = None
    priority: str = "HIGH"
    target_date: Optional[datetime] = None
    budget_limit: Optional[float] = None
    budget_currency: str = "INR"
    constraints: Dict[str, Any] = Field(default_factory=dict)


class MissionCreate(MissionBase):
    nodes: Optional[List[MissionNodeBase]] = None
    edges: Optional[List[MissionEdgeBase]] = None


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
