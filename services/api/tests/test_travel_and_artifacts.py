import pytest
import uuid
from lifeos.travel.adapters import AmadeusTravelAdapter
from lifeos.travel.schemas import FlightSearchRequest
from httpx import AsyncClient, ASGITransport
from lifeos.main import app
from lifeos.core.database import init_db


async def register_user(client: AsyncClient, name: str = "User") -> tuple[dict[str, str], str]:
    email = f"art-user-{uuid.uuid4().hex[:10]}@convia.app"
    res = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123!", "full_name": name},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    user_id = res.json()["user_id"]
    return {"Authorization": f"Bearer {token}"}, user_id


@pytest.mark.asyncio
async def test_travel_provider_readiness_and_honest_disclosure():
    """Verify Section 9: Provider status is honest, live booking is not faked, official search links are provided."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers, _ = await register_user(client, "TravelExplorer")

        # 1. Travel provider status
        status_res = await client.get("/api/travel/status", headers=headers)
        assert status_res.status_code == 200
        st = status_res.json()
        assert st["live_booking_enabled"] is False  # unconfigured credentials
        assert "Illustrative fares are never shown" in st["policy"]
        assert "amadeus" in st["providers"]
        assert "duffel" in st["providers"]

        # 2. Flight search when provider is unconfigured
        flight_res = await client.post(
            "/api/travel/flights/search",
            json={
                "origin": "DEL",
                "destination": "SHL",
                "departure_date": "2026-11-15",
                "passengers": 2,
                "cabin_class": "ECONOMY",
            },
            headers=headers,
        )
        assert flight_res.status_code == 200
        f_data = flight_res.json()
        assert f_data["live_inventory_available"] is False
        assert f_data["configured"] is False
        assert len(f_data["offers"]) == 0  # Zero fake offers!
        assert len(f_data["official_search_links"]) >= 2
        # Verify official search links contain destination
        assert any("Google Flights" in link["provider_name"] for link in f_data["official_search_links"])
        assert any("SHL" in link["url"] or "DEL" in link["url"] for link in f_data["official_search_links"])

        # 3. Hotel search when provider is unconfigured
        hotel_res = await client.post(
            "/api/travel/hotels/search",
            json={
                "destination": "Shillong",
                "check_in_date": "2026-11-15",
                "check_out_date": "2026-11-17",
                "guests": 2,
                "rooms": 1,
            },
            headers=headers,
        )
        assert hotel_res.status_code == 200
        h_data = hotel_res.json()
        assert h_data["live_inventory_available"] is False
        assert len(h_data["offers"]) == 0
        assert len(h_data["official_search_links"]) >= 2
        assert any("Booking.com" in link["provider_name"] for link in h_data["official_search_links"])


@pytest.mark.asyncio
async def test_present_travel_credentials_do_not_claim_inventory(monkeypatch):
    """Keys alone are not evidence that a provider request was made."""
    monkeypatch.setenv("AMADEUS_CLIENT_ID", "configured-id")
    monkeypatch.setenv("AMADEUS_CLIENT_SECRET", "configured-secret")
    result = await AmadeusTravelAdapter().search_flights(
        FlightSearchRequest(origin="DEL", destination="SHL", departure_date="2026-11-15")
    )
    assert result.configured is True
    assert result.live_inventory_available is False
    assert result.offers == []
    assert "No inventory was queried" in result.message


@pytest.mark.asyncio
async def test_shared_artifact_system():
    """Verify Section 8: Artifact creation, listing, versioning, export, and user ownership isolation."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers_a, user_a = await register_user(client, "ArtifactAuthor")
        headers_b, user_b = await register_user(client, "OtherUser")

        # 1. Create Artifact
        art_res = await client.post(
            "/api/artifacts",
            json={
                "title": "Meghalaya 3-Day Expedition Plan",
                "artifact_type": "task_plan",
                "content": "# Shillong & Cherrapunji Itinerary\n\nDay 1: Umiam Lake\nDay 2: Living Root Bridges\nDay 3: Dawki",
                "summary": "3-day curated travel plan for Meghalaya",
                "sources_json": [{"id": "s1", "title": "Meghalaya Tourism", "url": "https://meghalayatourism.in"}],
            },
            headers=headers_a,
        )
        assert art_res.status_code == 201
        art = art_res.json()
        art_id = art["id"]
        assert art["version"] == 1
        assert art["title"] == "Meghalaya 3-Day Expedition Plan"
        assert art["artifact_type"] == "task_plan"

        # 2. List Artifacts
        list_res = await client.get("/api/artifacts", headers=headers_a)
        assert list_res.status_code == 200
        assert len(list_res.json()) >= 1

        # Filter by type
        filter_res = await client.get("/api/artifacts?artifact_type=task_plan", headers=headers_a)
        assert filter_res.status_code == 200
        assert len(filter_res.json()) >= 1

        # 3. Patch / Update Artifact (increments version)
        patch_res = await client.patch(
            f"/api/artifacts/{art_id}",
            json={"title": "Updated Meghalaya 3-Day Plan", "summary": "Revised travel plan"},
            headers=headers_a,
        )
        assert patch_res.status_code == 200
        patched = patch_res.json()
        assert patched["version"] == 2
        assert patched["title"] == "Updated Meghalaya 3-Day Plan"

        # 4. Export Artifact as Markdown
        export_res = await client.get(f"/api/artifacts/{art_id}/export?format=markdown", headers=headers_a)
        assert export_res.status_code == 200
        assert export_res.headers["content-type"].startswith("text/markdown")
        md_text = export_res.text
        assert "# Updated Meghalaya 3-Day Plan" in md_text
        assert "**Version**: 2" in md_text
        assert "Living Root Bridges" in md_text
        assert "Sources & Citations" in md_text

        # 5. User B Isolation checks (Journey F)
        get_b = await client.get(f"/api/artifacts/{art_id}", headers=headers_b)
        assert get_b.status_code == 404

        patch_b = await client.patch(f"/api/artifacts/{art_id}", json={"title": "Hack"}, headers=headers_b)
        assert patch_b.status_code == 404

        export_b = await client.get(f"/api/artifacts/{art_id}/export", headers=headers_b)
        assert export_b.status_code == 404

        del_b = await client.delete(f"/api/artifacts/{art_id}", headers=headers_b)
        assert del_b.status_code == 404

        # 6. User A Deletes Artifact
        del_a = await client.delete(f"/api/artifacts/{art_id}", headers=headers_a)
        assert del_a.status_code == 204

        get_deleted = await client.get(f"/api/artifacts/{art_id}", headers=headers_a)
        assert get_deleted.status_code == 404
