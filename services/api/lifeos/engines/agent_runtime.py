import asyncio
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos.models.agent import AgentRun, AgentStep
from lifeos.models.action import ActionPassport
from lifeos.tools.registry import ToolRegistry, ToolExecutionResult
from lifeos.ai.provider import nemotron_provider
from lifeos.core.database import AsyncSessionLocal

logger = logging.getLogger("lifeos.engines.agent_runtime")


VALID_TRANSITIONS = {
    "QUEUED": {"PLANNING", "CANCELLED", "FAILED"},
    "PLANNING": {"RUNNING", "FAILED", "CANCELLED"},
    "RUNNING": {"RUNNING", "AWAITING_APPROVAL", "PAUSED", "COMPLETED", "PARTIALLY_COMPLETED", "BLOCKED", "FAILED", "CANCELLED"},
    "AWAITING_APPROVAL": {"RUNNING", "CANCELLED", "BLOCKED", "FAILED"},
    "PAUSED": {"RUNNING", "CANCELLED", "FAILED"},
    "BLOCKED": {"RUNNING", "CANCELLED", "FAILED"},
    "COMPLETED": set(),
    "PARTIALLY_COMPLETED": {"RUNNING", "CANCELLED"},
    "FAILED": set(),
    "CANCELLED": set(),
}


def _validate_transition(current_status: str, target_status: str) -> None:
    if current_status == target_status:
        return
    allowed = VALID_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise ValueError(f"Invalid transition from state '{current_status}' to '{target_status}'.")


