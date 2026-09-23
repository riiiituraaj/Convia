from datetime import datetime, timezone
from typing import List, Optional
from lifeos.models.commitment import Commitment, CommitmentEvent
from lifeos.core.event_bus import event_bus


class CommitmentEngine:
    VALID_STATUSES = [
        "DETECTED", "PENDING_CONFIRMATION", "CONFIRMED",
        "PLANNED", "IN_PROGRESS", "AT_RISK", "RECOVERY",
        "COMPLETED", "VERIFIED", "CLOSED"
    ]

    @classmethod
    async def transition_status(
        cls,
        commitment: Commitment,
        to_status: str,
        reason: str = "Status transition",
        db_session = None
    ) -> CommitmentEvent:
        if to_status not in cls.VALID_STATUSES:
            raise ValueError(f"Invalid status: {to_status}")

        from_status = commitment.status
        commitment.status = to_status
        commitment.updated_at = datetime.now(timezone.utc)

        if to_status in ("COMPLETED", "VERIFIED", "CLOSED") and not commitment.completed_at:
            commitment.completed_at = datetime.now(timezone.utc)

        event = CommitmentEvent(
            commitment_id=commitment.id,
            from_status=from_status,
            to_status=to_status,
            reason=reason
        )

        if db_session:
            db_session.add(event)

        # Emit real-time state change
        await event_bus.publish("commitment.updated", {
            "id": commitment.id,
            "action": commitment.action,
            "from_status": from_status,
            "to_status": to_status,
            "reason": reason,
            "user_id": commitment.user_id
        })

        return event


class RiskEngine:
    @staticmethod
    def calculate_score(
        time_remaining_hours: Optional[float],
        progress: float,
        unresolved_dependencies_count: int,
        budget_headroom_ratio: float = 1.0,
        consequence_severity: str = "MEDIUM"
    ) -> tuple[float, str]:
        """Calculates deterministic risk score between 0.0 and 1.0 and assigns severity."""
        score = 0.0

        # Time urgency factor
        if time_remaining_hours is not None:
            if time_remaining_hours <= 12 and progress < 80.0:
                score += 0.40
            elif time_remaining_hours <= 24 and progress < 50.0:
                score += 0.25
            elif time_remaining_hours <= 72 and progress < 25.0:
                score += 0.15

        # Dependency blocking factor
        if unresolved_dependencies_count > 0:
            score += min(0.35, unresolved_dependencies_count * 0.15)

        # Budget headroom penalty
        if budget_headroom_ratio < 0.2:
            score += 0.30
        elif budget_headroom_ratio < 0.5:
            score += 0.15

        # Severity multiplier
        severity_mult = {"LOW": 0.8, "MEDIUM": 1.0, "HIGH": 1.2, "CRITICAL": 1.4}.get(consequence_severity, 1.0)
        score = min(1.0, round(score * severity_mult, 2))

        # Severity band
        if score >= 0.75:
            level = "CRITICAL"
        elif score >= 0.50:
            level = "HIGH"
        elif score >= 0.25:
            level = "MEDIUM"
        else:
            level = "LOW"

        return score, level

