from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Dict
from lifeos.api.deps import get_current_user
from lifeos.core.config import settings
from lifeos.models.user import User
from lifeos.tools.tavily_research import tavily_tool

router = APIRouter(prefix="/research", tags=["research"])


class ResearchRequest(BaseModel):
    query: str
    search_depth: str = "basic"


class ResearchResponse(BaseModel):
    query: str
    results: list[Dict[str, Any]]
    answer: str = ""
    evidence: list[str] = []
    provider: str
    success: bool
    error: str = ""


@router.post("", response_model=ResearchResponse)
async def run_research(
    payload: ResearchRequest,
    current_user: User = Depends(get_current_user),
):
    """Live web research via Tavily; offline knowledge-base note when no key is set."""
    has_key = bool(settings.TAVILY_API_KEY)
    result = await tavily_tool.execute(payload.query, search_depth=payload.search_depth)
    data = result.data or {}
    offline = bool(data.get("offline")) or not has_key

    if offline:
        provider = "local_fallback"
        error = result.error or "No TAVILY_API_KEY — offline notes only, not live web results."
    else:
        provider = "tavily" if result.success else "local_fallback"
        error = result.error

    return ResearchResponse(
        query=payload.query,
        results=data.get("results", []),
        answer=data.get("answer", ""),
        evidence=result.evidence,
        provider=provider,
        success=result.success,
        error=error,
    )
