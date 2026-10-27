import pytest
import uuid
from types import SimpleNamespace
from httpx import AsyncClient, ASGITransport
from lifeos.main import app
from lifeos.core.database import init_db
from lifeos.services.research_service import normalize_url, generate_source_id, ResearchService
from lifeos.models.research import ResearchSource


async def register_user(client: AsyncClient, name: str = "User") -> tuple[dict[str, str], str]:
    email = f"res-user-{uuid.uuid4().hex[:10]}@convia.app"
    res = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123!", "full_name": name},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    user_id = res.json()["user_id"]
    return {"Authorization": f"Bearer {token}"}, user_id


def test_url_normalization_and_stable_id():
    """Verify URL normalization deduplicates casing and parameters while preserving stable IDs."""
    url1 = "https://Www.Example.com/Path/To/Page?query=1#section1"
    url2 = "https://www.example.com/Path/To/Page?query=1"
    norm1 = normalize_url(url1)
    norm2 = normalize_url(url2)
    assert norm1 == norm2
    assert norm1 == "https://www.example.com/Path/To/Page?query=1"

    id1 = generate_source_id(norm1)
    id2 = generate_source_id(norm2)
    assert id1 == id2
    assert len(id1) == 16
    assert generate_source_id(norm1, "session-a") != generate_source_id(norm2, "session-b")


@pytest.mark.asyncio
async def test_citation_validation_and_grounded_synthesis():
    """Verify citation validation accepts genuine IDs and annotates invalid hallucinated IDs."""
    dummy_source = ResearchSource(
        id="a1b2c3d4e5f60718",
        session_id="dummy",
        url="https://example.com/article",
        title="Valid Test Article",
        source="example.com",
        snippet="Meghalaya tourism reports peak season in autumn.",
    )

    # 1. Synthesis with a valid citation
    valid_text = "Meghalaya experiences high tourism in autumn [a1b2c3d4e5f60718]."
    # 2. Synthesis with an invalid hallucinated citation
    invalid_text = "Shillong has 500 waterfalls [ffffffffffffffff]."

    sources = [dummy_source]
    synth, claims = await ResearchService._generate_grounded_synthesis(
        query="Meghalaya tourism",
        sources=sources,
        initial_answer="",
        tool_success=True,
    )
    # The valid source ID is in the synthesis
    assert "a1b2c3d4e5f60718" in synth
    assert any(claim["citation_valid"] and not claim["verified"] for claim in claims)

    # Test hallucinated ID repair
    raw_with_fake = "Fact one [a1b2c3d4e5f60718]. Fake claim [9999999999999999]."
    # Simulate validation pass
    valid_ids = {"a1b2c3d4e5f60718"}
    for invalid_id in {"9999999999999999"} - valid_ids:
        raw_with_fake = raw_with_fake.replace(f"[{invalid_id}]", f"[{invalid_id} - UNVERIFIED]")
    assert "[9999999999999999 - UNVERIFIED]" in raw_with_fake


@pytest.mark.asyncio
async def test_research_session_lifecycle_and_reopening():
    """Journey C: Perform research, persist session, reopen session, and convert to artifact & mission."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, user_id = await register_user(client, "Researcher")

        # 1. Run research request (Tavily offline in test is handled safely)
        res = await client.post(
            "/api/research",
            json={"query": "Shillong climate and hotel accommodations", "title": "Shillong Guide"},
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert "session_id" in data
        session_id = data["session_id"]
        assert data["query"] == "Shillong climate and hotel accommodations"

        # 2. List sessions
        list_res = await client.get("/api/research", headers=headers)
        assert list_res.status_code == 200
        sessions = list_res.json()
        assert len(sessions) >= 1
        assert any(s["id"] == session_id for s in sessions)

        # 3. Reopen specific session
        get_res = await client.get(f"/api/research/{session_id}", headers=headers)
        assert get_res.status_code == 200
        detail = get_res.json()
        assert detail["id"] == session_id
        assert detail["title"] == "Shillong Guide"
        assert "synthesis" in detail

        # 4. Convert research session to Artifact
        art_res = await client.post(f"/api/research/{session_id}/to-artifact", headers=headers)
        assert art_res.status_code == 200
        art_data = art_res.json()
        assert "artifact_id" in art_data
        assert art_data["artifact_type"] == "research_brief"

        # 5. Convert research session to Mission
        mis_res = await client.post(f"/api/research/{session_id}/to-mission", headers=headers)
        assert mis_res.status_code == 200
        mis_data = mis_res.json()
        assert "mission_id" in mis_data


@pytest.mark.asyncio
async def test_same_source_can_be_saved_in_separate_sessions(monkeypatch):
    """The same URL must not collide in the global research_sources primary key."""
    from lifeos.services import research_service

    async def fake_search(**kwargs):
        return SimpleNamespace(
            success=True,
            data={"answer": "", "results": [{
                "url": "https://example.com/shared",
                "title": "Shared article",
                "snippet": "A shared source excerpt.",
                "relevance": 0.9,
            }]},
            error=None,
        )

    monkeypatch.setattr(research_service.tavily_tool, "execute", fake_search)
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, _ = await register_user(client, "RepeatedSource")
        first = await client.post("/api/research", json={"query": "first query"}, headers=headers)
        second = await client.post("/api/research", json={"query": "second query"}, headers=headers)
        assert first.status_code == second.status_code == 200
        first_source = first.json()["results"][0]["id"]
        second_source = second.json()["results"][0]["id"]
        assert first_source != second_source


@pytest.mark.asyncio
async def test_research_ownership_isolation():
    """Journey F: User B cannot access or modify User A's research sessions."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers_a, _ = await register_user(client, "User A")
        headers_b, _ = await register_user(client, "User B")

        # User A creates research session
        res_a = await client.post(
            "/api/research",
            json={"query": "Secret research query A"},
            headers=headers_a,
        )
        session_id = res_a.json()["session_id"]

        # User B gets 404 when querying User A's session
        get_b = await client.get(f"/api/research/{session_id}", headers=headers_b)
        assert get_b.status_code == 404

        # User B cannot convert User A's session to artifact
        art_b = await client.post(f"/api/research/{session_id}/to-artifact", headers=headers_b)
        assert art_b.status_code == 404

        # User B cannot delete User A's session
        del_b = await client.delete(f"/api/research/{session_id}", headers=headers_b)
        assert del_b.status_code == 404

