from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any

from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.agent import AgentRun
from lifeos.schemas.agent import (
    AgentRunResponse,
    AgentRunDetailResponse,
    AgentRunStartRequest,
)
from lifeos.engines.agent_runtime import DurableAgentEngine
from lifeos.tools.registry import ToolRegistry

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/tools")
async def list_available_tools(
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Lists registered tools available to the persisted agent runner."""
    return ToolRegistry.list_tools()


@router.get("/runs", response_model=List[AgentRunResponse])
async def list_agent_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AgentRun)
        .where(AgentRun.user_id == current_user.id)
        .order_by(AgentRun.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/runs", response_model=AgentRunDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_run(
    payload: AgentRunStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates a structured plan and starts execution for a task in the durable agent engine."""
    try:
        run = await DurableAgentEngine.create_and_plan_run(
            db=db,
            user_id=current_user.id,
            task_description=payload.task_description,
            mission_id=payload.mission_id,
            conversation_id=payload.conversation_id,
        )
        # Execute initial batch of steps
        run = await DurableAgentEngine.execute_run_steps(db, run.id, current_user.id)
        return run
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to start agent run: {str(e)}")


@router.get("/runs/{run_id}", response_model=AgentRunDetailResponse)
async def get_agent_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AgentRun)
        .where(AgentRun.id == run_id, AgentRun.user_id == current_user.id)
        .options(selectinload(AgentRun.steps))
    )
    result = await db.execute(stmt)
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found")
    return run


@router.post("/runs/{run_id}/execute", response_model=AgentRunDetailResponse)
async def execute_agent_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Continues execution of steps for an active agent run."""
    try:
        run = await DurableAgentEngine.execute_run_steps(db, run_id, current_user.id)
        return run
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/runs/{run_id}/pause", response_model=AgentRunDetailResponse)
async def pause_agent_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pauses an in-progress agent run."""
    try:
        run = await DurableAgentEngine.pause_run(db, run_id, current_user.id)
        return run
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/runs/{run_id}/resume", response_model=AgentRunDetailResponse)
async def resume_agent_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resumes a paused or interrupted agent run without repeating completed steps."""
    try:
        run = await DurableAgentEngine.resume_run(db, run_id, current_user.id)
        return run
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/runs/{run_id}/cancel", response_model=AgentRunDetailResponse)
async def cancel_agent_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancels an agent run; completed work remains preserved."""
    try:
        run = await DurableAgentEngine.cancel_run(db, run_id, current_user.id)
        return run
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/runs/{run_id}/retry", response_model=AgentRunDetailResponse)
async def retry_agent_step(
    run_id: str,
    step_index: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retries an eligible failed step and resumes subsequent execution."""
    try:
        run = await DurableAgentEngine.retry_step(db, run_id, step_index, current_user.id)
        return run
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
