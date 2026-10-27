from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime, timezone, timedelta
import time
from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.commitment import Commitment, CommitmentEvent
from lifeos.models.mission import Mission, MissionNode, MissionEdge
from lifeos.models.agent import AgentRun
from lifeos.models.risk import Risk
from lifeos.models.action import ActionPassport
from lifeos.models.memory import Memory
from lifeos.models.conversation import Conversation, Message
from lifeos.schemas.intent import IntentParseRequest, IntentParseResponse, BlindSpotsResponse, ResolveDayResponse
from lifeos.agents.orchestrator import orchestrator
from lifeos.engines.recovery_engine import BlindSpotsEngine, ResolveDayEngine
from lifeos.core.event_bus import event_bus

router = APIRouter(prefix="/intents", tags=["intents"])


async def _record_agent_run(
    db: AsyncSession,
    user_id: str,
    task_description: str,
    status: str,
    latency_ms: float,
    events: list,
    output_payload: Optional[dict] = None,
    model_used: str = "local-deterministic",
) -> None:
    run = AgentRun(
        user_id=user_id,
        agent_type="ORCHESTRATOR",
        task_description=task_description,
        status=status,
        model_used=model_used,
        latency_ms=latency_ms,
        events=events,
        output_payload=output_payload or {},
        completed_at=datetime.now(timezone.utc) if status != "RUNNING" else None,
    )
    db.add(run)
    await db.commit()


def _parse_deadline_text(text: Optional[str]) -> Optional[datetime]:
    if not text:
        return None
    lowered = text.lower()
    now = datetime.now(timezone.utc)
    if "tonight" in lowered or "today" in lowered:
        return now.replace(hour=23, minute=59, second=0, microsecond=0)
    if "day" in lowered:
        digits = "".join(ch for ch in lowered if ch.isdigit())
        if digits:
            return now + timedelta(days=int(digits))
    if "week" in lowered:
        return now + timedelta(days=7)
    return None


async def _persist_mission_and_commitments(
    db: AsyncSession,
    user_id: str,
    mission_data: Optional[dict],
    commitment_dicts: list[dict],
) -> tuple[Optional[Mission], list[Commitment]]:
    """Actually write extracted mission + commitments so capture is never a no-op."""
    mission: Optional[Mission] = None

    if mission_data and mission_data.get("title"):
        title = str(mission_data["title"])[:255]
        existing = (
            await db.execute(
                select(Mission).where(
                    Mission.user_id == user_id,
                    Mission.title == title,
                    Mission.status == "ACTIVE",
                )
            )
        ).scalars().first()
        mission = existing or Mission(
            user_id=user_id,
            title=title,
            description=mission_data.get("description"),
            desired_outcome=mission_data.get("desired_outcome"),
            status=str(mission_data.get("status") or "ACTIVE"),
            priority=str(mission_data.get("priority") or "HIGH"),
            progress=float(mission_data.get("progress") or 0.0),
            budget_limit=mission_data.get("budget_limit"),
            budget_currency=str(mission_data.get("budget_currency") or "INR"),
            constraints=mission_data.get("constraints") or {},
        )
        if existing is None:
            db.add(mission)
            await db.flush()

            # Attach planned DAG nodes/edges when the planning agent produced them
            planned_nodes = (mission_data.get("nodes") or [])
            node_ids: dict[str, str] = {}
            for node in planned_nodes:
                row = MissionNode(
                    mission_id=mission.id,
                    title=str(node.get("title") or "Node")[:255],
                    node_type=str(node.get("node_type") or "OBJECTIVE"),
                    status=str(node.get("status") or "PENDING"),
                    progress=float(node.get("progress") or 0.0),
                    position_x=float(node.get("position_x") or 0.0),
                    position_y=float(node.get("position_y") or 0.0),
                    metadata_json=node.get("metadata_json") or {},
                )
                # Always use a unique PK; agent-provided ids are only edge-map keys
                # (planner returns fixed labels like "node_api" that would collide).
                key = str(node.get("id") or f"node_{len(node_ids)}")
                node_ids[key] = row.id
                db.add(row)
                await db.flush()

            for edge in mission_data.get("edges") or []:
                source = node_ids.get(edge.get("source_node_id"), edge.get("source_node_id"))
                target = node_ids.get(edge.get("target_node_id"), edge.get("target_node_id"))
                if not source or not target:
                    continue
                db.add(
                    MissionEdge(
                        mission_id=mission.id,
                        source_node_id=source,
                        target_node_id=target,
                        relationship_type=str(edge.get("relationship_type") or "BLOCKS"),
                    )
                )

    saved: list[Commitment] = []
    for item in commitment_dicts:
        action = (item.get("action") or "").strip()
        if not action:
            continue

        # Skip exact open duplicates for this user
        dup = (
            await db.execute(
                select(Commitment).where(
                    Commitment.user_id == user_id,
                    Commitment.action == action,
                    Commitment.status.notin_(("CLOSED", "COMPLETED", "VERIFIED")),
                )
            )
        ).scalars().first()
        if dup:
            saved.append(dup)
            continue

        status = str(item.get("status") or "CONFIRMED")
        if status not in (
            "DETECTED",
            "PENDING_CONFIRMATION",
            "CONFIRMED",
            "PLANNED",
            "IN_PROGRESS",
            "AT_RISK",
            "RECOVERY",
            "COMPLETED",
            "VERIFIED",
            "CLOSED",
        ):
            status = "CONFIRMED"

        commitment = Commitment(
            user_id=user_id,
            mission_id=mission.id if mission else None,
            action=action[:2000],
            actor=str(item.get("actor") or "user"),
            recipient=item.get("recipient"),
            context=item.get("context"),
            deadline=item.get("deadline") or _parse_deadline_text(item.get("deadline_text")),
            priority=str(item.get("priority") or "MEDIUM"),
            status=status,
            confidence=item.get("confidence"),
            dependencies=item.get("dependencies") or [],
            consequences=item.get("consequences"),
            evidence=item.get("evidence"),
            completion_condition=item.get("completion_condition"),
            autonomy_level=int(item.get("autonomy_level") or 2),
        )
        db.add(commitment)
        await db.flush()
        db.add(
            CommitmentEvent(
                commitment_id=commitment.id,
                from_status=None,
                to_status=commitment.status,
                reason="Intent parse capture",
            )
        )
        saved.append(commitment)

    await db.commit()
    return mission, saved


