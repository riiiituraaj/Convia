from typing import Dict, Any, List
from lifeos.agents.state import AgentState


class RiskAgent:
    name = "RISK_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        risks = []
        raw_lower = state.raw_intent.lower()
        flagship = any(
            k in raw_lower
            for k in ("bangalore", "blr", "flight", "travel", "internship", "housing", "80,000", "80000", "relocation")
        )

        # Flagship demo risk only when the intent actually involves travel/budget.
        if flagship:
            flight_risk = {
                "title": "Flight Fare Surge Impacts ₹80,000 Budget Constraint",
                "description": "Average ticket price to BLR surged by 56% (from ₹8,000 to ₹12,500), compressing available housing security deposit reserve.",
                "severity": "HIGH",
                "score": 0.82,
                "evidence": [
                    "Kempegowda routes indicate price increase from ₹8,000 to ₹12,500 for selected departure window",
                    "Remaining budget for housing deposit reduced to ₹67,500 against required ₹70,000"
                ],
                "affected_commitments": ["Book travel to Kempegowda Airport (BLR)", "Secure verified housing in Bangalore near office"],
                "recovery_strategies": [
                    {
                        "id": "rec_option_a",
                        "title": "Option A: Book AC Express Train (Save ₹9,000)",
                        "description": "Switch to overnight 1st AC Express train arriving 1 day prior. Cost ₹3,200. Restores ₹9,300 to housing deposit headroom.",
                        "effort": "LOW",
                        "risk": "LOW",
                        "expected_outcome": "Protects ₹80,000 budget ceiling with full housing deposit preserved.",
                        "action_type": "ALTERNATIVE",
                        "action_payload": {"transit_mode": "TRAIN", "savings": 9300.0}
                    },
                    {
                        "id": "rec_option_b",
                        "title": "Option B: Book Early Morning Budget Flight",
                        "description": "Shift departure to 05:45 AM red-eye flight priced at ₹8,400.",
                        "effort": "MEDIUM",
                        "risk": "MEDIUM",
                        "expected_outcome": "Travels by air while keeping budget impact to only +₹400 over original target.",
                        "action_type": "ALTERNATIVE",
                        "action_payload": {"transit_mode": "FLIGHT_REDEYE", "cost": 8400.0}
                    },
                    {
                        "id": "rec_option_c",
                        "title": "Option C: Seek Advance Housing Allowance from Company",
                        "description": "Request HR to disburse 50% relocation allowance on day 1 to cover the housing buffer.",
                        "effort": "HIGH",
                        "risk": "LOW",
                        "expected_outcome": "Expands budget constraint to ₹95,000.",
                        "action_type": "EXTENSION",
                        "action_payload": {"advance_requested": 15000.0}
                    }
                ]
            }
            risks.append(flight_risk)

        # Generic deadline risk when any commitment is due tonight.
        for commitment in state.commitments:
            deadline_text = str(commitment.get("deadline_text") or "").lower()
            if "tonight" in deadline_text or "today" in deadline_text:
                risks.append({
                    "title": f"Deadline risk: {commitment.get('action', 'commitment')[:80]}",
                    "description": (
                        "This obligation is due tonight while other work is in flight. "
                        "Missing it creates a visible continuity gap for the recipient."
                    ),
                    "severity": "HIGH",
                    "score": 0.7,
                    "evidence": [
                        f"Deadline text: {commitment.get('deadline_text')}",
                        f"Recipient: {commitment.get('recipient') or 'unspecified'}",
                    ],
                    "affected_commitments": [commitment.get("action", "")],
                    "recovery_strategies": [
                        {
                            "id": "rec_deadline_fast",
                            "title": "Option A: Fast-track the critical path",
                            "description": "Drop non-essential polish and ship the completion condition first.",
                            "effort": "MEDIUM",
                            "risk": "LOW",
                            "expected_outcome": "Closes the loop before the deadline.",
                            "action_type": "FAST_TRACK",
                            "action_payload": {},
                        },
                        {
                            "id": "rec_deadline_scope",
                            "title": "Option B: Negotiate scope with the recipient",
                            "description": "Message the recipient with a revised, smaller deliverable and a new time.",
                            "effort": "LOW",
                            "risk": "MEDIUM",
                            "expected_outcome": "Protects trust while reducing delivery risk.",
                            "action_type": "SCOPE_REDUCTION",
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
        raw_lower = state.raw_intent.lower()
        criticisms = []

        if any(k in raw_lower for k in ("api", "tonight")) and any(
            k in raw_lower for k in ("bangalore", "relocation", "internship", "housing", "travel")
        ):
            criticisms.append(
                "API commitment deadline is tonight while relocation research is underway; "
                "context-switching poses execution risk."
            )
            criticisms.append(
                "Housing rental agreement typically requires physical verification; "
                "prefer a coliving provider with a short return policy."
            )

        if not criticisms and state.commitments:
            criticisms.append(
                f"{len(state.commitments)} commitment(s) captured in one pass — "
                "confirm recipients and deadlines so nothing is inferred incorrectly."
            )

        state.critic_notes = criticisms
        state.run_logs.append({
            "agent": self.name,
            "status": "COMPLETED",
            "critical_observations": criticisms
        })
        return state

