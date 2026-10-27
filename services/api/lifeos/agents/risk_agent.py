from typing import Dict, Any, List
from lifeos.agents.state import AgentState


class RiskAgent:
    name = "RISK_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        risks = []
        raw_lower = state.raw_intent.lower()
        # Only derive a timing risk from a user-confirmable deadline phrase.
        for commitment in state.commitments:
            deadline_text = str(commitment.get("deadline_text") or "").lower()
            if deadline_text:
                action = commitment.get("action", "the stated obligation")
                risks.append({
                    "title": f"Review deadline: {action[:80]}",
                    "description": (
                        f"The user mentioned a deadline ({deadline_text}). The date and recipient have not been confirmed."
                    ),
                    "severity": "MEDIUM",
                    "score": 0.45,
                    "evidence": [
                        f"Deadline phrase supplied by the user: {deadline_text}",
                    ],
                    "affected_commitments": [action],
                    "recovery_strategies": [
                        {
                            "id": "rec_deadline_fast",
                            "title": "Confirm the due date and next milestone",
                            "description": "Review the commitment details and decide what should happen next.",
                            "effort": "MEDIUM",
                            "risk": "MEDIUM",
                            "expected_outcome": "A confirmed deadline and a next step.",
                            "action_type": "REVIEW",
                            "action_payload": {},
                        },
                    ],
                })

        state.risks = risks
        state.run_logs.append({
            "agent": self.name,
            "status": "COMPLETED",
            "risks_identified": len(risks),
            "highest_severity": "HIGH" if risks else "NONE"
        })
        return state


class CriticAgent:
    name = "CRITIC_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        criticisms = []
        if state.current_mission:
            criticisms.append("Planning used phrase grouping only; task dependencies and durations were not inferred.")
        if state.commitments:
            missing_details = sum(
                1 for item in state.commitments if not item.get("recipient") or not item.get("deadline_text")
            )
            if missing_details:
                criticisms.append(
                    f"{missing_details} captured commitment(s) have a missing recipient or deadline and need review."
                )

        state.critic_notes = criticisms
        state.run_logs.append({
            "agent": self.name,
            "status": "COMPLETED",
            "critical_observations": criticisms
        })
        return state

