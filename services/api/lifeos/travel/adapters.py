import os
import urllib.parse
from typing import Any, Dict, List, Optional
from lifeos.travel.base import BaseTravelAdapter
from lifeos.travel.schemas import (
    FlightSearchRequest,
    HotelSearchRequest,
    TravelSearchResult,
    RevalidationResult,
    BookingHandoff,
    OfficialSearchLink,
)


class AmadeusTravelAdapter(BaseTravelAdapter):
    provider_name: str = "amadeus"

    def is_configured(self) -> bool:
        return bool(os.getenv("AMADEUS_CLIENT_ID") and os.getenv("AMADEUS_CLIENT_SECRET"))

    async def search_flights(self, req: FlightSearchRequest) -> TravelSearchResult:
        if not self.is_configured():
            # Build verified official Google Flights & Skyscanner links without faking numbers
            orig = urllib.parse.quote(req.origin)
            dest = urllib.parse.quote(req.destination)
            date_str = req.departure_date
            gf_url = f"https://www.google.com/travel/flights?q=flights%20from%20{orig}%20to%20{dest}%20on%20{date_str}"
            sky_url = f"https://www.skyscanner.net/transport/flights/{orig}/{dest}/{date_str.replace('-', '')}/"

            links = [
                OfficialSearchLink(
                    provider_name="Google Flights",
                    label=f"Compare {req.origin} to {req.destination} on Google Flights",
                    url=gf_url,
                    notes="Open the provider search to check current fares and availability.",
                ),
                OfficialSearchLink(
                    provider_name="Skyscanner",
                    label=f"Search {req.origin} to {req.destination} on Skyscanner",
                    url=sky_url,
                    notes="Open the provider search to check current fares and availability.",
                ),
            ]
            return TravelSearchResult(
                search_type="FLIGHTS",
                provider=self.provider_name,
                configured=False,
                live_inventory_available=False,
                offers=[],
                message="Amadeus GDS credentials are not configured in this environment. Live direct inventory is unavailable. Use official search links for current fares.",
                official_search_links=links,
            )

        return TravelSearchResult(
            search_type="FLIGHTS",
            provider=self.provider_name,
            configured=True,
            live_inventory_available=False,
            offers=[],
            message="Amadeus credentials are present, but live search is not implemented in this build. No inventory was queried.",
            official_search_links=[
                OfficialSearchLink(
                    provider_name="Google Flights",
                    label=f"Compare {req.origin} to {req.destination} on Google Flights",
                    url=f"https://www.google.com/travel/flights?q=flights%20from%20{urllib.parse.quote(req.origin)}%20to%20{urllib.parse.quote(req.destination)}%20on%20{req.departure_date}",
                    notes="Open the provider search to check current fares and availability.",
                ),
                OfficialSearchLink(
                    provider_name="Skyscanner",
                    label=f"Search {req.origin} to {req.destination} on Skyscanner",
                    url=f"https://www.skyscanner.net/transport/flights/{urllib.parse.quote(req.origin)}/{urllib.parse.quote(req.destination)}/{req.departure_date.replace('-', '')}/",
                    notes="Open the provider search to check current fares and availability.",
                ),
            ],
        )

    async def search_hotels(self, req: HotelSearchRequest) -> TravelSearchResult:
        if not self.is_configured():
            dest = urllib.parse.quote(req.destination)
            booking_url = f"https://www.booking.com/searchresults.html?ss={dest}&checkin={req.check_in_date}&checkout={req.check_out_date}&group_adults={req.guests}&no_rooms={req.rooms}"
            agoda_url = f"https://www.agoda.com/search?city={dest}&checkIn={req.check_in_date}&checkOut={req.check_out_date}&rooms={req.rooms}&adults={req.guests}"

            links = [
                OfficialSearchLink(
                    provider_name="Booking.com",
                    label=f"Find accommodations in {req.destination} on Booking.com",
                    url=booking_url,
                    notes="Open the provider search to check current inventory and terms.",
                ),
                OfficialSearchLink(
                    provider_name="Agoda",
                    label=f"Check hotel rates in {req.destination} on Agoda",
                    url=agoda_url,
                    notes="Open the provider search to check current inventory and terms.",
                ),
            ]
            return TravelSearchResult(
                search_type="HOTELS",
                provider=self.provider_name,
                configured=False,
                live_inventory_available=False,
                offers=[],
                message="Hotel GDS integration is not configured. Live direct inventory is unavailable. Use official accommodation links for real availability.",
                official_search_links=links,
            )

        return TravelSearchResult(
            search_type="HOTELS",
            provider=self.provider_name,
            configured=True,
            live_inventory_available=False,
            offers=[],
            message="Amadeus credentials are present, but live hotel search is not implemented in this build. No inventory was queried.",
            official_search_links=[
                OfficialSearchLink(
                    provider_name="Booking.com",
                    label=f"Find accommodations in {req.destination} on Booking.com",
                    url=f"https://www.booking.com/searchresults.html?ss={urllib.parse.quote(req.destination)}&checkin={req.check_in_date}&checkout={req.check_out_date}&group_adults={req.guests}&no_rooms={req.rooms}",
                    notes="Open the provider search to check current inventory and terms.",
                ),
                OfficialSearchLink(
                    provider_name="Agoda",
                    label=f"Check hotel rates in {req.destination} on Agoda",
                    url=f"https://www.agoda.com/search?city={urllib.parse.quote(req.destination)}&checkIn={req.check_in_date}&checkOut={req.check_out_date}&rooms={req.rooms}&adults={req.guests}",
                    notes="Open the provider search to check current inventory and terms.",
                ),
            ],
        )

    async def revalidate_offer(self, offer_id: str) -> RevalidationResult:
        return RevalidationResult(
            offer_id=offer_id,
            provider=self.provider_name,
            still_available=False,
            price_changed=False,
            message="Live offer revalidation is not implemented. This offer was not checked.",
        )

    async def create_booking_handoff(self, offer_id: str, traveler_details: Dict[str, Any]) -> BookingHandoff:
        return BookingHandoff(
            offer_id=offer_id,
            provider=self.provider_name,
            handoff_type="UNAVAILABLE",
            instructions="Direct booking is not implemented. Review and complete the reservation through an official provider site.",
            requires_user_confirmation=True,
        )


