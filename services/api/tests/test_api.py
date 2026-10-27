import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from lifeos.main import app
from lifeos.core.database import init_db


async def register_user(client: AsyncClient) -> dict[str, str]:
    response = await client.post(
        "/api/auth/register",
        json={"email": f"api-{uuid.uuid4().hex}@convia.app", "password": "test-pass-123", "full_name": "API Test"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.asyncio
async def test_health_and_demo_flow():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = await register_user(client)
        # 1. Health check
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "HEALTHY"

        # 2. Seed flagship demo
        seed_res = await client.post("/api/demo/seed", headers=headers)
        assert seed_res.status_code == 200
        assert "Move to Bangalore" in seed_res.json()["message"]

        # 3. List missions
        missions_res = await client.get("/api/missions", headers=headers)
        assert missions_res.status_code == 200
        missions = missions_res.json()
        assert len(missions) >= 1
        assert "Bangalore" in missions[0]["title"]

        # 4. List commitments
        commitments_res = await client.get("/api/commitments", headers=headers)
        assert commitments_res.status_code == 200
        commitments = commitments_res.json()
        assert len(commitments) >= 4

        # 5. Blind spots
        blind_res = await client.get("/api/intents/blind-spots", headers=headers)
        assert blind_res.status_code == 200
        assert blind_res.json()["total_found"] > 0

        # 6. Resolve day
        day_res = await client.get("/api/intents/resolve-day", headers=headers)
        assert day_res.status_code == 200
        assert all(item["time_slot"] == "Unscheduled" for item in day_res.json()["schedule"])
        assert "UNSCHEDULED" in day_res.json()["continuity_status"] or "NO DUE ITEMS" in day_res.json()["continuity_status"]

        # 7. Action Passports & Approval
        actions_res = await client.get("/api/actions", headers=headers)
        assert actions_res.status_code == 200
        actions = actions_res.json()
        assert len(actions) >= 1
        passport_id = actions[0]["id"]

        # Approve Action Passport
        approval_res = await client.post(f"/api/actions/{passport_id}/decision", json={"decision": "APPROVE"}, headers=headers)
        assert approval_res.status_code == 200
        approved = approval_res.json()
        assert approved["status"] == "APPROVED"
        assert approved["execution_result"]["status"] == "APPROVED_NOT_EXECUTED"
        assert approved["verified_at"] is None

        duplicate = await client.post(f"/api/actions/{passport_id}/decision", json={"decision": "APPROVE"}, headers=headers)
        assert duplicate.status_code == 409

        # Loading demo data is non-destructive and only allowed on an empty account.
        repeat_seed = await client.post("/api/demo/seed", headers=headers)
        assert repeat_seed.status_code == 409
        assert len((await client.get("/api/missions", headers=headers)).json()) == 1

        # A saved conversation also counts as user data for demo safety.
        second_headers = await register_user(client)
        saved_conversation = await client.post(
            "/api/conversations",
            json={"title": "Existing private history"},
            headers=second_headers,
        )
        assert saved_conversation.status_code == 201
        conversation_id = saved_conversation.json()["id"]
        blocked_seed = await client.post("/api/demo/seed", headers=second_headers)
        assert blocked_seed.status_code == 409
        still_present = await client.get(f"/api/conversations/{conversation_id}", headers=second_headers)
        assert still_present.status_code == 200
        deleted_conversation = await client.delete(f"/api/conversations/{conversation_id}", headers=second_headers)
        assert deleted_conversation.status_code == 204