async def _persist_risks_and_passports(
    db: AsyncSession,
    user_id: str,
    mission: Optional[Mission],
    commitments: list[Commitment],
    risk_dicts: list[dict],
    passport_dicts: list[dict],
) -> tuple[list[Risk], list[ActionPassport]]:
    """Persist pipeline risks + action passports so recovery is never a phantom."""
    saved_risks: list[Risk] = []
    saved_passports: list[ActionPassport] = []

    # Map commitment titles → ids for linking when affected_commitments match.
    title_to_id = {c.action: c.id for c in commitments if c.action}

    for item in risk_dicts:
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        dup = (
            await db.execute(
                select(Risk).where(
                    Risk.user_id == user_id,
                    Risk.title == title,
                    Risk.is_resolved.is_(False),
                )
            )
        ).scalars().first()
        if dup:
            saved_risks.append(dup)
            continue

        affected = item.get("affected_commitments") or []
        commitment_id = None
        for name in affected:
            if name in title_to_id:
                commitment_id = title_to_id[name]
                break

        risk = Risk(
            user_id=user_id,
            mission_id=mission.id if mission else None,
            commitment_id=commitment_id,
            title=title[:255],
            description=str(item.get("description") or title),
            severity=str(item.get("severity") or "MEDIUM"),
            score=float(item.get("score") or 0.5),
            evidence=item.get("evidence") or [],
            affected_commitments=affected,
            recovery_strategies=item.get("recovery_strategies") or [],
        )
        db.add(risk)
        await db.flush()
        saved_risks.append(risk)

    for item in passport_dicts:
        action_name = str(item.get("action_name") or "").strip()
        if not action_name:
            continue
        dup = (
            await db.execute(
                select(ActionPassport).where(
                    ActionPassport.user_id == user_id,
                    ActionPassport.action_name == action_name,
                    ActionPassport.status == "PENDING_APPROVAL",
                )
            )
        ).scalars().first()
        if dup:
            saved_passports.append(dup)
            continue

        passport = ActionPassport(
            user_id=user_id,
            mission_id=mission.id if mission else None,
            commitment_id=commitments[0].id if commitments else None,
            action_name=action_name[:255],
            why=str(item.get("why") or "Prepared from intent pipeline."),
            evidence=item.get("evidence") or [],
            expected_impact=str(item.get("expected_impact") or "Mitigates identified risk."),
            risk_level=str(item.get("risk_level") or "MEDIUM"),
            is_reversible=bool(item.get("is_reversible", True)),
            approval_required=bool(item.get("approval_required", True)),
            status=str(item.get("status") or "PENDING_APPROVAL"),
            execution_payload=item.get("execution_payload") or {},
        )
        db.add(passport)
        await db.flush()
        saved_passports.append(passport)

    await db.commit()
    return saved_risks, saved_passports


