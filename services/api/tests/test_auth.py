import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from lifeos.main import app
from lifeos.core.database import init_db


@pytest.fixture
async def client():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_register_login_me(client: AsyncClient):
    email = f"test-{uuid.uuid4().hex[:12]}@convia.app"
    # Register
    res = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "s3curePass!", "full_name": "Test User"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["email"] == email
    token = body["access_token"]

    # Duplicate register rejected
    dup = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "s3curePass!", "full_name": "Dup"},
    )
    assert dup.status_code == 400

    # Login
    login = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "s3curePass!"},
    )
    assert login.status_code == 200
    login_token = login.json()["access_token"]
    assert login_token

    # Bad password
    bad = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "wrong"},
    )
    assert bad.status_code == 401

    # GET /me with token
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["full_name"] == "Test User"


@pytest.mark.asyncio
async def test_patch_settings(client: AsyncClient):
    email = f"settings-{uuid.uuid4().hex[:12]}@convia.app"
    res = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "pass1234", "full_name": "Settings User"},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    patch = await client.patch(
        "/api/auth/me",
        json={"autonomy_level": 3, "voice_enabled": False, "full_name": "Renamed"},
        headers=headers,
    )
    assert patch.status_code == 200
    updated = patch.json()
    assert updated["autonomy_level"] == 3
    assert updated["voice_enabled"] is False
    assert updated["full_name"] == "Renamed"

    # Autonomy out of range rejected
    bad = await client.patch(
        "/api/auth/me",
        json={"autonomy_level": 99},
        headers=headers,
    )
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_people_and_waiting(client: AsyncClient):
    registered = await client.post(
        "/api/auth/register",
        json={"email": f"people-{uuid.uuid4().hex[:12]}@convia.app", "password": "peoplePass1", "full_name": "People User"},
    )
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    # Seed commitments first
    seed = await client.post("/api/demo/seed", headers=headers)
    assert seed.status_code == 200

    people = await client.get("/api/people", headers=headers)
    assert people.status_code == 200
    people_list = people.json()
    assert isinstance(people_list, list)
    assert len(people_list) >= 1

    waiting = await client.get("/api/people/waiting", headers=headers)
    assert waiting.status_code == 200
    w = waiting.json()
    assert "they_wait_on_you" in w
    assert "you_wait_on_them" in w
    assert isinstance(w["they_wait_on_you"], list)


