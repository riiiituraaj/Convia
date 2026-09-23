from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.risk import Risk
from lifeos.models.action import ActionPassport
from lifeos.schemas.risk import RiskResponse, RecoveryExecuteRequest
from lifeos.schemas.action import ActionPassportResponse, ActionDecisionRequest
from lifeos.agents.execution_agent import VerificationAgent
from lifeos.core.event_bus import event_bus
from datetime import datetime, timezone

router = APIRouter(prefix="/risks", tags=["risks"])
actions_router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("", response_model=List[RiskResponse])
async def list_risks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Risk).where(Risk.user_id == current_user.id).order_by(Risk.score.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/{id}/recover")
async def execute_recovery_option(
    id: str,
    payload: RecoveryExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Risk).where(Risk.id == id, Risk.user_id == current_user.id)
    result = await db.execute(stmt)
    risk = result.scalars().first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")

    # Generate Action Passport for chosen recovery option
    chosen_opt = next((opt for opt in risk.recovery_strategies if opt.get("id") == payload.option_id), None)
    if not chosen_opt:
        raise HTTPException(status_code=400, detail="Recovery option not found")

    passport = ActionPassport(
        user_id=current_user.id,
        mission_id=risk.mission_id,
        commitment_id=risk.commitment_id,
        action_name=chosen_opt["title"],
        why=f"Mitigating risk: {risk.title}",
        evidence=risk.evidence,
        expected_impact=chosen_opt["expected_outcome"],
        risk_level=chosen_opt["risk"],
        is_reversible=True,
        approval_required=True,
        execution_payload=chosen_opt.get("action_payload", {})
    )
    db.add(passport)
    await db.commit()
    await db.refresh(passport)

    await event_bus.publish("approval.requested", {
        "passport_id": passport.id,
        "action": passport.action_name,
        "user_id": current_user.id
    })

    return {"message": "Recovery initiated. Action Passport ready for review.", "passport_id": passport.id}


@actions_router.get("", response_model=List[ActionPassportResponse])
async def list_actions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ActionPassport).where(ActionPassport.user_id == current_user.id).order_by(ActionPassport.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@actions_router.post("/{id}/decision", response_model=ActionPassportResponse)
async def decide_action(
    id: str,
    payload: ActionDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ActionPassport).where(ActionPassport.id == id, ActionPassport.user_id == current_user.id)
    result = await db.execute(stmt)
    passport = result.scalars().first()
    if not passport:
        raise HTTPException(status_code=404, detail="Action passport not found")

    if payload.decision == "APPROVE":
        passport.status = "EXECUTED"
        passport.executed_at = datetime.now(timezone.utc)
        passport.execution_result = {
            "status": "SUCCESS",
            "message": f"Recorded action '{passport.action_name}' as executed after approval."
        }

        # Verification step
        verifier = VerificationAgent()
        verification_record = await verifier.verify_action({
            "id": passport.id,
            "action_name": passport.action_name
        })
        passport.status = "VERIFIED"
        passport.verified_at = datetime.now(timezone.utc)
        passport.verification_record = verification_record

        # Close related open risks for this commitment/mission so recovery completes the loop.
        risk_stmt = select(Risk).where(
            Risk.user_id == current_user.id,
            Risk.is_resolved.is_(False),
        )
        if passport.commitment_id:
            risk_stmt = risk_stmt.where(Risk.commitment_id == passport.commitment_id)
        elif passport.mission_id:
            risk_stmt = risk_stmt.where(Risk.mission_id == passport.mission_id)
        related_risks = (await db.execute(risk_stmt)).scalars().all()
        for risk in related_risks:
            risk.is_resolved = True
            risk.resolution_notes = (
                f"Resolved after approved recovery: {passport.action_name}"
            )

        await event_bus.publish("action.completed", {
            "passport_id": passport.id,
            "action": passport.action_name,
            "verification": verification_record,
            "user_id": current_user.id,
        })
        for risk in related_risks:
            await event_bus.publish("risk.resolved", {
                "risk_id": risk.id,
                "title": risk.title,
                "user_id": current_user.id,
            })
    else:
        passport.status = "REJECTED"

    await db.commit()
    await db.refresh(passport)
    return passport

