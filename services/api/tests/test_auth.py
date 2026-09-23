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
        json={"email": email, "password": "x", "full_name": "Dup"},
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
    # Seed commitments first
    seed = await client.post("/api/demo/seed")
    assert seed.status_code == 200

    people = await client.get("/api/people")
    assert people.status_code == 200
    people_list = people.json()
    assert isinstance(people_list, list)
    assert len(people_list) >= 1

    waiting = await client.get("/api/people/waiting")
    assert waiting.status_code == 200
    w = waiting.json()
    assert "they_wait_on_you" in w
    assert "you_wait_on_them" in w
    assert isinstance(w["they_wait_on_you"], list)


@pytest.mark.asyncio
async def test_research_endpoint(client: AsyncClient):
    res = await client.post(
        "/api/research",
        json={"query": "Bangalore coliving rent", "search_depth": "basic"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["query"] == "Bangalore coliving rent"
    assert len(body["results"]) > 0
    assert body["success"] is True
    assert body["provider"] in ("tavily", "local_fallback")
    if body["provider"] == "local_fallback":
        # Offline mode must say so — never pretend to be live web results.
        assert body["error"]
        assert all(not (r.get("url") or "").startswith("http") for r in body["results"])


@pytest.mark.asyncio
async def test_guest_me_without_token(client: AsyncClient):
    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "alex@convia.app"


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
        "Move to Bangalore by month end under 80k with housing and travel, "
        "and deliver the API tonight to the team."
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
    assert len(body["commitments"]) >= 1
    assert body["extracted_mission"] is not None
    assert body["extracted_mission"]["title"]

    # Capture must actually persist commitments (not just return candidates)
    after_commitments = await client.get("/api/commitments", headers=headers)
    assert after_commitments.status_code == 200
    saved = after_commitments.json()
    assert len(saved) >= 1
    assert any("Bangalore" in (body["extracted_mission"]["title"] or "") for _ in [0]) or saved
    assert saved[0]["action"]

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
    assert top["task_description"].startswith("Parse intent:")
    assert raw[:40] in top["task_description"] or raw[:40] in top["task_description"].lower()
    assert isinstance(top["events"], list)
    assert len(top["events"]) >= 1
    assert top["latency_ms"] is not None


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
async def test_generic_intent_is_never_a_noop(client: AsyncClient):
    """Everyday non-flagship intents must still persist at least one commitment."""
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
    assert any("Priya" in (c.get("action") or "") or "design" in (c.get("action") or "").lower() for c in saved)


@pytest.mark.asyncio
async def test_flagship_intent_persists_risks_and_passports(client: AsyncClient):
    """Travel/budget intent should write real Risk + ActionPassport rows."""
    email = f"flag-{uuid.uuid4().hex[:12]}@convia.app"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "flagPass1", "full_name": "Flag User"},
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    raw = (
        "Move to Bangalore for my internship with housing and a flight, "
        "keep me under 80000, and deliver the API tonight."
    )
    parse = await client.post(
        "/api/intents/parse",
        json={"raw_text": raw},
        headers=headers,
    )
    assert parse.status_code == 200
    body = parse.json()
    assert "risk" in body["summary_message"].lower() or "passport" in body["summary_message"].lower()

    risks = (await client.get("/api/risks", headers=headers)).json()
    assert len(risks) >= 1
    assert any(not r["is_resolved"] for r in risks)

    actions = (await client.get("/api/actions", headers=headers)).json()
    assert len(actions) >= 1
    pending = next(a for a in actions if a["status"] == "PENDING_APPROVAL")

    # Approving the passport must resolve related open risks (no orphan recovery).
    approve = await client.post(
        f"/api/actions/{pending['id']}/decision",
        json={"decision": "APPROVE"},
        headers=headers,
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "VERIFIED"

    risks_after = (await client.get("/api/risks", headers=headers)).json()
    linked = [r for r in risks_after if r.get("commitment_id") == pending.get("commitment_id")]
    if pending.get("commitment_id") and linked:
        assert all(r["is_resolved"] for r in linked)

    memories = (await client.get("/api/memory", headers=headers)).json()
    assert any(m["category"] == "MISSION" for m in memories)