@pytest.mark.asyncio
async def test_research_endpoint_is_honest_without_credentials(client: AsyncClient, monkeypatch):
    from lifeos.core.config import settings
    registered = await client.post(
        "/api/auth/register",
        json={"email": f"research-{uuid.uuid4().hex[:12]}@convia.app", "password": "researchPass1", "full_name": "Research User"},
    )
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    monkeypatch.setattr(settings, "TAVILY_API_KEY", None)
    res = await client.post(
        "/api/research",
        json={"query": "Bangalore coliving rent", "search_depth": "basic"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["query"] == "Bangalore coliving rent"
    assert body["results"] == []
    assert body["success"] is False
    assert body["provider"] == "unavailable"
    assert "not configured" in body["error"].lower()


@pytest.mark.asyncio
async def test_protected_routes_require_a_valid_token(client: AsyncClient):
    me = await client.get("/api/auth/me")
    assert me.status_code == 401
    missions = await client.get("/api/missions")
    assert missions.status_code == 401
    stream = await client.get("/api/activity/stream")
    assert stream.status_code == 401
    invalid = await client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"})
    assert invalid.status_code == 401


@pytest.mark.asyncio
async def test_user_owned_records_are_isolated(client: AsyncClient):
    first = await client.post(
        "/api/auth/register",
        json={"email": f"owner-{uuid.uuid4().hex[:12]}@convia.app", "password": "ownerPass1", "full_name": "Owner"},
    )
    second = await client.post(
        "/api/auth/register",
        json={"email": f"other-{uuid.uuid4().hex[:12]}@convia.app", "password": "otherPass1", "full_name": "Other"},
    )
    owner_headers = {"Authorization": f"Bearer {first.json()['access_token']}"}
    other_headers = {"Authorization": f"Bearer {second.json()['access_token']}"}
    mission = await client.post("/api/missions", json={"title": "Private mission"}, headers=owner_headers)
    assert mission.status_code == 200
    mission_id = mission.json()["id"]

    other_missions = await client.get("/api/missions", headers=other_headers)
    assert other_missions.status_code == 200
    assert other_missions.json() == []
    hidden = await client.get(f"/api/missions/{mission_id}", headers=other_headers)
    assert hidden.status_code == 404

    foreign_memory = await client.post(
        "/api/memory",
        json={"content": "foreign link", "mission_id": mission_id},
        headers=other_headers,
    )
    assert foreign_memory.status_code == 404
    foreign_commitment = await client.post(
        "/api/commitments",
        json={"action": "foreign link", "mission_id": mission_id},
        headers=other_headers,
    )
    assert foreign_commitment.status_code == 404


@pytest.mark.asyncio
async def test_mission_graph_rejects_cross_mission_edges_and_cycles(client: AsyncClient):
    registered = await client.post(
        "/api/auth/register",
        json={"email": f"graph-{uuid.uuid4().hex[:12]}@convia.app", "password": "graphPass1", "full_name": "Graph User"},
    )
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    bad_reference = await client.post(
        "/api/missions",
        headers=headers,
        json={
            "title": "Broken graph",
            "nodes": [{"client_id": "a", "title": "Task A"}],
            "edges": [{"source_node_id": "a", "target_node_id": "foreign"}],
        },
    )
    assert bad_reference.status_code == 422

    cycle = await client.post(
        "/api/missions",
        headers=headers,
        json={
            "title": "Cyclic graph",
            "nodes": [{"client_id": "a", "title": "Task A"}, {"client_id": "b", "title": "Task B"}],
            "edges": [
                {"source_node_id": "a", "target_node_id": "b"},
                {"source_node_id": "b", "target_node_id": "a"},
            ],
        },
    )
    assert cycle.status_code == 422


@pytest.mark.asyncio
async def test_intent_parse_records_agent_run(client: AsyncClient):
    # Unique guest-ish user via register so runs are isolated
    email = f"runs-{uuid.uuid4().hex[:12]}@convia.app"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "runPass1", "full_name": "Run User"},
    )
    assert reg.status_code == 200
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fresh user should have no seeded fake runs
    before = await client.get("/api/agents/runs", headers=headers)
    assert before.status_code == 200
    assert before.json() == []

    # Nothing captured yet
    empty = await client.get("/api/commitments", headers=headers)
    assert empty.status_code == 200
    assert empty.json() == []

    raw = (
        "I promised the engineering team I would deliver the API by tonight; "
        "I also plan to move to Bangalore by month end under 80k with housing and travel."
    )
    parse = await client.post(
        "/api/intents/parse",
        json={"raw_text": raw},
        headers=headers,
    )
    assert parse.status_code == 200
    body = parse.json()
    assert body["recognized_intent"] == "MISSION_AND_COMMITMENT_EXTRACTION"
    assert isinstance(body["commitments"], list)
    assert len(body["commitments"]) == 1
    assert body["commitments"][0]["suggested_for_confirmation"] is True
    assert body["extracted_mission"] is not None
    assert body["extracted_mission"]["title"]

    # Capture must actually persist commitments (not just return candidates)
    after_commitments = await client.get("/api/commitments", headers=headers)
    assert after_commitments.status_code == 200
    saved = after_commitments.json()
    assert len(saved) >= 1
    assert "Bangalore" in body["extracted_mission"]["title"]
    assert saved[0]["action"]
    assert saved[0]["status"] == "PENDING_CONFIRMATION"

    # Mission graph available for the extracted mission
    missions = await client.get("/api/missions", headers=headers)
    assert missions.status_code == 200
    mission_list = missions.json()
    assert len(mission_list) >= 1

    # Real telemetry row recorded for this intent
    after = await client.get("/api/agents/runs", headers=headers)
    assert after.status_code == 200
    runs = after.json()
    assert len(runs) >= 1
    top = runs[0]
    assert top["agent_type"] == "ORCHESTRATOR"
    assert top["status"] == "COMPLETED"
    assert top["task_description"].startswith("Parse intent (")
    assert raw not in top["task_description"]
    assert isinstance(top["events"], list)
    assert len(top["events"]) >= 1
    assert top["latency_ms"] is not None


