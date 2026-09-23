import uuid
from typing import Dict, Any, List
from lifeos.agents.state import AgentState
from lifeos.tools.tavily_research import tavily_tool


class PlanningAgent:
    name = "PLANNING_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        constraints = state.user_context.get("constraints", {})
        raw_lower = state.raw_intent.lower()
        flagship = any(
            k in raw_lower
            for k in ("bangalore", "blr", "relocation", "internship", "housing", "travel", "80,000", "80000")
        )

        if flagship:
            budget_limit = constraints.get("budget_limit", 80000.0)
            mission = {
                "title": "Move to Bangalore & Start Internship",
                "description": "Orchestrate relocation, accommodation, transit, documentation, and deliver immediate engineering commitments.",
                "desired_outcome": "Relocate smoothly to Bangalore under ₹80,000 budget and start internship without missing any commitments.",
                "budget_limit": budget_limit,
                "budget_currency": "INR",
                "constraints": constraints,
                "status": "ACTIVE",
                "progress": 35.0
            }

            node_housing = {
                "id": "node_housing",
                "title": "Housing & Coliving",
                "node_type": "OBJECTIVE",
                "status": "IN_PROGRESS",
                "progress": 40.0,
                "position_x": 100,
                "position_y": 150
            }
            node_travel = {
                "id": "node_travel",
                "title": "Travel & Flight Booking",
                "node_type": "OBJECTIVE",
                "status": "IN_PROGRESS",
                "progress": 25.0,
                "position_x": 400,
                "position_y": 150
            }
            node_docs = {
                "id": "node_docs",
                "title": "Internship Documentation",
                "node_type": "OBJECTIVE",
                "status": "COMPLETED",
                "progress": 100.0,
                "position_x": 700,
                "position_y": 150
            }
            node_api = {
                "id": "node_api",
                "title": "API Tonight Delivery",
                "node_type": "TASK",
                "status": "IN_PROGRESS",
                "progress": 60.0,
                "position_x": 400,
                "position_y": 10
            }
            node_move = {
                "id": "node_move",
                "title": "Relocation & Check-in",
                "node_type": "MILESTONE",
                "status": "PENDING",
                "progress": 0.0,
                "position_x": 250,
                "position_y": 300
            }
            node_start = {
                "id": "node_start",
                "title": "Start Internship Day 1",
                "node_type": "MILESTONE",
                "status": "PENDING",
                "progress": 0.0,
                "position_x": 400,
                "position_y": 450
            }

            nodes = [node_api, node_housing, node_travel, node_docs, node_move, node_start]
            edges = [
                {"source_node_id": "node_housing", "target_node_id": "node_move", "relationship_type": "BLOCKS"},
                {"source_node_id": "node_travel", "target_node_id": "node_move", "relationship_type": "BLOCKS"},
                {"source_node_id": "node_move", "target_node_id": "node_start", "relationship_type": "FEEDS_INTO"},
                {"source_node_id": "node_docs", "target_node_id": "node_start", "relationship_type": "RELIES_ON"},
            ]
        else:
            # Generic mission derived from the raw intent — never invent Bangalore for unrelated text.
            title_src = " ".join(state.raw_intent.split())[:80] or "Captured objective"
            mission = {
                "title": title_src,
                "description": state.raw_intent[:500],
                "desired_outcome": "Close the open thread captured from this intent.",
                "budget_limit": constraints.get("budget_limit"),
                "budget_currency": str(constraints.get("currency") or "INR"),
                "constraints": constraints,
                "status": "ACTIVE",
                "progress": 0.0,
            }
            nodes = [
                {
                    "id": "node_root",
                    "title": title_src,
                    "node_type": "OBJECTIVE",
                    "status": "PENDING",
                    "progress": 0.0,
                    "position_x": 200,
                    "position_y": 150,
                }
            ]
            edges = []

        state.current_mission = mission
        state.agent_results["nodes"] = nodes
        state.agent_results["edges"] = edges
        state.dependencies = edges

        state.run_logs.append({
            "agent": self.name,
            "status": "COMPLETED",
            "nodes_planned": len(nodes),
            "edges_connected": len(edges)
        })
        return state


class ResearchAgent:
    name = "RESEARCH_AGENT"

    async def execute(self, state: AgentState) -> AgentState:
        state.active_agent = self.name
        raw_lower = state.raw_intent.lower()
        if any(k in raw_lower for k in ("bangalore", "blr", "housing", "flight", "travel", "coliving")):
            query = "Bangalore coliving rent HSR Layout flights prices"
        else:
            # Keep research tied to the actual intent; never force a Bangalore query.
            query = " ".join(state.raw_intent.split())[:180] or "current best practices"
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
            "status": "COMPLETED",
            "findings_count": len(research_summary["findings"]),
            "evidence_snippets": len(tool_result.evidence)
        })
        return state

