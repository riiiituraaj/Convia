from typing import Dict, Any
from lifeos.agents.state import AgentState


class ExecutionAgent:
    name = "EXECUTION_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        # No external action handlers are registered yet. Preserve the proposal
        # as a recovery strategy, but never manufacture an executable action.
        state.run_logs.append({
            "agent": self.name,
            "status": "SKIPPED",
            "reason": "No external action handler is connected",
        })
        return state


class VerificationAgent:
    name = "VERIFICATION_AGENT"

    async def verify_action(self, action_passport: Dict[str, Any]) -> Dict[str, Any]:
        """Report an honest unverified result until a real verifier is connected."""
        verification = {
            "passport_id": action_passport.get("id"),
            "action_name": action_passport.get("action_name"),
            "status": "NOT_VERIFIED",
            "checks": [],
            "conclusion": "No connected action handler or verification source is available.",
        }
        return verification

