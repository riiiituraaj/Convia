import httpx
import logging
from typing import Dict, Any, List
from lifeos.core.config import settings
from lifeos.tools.base import BaseTool, ToolResult

logger = logging.getLogger("lifeos.tools.tavily")


class TavilyResearchTool(BaseTool):
    name = "tavily_search"
    description = "Searches the live web for verified facts, pricing, flights, housing, and documentation."
    permission_level = 0 # Safe read-only research
    risk_level = "LOW"

    async def execute(self, query: str, search_depth: str = "basic") -> ToolResult:
        api_key = settings.TAVILY_API_KEY

        if not api_key:
            # Offline knowledge base — clearly labeled, never pretends to be live web results.
            logger.info("Tavily API key not found. Returning offline knowledge-base entries.")
            return ToolResult(
                success=True,
                data={
                    "query": query,
                    "offline": True,
                    "results": [
                        {
                            "title": "Offline note: travel & housing cost ranges",
                            "url": "",
                            "source": "CONVIA offline knowledge base",
                            "snippet": (
                                "No live web search is configured. Rough planning ranges often used for "
                                "Indian metro relocation: inter-city flights often ₹6,000–₹15,000 "
                                "depending on window; furnished coliving often ₹12,000–₹25,000/month "
                                "depending on city and occupancy. Treat as rough order-of-magnitude only."
                            ),
                            "relevance": 0.5,
                            "offline": True,
                        },
                        {
                            "title": "Offline note: how to get live research",
                            "url": "",
                            "source": "CONVIA offline knowledge base",
                            "snippet": (
                                "Set TAVILY_API_KEY to enable live web research for pricing, flights, "
                                "housing, and documentation. Without it, CONVIA only returns this offline note."
                            ),
                            "relevance": 0.4,
                            "offline": True,
                        },
                    ],
                    "answer": (
                        "Live web research is off (no TAVILY_API_KEY). "
                        "These are offline planning notes, not verified current sources."
                    ),
                },
                evidence=[
                    "Offline mode: no TAVILY_API_KEY configured — results are not live web sources.",
                    "Add TAVILY_API_KEY to enable verified live research.",
                ],
                error="",
            )

        payload = {
            "api_key": api_key,
            "query": query,
            "search_depth": search_depth,
            "include_answer": True,
            "max_results": 5
        }

        async with httpx.AsyncClient(timeout=25.0) as client:
            try:
                response = await client.post("https://api.tavily.com/search", json=payload)
                response.raise_for_status()
                raw_data = response.json()

                formatted_results = []
                evidence_list = []
                for item in raw_data.get("results", []):
                    entry = {
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "source": item.get("url", "").split("/")[2] if "//" in item.get("url", "") else "web",
                        "snippet": item.get("content", ""),
                        "relevance": item.get("score", 0.9)
                    }
                    formatted_results.append(entry)
                    evidence_list.append(f"{entry['title']}: {entry['snippet'][:120]} ({entry['url']})")

                return ToolResult(
                    success=True,
                    data={"query": query, "results": formatted_results, "answer": raw_data.get("answer", "")},
                    evidence=evidence_list
                )
            except Exception as e:
                logger.error(f"Tavily search failed: {e}")
                return ToolResult(
                    success=False,
                    data={},
                    error=f"Live research failed: {str(e)}"
                )


tavily_tool = TavilyResearchTool()