class DurableAgentEngine:
    """Database-persisted plan and step runner with bounded synchronous execution."""

    @staticmethod
    async def create_and_plan_run(
        db: AsyncSession,
        user_id: str,
        task_description: str,
        mission_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> AgentRun:
        task_clean = task_description.strip()
        run = AgentRun(
            user_id=user_id,
            agent_type="DURABLE_ENGINE",
            task_description=task_clean,
            status="QUEUED",
            input_payload={
                "task": task_clean,
                "mission_id": mission_id,
                "conversation_id": conversation_id,
            },
            events=[{"step": "Queued", "timestamp": datetime.now(timezone.utc).isoformat()}],
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)

        # Plan the run
        await DurableAgentEngine.plan_run(db, run.id, user_id)
        return run

    @staticmethod
    async def plan_run(db: AsyncSession, run_id: str, user_id: str) -> AgentRun:
        run_res = await db.execute(
            select(AgentRun)
            .where(AgentRun.id == run_id, AgentRun.user_id == user_id)
            .options(selectinload(AgentRun.steps))
        )
        run = run_res.scalars().first()
        if not run:
            raise ValueError("Agent run not found.")

        _validate_transition(run.status, "PLANNING")
        run.status = "PLANNING"
        run.events.append({"step": "Planning started", "timestamp": datetime.now(timezone.utc).isoformat()})
        await db.commit()

        # Generate structured plan
        plan_steps = await DurableAgentEngine._generate_plan(run.task_description)
        run.plan_json = plan_steps

        # Persist steps in database
        for idx, step_spec in enumerate(plan_steps):
            step = AgentStep(
                run_id=run.id,
                step_index=idx,
                title=step_spec.get("title", f"Step {idx + 1}")[:255],
                tool_name=step_spec.get("tool_name", "tavily_search"),
                input_payload=step_spec.get("input_payload", {}),
                output_payload={},
                status="PENDING",
                requires_approval=bool(step_spec.get("requires_approval", False)),
                idempotency_key=hashlib.sha256(f"{run.id}_{idx}_{step_spec.get('title')}".encode()).hexdigest(),
            )
            db.add(step)

        _validate_transition(run.status, "RUNNING")
        run.status = "RUNNING"
        run.events.append({
            "step": "Planning completed",
            "steps_count": len(plan_steps),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await db.commit()
        await db.refresh(run)
        return run

    @staticmethod
    async def _generate_plan(task_description: str) -> List[Dict[str, Any]]:
        """Generates structured multi-step plan using model or deterministic planner."""
        task_lower = task_description.lower()
        steps: List[Dict[str, Any]] = []

        # Check if AI provider is configured for model planning
        health = await nemotron_provider.health_check()
        provider_configured = bool(health.get("configured")) and health.get("status") == "CONFIGURED"

        if provider_configured:
            prompt = (
                f"Create a step-by-step execution plan for this task:\n\"{task_description}\"\n\n"
                "Available tools:\n"
                "- tavily_search (query)\n"
                "- document_vault_search (query)\n"
                "- document_qa (document_id, question)\n"
                "- mission_task_create (title, description, tasks)\n"
                "- artifact_save (title, artifact_type, content, summary)\n"
                "- action_request_approval (action_name, why, expected_impact, execution_payload)\n"
            )
            system = "Return a JSON object with a 'steps' list where each step has: title, tool_name, input_payload, requires_approval."
            schema = {
                "steps": [
                    {
                        "title": "Search current information",
                        "tool_name": "tavily_search",
                        "input_payload": {"query": "sample query"},
                        "requires_approval": False
                    }
                ]
            }
            try:
                res = await nemotron_provider.structured_output(prompt, system, schema)
                model_steps = res.get("data", {}).get("steps", [])
                if model_steps and isinstance(model_steps, list):
                    for spec in model_steps[:12]:
                        if not isinstance(spec, dict):
                            continue
                        tool_name = spec.get("tool_name")
                        tool = ToolRegistry.get(tool_name) if isinstance(tool_name, str) else None
                        tool_input = spec.get("input_payload", {})
                        if not tool or tool.validate_input(tool_input):
                            continue
                        title = spec.get("title")
                        if not isinstance(title, str) or not title.strip():
                            continue
                        normalized = {
                            "title": title.strip()[:255],
                            "tool_name": tool_name,
                            "input_payload": tool_input,
                            "requires_approval": bool(spec.get("requires_approval", False)) or tool.requires_approval,
                        }
                        steps.append(normalized)
            except Exception:
                steps = []

        # Deterministic intelligent fallback plan if model not configured or returned empty
        if not steps:
            # 1. If research or comparison is needed
            if any(w in task_lower for w in ("research", "find", "search", "flight", "hotel", "travel", "compare", "price", "latest")):
                steps.append({
                    "title": f"Search web sources for: {task_description[:80]}",
                    "tool_name": "tavily_search",
                    "input_payload": {"query": task_description[:180], "search_depth": "basic"},
                    "requires_approval": False,
                })

            # 2. If documents are mentioned
            if any(w in task_lower for w in ("doc", "document", "pdf", "file", "vault")):
                steps.append({
                    "title": f"Search user document vault for relevant passages",
                    "tool_name": "document_vault_search",
                    "input_payload": {"query": task_description[:180], "limit": 5},
                    "requires_approval": False,
                })

            # 3. If saving tasks or mission
            if any(w in task_lower for w in ("mission", "track", "tasks", "organize", "plan", "trip", "travel")):
                steps.append({
                    "title": f"Create tracked mission and commitments",
                    "tool_name": "mission_task_create",
                    "input_payload": {
                        "title": task_description[:100],
                        "description": task_description,
                        "tasks": ["Review gathered information", "Confirm constraints", "Execute planned itinerary"],
                    },
                    "requires_approval": False,
                })

            # 4. If booking, purchasing, or external actions are requested
            if any(w in task_lower for w in ("book", "buy", "pay", "order", "purchase", "send email")):
                steps.append({
                    "title": f"Request approval for external operation",
                    "tool_name": "action_request_approval",
                    "input_payload": {
                        "action_name": f"Execute action for: {task_description[:100]}",
                        "why": "External operation requires explicit user authorization.",
                        "expected_impact": "Proceeds with authorized external booking or payment.",
                        "execution_payload": {"task": task_description},
                    },
                    "requires_approval": True,
                })

            # Save an honest plan artifact, never a fabricated completion report.
            proposed_steps = list(steps)
            plan_content = "# Proposed plan\n\n"
            if proposed_steps:
                plan_content += "\n".join(
                    f"{index}. {item['title']} (`{item['tool_name']}`)"
                    for index, item in enumerate(proposed_steps, start=1)
                )
            else:
                plan_content += "No supported tool steps were generated."
            plan_content += "\n\nThis is a proposed plan. No work is represented as completed by this artifact."
            steps.append({
                "title": f"Save proposed plan for: {task_description[:80]}",
                "tool_name": "artifact_save",
                "input_payload": {
                    "title": f"Proposed plan: {task_description[:80]}",
                    "artifact_type": "task_plan",
                    "content": plan_content,
                    "summary": "Proposed tasks only; completion is tracked separately in the agent run.",
                },
                "requires_approval": False,
            })

        return steps

    @staticmethod
    async def execute_run_steps(
        db: AsyncSession,
        run_id: str,
        user_id: str,
        max_steps_per_turn: int = 10,
    ) -> AgentRun:
        """Bounded execution loop: Plan -> Execute -> Inspect -> Update -> Finish."""
        run_res = await db.execute(
            select(AgentRun)
            .where(AgentRun.id == run_id, AgentRun.user_id == user_id)
            .options(selectinload(AgentRun.steps))
        )
        run = run_res.scalars().first()
        if not run:
            raise ValueError("Agent run not found.")

        if run.status in ("COMPLETED", "CANCELLED", "FAILED", "PAUSED"):
            return run

        steps = sorted(run.steps, key=lambda s: s.step_index)
        steps_executed = 0

        for step in steps:
            if step.status == "COMPLETED" or step.status == "SKIPPED":
                continue

            step_tool = ToolRegistry.get(step.tool_name)
            if step.status == "RUNNING" and step_tool and not step_tool.retry_safe:
                step.status = "FAILED"
                step.error_message = (
                    "The process stopped during a non-repeatable step. Its outcome is uncertain; "
                    "inspect the account before retrying."
                )
                step.completed_at = datetime.now(timezone.utc)
                _validate_transition(run.status, "BLOCKED")
                run.status = "BLOCKED"
                await db.commit()
                return run

            if run.status == "PAUSED" or run.status == "CANCELLED":
                break

            if steps_executed >= max_steps_per_turn:
                # Bounded loop: pause cleanly if max steps per batch reached
                break

            # Handle step requiring approval
            tool = ToolRegistry.get(step.tool_name)
            if step.requires_approval or (tool and tool.requires_approval):
                # Check if an approval was already created and executed
                if step.action_passport_id:
                    pass_res = await db.execute(
                        select(ActionPassport).where(
                            ActionPassport.id == step.action_passport_id,
                            ActionPassport.user_id == user_id,
                        )
                    )
                    passport = pass_res.scalars().first()
                    if passport and passport.status == "APPROVED":
                        step.status = "SKIPPED"
                        step.error_message = (
                            "Approval was recorded, but no external action handler is configured; "
                            "no external action was executed."
                        )
                        step.completed_at = datetime.now(timezone.utc)
                        _validate_transition(run.status, "BLOCKED")
                        run.status = "BLOCKED"
                        run.events.append({
                            "step": f"Approval recorded; execution unavailable for '{step.title}'",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })
                        await db.commit()
                        return run
                    if passport and passport.status == "REJECTED":
                        step.status = "SKIPPED"
                        step.error_message = "The approval request was rejected; no external action was executed."
                        step.completed_at = datetime.now(timezone.utc)
                        _validate_transition(run.status, "BLOCKED")
                        run.status = "BLOCKED"
                        await db.commit()
                        return run
                    if not passport or passport.status == "PENDING_APPROVAL":
                        _validate_transition(run.status, "AWAITING_APPROVAL")
                        run.status = "AWAITING_APPROVAL"
                        step.status = "AWAITING_APPROVAL"
                        await db.commit()
                        return run
                    step.status = "SKIPPED"
                    step.error_message = (
                        f"Approval passport has unsupported status '{passport.status}'; no external action was executed."
                    )
                    step.completed_at = datetime.now(timezone.utc)
                    _validate_transition(run.status, "BLOCKED")
                    run.status = "BLOCKED"
                    await db.commit()
                    return run
                else:
                    # Create approval request
                    tool = ToolRegistry.get(step.tool_name)
                    if tool:
                        res = await tool.execute(db, user_id, **step.input_payload)
                        step.action_passport_id = res.action_passport_id
                        step.output_payload = res.data
                        step.status = "AWAITING_APPROVAL"
                        _validate_transition(run.status, "AWAITING_APPROVAL")
                        run.status = "AWAITING_APPROVAL"
                        run.events.append({
                            "step": f"Awaiting approval for '{step.title}'",
                            "passport_id": res.action_passport_id,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })
                        await db.commit()
                        return run

            # Execute normal tool step
            step.status = "RUNNING"
            step.started_at = datetime.now(timezone.utc)
            await db.commit()

            tool = ToolRegistry.get(step.tool_name)
            if not tool:
                step.status = "FAILED"
                step.error_message = f"Tool '{step.tool_name}' is not registered."
                step.completed_at = datetime.now(timezone.utc)
                _validate_transition(run.status, "PARTIALLY_COMPLETED")
                run.status = "PARTIALLY_COMPLETED"
                await db.commit()
                return run

            validation_error = tool.validate_input(step.input_payload)
            if validation_error:
                step.status = "FAILED"
                step.error_message = validation_error
                step.completed_at = datetime.now(timezone.utc)
                _validate_transition(run.status, "PARTIALLY_COMPLETED")
                run.status = "PARTIALLY_COMPLETED"
                await db.commit()
                return run

            # Retry read-only tools only; a retried write can duplicate a side effect.
            tool_res: Optional[ToolExecutionResult] = None
            uncertain_side_effect = False
            max_attempts = 2 if tool.retry_safe else 1
            for attempt in range(max_attempts):
                try:
                    tool_res = await tool.execute(db, user_id, **step.input_payload)
                    if tool_res.success:
                        break
                except Exception as e:
                    logger.warning("Step %s execution error: %s", step.title, e)
                    if not tool.retry_safe:
                        uncertain_side_effect = True
                        tool_res = ToolExecutionResult(success=False, error=str(e))
                        break
                    if attempt == max_attempts - 1:
                        tool_res = ToolExecutionResult(success=False, error=str(e))

            if tool_res and tool_res.success:
                step.status = "COMPLETED"
                step.output_payload = tool_res.data
                step.completed_at = datetime.now(timezone.utc)
                run.events.append({
                    "step": f"Completed: {step.title}",
                    "evidence": tool_res.evidence,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                steps_executed += 1
            else:
                step.status = "FAILED"
                step.error_message = tool_res.error if tool_res else "Step execution failed."
                step.completed_at = datetime.now(timezone.utc)
                if uncertain_side_effect:
                    step.error_message = (
                        "The tool raised an error after a non-repeatable step began. Its outcome is uncertain; "
                        "inspect the account before retrying."
                    )
                    _validate_transition(run.status, "BLOCKED")
                    run.status = "BLOCKED"
                    await db.commit()
                    return run
                run.events.append({
                    "step": f"Failed: {step.title}",
                    "error": step.error_message,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                _validate_transition(run.status, "PARTIALLY_COMPLETED")
                run.status = "PARTIALLY_COMPLETED"
                await db.commit()
                return run

            await db.commit()

        # Check if all steps are completed
        all_completed = bool(steps) and all(s.status == "COMPLETED" for s in steps)
        if all_completed:
            _validate_transition(run.status, "COMPLETED")
            run.status = "COMPLETED"
            run.completed_at = datetime.now(timezone.utc)
            run.events.append({"step": "All steps completed successfully", "timestamp": datetime.now(timezone.utc).isoformat()})
            await db.commit()

        return run

    @staticmethod
    async def cancel_run(db: AsyncSession, run_id: str, user_id: str) -> AgentRun:
        run_res = await db.execute(
            select(AgentRun)
            .where(AgentRun.id == run_id, AgentRun.user_id == user_id)
            .options(selectinload(AgentRun.steps))
        )
        run = run_res.scalars().first()
        if not run:
            raise ValueError("Agent run not found.")

        _validate_transition(run.status, "CANCELLED")
        run.status = "CANCELLED"
        run.completed_at = datetime.now(timezone.utc)

        # Cancel all pending/awaiting steps; preserve completed steps
        for step in run.steps:
            if step.status in ("PENDING", "RUNNING", "AWAITING_APPROVAL"):
                step.status = "CANCELLED"

        run.events.append({
            "step": "Run cancelled by user",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await db.commit()
        return run

    @staticmethod
    async def pause_run(db: AsyncSession, run_id: str, user_id: str) -> AgentRun:
        run_res = await db.execute(
            select(AgentRun)
            .where(AgentRun.id == run_id, AgentRun.user_id == user_id)
            .options(selectinload(AgentRun.steps))
        )
        run = run_res.scalars().first()
        if not run:
            raise ValueError("Agent run not found.")

        _validate_transition(run.status, "PAUSED")
        run.status = "PAUSED"
        run.events.append({
            "step": "Run paused",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await db.commit()
        return run

    @staticmethod
    async def resume_run(db: AsyncSession, run_id: str, user_id: str) -> AgentRun:
        run_res = await db.execute(
            select(AgentRun)
            .where(AgentRun.id == run_id, AgentRun.user_id == user_id)
            .options(selectinload(AgentRun.steps))
        )
        run = run_res.scalars().first()
        if not run:
            raise ValueError("Agent run not found.")

        _validate_transition(run.status, "RUNNING")
        run.status = "RUNNING"
        run.events.append({
            "step": "Run resumed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await db.commit()

        # Continue execution
        return await DurableAgentEngine.execute_run_steps(db, run_id, user_id)

    @staticmethod
    async def retry_step(db: AsyncSession, run_id: str, step_index: int, user_id: str) -> AgentRun:
        run_res = await db.execute(
            select(AgentRun)
            .where(AgentRun.id == run_id, AgentRun.user_id == user_id)
            .options(selectinload(AgentRun.steps))
        )
        run = run_res.scalars().first()
        if not run:
            raise ValueError("Agent run not found.")

        target_step = next((s for s in run.steps if s.step_index == step_index), None)
        if not target_step:
            raise ValueError(f"Step with index {step_index} not found.")
        if target_step.status != "FAILED":
            raise ValueError("Only failed steps can be retried.")

        target_step.status = "PENDING"
        target_step.error_message = None
        _validate_transition(run.status, "RUNNING")
        run.status = "RUNNING"
        run.events.append({
            "step": f"Retrying step: {target_step.title}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await db.commit()

        return await DurableAgentEngine.execute_run_steps(db, run_id, user_id)

