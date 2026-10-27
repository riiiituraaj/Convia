from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos.api.deps import get_current_user
from lifeos.core.database import get_db
from lifeos.models.research import ResearchSession, ResearchSource
from lifeos.models.user import User
from lifeos.services.research_service import ResearchService

router = APIRouter(prefix="/research", tags=["research"])


class ResearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    search_depth: Literal["basic", "advanced"] = "basic"
    title: Optional[str] = None


class SourceResponse(BaseModel):
    id: str
    url: str
    title: str
    source: str
    domain: Optional[str] = None
    snippet: str
    relevance: Optional[float] = None
    retrieval_status: str
    published_at: Optional[str] = None
    retrieved_at: datetime


class ResearchSessionSummary(BaseModel):
    id: str
    title: str
    original_query: str
    status: str
    summary: Optional[str] = None
    sources_count: int
    created_at: datetime
    updated_at: datetime


class ResearchSessionDetail(BaseModel):
    id: str
    title: str
    original_query: str
    status: str
    summary: Optional[str] = None
    synthesis: Optional[str] = None
    claims_json: List[Dict[str, Any]] = Field(default_factory=list)
    sources: List[SourceResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ResearchResponse(BaseModel):
    session_id: str
    query: str
    results: List[Dict[str, Any]]
    answer: str = ""
    synthesis: str = ""
    claims: List[Dict[str, Any]] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    provider: str
    success: bool
    error: str = ""


@router.post("", response_model=ResearchResponse)
async def run_research(
    payload: ResearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Runs web research, persists sources, and checks citation IDs resolve to retrieved sources."""
    session = await ResearchService.run_and_persist_research(
        db=db,
        user_id=current_user.id,
        query=payload.query,
        search_depth=payload.search_depth,
        title=payload.title,
    )

    results = [
        {
            "id": s.id,
            "title": s.title,
            "url": s.url,
            "domain": s.domain,
            "snippet": s.snippet,
            "published_at": s.published_at,
            "relevance": s.relevance,
        }
        for s in session.sources
    ]

    evidence = [f"[{s.id}] {s.title}: {s.snippet[:200]} ({s.url})" for s in session.sources]

    return ResearchResponse(
        session_id=session.id,
        query=session.original_query,
        results=results,
        answer=session.summary or "",
        synthesis=session.synthesis or "",
        claims=session.claims_json,
        evidence=evidence,
        provider="tavily" if session.status == "COMPLETED" else "unavailable",
        success=session.status == "COMPLETED",
        error="" if session.status == "COMPLETED" else (session.summary or "Live research unavailable"),
    )


@router.get("", response_model=List[ResearchSessionSummary])
async def list_research_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists saved research sessions owned by the authenticated user."""
    stmt = (
        select(ResearchSession)
        .where(ResearchSession.user_id == current_user.id)
        .options(selectinload(ResearchSession.sources))
        .order_by(ResearchSession.updated_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.scalars().all()
    return [
        ResearchSessionSummary(
            id=r.id,
            title=r.title,
            original_query=r.original_query,
            status=r.status,
            summary=r.summary,
            sources_count=len(r.sources),
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.get("/{session_id}", response_model=ResearchSessionDetail)
async def get_research_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reopens a saved research session and its source-linked synthesis."""
    stmt = (
        select(ResearchSession)
        .where(ResearchSession.id == session_id, ResearchSession.user_id == current_user.id)
        .options(selectinload(ResearchSession.sources))
    )
    res = await db.execute(stmt)
    session = res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Research session not found")

    return ResearchSessionDetail(
        id=session.id,
        title=session.title,
        original_query=session.original_query,
        status=session.status,
        summary=session.summary,
        synthesis=session.synthesis,
        claims_json=session.claims_json,
        sources=[
            SourceResponse(
                id=s.id,
                url=s.url,
                title=s.title,
                source=s.source,
                domain=s.domain,
                snippet=s.snippet,
                relevance=s.relevance,
                retrieval_status=s.retrieval_status,
                published_at=s.published_at,
                retrieved_at=s.retrieved_at,
            )
            for s in session.sources
        ],
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.post("/{session_id}/to-artifact")
async def convert_research_to_artifact(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Converts a completed research session into a permanent, reusable Artifact."""
    try:
        artifact = await ResearchService.convert_to_artifact(db, session_id, current_user.id)
        return {
            "artifact_id": artifact.id,
            "title": artifact.title,
            "artifact_type": artifact.artifact_type,
            "message": "Research successfully saved as a deliverable artifact.",
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{session_id}/to-mission")
async def convert_research_to_mission(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Converts research findings into an actionable mission with tracked commitments."""
    try:
        mission = await ResearchService.convert_to_mission(db, session_id, current_user.id)
        return {
            "mission_id": mission.id,
            "title": mission.title,
            "message": "Research findings converted into a tracked mission.",
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_research_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ResearchSession).where(
        ResearchSession.id == session_id,
        ResearchSession.user_id == current_user.id,
    )
    res = await db.execute(stmt)
    session = res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Research session not found")
    await db.delete(session)
    await db.commit()
