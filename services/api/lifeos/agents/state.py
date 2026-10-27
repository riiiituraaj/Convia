from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class AgentState(BaseModel):
    user_id: str
    raw_intent: str
    user_context: Dict[str, Any] = Field(default_factory=dict)
    current_mission: Optional[Dict[str, Any]] = None
    commitments: List[Dict[str, Any]] = Field(default_factory=list)
    dependencies: List[Dict[str, Any]] = Field(default_factory=list)
    risks: List[Dict[str, Any]] = Field(default_factory=list)
    memory: List[Dict[str, Any]] = Field(default_factory=list)
    tool_availability: List[str] = Field(default_factory=lambda: [
        "tavily_search"
        # Calendar/email write tools remain omitted; Google Workspace grants read-only access.
    ])
    agent_results: Dict[str, Any] = Field(default_factory=dict)
    pending_approvals: List[Dict[str, Any]] = Field(default_factory=list)
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    verification_results: List[Dict[str, Any]] = Field(default_factory=list)
    critic_notes: List[str] = Field(default_factory=list)
    active_agent: Optional[str] = None
    run_logs: List[Dict[str, Any]] = Field(default_factory=list)

