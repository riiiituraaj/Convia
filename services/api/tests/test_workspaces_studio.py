import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from lifeos.core.database import init_db
from lifeos.main import app


async def _user(client: AsyncClient) -> dict[str, str]:
    email = f"workspace-{uuid.uuid4().hex[:12]}@convia.app"
    response = await client.post("/api/auth/register", json={"email": email, "password": "password123!", "full_name": "Workspace User"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.asyncio
async def test_context_packs_are_scoped_and_resume_only_attached_data():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        owner = await _user(client)
        other = await _user(client)
        artifact = await client.post("/api/artifacts", headers=owner, json={"title": "Project note", "artifact_type": "task_plan", "content": "Review access controls."})
        assert artifact.status_code == 201
        pack = await client.post("/api/context-packs", headers=owner, json={
            "title": "Project alpha", "objective": "Review the plan", "facts_json": [{"text": "Kickoff approved", "provenance": "user-entered"}],
            "constraints_json": ["No external email"], "resource_refs_json": {"artifacts": [artifact.json()["id"]]},
        })
        assert pack.status_code == 201
        pack_id = pack.json()["id"]
        resumed = await client.get(f"/api/context-packs/{pack_id}/context", headers=owner)
        assert resumed.status_code == 200
        assert resumed.json()["resources"][0]["title"] == "Project note"
        assert (await client.get(f"/api/context-packs/{pack_id}/context", headers=other)).status_code == 404

        rejected = await client.post("/api/context-packs", headers=other, json={"title": "Cross-account", "resource_refs_json": {"artifacts": [artifact.json()["id"]]}})
        assert rejected.status_code == 404

        await client.delete(f"/api/artifacts/{artifact.json()['id']}", headers=owner)
        resumed_after_delete = await client.get(f"/api/context-packs/{pack_id}/context", headers=owner)
        assert resumed_after_delete.status_code == 200
        assert resumed_after_delete.json()["resources"] == []
        assert resumed_after_delete.json()["missing_references"]


@pytest.mark.asyncio
async def test_knowledge_provenance_search_and_personal_briefing():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        owner = await _user(client)
        other = await _user(client)
        artifact = await client.post("/api/artifacts", headers=owner, json={"title": "Evidence", "artifact_type": "evidence_report", "content": "A saved conclusion."})
        assert artifact.status_code == 201
        entry = await client.post("/api/knowledge", headers=owner, json={
            "title": "Decision record", "content": "Prefer the lower-cost option.", "entry_type": "DECISION", "collection": "Project",
            "provenance_json": [{"type": "artifacts", "id": artifact.json()["id"], "label": "Evidence"}],
        })
        assert entry.status_code == 201
        found = await client.get("/api/knowledge?q=lower-cost", headers=owner)
        assert found.status_code == 200 and len(found.json()) == 1
        assert (await client.get("/api/knowledge?q=lower-cost", headers=other)).json() == []

        fake_ref = await client.post("/api/knowledge", headers=owner, json={"title": "Bad provenance", "content": "note", "provenance_json": [{"type": "artifacts", "id": "not-owned"}]})
        assert fake_ref.status_code == 404
        briefing = await client.get("/api/briefing", headers=owner)
        assert briefing.status_code == 200
        assert "missions" in briefing.json() and "commitments" in briefing.json()


@pytest.mark.asyncio
async def test_studio_outputs_csv_profile_and_playbook_tool_validation():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        owner = await _user(client)
        decision = await client.post("/api/studio/run", headers=owner, json={
            "task_type": "decision", "title": "Option scoring", "options": {
                "criteria": [{"name": "Cost", "weight": 2}, {"name": "Speed", "weight": 1}],
                "options": [{"name": "A", "scores": {"Cost": 10, "Speed": 4}}, {"name": "B", "scores": {"Cost": 4, "Speed": 10}}],
            },
        })
        assert decision.status_code == 200
        assert '"name": "A"' in decision.json()["content"]
        assert decision.json()["generated_by"] == "calculation"

        profile = await client.post("/api/studio/spreadsheet", headers=owner, json={"filename": "sales.csv", "csv_text": "item,amount\nA,10\nA,10\nB,15\n,20"})
        assert profile.status_code == 200
        assert profile.json()["row_count"] == 4
        assert profile.json()["duplicate_rows"] == 1
        assert profile.json()["columns"][1]["statistics"]["mean"] == 13.75

        meeting = await client.post("/api/studio/run", headers=owner, json={"task_type": "meeting", "title": "Meeting notes", "text": "Action: send the updated draft\nDecision: meet next week\nOpen question: who owns the review?"})
        assert meeting.status_code == 200
        assert "send the updated draft" in meeting.json()["content"]
        assert meeting.json()["status"] == "draft"
        converted = await client.post("/api/studio/meeting-to-mission", headers=owner, json={
            "artifact_id": meeting.json()["artifact_id"], "title": "Meeting follow-ups", "action_indexes": [0],
        })
        assert converted.status_code == 201
        assert converted.json()["commitments_created"] == 1
        commitments = await client.get("/api/commitments?filter_by=ALL", headers=owner)
        assert any(item["action"] == "send the updated draft" and item["status"] == "PLANNED" for item in commitments.json())

        playbook = await client.post("/api/playbooks", headers=owner, json={"name": "Research brief", "steps_json": [{"title": "Search sources", "action": "tavily_search"}]})
        assert playbook.status_code == 201
        invalid = await client.post("/api/playbooks", headers=owner, json={"name": "Pretend calendar", "steps_json": [{"title": "Send invite", "action": "calendar_send"}]})
        assert invalid.status_code == 422