@pytest.mark.asyncio
async def test_conversation_messages_persist_and_are_user_scoped(client: AsyncClient):
    first = await client.post(
        "/api/auth/register",
        json={
            "email": f"conversation-{uuid.uuid4().hex[:12]}@convia.app",
            "password": "conversationPass1",
            "full_name": "Conversation Owner",
        },
    )
    assert first.status_code == 200
    owner_headers = {"Authorization": f"Bearer {first.json()['access_token']}"}

    captured = await client.post(
        "/api/intents/parse",
        json={"raw_text": "I promised to send the budget summary by Friday."},
        headers=owner_headers,
    )
    assert captured.status_code == 200
    conversation_id = captured.json()["conversation_id"]

    detail = await client.get(f"/api/conversations/{conversation_id}", headers=owner_headers)
    assert detail.status_code == 200
    assert [message["role"] for message in detail.json()["messages"]] == ["USER", "ASSISTANT"]
    assert "budget summary" in detail.json()["messages"][0]["content"]
    assert detail.json()["messages"][1]["metadata_json"]["model_used"] == "local-deterministic"

    listed = await client.get("/api/conversations", headers=owner_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["message_count"] == 2

    second = await client.post(
        "/api/auth/register",
        json={
            "email": f"conversation-other-{uuid.uuid4().hex[:12]}@convia.app",
            "password": "conversationPass1",
            "full_name": "Other User",
        },
    )
    assert second.status_code == 200
    other_headers = {"Authorization": f"Bearer {second.json()['access_token']}"}
    hidden = await client.get(f"/api/conversations/{conversation_id}", headers=other_headers)
    assert hidden.status_code == 404

    rejected = await client.post(
        "/api/intents/parse",
        json={"raw_text": "I will keep working on this", "conversation_id": conversation_id},
        headers=other_headers,
    )
    assert rejected.status_code == 404

    deleted = await client.delete(f"/api/conversations/{conversation_id}", headers=owner_headers)
    assert deleted.status_code == 204
    assert (await client.get(f"/api/conversations/{conversation_id}", headers=owner_headers)).status_code == 404


@pytest.mark.asyncio
async def test_memories_start_empty_for_new_user(client: AsyncClient):
    """Fresh accounts must not receive auto-seeded demo memories."""
    email = f"mem-{uuid.uuid4().hex[:12]}@convia.app"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "memPass1", "full_name": "Mem User"},
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    memories = await client.get("/api/memory", headers=headers)
    assert memories.status_code == 200
    assert memories.json() == []


@pytest.mark.asyncio
async def test_calendar_and_email_tools_fail_honestly(client: AsyncClient):
    """Unwired tools must fail instead of claiming fake success."""
    from lifeos.tools.calendar_tool import calendar_tool, email_tool

    cal = await calendar_tool.execute(
        action="schedule_block", title="Deep work", start_time="2026-09-25T20:00:00"
    )
    assert cal.success is False
    assert "Coming Soon" in cal.error or "not connected" in cal.error.lower()
    assert "event_id" not in cal.data or cal.data.get("status") == "COMING_SOON"

    mail = await email_tool.execute(
        action="send", recipient="team@example.com", subject="Update", body="Hello"
    )
    assert mail.success is False
    assert "Coming Soon" in mail.error or "not connected" in mail.error.lower()
    assert mail.data.get("status") == "COMING_SOON"


@pytest.mark.asyncio
async def test_generic_intent_captures_only_explicit_obligations(client: AsyncClient):
    email = f"generic-{uuid.uuid4().hex[:12]}@convia.app"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "genPass1", "full_name": "Generic User"},
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    raw = "I promised Priya I would send the design review notes by Friday."
    parse = await client.post(
        "/api/intents/parse",
        json={"raw_text": raw},
        headers=headers,
    )
    assert parse.status_code == 200
    body = parse.json()
    assert len(body["commitments"]) >= 1
    assert body["extracted_mission"] is not None
    # Generic intent must not invent the Bangalore flagship mission.
    assert "Bangalore" not in (body["extracted_mission"]["title"] or "")

    saved = (await client.get("/api/commitments", headers=headers)).json()
    assert len(saved) >= 1
    assert saved[0]["status"] == "PENDING_CONFIRMATION"
    assert any("Priya" in (c.get("action") or "") or "design" in (c.get("action") or "").lower() for c in saved)


@pytest.mark.asyncio
async def test_intent_does_not_invent_live_fares_or_external_approvals(client: AsyncClient):
    email = f"flag-{uuid.uuid4().hex[:12]}@convia.app"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "flagPass1", "full_name": "Flag User"},
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    raw = "I promised my team I would deliver the API by tonight. I plan to move to Bangalore for my internship with housing and a flight."
    parse = await client.post(
        "/api/intents/parse",
        json={"raw_text": raw},
        headers=headers,
    )
    assert parse.status_code == 200
    body = parse.json()
    assert "captured" in body["summary_message"].lower()

    risks = (await client.get("/api/risks", headers=headers)).json()
    assert len(risks) == 1
    assert "deadline" in risks[0]["title"].lower()
    assert "flight fare" not in risks[0]["title"].lower()

    actions = (await client.get("/api/actions", headers=headers)).json()
    assert actions == []

    memories = (await client.get("/api/memory", headers=headers)).json()
    assert any(m["category"] == "MISSION" for m in memories)
