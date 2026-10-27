import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos.models.document import Document, DocumentChunk
from lifeos.models.mission import Mission
from lifeos.models.commitment import Commitment
from lifeos.models.action import ActionPassport
from lifeos.models.artifact import Artifact
from lifeos.models.research import ResearchSession, ResearchSource
from lifeos.documents.search import BM25Retriever
from lifeos.tools.tavily_research import tavily_tool


class ToolExecutionResult(BaseModel):
    success: bool
    data: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    evidence: List[str] = Field(default_factory=list)
    requires_approval: bool = False
    action_passport_id: Optional[str] = None


class BaseAgentTool:
    name: str = "base_tool"
    description: str = "Base tool"
    risk_level: str = "LOW"  # LOW, MEDIUM, HIGH
    requires_approval: bool = False
    retry_safe: bool = False
    input_schema: Dict[str, Any] = {}
    output_schema: Dict[str, Any] = {}

    def validate_input(self, payload: Any) -> Optional[str]:
        """Validate tool arguments against the declared JSON Schema subset."""
        if not isinstance(payload, dict):
            return "Tool input must be an object."
        schema = self.input_schema or {}
        properties = schema.get("properties", {})
        missing = [key for key in schema.get("required", []) if key not in payload]
        if missing:
            return f"Missing required input field(s): {', '.join(missing)}."
        unknown = sorted(set(payload) - set(properties))
        if unknown:
            return f"Unknown input field(s): {', '.join(unknown)}."
        for key, value in payload.items():
            spec = properties[key]
            expected = spec.get("type")
            matches = {
                "string": lambda item: isinstance(item, str),
                "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
                "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
                "boolean": lambda item: isinstance(item, bool),
                "object": lambda item: isinstance(item, dict),
                "array": lambda item: isinstance(item, list),
            }.get(expected)
            if matches and not matches(value):
                return f"Input field '{key}' must be of type {expected}."
            if "enum" in spec and value not in spec["enum"]:
                return f"Input field '{key}' must be one of: {', '.join(map(str, spec['enum']))}."
        return None

    async def execute(self, db: AsyncSession, user_id: str, **kwargs) -> ToolExecutionResult:
        raise NotImplementedError


class TavilySearchTool(BaseAgentTool):
    name = "tavily_search"
    description = "Searches web sources for current information, returning normalized source records."
    risk_level = "LOW"
    requires_approval = False
    retry_safe = True
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "search_depth": {"type": "string", "enum": ["basic", "advanced"], "default": "basic"},
        },
        "required": ["query"],
    }

    async def execute(self, db: AsyncSession, user_id: str, **kwargs) -> ToolExecutionResult:
        query = str(kwargs.get("query", "")).strip()
        search_depth = kwargs.get("search_depth", "basic")
        if not query:
            return ToolExecutionResult(success=False, error="Search query cannot be empty.")

        res = await tavily_tool.execute(query=query, search_depth=search_depth)
        # If offline/unconfigured, disclose clearly without crashing the multi-step run
        if not res.success and res.data.get("offline"):
            return ToolExecutionResult(
                success=True,
                data=res.data,
                error=res.error,
                evidence=[f"Web search for '{query}': {res.error}"],
            )

        return ToolExecutionResult(
            success=res.success,
            data=res.data,
            error=res.error if not res.success else None,
            evidence=res.evidence,
        )


class DocumentVaultSearchTool(BaseAgentTool):
    name = "document_vault_search"
    description = "Retrieves grounded text passages from the authenticated user's uploaded documents."
    risk_level = "LOW"
    requires_approval = False
    retry_safe = True
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search terms to match in document vault"},
            "limit": {"type": "integer", "default": 5},
        },
        "required": ["query"],
    }

    async def execute(self, db: AsyncSession, user_id: str, **kwargs) -> ToolExecutionResult:
        query = str(kwargs.get("query", "")).strip()
        limit = int(kwargs.get("limit", 5))
        if not query:
            return ToolExecutionResult(success=False, error="Search query cannot be empty.")

        # Find user documents and chunks
        docs_res = await db.execute(
            select(Document)
            .where(Document.user_id == user_id)
            .options(selectinload(Document.chunks))
        )
        docs = docs_res.scalars().all()
        all_chunks: List[DocumentChunk] = []
        for doc in docs:
            all_chunks.extend(doc.chunks)

        if not all_chunks:
            return ToolExecutionResult(
                success=True,
                data={"results": [], "count": 0, "message": "No documents found in your vault."},
            )

        ranked = BM25Retriever.rank_chunks(all_chunks, query, limit=limit)
        results = [
            {
                "chunk_id": c.id,
                "document_id": c.document_id,
                "locator": c.source_locator,
                "content": c.content[:800],
            }
            for c in ranked
        ]
        evidence = [f"[{r['locator']}] {r['content'][:200]}" for r in results]

        return ToolExecutionResult(
            success=True,
            data={"results": results, "count": len(results)},
            evidence=evidence,
        )


