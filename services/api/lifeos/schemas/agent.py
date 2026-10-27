from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class AgentRunBase(BaseModel):
    agent_type: str
    task_description: str
    input_payload: Dict[str, Any] = Field(default_factory=dict)


class AgentRunCreate(AgentRunBase):
    pass


class AgentStepResponse(BaseModel):
    id: str
    run_id: str
    step_index: int
    title: str
    tool_name: str
    input_payload: Dict[str, Any] = Field(default_factory=dict)
    output_payload: Dict[str, Any] = Field(default_factory=dict)
    status: str
    error_message: Optional[str] = None
    requires_approval: bool = False
    action_passport_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AgentRunResponse(AgentRunBase):
    id: str
    user_id: str
    status: str
    model_used: str
    latency_ms: float
    output_payload: Dict[str, Any] = Field(default_factory=dict)
    events: List[Dict[str, Any]] = Field(default_factory=list)
    plan_json: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AgentRunDetailResponse(AgentRunResponse):
    steps: List[AgentStepResponse] = Field(default_factory=list)


class AgentRunStartRequest(BaseModel):
    task_description: str = Field(min_length=1, max_length=5000)
    mission_id: Optional[str] = None
    conversation_id: Optional[str] = None


class MemoryBase(BaseModel):
    category: str = "EXPLICIT" # EXPLICIT, MISSION, TEMPORARY, DERIVED_PREFERENCE, EXTERNAL_KNOWLEDGE
    content: str
    source: str = "user_speech"
    confidence: float = 1.0
    retention_rule: str = "PERSISTENT"
    user_visible: bool = True
    mission_id: Optional[str] = None


class MemoryCreate(MemoryBase):
    pass


class MemoryResponse(MemoryBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IntegrationResponse(BaseModel):
    id: str
    provider: str
    status: str
    credentials_present: bool
    last_synced_at: Optional[datetime] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)
