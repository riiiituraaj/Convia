import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from lifeos.core.database import get_db
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.models.mission import Mission, MissionNode, MissionEdge
from lifeos.models.commitment import Commitment, CommitmentEvent
from lifeos.models.risk import Risk
from lifeos.models.action import ActionPassport
from lifeos.models.agent import AgentRun
from lifeos.core.event_bus import event_bus

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed")
async def seed_flagship_demo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Initializes the deterministic flagship demo: 'Move to Bangalore'."""
    # 1. Clear existing user data for a clean demonstration
    await db.execute(delete(ActionPassport).where(ActionPassport.user_id == current_user.id))
    await db.execute(delete(Risk).where(Risk.user_id == current_user.id))
    await db.execute(delete(CommitmentEvent).where(CommitmentEvent.commitment_id.in_(
        select(Commitment.id).where(Commitment.user_id == current_user.id)
    )))
    await db.execute(delete(Commitment).where(Commitment.user_id == current_user.id))
    await db.execute(delete(MissionEdge).where(MissionEdge.mission_id.in_(
        select(Mission.id).where(Mission.user_id == current_user.id)
    )))
    await db.execute(delete(MissionNode).where(MissionNode.mission_id.in_(
        select(Mission.id).where(Mission.user_id == current_user.id)
    )))
    await db.execute(delete(Mission).where(Mission.user_id == current_user.id))
    await db.execute(delete(AgentRun).where(AgentRun.user_id == current_user.id))
    await db.commit()

    now = datetime.now(timezone.utc)

    # 2. Create Mission
    mission = Mission(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        title="Move to Bangalore & Start Internship",
        description="Relocate smoothly to Bangalore under ₹80,000 budget and start internship without missing any commitments.",
        desired_outcome="Settle into HSR Layout coliving, arrive on schedule, and fulfill immediate API delivery commitment.",
        status="ACTIVE",
        priority="HIGH",
        progress=45.0,
        target_date=now + timedelta(days=21),
        budget_limit=80000.0,
        budget_currency="INR",
        constraints={
            "budget_limit": 80000.0,
            "days_remaining": 21,
            "office_location": "HSR Layout Sector 2, Bangalore"
        }
    )
    db.add(mission)
    await db.flush()

    # 3. Create Mission Nodes (DAG) — unique IDs so re-seed never collides
    node_api = MissionNode(
        id=str(uuid.uuid4()),
        mission_id=mission.id,
        title="API Implementation Delivery",
        node_type="TASK",
        status="IN_PROGRESS",
        progress=70.0,
        position_x=320,
        position_y=20,
        metadata_json={"deadline": "Tonight 23:59", "assignee": "User", "recipient": "Engineering Team"}
    )
    node_housing = MissionNode(
        id=str(uuid.uuid4()),
        mission_id=mission.id,
        title="Housing & Coliving (HSR)",
        node_type="OBJECTIVE",
        status="IN_PROGRESS",
        progress=35.0,
        position_x=120,
        position_y=160,
        metadata_json={"target_rent": "₹14,000/mo", "deposit": "₹28,000"}
    )
    node_travel = MissionNode(
        id=str(uuid.uuid4()),
        mission_id=mission.id,
        title="Travel & Transit to BLR",
        node_type="OBJECTIVE",
        status="IN_PROGRESS",
        progress=20.0,
        position_x=520,
        position_y=160,
        metadata_json={"mode": "Flight", "target_price": "₹8,000"}
    )
    node_docs = MissionNode(
        id=str(uuid.uuid4()),
        mission_id=mission.id,
        title="Internship Documents & NDA",
        node_type="OBJECTIVE",
        status="COMPLETED",
        progress=100.0,
        position_x=800,
        position_y=160,
        metadata_json={"status": "HR Approved"}
    )
    node_move = MissionNode(
        id=str(uuid.uuid4()),
        mission_id=mission.id,
        title="Relocation & Check-in",
        node_type="MILESTONE",
        status="PENDING",
        progress=0.0,
        position_x=320,
        position_y=300,
        metadata_json={"target_day": "Day 19"}
    )
    node_start = MissionNode(
        id=str(uuid.uuid4()),
        mission_id=mission.id,
        title="Start Internship Day 1",
        node_type="MILESTONE",
        status="PENDING",
        progress=0.0,
        position_x=450,
        position_y=440,
        metadata_json={"start_date": "Day 21"}
    )

    nodes = [node_api, node_housing, node_travel, node_docs, node_move, node_start]
    for n in nodes:
        db.add(n)

    # 4. Create Edges (reference the generated node IDs)
    edges = [
        MissionEdge(mission_id=mission.id, source_node_id=node_housing.id, target_node_id=node_move.id, relationship_type="BLOCKS"),
        MissionEdge(mission_id=mission.id, source_node_id=node_travel.id, target_node_id=node_move.id, relationship_type="BLOCKS"),
        MissionEdge(mission_id=mission.id, source_node_id=node_move.id, target_node_id=node_start.id, relationship_type="FEEDS_INTO"),
        MissionEdge(mission_id=mission.id, source_node_id=node_docs.id, target_node_id=node_start.id, relationship_type="RELIES_ON"),
    ]
    for e in edges:
        db.add(e)

    # 5. Create Commitments
    c_api = Commitment(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mission_id=mission.id,
        action="Finish and deliver Phoenix API endpoints tonight",
        recipient="Rahul & Engineering Team",
        actor="user",
        context="Phoenix Project / Team Obligation",
        priority="HIGH",
        status="IN_PROGRESS",
        confidence=0.98,
        risk_score=0.45,
        risk_level="MEDIUM",
        deadline=now + timedelta(hours=6),
        consequences="Team frontend engineers are blocked tomorrow morning without API specs",
        evidence="Promised team I would finish the API tonight",
        autonomy_level=2,
        completion_condition="PR merged and endpoints responding with 200 OK"
    )
    c_travel = Commitment(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mission_id=mission.id,
        action="Book travel ticket to Kempegowda Airport (BLR)",
        recipient="Self",
        actor="user",
        context="Move to Bangalore",
        priority="HIGH",
        status="AT_RISK",
        confidence=0.96,
        risk_score=0.82,
        risk_level="HIGH",
        deadline=now + timedelta(days=4),
        consequences="Airfare surges dramatically within 14 days of departure, breaching budget",
        evidence="Need travel booked under ₹80,000 budget",
        autonomy_level=3,
        completion_condition="PNR issued with confirmed seat"
    )
    c_housing = Commitment(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mission_id=mission.id,
        action="Secure verified coliving space in HSR Layout",
        recipient="Self / Provider",
        actor="user",
        context="Move to Bangalore",
        priority="HIGH",
        status="IN_PROGRESS",
        confidence=0.95,
        risk_score=0.35,
        risk_level="MEDIUM",
        deadline=now + timedelta(days=12),
        consequences="No accommodation on arrival in Bangalore",
        evidence="Need housing under ₹80,000 total budget",
        autonomy_level=2,
        completion_condition="Deposit paid and agreement signed"
    )
    c_docs = Commitment(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mission_id=mission.id,
        action="Submit verified identity and college NDA documentation",
        recipient="HR Department",
        actor="user",
        context="Move to Bangalore",
        priority="MEDIUM",
        status="CLOSED",
        confidence=1.0,
        risk_score=0.0,
        risk_level="LOW",
        deadline=now - timedelta(days=1),
        completed_at=now - timedelta(hours=3),
        consequences="None - already closed",
        evidence="Internship docs submission acknowledged by HR",
        autonomy_level=1,
        completion_condition="Signed acknowledgment from HR"
    )

    commitments = [c_api, c_travel, c_housing, c_docs]
    for c in commitments:
        db.add(c)
        evt = CommitmentEvent(
            commitment_id=c.id,
            from_status="DETECTED",
            to_status=c.status,
            reason="Flagship demo initialization"
        )
        db.add(evt)

    # 6. Flagship Demo Risk Event (Flight Fare Surge)
    demo_risk = Risk(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mission_id=mission.id,
        commitment_id=c_travel.id,
        title="Flight Cost Surged to ₹12,500 (Budget Ceiling Risk)",
        description="Ticket price to Kempegowda Airport jumped by +₹4,500. This compresses the available reserve for HSR housing deposit from ₹30,000 down to ₹25,500, risking a budget overrun.",
        severity="HIGH",
        score=0.82,
        evidence=[
            "Direct route ticket price increased from ₹8,000 to ₹12,500",
            "Available housing deposit buffer compressed to ₹67,500 against required ₹70,000",
            "Total estimated mission spend now projected at ₹84,500 (exceeds ₹80,000 cap)"
        ],
        affected_commitments=[c_travel.action, c_housing.action],
        recovery_strategies=[
            {
                "id": "rec_train",
                "title": "Option A: 1st AC Express Overnight Train (Save ₹9,300)",
                "description": "Switch to overnight 1st AC train arriving morning of Day 19. Fare ₹3,200. Restores ₹9,300 buffer to housing reserve.",
                "effort": "LOW",
                "risk": "LOW",
                "expected_outcome": "Guarantees ₹80,000 budget cap with ₹7,200 safety buffer intact.",
                "action_type": "ALTERNATIVE",
                "action_payload": {"mode": "TRAIN", "savings": 9300.0}
            },
            {
                "id": "rec_redeye",
                "title": "Option B: Book 05:45 AM Budget Flight",
                "description": "Book morning flight (6E-204) at ₹8,400. Kept within ₹400 of original target.",
                "effort": "MEDIUM",
                "risk": "LOW",
                "expected_outcome": "Travels by air while keeping total expenditure under ₹78,400.",
                "action_type": "ALTERNATIVE",
                "action_payload": {"mode": "FLIGHT_REDEYE", "fare": 8400.0}
            }
        ]
    )
    db.add(demo_risk)

    # 7. Action Passport awaiting user approval
    action_passport = ActionPassport(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mission_id=mission.id,
        commitment_id=c_travel.id,
        action_name="Book 05:45 AM Flight (6E-204) & Protect Housing Reserve",
        why="Mitigate travel cost surge and enforce the strict ₹80,000 budget limit.",
        evidence=[
            "Morning flight 6E-204 available at ₹8,400",
            "Preserves ₹71,600 for HSR coliving deposit and initial living expenses",
            "Protects arrival schedule 2 days before internship begins"
        ],
        expected_impact="Eliminates the HIGH risk on travel commitment and recovers mission budget headroom.",
        risk_level="LOW",
        is_reversible=True,
        approval_required=True,
        status="PENDING_APPROVAL",
        execution_payload={
            "carrier": "IndiGo 6E-204",
            "departure": "05:45 AM",
            "fare": 8400.0,
            "currency": "INR"
        }
    )
    db.add(action_passport)

    # Flagship demo agent telemetry (same seed narrative as mission/commitments)
    demo_runs = [
        AgentRun(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            agent_type="ORCHESTRATOR",
            task_description="Orchestrating Bangalore relocation and team delivery",
            status="COMPLETED",
            model_used="nvidia/nemotron-4-340b-instruct",
            latency_ms=142.0,
            events=[{"step": "Context mapped"}, {"step": "DAG constructed"}],
            output_payload={"mission_id": mission.id},
            completed_at=now,
        ),
        AgentRun(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            agent_type="RESEARCH",
            task_description="Querying Tavily for verified Bangalore coliving and flights",
            status="COMPLETED",
            model_used="tavily_search + nemotron-mini-4b",
            latency_ms=310.0,
            events=[{"step": "Tavily queried"}, {"step": "Evidence validated"}],
            output_payload={"sources": 3},
            completed_at=now,
        ),
        AgentRun(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            agent_type="RISK",
            task_description="Calculating budget headroom & schedule collisions",
            status="COMPLETED",
            model_used="nvidia/nemotron-4-340b-instruct",
            latency_ms=89.0,
            events=[{"step": "Surge detected"}, {"step": "Recovery options prepared"}],
            output_payload={"risk_id": demo_risk.id},
            completed_at=now,
        ),
        AgentRun(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            agent_type="VERIFICATION",
            task_description="Validating receipt confirmation for booked transit",
            status="COMPLETED",
            model_used="nvidia/nemotron-mini-4b-instruct",
            latency_ms=45.0,
            events=[{"step": "PNR verified"}, {"step": "Budget updated"}],
            output_payload={},
            completed_at=now,
        ),
    ]
    for r in demo_runs:
        db.add(r)

    await db.commit()

    # Emit real-time updates
    await event_bus.publish("mission.updated", {"id": mission.id, "title": mission.title, "user_id": current_user.id})
    await event_bus.publish("risk.created", {"id": demo_risk.id, "title": demo_risk.title, "severity": "HIGH", "user_id": current_user.id})
    await event_bus.publish("approval.requested", {"passport_id": action_passport.id, "action": action_passport.action_name, "user_id": current_user.id})

    return {
        "status": "SUCCESS",
        "message": "Flagship demo scenario 'Move to Bangalore' successfully seeded with real database state.",
        "mission_id": mission.id,
        "passport_id": action_passport.id
    }

