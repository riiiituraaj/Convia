import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from lifeos.main import app
from lifeos.core.database import init_db
from lifeos.ai.provider import nemotron_provider


async def register_user(client: AsyncClient, name: str = "User") -> tuple[dict[str, str], str]:
    email = f"user-{uuid.uuid4().hex[:10]}@convia.app"
    res = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123!", "full_name": name},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    user_id = res.json()["user_id"]
    return {"Authorization": f"Bearer {token}"}, user_id


@pytest.mark.asyncio
async def test_multiturn_conversational_context_retention():
    """Journey A: Multi-turn conversation retains constraints without forcing restatement."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, user_id = await register_user(client, "Traveler")

        # 1. Create a new conversation
        create_res = await client.post("/api/conversations", json={"title": "Trip Planning"}, headers=headers)
        assert create_res.status_code == 201
        conv_id = create_res.json()["id"]

        # 2. Turn 1: Destination and headcount
        turn1 = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"content": "I am planning a trip to Shillong for two people."},
            headers=headers,
        )
        assert turn1.status_code == 200
        data1 = turn1.json()
        assert data1["user_message"]["content"] == "I am planning a trip to Shillong for two people."
        assert data1["assistant_message"]["status"] == "COMPLETED"
        assert data1["active_constraints"]["destination"] == "Shillong"
        assert data1["active_constraints"]["headcount"] == 2

        # 3. Turn 2: Budget constraint
        turn2 = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Keep the total budget under ₹10,000."},
            headers=headers,
        )
        assert turn2.status_code == 200
        data2 = turn2.json()
        # Retains Turn 1 constraints AND captures budget!
        assert data2["active_constraints"]["destination"] == "Shillong"
        assert data2["active_constraints"]["headcount"] == 2
        assert data2["active_constraints"]["budget_limit"] == 10000.0

        # 4. Turn 3: Duration / hotel
        turn3 = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Find a hotel for two nights."},
            headers=headers,
        )
        assert turn3.status_code == 200
        data3 = turn3.json()
        # All accumulated constraints are preserved
        assert data3["active_constraints"]["destination"] == "Shillong"
        assert data3["active_constraints"]["headcount"] == 2
        assert data3["active_constraints"]["budget_limit"] == 10000.0
        assert data3["active_constraints"]["duration"] == 2

        # 5. Check context preview diagnostics
        preview = await client.get(f"/api/conversations/{conv_id}/context-preview", headers=headers)
        assert preview.status_code == 200
        preview_data = preview.json()
        assert preview_data["conversation_id"] == conv_id
        assert preview_data["history_message_count"] == 6  # 3 user + 3 assistant
        assert preview_data["active_constraints"]["destination"] == "Shillong"
        assert "conversation_history" in preview_data["categories_present"]

        # 6. Reopen conversation and verify full message trail
        get_res = await client.get(f"/api/conversations/{conv_id}", headers=headers)
        assert get_res.status_code == 200
        conv_detail = get_res.json()
        assert len(conv_detail["messages"]) == 6
        assert conv_detail["messages"][0]["role"] == "USER"
        assert conv_detail["messages"][1]["role"] == "ASSISTANT"


@pytest.mark.asyncio
async def test_saved_user_turn_is_sent_to_model_once(monkeypatch):
    """The latest turn is persisted before context assembly and must not be appended twice."""
    await init_db()
    captured = {}

    async def configured_health():
        return {"configured": True, "status": "CONFIGURED"}

    async def capture_prompt(prompt, system_prompt, temperature):
        captured["prompt"] = prompt
        return {"content": "Got it.", "model_used": "test-model"}

    monkeypatch.setattr(nemotron_provider, "health_check", configured_health)
    monkeypatch.setattr(nemotron_provider, "generate", capture_prompt)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, _ = await register_user(client, "PromptOnce")
        created = await client.post("/api/conversations", json={"title": "Prompt"}, headers=headers)
        conversation_id = created.json()["id"]
        text = "Remember this one exact turn for the prompt."
        response = await client.post(
            f"/api/conversations/{conversation_id}/messages",
            json={"content": text, "client_message_id": "prompt-once-001"},
            headers=headers,
        )
        assert response.status_code == 200
        assert captured["prompt"].count(f"USER: {text}") == 1
        repeated = await client.post(
            f"/api/conversations/{conversation_id}/messages",
            json={"content": text, "client_message_id": "prompt-once-001"},
            headers=headers,
        )
        assert repeated.status_code == 200
        assert repeated.json()["user_message"]["id"] == response.json()["user_message"]["id"]
        assert repeated.json()["assistant_message"]["id"] == response.json()["assistant_message"]["id"]
        assert captured["prompt"].count(f"USER: {text}") == 1


@pytest.mark.asyncio
async def test_conversation_ownership_isolation():
    """Journey F: User B cannot access or send messages to User A's conversation."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers_a, _ = await register_user(client, "User A")
        headers_b, _ = await register_user(client, "User B")

        # User A creates conversation
        res_a = await client.post("/api/conversations", json={"title": "Private Conv A"}, headers=headers_a)
        conv_id = res_a.json()["id"]

        # User B tries to get conversation
        get_b = await client.get(f"/api/conversations/{conv_id}", headers=headers_b)
        assert get_b.status_code == 404

        # User B tries to post message to User A's conversation
        post_b = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Malicious intrusion"},
            headers=headers_b,
        )
        assert post_b.status_code == 404

        # User B tries to view context diagnostics of User A's conversation
        diag_b = await client.get(f"/api/conversations/{conv_id}/context-preview", headers=headers_b)
        assert diag_b.status_code == 404


