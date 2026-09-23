from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class ActionPassportBase(BaseModel):
    action_name: str
    why: str
    evidence: List[str] = Field(default_factory=list)
    expected_impact: str
    risk_level: str = "LOW"
    is_reversible: bool = True
    approval_required: bool = True
    commitment_id: Optional[str] = None
    mission_id: Optional[str] = None
    execution_payload: Dict[str, Any] = Field(default_factory=dict)


class ActionPassportCreate(ActionPassportBase):
    pass


class ActionPassportResponse(ActionPassportBase):
    id: str
    user_id: str
    status: str # PENDING_APPROVAL, APPROVED, REJECTED, EXECUTED, VERIFIED
    execution_result: Dict[str, Any] = Field(default_factory=dict)
    verification_record: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    executed_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ActionDecisionRequest(BaseModel):
    decision: str # APPROVE or REJECT
    notes: Optional[str] = None
