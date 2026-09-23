from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.agent import AgentRun
from lifeos.schemas.agent import AgentRunResponse

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/runs", response_model=List[AgentRunResponse])
async def list_agent_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AgentRun).where(AgentRun.user_id == current_user.id).order_by(AgentRun.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())
