from typing import Any, Dict, List, Optional
from lifeos.travel.adapters import AmadeusTravelAdapter, DuffelTravelAdapter
from lifeos.travel.schemas import (
    FlightSearchRequest,
    HotelSearchRequest,
    TravelSearchResult,
    RevalidationResult,
    BookingHandoff,
)


class TravelService:
    def __init__(self):
        self.adapters = {
            "amadeus": AmadeusTravelAdapter(),
            "duffel": DuffelTravelAdapter(),
        }

    def get_status(self) -> Dict[str, Any]:
        """Reports provider configuration status honestly without claiming live connections."""
        providers = {}
        for name, adapter in self.adapters.items():
            providers[name] = {
                "name": name,
                "configured": adapter.is_configured(),
                "status": "CREDENTIALS_PRESENT_NOT_IMPLEMENTED" if adapter.is_configured() else "NOT_CONFIGURED",
                "direct_booking_enabled": False,
            }
        return {
            "live_booking_enabled": False,
            "policy": "No provider inventory or booking is connected in this build. Illustrative fares are never shown; unconfigured providers supply official search links.",
            "providers": providers,
        }

    async def search_flights(self, req: FlightSearchRequest, provider: str = "amadeus") -> TravelSearchResult:
        adapter = self.adapters.get(provider, self.adapters["amadeus"])
        return await adapter.search_flights(req)

    async def search_hotels(self, req: HotelSearchRequest, provider: str = "amadeus") -> TravelSearchResult:
        adapter = self.adapters.get(provider, self.adapters["amadeus"])
        return await adapter.search_hotels(req)

    async def revalidate_offer(self, offer_id: str, provider: str = "amadeus") -> RevalidationResult:
        adapter = self.adapters.get(provider, self.adapters["amadeus"])
        return await adapter.revalidate_offer(offer_id)

    async def create_booking_handoff(
        self,
        offer_id: str,
        traveler_details: Dict[str, Any],
        provider: str = "amadeus",
    ) -> BookingHandoff:
        adapter = self.adapters.get(provider, self.adapters["amadeus"])
        return await adapter.create_booking_handoff(offer_id, traveler_details)


travel_service = TravelService()

