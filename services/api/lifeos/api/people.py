from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.commitment import Commitment
from lifeos.models.mission import Mission
from lifeos.schemas.commitment import CommitmentResponse

router = APIRouter(prefix="/people", tags=["people"])


@router.get("")
async def list_people(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Returns people with their relationship context based on commitments."""
    # Get all commitments for the user
    stmt = select(Commitment).where(Commitment.user_id == current_user.id).where(Commitment.status.not_in(["CLOSED"]))
    result = await db.execute(stmt)
    commitments = list(result.scalars().all())

    # Group by recipient
    people_map: Dict[str, Dict[str, Any]] = {}

    for c in commitments:
        recipient = c.recipient or "Self"
        if recipient not in people_map:
            people_map[recipient] = {
                "name": recipient,
                "waiting_on_user": [],
                "user_waiting_on": [],
                "last_interaction": c.created_at.isoformat(),
                "total_commitments": 0,
                "open_commitments": 0,
            }

        people_map[recipient]["total_commitments"] += 1
        if c.status not in ("COMPLETED", "VERIFIED", "CLOSED"):
            people_map[recipient]["open_commitments"] += 1

            # Check if user is waiting on them (no recipient means self, but if recipient is someone else and status is pending)
            if c.recipient and c.status in ("PENDING_CONFIRMATION", "PLANNED", "IN_PROGRESS"):
                people_map[recipient]["waiting_on_user"].append({
                    "commitment_id": c.id,
                    "action": c.action,
                    "status": c.status,
                    "deadline": c.deadline.isoformat() if c.deadline else None,
                })
            elif c.actor != "user" and c.recipient == "user":
                # Someone else committed to user
                people_map[recipient]["user_waiting_on"].append({
                    "commitment_id": c.id,
                    "action": c.action,
                    "status": c.status,
                    "deadline": c.deadline.isoformat() if c.deadline else None,
                })

    # Convert to list and sort by activity
    people_list = list(people_map.values())
    people_list.sort(key=lambda p: p["open_commitments"], reverse=True)

    return people_list


@router.get("/waiting")
async def get_waiting_on(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Returns bidirectional waiting state: who's waiting on user and who user is waiting on."""
    stmt = select(Commitment).where(Commitment.user_id == current_user.id).where(Commitment.status.not_in(["CLOSED"]))
    result = await db.execute(stmt)
    commitments = list(result.scalars().all())

    they_wait_on_you = []
    you_wait_on_them = []

    for c in commitments:
        if c.recipient and c.recipient != "Self" and c.status in ("PENDING_CONFIRMATION", "PLANNED", "IN_PROGRESS", "AT_RISK", "RECOVERY"):
            they_wait_on_you.append({
                "person": c.recipient,
                "commitment_id": c.id,
                "action": c.action,
                "context": c.context,
                "status": c.status,
                "deadline": c.deadline.isoformat() if c.deadline else None,
                "consequences": c.consequences,
            })

        # Check dependencies - if user is waiting on someone else's action
        if c.dependencies and c.status not in ("COMPLETED", "VERIFIED", "CLOSED"):
            for dep in c.dependencies:
                if isinstance(dep, dict) and dep.get("person"):
                    you_wait_on_them.append({
                        "person": dep.get("person"),
                        "commitment_id": c.id,
                        "action": c.action,
                        "waiting_for": dep.get("action"),
                        "status": c.status,
                    })

    return {
        "they_wait_on_you": they_wait_on_you,
        "you_wait_on_them": you_wait_on_them,
    }