import pytest
from httpx import AsyncClient, ASGITransport
from lifeos.main import app
from lifeos.core.database import init_db


@pytest.mark.asyncio
async def test_health_and_demo_flow():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "HEALTHY"

        # 2. Seed flagship demo
        seed_res = await client.post("/api/demo/seed")
        assert seed_res.status_code == 200
        assert "Move to Bangalore" in seed_res.json()["message"]

        # 3. List missions
        missions_res = await client.get("/api/missions")
        assert missions_res.status_code == 200
        missions = missions_res.json()
        assert len(missions) >= 1
        assert "Bangalore" in missions[0]["title"]

        # 4. List commitments
        commitments_res = await client.get("/api/commitments")
        assert commitments_res.status_code == 200
        commitments = commitments_res.json()
        assert len(commitments) >= 4

        # 5. Blind spots
        blind_res = await client.get("/api/intents/blind-spots")
        assert blind_res.status_code == 200
        assert blind_res.json()["total_found"] > 0

        # 6. Resolve day
        day_res = await client.get("/api/intents/resolve-day")
        assert day_res.status_code == 200
        assert len(day_res.json()["schedule"]) > 0

        # 7. Action Passports & Approval
        actions_res = await client.get("/api/actions")
        assert actions_res.status_code == 200
        actions = actions_res.json()
        assert len(actions) >= 1
        passport_id = actions[0]["id"]

        # Approve Action Passport
        approval_res = await client.post(f"/api/actions/{passport_id}/decision", json={"decision": "APPROVE"})
        assert approval_res.status_code == 200
        assert approval_res.json()["status"] == "VERIFIED"
        assert approval_res.json()["verification_record"]["status"] == "VERIFIED_SUCCESSFUL"
