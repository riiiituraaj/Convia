from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.memory import Memory, Integration
from lifeos.models.mission import Mission
from lifeos.schemas.agent import MemoryResponse, MemoryCreate, IntegrationResponse
from lifeos.core.config import settings

memory_router = APIRouter(prefix="/memory", tags=["memory"])
integrations_router = APIRouter(prefix="/integrations", tags=["integrations"])


@memory_router.get("", response_model=List[MemoryResponse])
async def list_memories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Memory).where(Memory.user_id == current_user.id).order_by(Memory.created_at.desc())
    result = await db.execute(stmt)
    # Honest empty state — never inject demo Bangalore memories for a fresh account.
    return list(result.scalars().all())


@memory_router.post("", response_model=MemoryResponse)
async def create_memory(
    payload: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if payload.mission_id:
        owned_mission = await db.execute(
            select(Mission.id).where(Mission.id == payload.mission_id, Mission.user_id == current_user.id)
        )
        if not owned_mission.first():
            raise HTTPException(status_code=404, detail="Mission not found")

    mem = Memory(
        user_id=current_user.id,
        category=payload.category,
        content=payload.content,
        source=payload.source,
        confidence=payload.confidence,
        retention_rule=payload.retention_rule,
        user_visible=payload.user_visible,
        mission_id=payload.mission_id
    )
    db.add(mem)
    await db.commit()
    await db.refresh(mem)
    return mem


@memory_router.delete("/{id}")
async def delete_memory(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = delete(Memory).where(Memory.id == id, Memory.user_id == current_user.id)
    await db.execute(stmt)
    await db.commit()
    return {"message": "Memory deleted successfully"}


@integrations_router.get("", response_model=List[IntegrationResponse])
async def list_integrations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return configuration presence only; no provider is called by this endpoint."""
    has_tavily = bool(settings.TAVILY_API_KEY)
    selected_provider = settings.AI_PROVIDER
    inference_key = settings.NVIDIA_API_KEY if selected_provider == "nvidia" else settings.NEBIUS_API_KEY
    inference_model = settings.NVIDIA_NIM_MODEL if selected_provider == "nvidia" else settings.NEBIUS_NEMOTRON_MODEL
    inference_configured = bool(inference_key and inference_model)

    integrations = [
        IntegrationResponse(
            id="tavily_search",
            provider="Tavily External Research",
            status="CONFIGURED" if has_tavily else "NOT_CONFIGURED",
            credentials_present=has_tavily,
            last_synced_at=None,
            metadata_json={"purpose": "Server-side web research", "connectivity_checked": False}
        ),
        IntegrationResponse(
            id="nvidia_nim",
            provider=f"{selected_provider.title()} inference (Nemotron)",
            status="CONFIGURED" if inference_configured else "NOT_CONFIGURED",
            credentials_present=bool(inference_key),
            last_synced_at=None,
            metadata_json={
                "purpose": "Selected language-model inference route.",
                "model_configured": bool(inference_model),
                "connectivity_checked": False,
            }
        ),
        IntegrationResponse(
            id="google_calendar",
            provider="Google Calendar",
            status="COMING_SOON",
            credentials_present=False,
            last_synced_at=None,
            metadata_json={
                "purpose": "Schedule conflict detection and work block reservation",
                "note": "Calendar tool is wired in code but no provider is connected — it fails honestly instead of booking fake events.",
            }
        ),
        IntegrationResponse(
            id="gmail",
            provider="Gmail",
            status="COMING_SOON",
            credentials_present=False,
            last_synced_at=None,
            metadata_json={
                "purpose": "Inbound commitment detection from stakeholder emails",
                "note": "Email tool is wired in code but no provider is connected — it fails honestly instead of sending fake mail.",
            }
        ),
        IntegrationResponse(
            id="google_drive",
            provider="Google Drive",
            status="COMING_SOON",
            credentials_present=False,
            last_synced_at=None,
            metadata_json={"purpose": "Document scanning and agreement evidence verification"}
        ),
        IntegrationResponse(
            id="nvidia_parakeet",
            provider="NVIDIA Parakeet ASR",
            status="NOT_CONNECTED" if settings.NVIDIA_API_KEY else "NOT_CONFIGURED",
            credentials_present=bool(settings.NVIDIA_API_KEY),
            last_synced_at=None,
            metadata_json={
                "purpose": "Optional server-side speech-to-text for explicit audio uploads",
                "note": "Transcription uses NVIDIA Parakeet when the user chooses Record with NVIDIA. A configured key does not verify model access or connectivity; server-side text-to-speech remains unavailable."
            }
        ),
    ]
    return integrations

