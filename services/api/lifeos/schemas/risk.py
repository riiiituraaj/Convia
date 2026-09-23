from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class RecoveryOption(BaseModel):
    id: str
    title: str
    description: str
    effort: str # LOW, MEDIUM, HIGH
    risk: str # LOW, MEDIUM, HIGH
    expected_outcome: str
    affected_commitments: List[str] = Field(default_factory=list)
    action_type: str # e.g. EXTENSION, ALTERNATIVE, SCOPE_REDUCTION, DELEGATE
    action_payload: Dict[str, Any] = Field(default_factory=dict)


class RiskBase(BaseModel):
    title: str
    description: str
    severity: str = "MEDIUM" # LOW, MEDIUM, HIGH, CRITICAL
    score: float = 0.5
    mission_id: Optional[str] = None
    commitment_id: Optional[str] = None
    evidence: List[str] = Field(default_factory=list)
    affected_commitments: List[str] = Field(default_factory=list)
    recovery_strategies: List[RecoveryOption] = Field(default_factory=list)


class RiskCreate(RiskBase):
    pass


class RiskResponse(RiskBase):
    id: str
    user_id: str
    is_resolved: bool
    resolution_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecoveryExecuteRequest(BaseModel):
    option_id: str
    user_notes: Optional[str] = None
