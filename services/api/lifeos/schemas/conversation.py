from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    context_pack_id: str | None = Field(default=None, min_length=1, max_length=36)


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    summary_text: str | None = None
    context_pack_id: str | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int
    last_message_preview: str | None = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: Literal["USER", "ASSISTANT"]
    content: str
    source: str
    status: str
    metadata_json: dict = Field(default_factory=dict)
    created_at: datetime


class ConversationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    summary_text: str | None = None
    context_pack_id: str | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse] = Field(default_factory=list)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    source: str = "text"
    client_message_id: str | None = Field(default=None, min_length=1, max_length=64)


class ConversationTurnResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse
    active_constraints: Dict[str, Any] = Field(default_factory=dict)
    diagnostics: Optional[Dict[str, Any]] = None


class ContextPreviewResponse(BaseModel):
    conversation_id: str
    total_items: int
    categories_present: List[str]
    items: List[Dict[str, Any]]
    active_constraints: Dict[str, Any]
    history_message_count: int
    truncated: bool
    summary_applied: bool