class DuffelTravelAdapter(BaseTravelAdapter):
    provider_name: str = "duffel"

    def is_configured(self) -> bool:
        return bool(os.getenv("DUFFEL_API_TOKEN"))

    async def search_flights(self, req: FlightSearchRequest) -> TravelSearchResult:
        return TravelSearchResult(
            search_type="FLIGHTS",
            provider=self.provider_name,
            configured=self.is_configured(),
            live_inventory_available=False,
            offers=[],
            message=("Duffel credentials are present, but live search is not implemented in this build. No inventory was queried."
                     if self.is_configured() else "Duffel API token is not configured. Live flights search is unavailable."),
        )

    async def search_hotels(self, req: HotelSearchRequest) -> TravelSearchResult:
        return TravelSearchResult(
            search_type="HOTELS",
            provider=self.provider_name,
            configured=self.is_configured(),
            live_inventory_available=False,
            offers=[],
            message=("Duffel credentials are present, but live stays search is not implemented in this build. No inventory was queried."
                     if self.is_configured() else "Duffel Stays API token is not configured."),
        )

    async def revalidate_offer(self, offer_id: str) -> RevalidationResult:
        return RevalidationResult(
            offer_id=offer_id,
            provider=self.provider_name,
            still_available=False,
            price_changed=False,
            message="Live offer revalidation is not implemented. This offer was not checked.",
        )

    async def create_booking_handoff(self, offer_id: str, traveler_details: Dict[str, Any]) -> BookingHandoff:
        return BookingHandoff(
            offer_id=offer_id,
            provider=self.provider_name,
            handoff_type="UNAVAILABLE",
            instructions="Direct booking is not implemented. Review and complete the reservation through an official provider site.",
            requires_user_confirmation=True,
        )