class DocumentQATool(BaseAgentTool):
    name = "document_qa"
    description = "Answers questions grounded strictly in passages from a specific user document."
    risk_level = "LOW"
    requires_approval = False
    retry_safe = True
    input_schema = {
        "type": "object",
        "properties": {
            "document_id": {"type": "string"},
            "question": {"type": "string"},
        },
        "required": ["document_id", "question"],
    }

    async def execute(self, db: AsyncSession, user_id: str, **kwargs) -> ToolExecutionResult:
        document_id = str(kwargs.get("document_id", "")).strip()
        question = str(kwargs.get("question", "")).strip()
        if not document_id or not question:
            return ToolExecutionResult(success=False, error="document_id and question are required.")

        doc_res = await db.execute(
            select(Document)
            .where(Document.id == document_id, Document.user_id == user_id)
            .options(selectinload(Document.chunks))
        )
        doc = doc_res.scalars().first()
        if not doc:
            return ToolExecutionResult(success=False, error="Document not found or access denied.")

        ranked = BM25Retriever.rank_chunks(doc.chunks, question, limit=5)
        if not ranked:
            return ToolExecutionResult(
                success=True,
                data={
                    "answered": False,
                    "answer": "No relevant passages found in this document answering the question.",
                    "sources": [],
                },
            )

        sources = [{"locator": c.source_locator, "excerpt": c.content[:600]} for c in ranked]
        return ToolExecutionResult(
            success=True,
            data={
                "answered": True,
                "document_title": doc.filename,
                "sources": sources,
                "excerpt_summary": f"Retrieved {len(sources)} grounded passage(s) from '{doc.filename}'.",
            },
            evidence=[f"[{s['locator']}] {s['excerpt'][:150]}" for s in sources],
        )


class MissionTaskCreateTool(BaseAgentTool):
    name = "mission_task_create"
    description = "Creates a mission and associated tracked commitments in the user's account."
    risk_level = "LOW"
    requires_approval = False
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "description": {"type": "string"},
            "tasks": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["title"],
    }

    async def execute(self, db: AsyncSession, user_id: str, **kwargs) -> ToolExecutionResult:
        title = str(kwargs.get("title", "")).strip()
        description = str(kwargs.get("description", "")).strip()
        tasks = kwargs.get("tasks", [])
        if not title:
            return ToolExecutionResult(success=False, error="Mission title cannot be empty.")

        mission = Mission(
            user_id=user_id,
            title=title[:255],
            description=description or title,
            desired_outcome=description or title,
            status="ACTIVE",
            priority="HIGH",
            progress=0.0,
        )
        db.add(mission)
        await db.flush()

        created_tasks = []
        for task_action in tasks:
            action_str = str(task_action).strip()
            if not action_str:
                continue
            commitment = Commitment(
                user_id=user_id,
                mission_id=mission.id,
                action=action_str[:2000],
                actor="user",
                priority="MEDIUM",
                status="PLANNED",
                context=f"Created by agent mission: {title}",
            )
            db.add(commitment)
            created_tasks.append(action_str)

        await db.commit()
        await db.refresh(mission)

        return ToolExecutionResult(
            success=True,
            data={
                "mission_id": mission.id,
                "mission_title": mission.title,
                "tasks_created_count": len(created_tasks),
                "tasks": created_tasks,
            },
            evidence=[f"Created Mission '{mission.title}' with {len(created_tasks)} planned tasks."],
        )


