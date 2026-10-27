import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from lifeos.main import app
from lifeos.core.database import init_db
from lifeos.tools.registry import ToolRegistry


async def register_user(client: AsyncClient, name: str = "User") -> tuple[dict[str, str], str]:
    email = f"agent-user-{uuid.uuid4().hex[:10]}@convia.app"
    res = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123!", "full_name": name},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    user_id = res.json()["user_id"]
    return {"Authorization": f"Bearer {token}"}, user_id


def test_registered_tools_enforce_declared_input_schemas():
    assert ToolRegistry.validate_input("tavily_search", {}) == "Missing required input field(s): query."
    assert ToolRegistry.validate_input("tavily_search", {"query": 42}) == "Input field 'query' must be of type string."
    assert ToolRegistry.validate_input("tavily_search", {"query": "rates", "unexpected": True})
    assert ToolRegistry.validate_input("tavily_search", {"query": "rates", "search_depth": "basic"}) is None


@pytest.mark.asyncio
async def test_agent_structured_plan_and_execution():
    """Journey D: Multi-step task creates structured plan, executes tools, and saves deliverables."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, user_id = await register_user(client, "AgentPlanner")

        # 1. Start agent run with task description
        res = await client.post(
            "/api/agents/runs",
            json={"task_description": "Organize trip to Shillong and save itinerary report"},
            headers=headers,
        )
        assert res.status_code == 201
        run = res.json()
        run_id = run["id"]
        assert len(run["plan_json"]) >= 2
        assert len(run["steps"]) >= 2

        # Verify steps were persisted
        for step in run["steps"]:
            assert "tool_name" in step
            assert "status" in step
            assert step["status"] in ("COMPLETED", "PENDING", "AWAITING_APPROVAL", "RUNNING")

        # 2. Check get run detail
        detail_res = await client.get(f"/api/agents/runs/{run_id}", headers=headers)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["id"] == run_id
        assert detail["agent_type"] == "DURABLE_ENGINE"
        assert len(detail["events"]) > 0
        artifacts_res = await client.get("/api/artifacts", headers=headers)
        assert artifacts_res.status_code == 200
        plan_artifact = next(item for item in artifacts_res.json() if "Proposed plan" in item["title"])
        full_artifact = await client.get(f"/api/artifacts/{plan_artifact['id']}", headers=headers)
        assert full_artifact.status_code == 200
        assert "No work is represented as completed" in full_artifact.json()["content"]
        assert "Completed execution via CONVIA durable runtime" not in full_artifact.json()["content"]


@pytest.mark.asyncio
async def test_agent_approval_enforcement():
    """Journey E: High-risk action creates ActionPassport and pauses run in AWAITING_APPROVAL."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, user_id = await register_user(client, "ApprovalUser")

        # Task mentioning booking/payment triggers action_request_approval
        res = await client.post(
            "/api/agents/runs",
            json={"task_description": "Book hotel in Bangalore under 10000 rupees"},
            headers=headers,
        )
        assert res.status_code == 201
        run = res.json()

        # Should be in AWAITING_APPROVAL because booking requires explicit authorization
        assert run["status"] == "AWAITING_APPROVAL"
        awaiting_steps = [s for s in run["steps"] if s["status"] == "AWAITING_APPROVAL"]
        assert len(awaiting_steps) >= 1
        passport_id = awaiting_steps[0]["action_passport_id"]
        assert passport_id is not None

        # Verify passport is in PENDING_APPROVAL in the actions database
        actions_res = await client.get("/api/actions", headers=headers)
        assert actions_res.status_code == 200
        passports = actions_res.json()
        target_passport = next((p for p in passports if p["id"] == passport_id), None)
        assert target_passport is not None
        assert target_passport["status"] == "PENDING_APPROVAL"

        # Rechecking a pending run must not create a second approval passport.
        execute_res = await client.post(f"/api/agents/runs/{run['id']}/execute", headers=headers)
        assert execute_res.status_code == 200
        assert execute_res.json()["status"] == "AWAITING_APPROVAL"
        passports_after = (await client.get("/api/actions", headers=headers)).json()
        assert sum(item["id"] == passport_id for item in passports_after) == 1

        # Approving the passport does NOT mark work as executed or verified!
        appr_res = await client.post(
            f"/api/actions/{passport_id}/decision",
            json={"decision": "APPROVE", "notes": "Approved by user in test"},
            headers=headers,
        )
        assert appr_res.status_code == 200
        assert appr_res.json()["status"] == "APPROVED"
        assert appr_res.json()["executed_at"] is None
        assert "APPROVED_NOT_EXECUTED" in appr_res.json()["execution_result"]["status"]

        # Resume can record the approval decision, but no handler executes a booking.
        resume_res = await client.post(f"/api/agents/runs/{run['id']}/resume", headers=headers)
        assert resume_res.status_code == 200
        resumed = resume_res.json()
        assert resumed["status"] == "BLOCKED"
        blocked = next(step for step in resumed["steps"] if step["action_passport_id"] == passport_id)
        assert blocked["status"] == "SKIPPED"
        assert "no external action was executed" in blocked["error_message"]


@pytest.mark.asyncio
async def test_agent_pause_cancel_resume():
    """Verify pause, cancel, and resume state transitions and preservation of completed work."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, user_id = await register_user(client, "ControlUser")

        # Submit task that requires approval, so it halts in AWAITING_APPROVAL
        res = await client.post(
            "/api/agents/runs",
            json={"task_description": "Book flights and hotel for holiday in Goa"},
            headers=headers,
        )
        assert res.status_code == 201
        run = res.json()
        run_id = run["id"]
        assert run["status"] == "AWAITING_APPROVAL"

        # Cancel the awaiting run
        cancel_res = await client.post(f"/api/agents/runs/{run_id}/cancel", headers=headers)
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "CANCELLED"

        # Verify completed steps are preserved while awaiting steps are marked CANCELLED
        detail = cancel_res.json()
        for step in detail["steps"]:
            assert step["status"] in ("COMPLETED", "CANCELLED")


@pytest.mark.asyncio
async def test_agent_isolation_and_security():
    """Journey F: User B cannot access, pause, cancel, or resume User A's agent runs."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers_a, _ = await register_user(client, "User A")
        headers_b, _ = await register_user(client, "User B")

        res_a = await client.post(
            "/api/agents/runs",
            json={"task_description": "Secret project run"},
            headers=headers_a,
        )
        run_id = res_a.json()["id"]

        # User B gets 404 for User A's run
        get_b = await client.get(f"/api/agents/runs/{run_id}", headers=headers_b)
        assert get_b.status_code == 404

        # User B cannot cancel User A's run
        cancel_b = await client.post(f"/api/agents/runs/{run_id}/cancel", headers=headers_b)
        assert cancel_b.status_code == 400 or cancel_b.status_code == 404
