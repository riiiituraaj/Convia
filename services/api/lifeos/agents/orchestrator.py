import logging
from typing import Dict, Any, List
from lifeos.agents.state import AgentState
from lifeos.agents.context_agent import ContextAgent, CommitmentAgent
from lifeos.agents.planning_agent import PlanningAgent, ResearchAgent
from lifeos.agents.risk_agent import RiskAgent, CriticAgent
from lifeos.agents.execution_agent import ExecutionAgent, VerificationAgent
from lifeos.core.event_bus import event_bus

logger = logging.getLogger("lifeos.agents.orchestrator")


class Orchestrator:
    def __init__(self):
        self.context_agent = ContextAgent()
        self.commitment_agent = CommitmentAgent()
        self.planning_agent = PlanningAgent()
        self.research_agent = ResearchAgent()
        self.risk_agent = RiskAgent()
        self.critic_agent = CriticAgent()
        self.execution_agent = ExecutionAgent()
        self.verification_agent = VerificationAgent()

    async def run(self, user_id: str, raw_intent: str) -> AgentState:
        """Executes the full CONVIA continuity loop through multi-agent orchestration."""
        state = AgentState(user_id=user_id, raw_intent=raw_intent)

        pipeline = [
            (self.context_agent, "Extracting context, entities & constraints"),
            (self.commitment_agent, "Extracting commitments & obligations"),
            (self.planning_agent, "Grouping the objective into mission phrases"),
            (self.research_agent, "Checking whether current external research is needed"),
            (self.risk_agent, "Evaluating schedule collisions & budget risk"),
            (self.critic_agent, "Critiquing plan assumptions and vulnerabilities"),
            (self.execution_agent, "Checking for a supported external action handler"),
        ]

        for agent, desc in pipeline:
            agent_name = agent.name
            await event_bus.publish("agent.started", {
                "agent": agent_name,
                "description": desc,
                "user_id": user_id
            })

            try:
                state = await agent.execute(state)
                agent_log = next(
                    (entry for entry in reversed(state.run_logs) if entry.get("agent") == agent_name),
                    {},
                )
                await event_bus.publish("agent.completed", {
                    "agent": agent_name,
                    "description": desc,
                    "status": agent_log.get("status", "COMPLETED"),
                    "user_id": user_id
                })
            except Exception as e:
                logger.warning("Agent %s failed (%s)", agent_name, type(e).__name__)
                await event_bus.publish("agent.completed", {
                    "agent": agent_name,
                    "status": "FAILED",
                    "error": "Agent execution failed",
                    "user_id": user_id
                })

        return state


orchestrator = Orchestrator()

