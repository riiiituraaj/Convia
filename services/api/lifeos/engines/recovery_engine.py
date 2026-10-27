import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from lifeos.models.commitment import Commitment
from lifeos.models.risk import Risk
from lifeos.schemas.risk import RecoveryOption
from lifeos.core.event_bus import event_bus


class RecoveryEngine:
    @staticmethod
    def generate_strategies(commitment_title: str, reason: str, context: str = "") -> List[RecoveryOption]:
        """Suggest review steps without claiming to schedule or contact anyone."""
        options = [
            RecoveryOption(
                id=f"opt_{uuid.uuid4().hex[:6]}",
                title="Review the next focused work block",
                description="Choose a time for focused work and decide which lower-priority work can wait.",
                effort="MEDIUM",
                risk="LOW",
                expected_outcome="A user-chosen next step for this commitment.",
                affected_commitments=[commitment_title],
                action_type="FAST_TRACK",
                action_payload={"time_block_minutes": 90}
            ),
            RecoveryOption(
                id=f"opt_{uuid.uuid4().hex[:6]}",
                title="Consider a smaller milestone",
                description="Decide whether a reduced deliverable would still meet the recipient's needs.",
                effort="LOW",
                risk="MEDIUM",
                expected_outcome="A clearer scope to discuss with the recipient.",
                affected_commitments=[commitment_title],
                action_type="SCOPE_REDUCTION",
                action_payload={}
            ),
            RecoveryOption(
                id=f"opt_{uuid.uuid4().hex[:6]}",
                title="Review whether the due date needs to change",
                description="If needed, prepare a revised date to discuss. CONVIA cannot send a message.",
                effort="LOW",
                risk="LOW",
                expected_outcome="A proposed timeline for the user to confirm.",
                affected_commitments=[commitment_title],
                action_type="EXTENSION",
                action_payload={}
            )
        ]
        return options


class ContinuityEngine:
    """Publish explicitly supplied, user-scoped change events."""

    @staticmethod
    async def process_external_change(change_type: str, details: Dict[str, Any], user_id: str):
        if change_type == "OBSERVED_CHANGE" and details.get("summary"):
            await event_bus.publish("external.change_observed", {
                "user_id": user_id,
                "details": details
            })


class BlindSpotsEngine:
    @staticmethod
    def scan_blind_spots(commitments: List[Commitment]) -> Dict[str, Any]:
        """Detects implicit risks, waiting stakeholders, and unaddressed dependencies."""
        unresolved_deps = []
        waiting_on_user = []
        expiring_windows = []
        schedule_conflicts = []

        for c in commitments:
            if c.status == "PENDING_CONFIRMATION":
                waiting_on_user.append({
                    "commitment_id": c.id,
                    "action": c.action,
                    "recipient": c.recipient,
                    "status": c.status,
                    "reason": "Review and confirm the captured commitment details.",
                })

            if c.risk_level in ("HIGH", "CRITICAL"):
                unresolved_deps.append({
                    "commitment_id": c.id,
                    "action": c.action,
                    "risk_level": c.risk_level,
                    "consequences": c.consequences or "Potential bottleneck"
                })

            if c.deadline and c.status not in ("COMPLETED", "VERIFIED", "CLOSED"):
                deadline = c.deadline
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=timezone.utc)
                remaining = deadline - datetime.now(timezone.utc)
                if timedelta(0) <= remaining <= timedelta(hours=48):
                    hours = max(1, int(remaining.total_seconds() // 3600))
                    expiring_windows.append({
                        "commitment_id": c.id,
                        "title": c.action,
                        "time_left": f"{hours} hour(s)",
                        "warning": "A user-supplied deadline is within the next 48 hours.",
                    })

        insights = []
        if waiting_on_user:
            insights.append(f"{len(waiting_on_user)} captured commitment(s) need confirmation.")
        if unresolved_deps:
            insights.append(f"{len(unresolved_deps)} saved commitment(s) are marked high risk.")
        if expiring_windows:
            insights.append(f"{len(expiring_windows)} user-supplied deadline(s) are within 48 hours.")
        if not insights:
            insights.append("No current blind spots were found in saved commitment data.")

        return {
            "total_found": len(unresolved_deps) + len(waiting_on_user) + len(expiring_windows),
            "unresolved_dependencies": unresolved_deps,
            "waiting_on_user": waiting_on_user,
            "expiring_windows": expiring_windows,
            "schedule_conflicts": schedule_conflicts,
            "insights": insights
        }


class ResolveDayEngine:
    @staticmethod
    def generate_plan(commitments: List[Commitment]) -> Dict[str, Any]:
        """List today's stored deadlines without inventing calendar blocks."""
        now = datetime.now(timezone.utc)
        active = []
        for commitment in commitments:
            if commitment.status in ("COMPLETED", "VERIFIED", "CLOSED") or not commitment.deadline:
                continue
            deadline = commitment.deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if deadline.date() == now.date():
                active.append(commitment)
        active.sort(
            key=lambda item: (
                item.deadline.replace(tzinfo=timezone.utc).timestamp()
                if item.deadline.tzinfo is None else item.deadline.timestamp(),
                item.priority,
                item.created_at.replace(tzinfo=timezone.utc).timestamp()
                if item.created_at.tzinfo is None else item.created_at.timestamp(),
            )
        )
        schedule = [
            {
                "time_slot": "Unscheduled",
                "commitment_id": item.id,
                "title": item.action,
                "priority": item.priority,
                "why": "This commitment has a stored deadline today; no calendar block is connected.",
                "estimated_minutes": 0,
                "action_type": "REVIEW",
            }
            for item in active
        ]

        return {
            "plan_date": now.date().isoformat(),
            "total_hours_required": 0.0,
            "critical_commitments_protected": 0,
            "schedule": schedule,
            "tradeoffs_made": [],
            "continuity_status": (
                "UNSCHEDULED - Calendar integration is unavailable; listed items are user-supplied deadlines only."
                if schedule else "NO DUE ITEMS - No active commitments with deadlines today."
            ),
        }

