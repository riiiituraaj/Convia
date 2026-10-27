from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos.api.deps import get_current_user
from lifeos.core.database import get_db
from lifeos.models.artifact import Artifact
from lifeos.models.user import User

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


class ArtifactCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    artifact_type: str = Field(default="evidence_report")
    content: str = Field(min_length=1)
    summary: Optional[str] = None
    sources_json: List[Dict[str, Any]] = Field(default_factory=list)
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    mission_id: Optional[str] = None
    agent_run_id: Optional[str] = None
    conversation_id: Optional[str] = None


class ArtifactUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    summary: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


class ArtifactResponse(BaseModel):
    id: str
    user_id: str
    mission_id: Optional[str] = None
    agent_run_id: Optional[str] = None
    conversation_id: Optional[str] = None
    title: str
    artifact_type: str
    content: str
    summary: Optional[str] = None
    sources_json: List[Dict[str, Any]] = Field(default_factory=list)
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    version: int
    created_at: datetime
    updated_at: datetime


class ArtifactSummaryResponse(BaseModel):
    id: str
    title: str
    artifact_type: str
    summary: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime


@router.post("", response_model=ArtifactResponse, status_code=status.HTTP_201_CREATED)
async def create_artifact(
    payload: ArtifactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a persistent, reusable artifact."""
    artifact = Artifact(
        user_id=current_user.id,
        title=payload.title.strip()[:255],
        artifact_type=payload.artifact_type.strip()[:50],
        content=payload.content,
        summary=payload.summary,
        sources_json=payload.sources_json,
        metadata_json=payload.metadata_json,
        mission_id=payload.mission_id,
        agent_run_id=payload.agent_run_id,
        conversation_id=payload.conversation_id,
        version=1,
    )
    db.add(artifact)
    await db.commit()
    await db.refresh(artifact)
    return artifact


@router.get("", response_model=List[ArtifactSummaryResponse])
async def list_artifacts(
    artifact_type: Optional[str] = Query(None),
    mission_id: Optional[str] = Query(None),
    conversation_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists artifacts owned by the authenticated user with optional filtering."""
    query = select(Artifact).where(Artifact.user_id == current_user.id)
    if artifact_type:
        query = query.where(Artifact.artifact_type == artifact_type)
    if mission_id:
        query = query.where(Artifact.mission_id == mission_id)
    if conversation_id:
        query = query.where(Artifact.conversation_id == conversation_id)

    query = query.order_by(Artifact.updated_at.desc())
    res = await db.execute(query)
    rows = res.scalars().all()
    return [
        ArtifactSummaryResponse(
            id=r.id,
            title=r.title,
            artifact_type=r.artifact_type,
            summary=r.summary,
            version=r.version,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.get("/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    artifact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Artifact).where(Artifact.id == artifact_id, Artifact.user_id == current_user.id)
    res = await db.execute(stmt)
    artifact = res.scalars().first()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact


@router.patch("/{artifact_id}", response_model=ArtifactResponse)
async def update_artifact(
    artifact_id: str,
    payload: ArtifactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Artifact).where(Artifact.id == artifact_id, Artifact.user_id == current_user.id)
    res = await db.execute(stmt)
    artifact = res.scalars().first()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if payload.title is not None:
        artifact.title = payload.title.strip()[:255]
    if payload.content is not None:
        artifact.content = payload.content
    if payload.summary is not None:
        artifact.summary = payload.summary
    if payload.metadata_json is not None:
        artifact.metadata_json.update(payload.metadata_json)

    artifact.version += 1
    artifact.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(artifact)
    return artifact


@router.get("/{artifact_id}/export")
async def export_artifact(
    artifact_id: str,
    format: Literal["markdown", "json"] = "markdown",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Exports artifact as Markdown or JSON."""
    stmt = select(Artifact).where(Artifact.id == artifact_id, Artifact.user_id == current_user.id)
    res = await db.execute(stmt)
    artifact = res.scalars().first()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if format == "json":
        return {
            "id": artifact.id,
            "title": artifact.title,
            "type": artifact.artifact_type,
            "content": artifact.content,
            "summary": artifact.summary,
            "sources": artifact.sources_json,
            "version": artifact.version,
            "created_at": artifact.created_at.isoformat(),
        }

    # Markdown export format
    md_header = (
        f"# {artifact.title}\n\n"
        f"- **Type**: {artifact.artifact_type}\n"
        f"- **Version**: {artifact.version}\n"
        f"- **Generated**: {artifact.created_at.strftime('%Y-%m-%d %H:%M UTC')}\n\n"
    )
    if artifact.summary:
        md_header += f"> {artifact.summary}\n\n"

    sources_block = ""
    if artifact.sources_json:
        sources_block = "\n\n## Sources & Citations\n" + "\n".join(
            f"- [{s.get('id', 'ref')}] {s.get('title', 'Source')}: {s.get('url', '')}"
            for s in artifact.sources_json
        )

    full_md = f"{md_header}{artifact.content}{sources_block}"
    return Response(
        content=full_md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{artifact.title[:50]}.md"'},
    )


@router.delete("/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(
    artifact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Artifact).where(Artifact.id == artifact_id, Artifact.user_id == current_user.id)
    res = await db.execute(stmt)
    artifact = res.scalars().first()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    await db.delete(artifact)
    await db.commit()

