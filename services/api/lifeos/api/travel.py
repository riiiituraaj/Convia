from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.travel.schemas import (
    FlightSearchRequest,
    HotelSearchRequest,
    TravelSearchResult,
    RevalidationResult,
    BookingHandoff,
)
from lifeos.travel.service import travel_service

router = APIRouter(prefix="/travel", tags=["travel"])


@router.get("/status")
async def get_travel_provider_status(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Inspects travel provider configuration status without claiming fake availability."""
    return travel_service.get_status()


@router.post("/flights/search", response_model=TravelSearchResult)
async def search_flights(
    payload: FlightSearchRequest,
    provider: str = Query("amadeus"),
    current_user: User = Depends(get_current_user),
):
    """Searches flights from configured GDS or provides grounded official search links."""
    return await travel_service.search_flights(payload, provider=provider)


@router.post("/hotels/search", response_model=TravelSearchResult)
async def search_hotels(
    payload: HotelSearchRequest,
    provider: str = Query("amadeus"),
    current_user: User = Depends(get_current_user),
):
    """Searches hotels from configured providers or provides official booking links."""
    return await travel_service.search_hotels(payload, provider=provider)


@router.post("/offers/{offer_id}/revalidate", response_model=RevalidationResult)
async def revalidate_offer(
    offer_id: str,
    provider: str = Query("amadeus"),
    current_user: User = Depends(get_current_user),
):
    """Revalidates price and availability for a specific offer before booking."""
    return await travel_service.revalidate_offer(offer_id, provider=provider)


@router.post("/offers/{offer_id}/handoff", response_model=BookingHandoff)
async def create_booking_handoff(
    offer_id: str,
    traveler_details: Dict[str, Any],
    provider: str = Query("amadeus"),
    current_user: User = Depends(get_current_user),
):
    """Prepares a secure booking handoff requiring user review and authorization."""
    return await travel_service.create_booking_handoff(offer_id, traveler_details, provider=provider)

