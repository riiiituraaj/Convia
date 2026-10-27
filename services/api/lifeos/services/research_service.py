import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos.models.research import ResearchSession, ResearchSource
from lifeos.models.artifact import Artifact
from lifeos.models.mission import Mission
from lifeos.models.commitment import Commitment
from lifeos.tools.tavily_research import tavily_tool
from lifeos.ai.provider import nemotron_provider


def normalize_url(value: Any) -> Optional[str]:
    """Normalizes URL without merging materially different pages."""
    if not isinstance(value, str) or len(value) > 2048:
        return None
    try:
        parts = urlsplit(value.strip())
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            return None
        # Lowercase scheme and netloc, keep path and query, drop hash fragment
        return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", parts.query, ""))
    except ValueError:
        return None


def generate_source_id(url: str, session_id: Optional[str] = None) -> str:
    """Stable source reference scoped to a research session when one is supplied."""
    source_identity = f"{session_id}:{url}" if session_id else url
    return hashlib.sha256(source_identity.encode("utf-8")).hexdigest()[:16]


class ResearchService:
    @staticmethod
    async def run_and_persist_research(
        db: AsyncSession,
        user_id: str,
        query: str,
        search_depth: str = "basic",
        title: Optional[str] = None,
    ) -> ResearchSession:
        normalized_query = " ".join(query.split())[:500]
        session_title = title or normalized_query[:100]

        # 1. Execute Tavily search
        tool_result = await tavily_tool.execute(query=normalized_query, search_depth=search_depth)
        raw_results = tool_result.data.get("results", []) if tool_result.success else []

        # 2. Create ResearchSession
        session = ResearchSession(
            user_id=user_id,
            title=session_title,
            original_query=normalized_query,
            status="COMPLETED" if tool_result.success else "UNAVAILABLE",
            summary=tool_result.data.get("answer") or tool_result.error or "",
            claims_json=[],
        )
        db.add(session)
        await db.flush()

        # 3. Normalize, deduplicate, and persist sources
        seen_urls: set[str] = set()
        persisted_sources: List[ResearchSource] = []

        for item in raw_results:
            norm_url = normalize_url(item.get("url"))
            if not norm_url or norm_url in seen_urls:
                continue
            seen_urls.add(norm_url)

            # The source table uses this identifier as its primary key, so scope it
            # to a session while keeping references stable inside that session.
            src_id = generate_source_id(norm_url, session.id)
            parsed = urlsplit(norm_url)

            source = ResearchSource(
                id=src_id,
                session_id=session.id,
                url=norm_url,
                title=str(item.get("title") or parsed.hostname or "Untitled source")[:500],
                source=parsed.hostname or "web",
                domain=parsed.hostname,
                snippet=str(item.get("snippet") or item.get("content") or "")[:4000],
                raw_content=str(item.get("raw_content") or "")[:12000] or None,
                relevance=float(item.get("relevance")) if item.get("relevance") is not None else None,
                retrieval_status="retrieved",
                published_at=item.get("published_at") or item.get("published_date"),
                retrieved_at=datetime.now(timezone.utc),
            )
            db.add(source)
            persisted_sources.append(source)

        await db.commit()

        # 4. Generate grounded synthesis and validate citation IDs
        synthesis, claims = await ResearchService._generate_grounded_synthesis(
            query=normalized_query,
            sources=persisted_sources,
            initial_answer=tool_result.data.get("answer", ""),
            tool_success=tool_result.success,
            tool_error=tool_result.error,
        )

        session.synthesis = synthesis
        session.claims_json = claims
        session.updated_at = datetime.now(timezone.utc)
        await db.commit()

        # Eagerly load session with sources to avoid async lazy-load error
        reloaded = await db.execute(
            select(ResearchSession)
            .where(ResearchSession.id == session.id)
            .options(selectinload(ResearchSession.sources))
        )
        return reloaded.scalars().first()

    @staticmethod
    async def _generate_grounded_synthesis(
        query: str,
        sources: List[ResearchSource],
        initial_answer: str,
        tool_success: bool,
        tool_error: Optional[str] = None,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        if not tool_success or not sources:
            err_msg = tool_error or "No live search sources were retrieved. Provider is offline or unconfigured."
            synthesis = (
                f"# Research Report: {query}\n\n"
                f"**Status**: Offline / Unavailable\n\n"
                f"{err_msg}\n\n"
                "No live claims were verified against external sources."
            )
            return synthesis, []

        valid_source_ids = {s.id for s in sources}
        source_id_to_title = {s.id: s.title for s in sources}

        # Format sources text with explicit IDs
        sources_text = "\n\n".join(
            f"[{s.id}] {s.title} ({s.url})\nDomain: {s.domain or 'unknown'} | Published: {s.published_at or 'n/a'}\n{s.snippet}"
            for s in sources
        )

        health = await nemotron_provider.health_check()
        provider_configured = bool(health.get("configured")) and health.get("status") == "CONFIGURED"

        raw_synthesis = ""
        if provider_configured:
            prompt = (
                f"Research Question: {query}\n\n"
                f"Retrieved Sources:\n{sources_text}\n\n"
                "Synthesize a clear, grounded answer. Every factual claim MUST cite its supporting source using its exact ID "
                "in square brackets like [source_id]. If sources disagree or details are missing, explicitly note the uncertainty."
            )
            system = "You are an objective research synthesizer. Cite only genuine provided source IDs. Do not invent citations or facts."
            try:
                res = await nemotron_provider.generate(prompt=prompt, system_prompt=system, temperature=0.1)
                raw_synthesis = res.get("content", "").strip()
            except Exception:
                raw_synthesis = ""

        # Grounded fallback synthesis using sources
        if not raw_synthesis:
            sections = [f"# Research Synthesis: {query}\n"]
            if initial_answer:
                sections.append(f"**Overview**: {initial_answer}\n")
            sections.append("### Retrieved source excerpts:\n")
            for s in sources[:5]:
                sections.append(f"- **{s.title}** [{s.id}]: {s.snippet[:250]}... (Source: {s.url})")
            raw_synthesis = "\n".join(sections)

        # 5. Citation Validation Pass: Validate every [id] against valid_source_ids
        claims: List[Dict[str, Any]] = []
        cited_tags = re.findall(r"\[([a-f0-9]{16})\]", raw_synthesis)

        # Build structured claims from paragraphs/bullets
        lines = [line.strip() for line in raw_synthesis.split("\n") if line.strip() and not line.startswith("#")]
        for line in lines:
            line_citations = re.findall(r"\[([a-f0-9]{16})\]", line)
            valid_citations = [cid for cid in line_citations if cid in valid_source_ids]
            invalid_citations = [cid for cid in line_citations if cid not in valid_source_ids]

            claims.append({
                "claim": line,
                "source_ids": valid_citations,
                # Resolving a citation proves only that the reference exists; it
                # does not prove that the source supports the surrounding claim.
                "verified": False,
                "citation_valid": bool(valid_citations) and not invalid_citations,
                "invalid_citations_detected": invalid_citations,
            })

        # Repair or annotate hallucinated IDs in the text
        for invalid_id in set(re.findall(r"\[([a-f0-9]{16})\]", raw_synthesis)) - valid_source_ids:
            raw_synthesis = raw_synthesis.replace(f"[{invalid_id}]", f"[{invalid_id} - UNVERIFIED]")

        return raw_synthesis, claims

    @staticmethod
    async def convert_to_artifact(db: AsyncSession, session_id: str, user_id: str) -> Artifact:
        sess_res = await db.execute(
            select(ResearchSession)
            .where(ResearchSession.id == session_id, ResearchSession.user_id == user_id)
            .options(selectinload(ResearchSession.sources))
        )
        session = sess_res.scalars().first()
        if not session:
            raise ValueError("Research session not found.")

        sources_payload = [
            {"id": s.id, "title": s.title, "url": s.url, "domain": s.domain, "snippet": s.snippet[:300]}
            for s in session.sources
        ]

        artifact = Artifact(
            user_id=user_id,
            title=f"Research Brief: {session.title}",
            artifact_type="research_brief",
            content=session.synthesis or session.summary or "Empty research session",
            summary=session.summary,
            sources_json=sources_payload,
            metadata_json={
                "research_session_id": session.id,
                "query": session.original_query,
                "sources_count": len(session.sources),
                "claims_count": len(session.claims_json),
            },
        )
        db.add(artifact)
        await db.commit()
        await db.refresh(artifact)
        return artifact

    @staticmethod
    async def convert_to_mission(db: AsyncSession, session_id: str, user_id: str) -> Mission:
        sess_res = await db.execute(
            select(ResearchSession)
            .where(ResearchSession.id == session_id, ResearchSession.user_id == user_id)
            .options(selectinload(ResearchSession.sources))
        )
        session = sess_res.scalars().first()
        if not session:
            raise ValueError("Research session not found.")

        mission = Mission(
            user_id=user_id,
            title=f"Mission from Research: {session.title}"[:255],
            description=session.summary or session.original_query,
            desired_outcome=f"Execute tasks derived from research for '{session.title}'",
            status="ACTIVE",
            priority="HIGH",
            progress=0.0,
        )
        db.add(mission)
        await db.flush()

        # Add commitments from claims or sources
        for s in session.sources[:5]:
            commitment = Commitment(
                user_id=user_id,
                mission_id=mission.id,
                action=f"Review findings from {s.title}"[:2000],
                actor="user",
                status="PLANNED",
                priority="MEDIUM",
                context=s.url,
                evidence=s.snippet[:500],
            )
            db.add(commitment)

        await db.commit()
        await db.refresh(mission)
        return mission
