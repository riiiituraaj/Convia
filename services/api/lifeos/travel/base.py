from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from lifeos.travel.schemas import (
    FlightSearchRequest,
    HotelSearchRequest,
    TravelSearchResult,
    RevalidationResult,
    BookingHandoff,
)


class BaseTravelAdapter(ABC):
    """Abstract base adapter for real travel provider integrations."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Reports whether credentials and endpoints for this provider are configured."""
        pass

    @abstractmethod
    async def search_flights(self, req: FlightSearchRequest) -> TravelSearchResult:
        pass

    @abstractmethod
    async def search_hotels(self, req: HotelSearchRequest) -> TravelSearchResult:
        pass

    @abstractmethod
    async def revalidate_offer(self, offer_id: str) -> RevalidationResult:
        pass

    @abstractmethod
    async def create_booking_handoff(self, offer_id: str, traveler_details: Dict[str, Any]) -> BookingHandoff:
        pass