@pytest.mark.asyncio
async def test_long_conversation_truncation_and_summary():
    """Verify long conversation management summarizes older turns while preserving constraints."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, _ = await register_user(client, "LongChatUser")

        create_res = await client.post("/api/conversations", json={"title": "Long Chat"}, headers=headers)
        conv_id = create_res.json()["id"]

        # First message sets destination
        await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Trip to Shillong with budget under 50000"},
            headers=headers,
        )

        # Send 11 more messages to exceed default recent window (10 messages = 5 turns)
        for i in range(11):
            await client.post(
                f"/api/conversations/{conv_id}/messages",
                json={"content": f"Follow-up requirement number {i}"},
                headers=headers,
            )

        # Context preview should show truncation and summary applied
        preview = await client.get(f"/api/conversations/{conv_id}/context-preview", headers=headers)
        assert preview.status_code == 200
        pdata = preview.json()
        assert pdata["truncated"] is True
        assert pdata["summary_applied"] is True
        # Original constraints from turn 1 must STILL be preserved!
        assert pdata["active_constraints"]["destination"] == "Shillong"
        assert pdata["active_constraints"]["budget_limit"] == 50000.0


@pytest.mark.asyncio
async def test_relevant_commitments_and_missions_in_context():
    """Verify saved commitments and missions matching query are included in context preview."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, _ = await register_user(client, "MissionUser")

        # 1. Create a commitment and mission
        await client.post(
            "/api/commitments",
            json={"action": "Book Shillong homestay near police bazar", "priority": "HIGH"},
            headers=headers,
        )
        await client.post(
            "/api/missions",
            json={"title": "Northeast India Exploration", "desired_outcome": "Complete Meghalaya circuit"},
            headers=headers,
        )

        # 2. Create conversation asking about Shillong
        res = await client.post("/api/conversations", json={"title": "Meghalaya Trip"}, headers=headers)
        conv_id = res.json()["id"]

        preview = await client.get(f"/api/conversations/{conv_id}/context-preview?query=Shillong", headers=headers)
        assert preview.status_code == 200
        pdata = preview.json()
        categories = pdata["categories_present"]
        assert "commitments" in categories or "missions" in categories
        # Verify no secret is leaked in snippets
        for item in pdata["items"]:
            assert "password" not in item["snippet"].lower()
            assert "secret" not in item["snippet"].lower()


@pytest.mark.asyncio
async def test_context_uses_only_matching_user_visible_memories():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, _ = await register_user(client, "ContextMemory")
        visible = await client.post(
            "/api/memory",
            json={"content": "Prefers quiet hotels near walking trails.", "user_visible": True},
            headers=headers,
        )
        hidden = await client.post(
            "/api/memory",
            json={"content": "Hidden hotel preference data.", "user_visible": False},
            headers=headers,
        )
        conv = await client.post("/api/conversations", json={"title": "Stay"}, headers=headers)
        preview = await client.get(
            f"/api/conversations/{conv.json()['id']}/context-preview?query=quiet%20hotels",
            headers=headers,
        )
        assert preview.status_code == 200
        memory_items = [item for item in preview.json()["items"] if item["category"] == "memories"]
        assert any(item["source_id"] == visible.json()["id"] for item in memory_items)
        assert all(item["source_id"] != hidden.json()["id"] for item in memory_items)

