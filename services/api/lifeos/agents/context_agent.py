import re
from typing import Dict, Any
from lifeos.agents.state import AgentState
from lifeos.ai.provider import nemotron_provider
from lifeos.ai.router import TaskComplexity


class ContextAgent:
    name = "CONTEXT_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        prompt = (
            f"Extract entities, people, deadlines, constraints, and relationships from this user input:\n"
            f"\"{state.raw_intent}\""
        )
        system_prompt = (
            "You are the CONVIA Context Agent. Extract people (recipients/stakeholders), dates, budget numbers, "
            "locations, and project names."
        )
        schema = {
            "people": ["Rahul", "Team"],
            "locations": ["Bangalore"],
            "constraints": {"budget_limit": 80000, "days_remaining": 21, "currency": "INR"},
            "projects": ["Internship", "API delivery"],
            "deadlines": ["tonight", "in 21 days"]
        }

        result = await nemotron_provider.structured_output(
            prompt=prompt,
            system_prompt=system_prompt,
            schema=schema,
            complexity=TaskComplexity.SIMPLE
        )

        extracted = result.get("data", {})

        state.user_context.update(extracted)
        state.run_logs.append({
            "agent": self.name,
            "status": "COMPLETED",
            "extracted": extracted,
            "latency_ms": result.get("latency_ms"),
            "model_used": result.get("model_used", "local-deterministic"),
            "provider_error": result.get("error"),
        })
        return state


class CommitmentAgent:
    name = "COMMITMENT_AGENT"

    _OBLIGATION_MARKERS = (
        "i promised", "i commit to", "i committed to", "i owe", "i will", "i'll",
        "i need to", "i have to", "i must", "my deadline is",
    )

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        commitments: list[dict[str, Any]] = []
        raw = state.raw_intent.strip()
        raw_lower = raw.lower()
        if any(marker in raw_lower for marker in self._OBLIGATION_MARKERS):
            deadline_text = None
            deadline_match = re.search(
                r"\b(?:by|before|due)\s+(tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b",
                raw_lower,
            )
            if deadline_match:
                deadline_text = deadline_match.group(1)
            commitments.append({
                "action": raw[:2000],
                "recipient": None,
                "actor": "user",
                "context": "User-stated obligation; confirm details",
                "priority": "MEDIUM",
                "status": "PENDING_CONFIRMATION",
                "deadline_text": deadline_text,
                "consequences": None,
                "evidence": raw,
                "autonomy_level": 2,
                "completion_condition": None,
            })

        state.commitments = commitments
        state.run_logs.append({
            "agent": self.name,
            "status": "COMPLETED" if commitments else "NO_COMMITMENT_DETECTED",
            "commitments_created": len(commitments)
        })
        return state

