from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.mission import Mission, MissionNode, MissionEdge
from lifeos.models.commitment import Commitment
from lifeos.schemas.mission import MissionCreate, MissionUpdate, MissionResponse, MissionGraphResponse
from lifeos.core.event_bus import event_bus

router = APIRouter(prefix="/missions", tags=["missions"])


def _validate_mission_graph(payload: MissionCreate) -> None:
    client_ids = [node.client_id for node in payload.nodes or []]
    if len(client_ids) != len(set(client_ids)):
        raise HTTPException(status_code=422, detail="Mission node client_id values must be unique")
    node_ids = set(client_ids)
    adjacency = {node_id: [] for node_id in node_ids}
    indegree = {node_id: 0 for node_id in node_ids}
    for edge in payload.edges or []:
        if edge.source_node_id not in node_ids or edge.target_node_id not in node_ids:
            raise HTTPException(status_code=422, detail="Mission edges must reference nodes in the same mission")
        if edge.source_node_id == edge.target_node_id:
            raise HTTPException(status_code=422, detail="Mission nodes cannot depend on themselves")
        adjacency[edge.source_node_id].append(edge.target_node_id)
        indegree[edge.target_node_id] += 1

    ready = [node_id for node_id, degree in indegree.items() if degree == 0]
    visited = 0
    while ready:
        node_id = ready.pop()
        visited += 1
        for dependent in adjacency[node_id]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                ready.append(dependent)
    if visited != len(node_ids):
        raise HTTPException(status_code=422, detail="Mission dependencies must not contain a cycle")


@router.post("", response_model=MissionResponse)
async def create_mission(
    payload: MissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    _validate_mission_graph(payload)
    mission = Mission(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        desired_outcome=payload.desired_outcome,
        priority=payload.priority,
        target_date=payload.target_date,
        budget_limit=payload.budget_limit,
        budget_currency=payload.budget_currency,
        constraints=payload.constraints
    )
    db.add(mission)
    await db.flush()

    node_id_map: dict[str, str] = {}
    if payload.nodes:
        for n in payload.nodes:
            node = MissionNode(
                mission_id=mission.id,
                title=n.title,
                node_type=n.node_type,
                status=n.status,
                progress=n.progress,
                position_x=n.position_x,
                position_y=n.position_y,
                metadata_json=n.metadata_json
            )
            db.add(node)
            await db.flush()
            node_id_map[n.client_id] = node.id

    if payload.edges:
        for e in payload.edges:
            edge = MissionEdge(
                mission_id=mission.id,
                source_node_id=node_id_map[e.source_node_id],
                target_node_id=node_id_map[e.target_node_id],
                relationship_type=e.relationship_type
            )
            db.add(edge)

    await db.commit()
    await db.refresh(mission)

    await event_bus.publish("mission.updated", {
        "id": mission.id,
        "title": mission.title,
        "user_id": current_user.id
    })

    # Reload with relationships
    stmt = (
        select(Mission)
        .where(Mission.id == mission.id)
        .options(
            selectinload(Mission.nodes),
            selectinload(Mission.edges),
            selectinload(Mission.commitments).selectinload(Commitment.events)
        )
    )
    res = await db.execute(stmt)
    return res.scalars().first()


@router.get("", response_model=List[MissionResponse])
async def list_missions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Mission)
        .where(Mission.user_id == current_user.id)
        .options(
            selectinload(Mission.nodes),
            selectinload(Mission.edges),
            selectinload(Mission.commitments).selectinload(Commitment.events)
        )
        .order_by(Mission.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{id}", response_model=MissionResponse)
async def get_mission(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Mission)
        .where(Mission.id == id, Mission.user_id == current_user.id)
        .options(
            selectinload(Mission.nodes),
            selectinload(Mission.edges),
            selectinload(Mission.commitments).selectinload(Commitment.events)
        )
    )
    result = await db.execute(stmt)
    mission = result.scalars().first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission


@router.get("/{id}/graph", response_model=MissionGraphResponse)
async def get_mission_graph(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    mission = await get_mission(id=id, current_user=current_user, db=db)
    return MissionGraphResponse(
        mission=mission, # type: ignore
        nodes=mission.nodes, # type: ignore
        edges=mission.edges # type: ignore
    )
