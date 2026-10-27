import re
from typing import Dict, Any, List
from lifeos.agents.state import AgentState
from lifeos.tools.tavily_research import tavily_tool


class PlanningAgent:
    name = "PLANNING_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        objective = " ".join(state.raw_intent.split())[:10000]
        title = objective[:255] or "Untitled objective"
        segments = [
            " ".join(part.split())
            for part in re.split(r"[;\n]+|\s*,\s*|\s+\band\b\s+", objective, flags=re.IGNORECASE)
            if len(part.strip()) >= 4
        ]
        if not segments:
            segments = [title]
        nodes = [
            {
                "id": f"objective_{index}",
                "title": segment[:255],
                "node_type": "OBJECTIVE" if len(segments) == 1 else "TASK",
                "status": "PENDING",
                "progress": 0.0,
                "position_x": 150 + (index % 3) * 260,
                "position_y": 140 + (index // 3) * 150,
                "metadata_json": {"source": "user_intent", "verified": False},
            }
            for index, segment in enumerate(segments[:20])
        ]
        mission = {
            "title": title,
            "description": objective,
            "desired_outcome": objective,
            "budget_limit": None,
            "budget_currency": "INR",
            "constraints": {},
            "status": "ACTIVE",
            "progress": 0.0,
        }
        edges: list[dict[str, Any]] = []

        state.current_mission = mission
        state.agent_results["nodes"] = nodes
        state.agent_results["edges"] = edges
        state.dependencies = edges

        state.run_logs.append({
            "agent": self.name,
            "status": "COMPLETED",
            "nodes_planned": len(nodes),
            "edges_connected": len(edges),
            "planning_mode": "deterministic phrase grouping; dependencies not inferred",
        })
        return state


class ResearchAgent:
    name = "RESEARCH_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        raw_lower = state.raw_intent.lower()
        research_markers = (
            "current", "latest", "research", "compare", "price", "prices", "cost", "flight",
            "housing", "coliving", "weather", "news", "documentation", "source", "web",
        )
        if not any(marker in raw_lower for marker in research_markers):
            state.agent_results["research"] = {"skipped": True, "reason": "No current external information requested", "findings": []}
            state.run_logs.append({
                "agent": self.name,
                "status": "SKIPPED",
                "reason": "No current external information requested",
            })
            return state

        query = " ".join(state.raw_intent.split())[:180]
        tool_result = await tavily_tool.execute(query=query)

        research_summary = {
            "query": query,
            "success": tool_result.success,
            "findings": tool_result.data.get("results", []),
            "evidence": tool_result.evidence
        }

        state.agent_results["research"] = research_summary
        state.run_logs.append({
            "agent": self.name,
            "status": "COMPLETED" if tool_result.success else "UNAVAILABLE",
            "findings_count": len(research_summary["findings"]),
            "evidence_snippets": len(tool_result.evidence),
            "provider": "tavily" if tool_result.success else "unavailable",
        })
        return state