class ArtifactSaveTool(BaseAgentTool):
    name = "artifact_save"
    description = "Creates and saves a reusable, verifiable artifact (e.g. research brief, plan, summary)."
    risk_level = "LOW"
    requires_approval = False
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "artifact_type": {"type": "string"},
            "content": {"type": "string"},
            "summary": {"type": "string"},
            "sources": {"type": "array"},
            "mission_id": {"type": "string"},
        },
        "required": ["title", "artifact_type", "content"],
    }

    async def execute(self, db: AsyncSession, user_id: str, **kwargs) -> ToolExecutionResult:
        title = str(kwargs.get("title", "")).strip()
        artifact_type = str(kwargs.get("artifact_type", "evidence_report")).strip()
        content = str(kwargs.get("content", "")).strip()
        summary = kwargs.get("summary")
        sources = kwargs.get("sources", [])
        mission_id = kwargs.get("mission_id")

        if not title or not content:
            return ToolExecutionResult(success=False, error="Title and content are required for saving an artifact.")

        artifact = Artifact(
            user_id=user_id,
            title=title[:255],
            artifact_type=artifact_type[:50],
            content=content,
            summary=summary,
            sources_json=sources if isinstance(sources, list) else [],
            mission_id=mission_id,
            metadata_json={"saved_via": "agent_runtime"},
        )
        db.add(artifact)
        await db.commit()
        await db.refresh(artifact)

        return ToolExecutionResult(
            success=True,
            data={
                "artifact_id": artifact.id,
                "title": artifact.title,
                "artifact_type": artifact.artifact_type,
                "created_at": artifact.created_at.isoformat(),
            },
            evidence=[f"Saved Artifact [{artifact.artifact_type}] '{artifact.title}' (ID: {artifact.id})"],
        )


class ActionRequestApprovalTool(BaseAgentTool):
    name = "action_request_approval"
    description = "Records an approval request. Approval does not execute an external action in this build."
    risk_level = "HIGH"
    requires_approval = True
    input_schema = {
        "type": "object",
        "properties": {
            "action_name": {"type": "string"},
            "why": {"type": "string"},
            "expected_impact": {"type": "string"},
            "execution_payload": {"type": "object"},
        },
        "required": ["action_name", "why"],
    }

    async def execute(self, db: AsyncSession, user_id: str, **kwargs) -> ToolExecutionResult:
        action_name = str(kwargs.get("action_name", "")).strip()
        why = str(kwargs.get("why", "")).strip()
        expected_impact = str(kwargs.get("expected_impact", "Records the request for user review; no external handler is connected."))
        payload = kwargs.get("execution_payload", {})

        if not action_name:
            return ToolExecutionResult(success=False, error="Action name cannot be empty.")

        passport = ActionPassport(
            user_id=user_id,
            action_name=action_name[:255],
            why=why,
            expected_impact=expected_impact,
            risk_level="HIGH",
            is_reversible=False,
            approval_required=True,
            status="PENDING_APPROVAL",
            execution_payload=payload if isinstance(payload, dict) else {},
        )
        db.add(passport)
        await db.commit()
        await db.refresh(passport)

        return ToolExecutionResult(
            success=True,
            requires_approval=True,
            action_passport_id=passport.id,
            data={
                "passport_id": passport.id,
                "action_name": passport.action_name,
                "status": passport.status,
                "message": f"Action '{passport.action_name}' requires your explicit approval before execution.",
            },
            evidence=[f"Created ActionPassport {passport.id} awaiting user approval."],
        )


class ToolRegistry:
    """Central registry of implemented agent tools."""

    _tools: Dict[str, BaseAgentTool] = {
        "tavily_search": TavilySearchTool(),
        "document_vault_search": DocumentVaultSearchTool(),
        "document_qa": DocumentQATool(),
        "mission_task_create": MissionTaskCreateTool(),
        "artifact_save": ArtifactSaveTool(),
        "action_request_approval": ActionRequestApprovalTool(),
    }

    @classmethod
    def get(cls, name: str) -> Optional[BaseAgentTool]:
        return cls._tools.get(name)

    @classmethod
    def validate_input(cls, name: str, payload: Any) -> Optional[str]:
        tool = cls.get(name)
        if not tool:
            return f"Tool '{name}' is not registered."
        return tool.validate_input(payload)

    @classmethod
    def list_tools(cls) -> List[Dict[str, Any]]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "risk_level": t.risk_level,
                "requires_approval": t.requires_approval,
                "input_schema": t.input_schema,
            }
            for t in cls._tools.values()
        ]
