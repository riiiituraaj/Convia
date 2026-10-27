from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from lifeos.schemas.commitment import CommitmentCreate
from lifeos.schemas.mission import MissionCreate


class CandidateCommitment(CommitmentCreate):
    candidate_id: str
    suggested_for_confirmation: bool = False
    clarification_question: Optional[str] = None


class ExtractedMission(MissionCreate):
    id: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[float] = None
    extracted_nodes: List[Dict[str, Any]] = Field(default_factory=list)
    extracted_edges: List[Dict[str, Any]] = Field(default_factory=list)


class IntentParseRequest(BaseModel):
    raw_text: str = Field(min_length=1, max_length=10000)
    context: Optional[str] = Field(default=None, max_length=4000)
    conversation_id: Optional[str] = Field(default=None, max_length=36)
    source: Literal["text", "voice", "calendar", "email"] = "text"


class IntentParseResponse(BaseModel):
    conversation_id: str
    recognized_intent: str
    extracted_mission: Optional[ExtractedMission] = None
    commitments: List[CandidateCommitment] = Field(default_factory=list)
    signals_detected: List[str] = Field(default_factory=list)
    summary_message: str
    confidence: Optional[float] = None
    model_used: str = "local-deterministic"


class BlindSpotsResponse(BaseModel):
    total_found: int
    unresolved_dependencies: List[Dict[str, Any]] = Field(default_factory=list)
    waiting_on_user: List[Dict[str, Any]] = Field(default_factory=list)
    expiring_windows: List[Dict[str, Any]] = Field(default_factory=list)
    schedule_conflicts: List[Dict[str, Any]] = Field(default_factory=list)
    insights: List[str] = Field(default_factory=list)


class ResolveDayTask(BaseModel):
    time_slot: str
    commitment_id: Optional[str]
    title: str
    priority: str
    why: str
    estimated_minutes: int
    action_type: str


class ResolveDayResponse(BaseModel):
    plan_date: str
    total_hours_required: float
    critical_commitments_protected: int
    schedule: List[ResolveDayTask] = Field(default_factory=list)
    tradeoffs_made: List[str] = Field(default_factory=list)
    continuity_status: str

