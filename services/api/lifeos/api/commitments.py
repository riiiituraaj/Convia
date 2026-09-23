from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.commitment import Commitment
from lifeos.schemas.commitment import CommitmentCreate, CommitmentUpdate, CommitmentResponse
from lifeos.engines.commitment_engine import CommitmentEngine
from lifeos.core.event_bus import event_bus

router = APIRouter(prefix="/commitments", tags=["commitments"])


@router.post("", response_model=CommitmentResponse)
async def create_commitment(
    payload: CommitmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    commitment = Commitment(
        user_id=current_user.id,
        action=payload.action,
        actor=payload.actor,
        recipient=payload.recipient,
        context=payload.context,
        deadline=payload.deadline,
        priority=payload.priority,
        confidence=payload.confidence,
        dependencies=payload.dependencies,
        consequences=payload.consequences,
        evidence=payload.evidence,
        completion_condition=payload.completion_condition,
        autonomy_level=payload.autonomy_level,
        mission_id=payload.mission_id,
        status="CONFIRMED"
    )
    db.add(commitment)
    await db.commit()
    await db.refresh(commitment)

    await event_bus.publish("commitment.created", {
        "id": commitment.id,
        "action": commitment.action,
        "recipient": commitment.recipient,
        "user_id": current_user.id
    })

    stmt = select(Commitment).where(Commitment.id == commitment.id).options(selectinload(Commitment.events))
    res = await db.execute(stmt)
    return res.scalars().first()


@router.get("", response_model=List[CommitmentResponse])
async def list_commitments(
    filter_by: Optional[str] = Query("ALL", description="Filter: ALL, TODAY, THIS_WEEK, AT_RISK, WAITING, COMPLETED"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Commitment)
        .where(Commitment.user_id == current_user.id)
        .options(selectinload(Commitment.events))
        .order_by(Commitment.created_at.desc())
    )
    result = await db.execute(stmt)
    items = list(result.scalars().all())

    if filter_by == "AT_RISK":
        return [c for c in items if c.risk_level in ("HIGH", "CRITICAL") or c.status == "AT_RISK"]
    elif filter_by == "WAITING":
        return [c for c in items if c.recipient and c.status not in ("COMPLETED", "CLOSED")]
    elif filter_by == "COMPLETED":
        return [c for c in items if c.status in ("COMPLETED", "VERIFIED", "CLOSED")]
    return items


@router.get("/{id}", response_model=CommitmentResponse)
async def get_commitment(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Commitment).where(Commitment.id == id, Commitment.user_id == current_user.id).options(selectinload(Commitment.events))
    result = await db.execute(stmt)
    commitment = result.scalars().first()
    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")
    return commitment


@router.patch("/{id}", response_model=CommitmentResponse)
async def update_commitment(
    id: str,
    payload: CommitmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Commitment).where(Commitment.id == id, Commitment.user_id == current_user.id).options(selectinload(Commitment.events))
    result = await db.execute(stmt)
    commitment = result.scalars().first()
    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")

    if payload.status and payload.status != commitment.status:
        await CommitmentEngine.transition_status(
            commitment=commitment,
            to_status=payload.status,
            reason="User status update",
            db_session=db
        )

    for field, val in payload.model_dump(exclude_unset=True).items():
        if field != "status":
            setattr(commitment, field, val)

    await db.commit()
    await db.refresh(commitment)
    return commitment