@router.post("/parse", response_model=IntentParseResponse)
async def parse_intent(
    payload: IntentParseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Capture an objective, persist its conversation messages, and return saved records."""
    if payload.conversation_id:
        conversation_result = await db.execute(
            select(Conversation).where(
                Conversation.id == payload.conversation_id,
                Conversation.user_id == current_user.id,
            )
        )
        conversation = conversation_result.scalars().first()
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        first_line = next((line.strip() for line in payload.raw_text.splitlines() if line.strip()), "")
        conversation = Conversation(
            user_id=current_user.id,
            title=first_line[:255] or "New conversation",
        )
        db.add(conversation)
        await db.flush()

    db.add(
        Message(
            conversation_id=conversation.id,
            role="USER",
            content=payload.raw_text,
            source=payload.source,
            status="COMPLETED",
        )
    )
    conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()

    started = time.perf_counter()
    state = await orchestrator.run(user_id=current_user.id, raw_intent=payload.raw_text)
    latency_ms = (time.perf_counter() - started) * 1000.0

    # Enrich mission with planned graph so persistence can write the DAG
    mission_data = dict(state.current_mission) if state.current_mission else None
    if mission_data is not None:
        mission_data.setdefault("nodes", state.agent_results.get("nodes") or [])
        mission_data.setdefault("edges", state.agent_results.get("edges") or [])

    mission, saved = await _persist_mission_and_commitments(
        db=db,
        user_id=current_user.id,
        mission_data=mission_data,
        commitment_dicts=state.commitments,
    )

    saved_risks, saved_passports = await _persist_risks_and_passports(
        db=db,
        user_id=current_user.id,
        mission=mission,
        commitments=saved,
        risk_dicts=state.risks,
        passport_dicts=state.pending_approvals,
    )

    # Store a visible MISSION memory for the captured objective (never silent).
    if mission:
        existing_mem = (
            await db.execute(
                select(Memory).where(
                    Memory.user_id == current_user.id,
                    Memory.category == "MISSION",
                    Memory.content == f"Mission captured: {mission.title}",
                )
            )
        ).scalars().first()
        if not existing_mem:
            db.add(
                Memory(
                    user_id=current_user.id,
                    category="MISSION",
                    content=f"Mission captured: {mission.title}",
                    source="intent_parse",
                    confidence=0.95,
                    mission_id=mission.id,
                )
            )
            await db.commit()

    # Reflect persisted rows (with real ids / deadlines) in the response
    candidate_commitments = []
    for idx, c in enumerate(saved):
        candidate_commitments.append({
            "candidate_id": f"cand_{idx}",
            "action": c.action,
            "recipient": c.recipient,
            "actor": c.actor,
            "context": c.context,
            "priority": c.priority,
            "confidence": c.confidence,
            "dependencies": c.dependencies or [],
            "consequences": c.consequences,
            "evidence": c.evidence,
            "completion_condition": c.completion_condition,
            "autonomy_level": c.autonomy_level,
            "deadline": c.deadline,
            "mission_id": c.mission_id,
            "suggested_for_confirmation": c.status == "PENDING_CONFIRMATION",
        })

    model_used = next(
        (entry.get("model_used") for entry in state.run_logs if entry.get("model_used")),
        "local-deterministic",
    )

    run_events = [
        {"step": "Intent received", "chars": len(payload.raw_text)},
        {"step": "Context & commitments extracted", "commitments": len(candidate_commitments)},
        {
            "step": "Mission phrase groups saved",
            "mission": mission.title if mission else None,
        },
        {"step": "Persisted to continuity store", "mission_id": mission.id if mission else None},
        {"step": "Risks persisted", "risks": len(saved_risks)},
        {"step": "Action proposals persisted", "passports": len(saved_passports)},
        {"step": "Risk & critic pass complete"},
        {"step": "Pipeline finished"},
    ]

    try:
        await _record_agent_run(
            db=db,
            user_id=current_user.id,
            task_description=f"Parse intent ({len(payload.raw_text)} characters)",
            status="COMPLETED",
            latency_ms=latency_ms,
            events=run_events,
            output_payload={
                "commitments": len(candidate_commitments),
                "mission": mission.title if mission else None,
                "mission_id": mission.id if mission else None,
                "risks": len(saved_risks),
                "passports": len(saved_passports),
            },
            model_used=model_used,
        )
    except Exception:
        # Telemetry must not break intent parsing.
        pass

    try:
        await event_bus.publish("commitment.created", {
            "user_id": current_user.id,
            "count": len(candidate_commitments),
            "mission_id": mission.id if mission else None,
        })
        if mission:
            await event_bus.publish("mission.updated", {
                "id": mission.id,
                "title": mission.title,
                "user_id": current_user.id,
            })
            await event_bus.publish("memory.created", {
                "mission_id": mission.id,
                "user_id": current_user.id,
            })
        for passport in saved_passports:
            await event_bus.publish("approval.requested", {
                "passport_id": passport.id,
                "action": passport.action_name,
                "user_id": current_user.id,
            })
    except Exception:
        pass

    mission_title = mission.title if mission else "your objective"
    summary = (
        f"CONVIA captured your intent. It saved {len(candidate_commitments)} commitment(s) "
        f"and created a mission record for '{mission_title}'. Planned dependencies were not inferred."
    )
    if saved_risks:
        summary += f" {len(saved_risks)} risk signal(s) are now tracked with recovery options."
    if saved_passports:
        summary += f" {len(saved_passports)} action passport(s) await your approval."

    extracted_mission = None
    if mission:
        extracted_mission = {
            "title": mission.title,
            "description": mission.description,
            "desired_outcome": mission.desired_outcome,
            "priority": mission.priority,
            "budget_limit": mission.budget_limit,
            "budget_currency": mission.budget_currency,
            "constraints": mission.constraints or {},
            "id": mission.id,
        }

    signals = []
    budget = None
    if mission and (mission.constraints or {}).get("budget_limit") is not None:
        budget = (mission.constraints or {}).get("budget_limit")
    elif state.user_context.get("constraints", {}).get("budget_limit") is not None:
        budget = state.user_context.get("constraints", {}).get("budget_limit")
    if budget is not None:
        signals.append(f"Budget ceiling identified: ₹{budget}")
    if any("tonight" in (c.action or "").lower() for c in saved):
        signals.append("Immediate delivery deadline tonight detected")
    else:
        signals.append("Commitments captured for your review; missing details are left unfilled")
    if saved_risks:
        signals.append(f"{len(saved_risks)} risk signal(s) with recovery strategies ready")
    if saved_passports:
        signals.append(f"{len(saved_passports)} action passport(s) pending your approval")

    if conversation.title == "New conversation":
        first_line = next((line.strip() for line in payload.raw_text.splitlines() if line.strip()), "")
        conversation.title = first_line[:255] or "New conversation"
    conversation.updated_at = datetime.now(timezone.utc)
    db.add(
        Message(
            conversation_id=conversation.id,
            role="ASSISTANT",
            content=summary,
            source="intent_capture",
            status="COMPLETED",
            metadata_json={
                "model_used": model_used,
                "mission_id": mission.id if mission else None,
                "commitment_count": len(candidate_commitments),
                "risk_count": len(saved_risks),
            },
        )
    )
    await db.commit()

    return IntentParseResponse(
        conversation_id=conversation.id,
        recognized_intent="MISSION_AND_COMMITMENT_EXTRACTION",
        extracted_mission=extracted_mission, # type: ignore
        commitments=candidate_commitments, # type: ignore
        signals_detected=signals,
        summary_message=summary,
        confidence=None,
        model_used=model_used
    )


@router.get("/blind-spots", response_model=BlindSpotsResponse)
async def get_blind_spots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Signature Feature: Scans for hidden risks, waiting people, and expiring windows."""
    result = await db.execute(select(Commitment).where(Commitment.user_id == current_user.id))
    commitments = list(result.scalars().all())
    return BlindSpotsEngine.scan_blind_spots(commitments)


@router.get("/resolve-day", response_model=ResolveDayResponse)
async def resolve_day(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Signature Feature: Generates an actionable chronological plan protecting critical commitments."""
    result = await db.execute(select(Commitment).where(Commitment.user_id == current_user.id))
    commitments = list(result.scalars().all())
    return ResolveDayEngine.generate_plan(commitments)

