import asyncio
import hashlib
import logging
import random
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx

from lifeos.core.config import settings
from lifeos.tools.base import BaseTool, ToolResult

logger = logging.getLogger("lifeos.tools.tavily")
TAVILY_SEARCH_URL = "https://api.tavily.com/search"


def _normalize_url(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) > 2048:
        return None
    try:
        parts = urlsplit(value.strip())
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            return None
        return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", parts.query, ""))
    except ValueError:
        return None


def _source(item: dict[str, Any], query: str) -> dict[str, Any] | None:
    url = _normalize_url(item.get("url"))
    if not url:
        return None
    parsed = urlsplit(url)
    source_id = hashlib.sha256(url.encode("utf-8")).hexdigest()[:20]
    score = item.get("score")
    try:
        score = float(score) if score is not None else None
    except (TypeError, ValueError):
        score = None
    return {
        "id": source_id,
        "title": str(item.get("title") or parsed.hostname or "Untitled source")[:500],
        "url": url,
        "source": parsed.hostname or "web",
        "domain": parsed.hostname,
        "query": query,
        "snippet": str(item.get("content") or "")[:4000],
        "raw_content": str(item.get("raw_content") or "")[:12000] or None,
        "published_at": item.get("published_date") or item.get("published_at"),
        "relevance": score,
        "retrieval_status": "retrieved",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


class TavilyResearchTool(BaseTool):
    name = "tavily_search"
    description = "Searches current web sources and returns normalized source records."
    permission_level = 0
    risk_level = "LOW"

    async def execute(self, query: str, search_depth: str = "basic") -> ToolResult:
        normalized_query = " ".join(query.split())
        if not normalized_query or len(normalized_query) > 500:
            return ToolResult(success=False, data={}, error="Search query must contain 1 to 500 characters.")
        if search_depth not in {"basic", "advanced"}:
            return ToolResult(success=False, data={}, error="Search depth must be basic or advanced.")
        if not settings.TAVILY_API_KEY:
            return ToolResult(
                success=False,
                data={"query": normalized_query, "results": [], "offline": True},
                error="Live web research is unavailable because TAVILY_API_KEY is not configured. No sources were returned.",
            )

        payload = {
            "query": normalized_query,
            "search_depth": search_depth,
            "include_answer": True,
            "max_results": settings.TAVILY_MAX_RESULTS,
        }
        headers = {
            "Authorization": f"Bearer {settings.TAVILY_API_KEY}",
            "Content-Type": "application/json",
        }

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=settings.TAVILY_TIMEOUT_SECONDS) as client:
                    response = await client.post(TAVILY_SEARCH_URL, headers=headers, json=payload)
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt < 2:
                        retry_after = response.headers.get("Retry-After")
                        try:
                            delay = min(float(retry_after), 4.0) if retry_after else (0.4 * (2 ** attempt) + random.uniform(0, 0.2))
                        except ValueError:
                            delay = 0.4 * (2 ** attempt) + random.uniform(0, 0.2)
                        await asyncio.sleep(delay)
                        continue
                response.raise_for_status()
                raw_data = response.json()
                results: list[dict[str, Any]] = []
                seen: set[str] = set()
                for item in raw_data.get("results", []):
                    normalized = _source(item, normalized_query)
                    if normalized and normalized["url"] not in seen:
                        seen.add(normalized["url"])
                        results.append(normalized)
                    if len(results) >= settings.TAVILY_MAX_RESULTS:
                        break

                evidence = [
                    f"[{result['id']}] {result['title']}: {result['snippet'][:1000]} ({result['url']})"
                    for result in results
                ]
                return ToolResult(
                    success=True,
                    data={
                        "query": normalized_query,
                        "results": results,
                        "answer": str(raw_data.get("answer") or ""),
                        "retrieved_at": datetime.now(timezone.utc).isoformat(),
                    },
                    evidence=evidence,
                )
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                logger.warning("Tavily search failed with HTTP status %s", status_code)
                if (status_code == 429 or status_code >= 500) and attempt < 2:
                    await asyncio.sleep(0.4 * (2 ** attempt) + random.uniform(0, 0.2))
                    continue
                hint = "Check the Tavily API key." if status_code in {401, 403} else "The search provider rejected the request."
                return ToolResult(success=False, data={"query": normalized_query, "results": []}, error=f"Live research failed (HTTP {status_code}). {hint}")
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                logger.warning("Tavily search network failure: %s", type(exc).__name__)
                if attempt < 2:
                    await asyncio.sleep(0.4 * (2 ** attempt) + random.uniform(0, 0.2))
                    continue
                return ToolResult(success=False, data={"query": normalized_query, "results": []}, error="Live research timed out or the provider could not be reached. No current sources were returned.")
            except (ValueError, TypeError):
                logger.warning("Tavily returned an invalid response payload")
                return ToolResult(success=False, data={"query": normalized_query, "results": []}, error="Live research returned an invalid response. No sources were returned.")

        return ToolResult(success=False, data={"query": normalized_query, "results": []}, error="Live research failed after bounded retries.")


tavily_tool = TavilyResearchTool()
