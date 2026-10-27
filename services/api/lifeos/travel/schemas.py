from datetime import datetime, date
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class FlightSearchRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=50, description="IATA code or city name")
    destination: str = Field(min_length=2, max_length=50, description="IATA code or city name")
    departure_date: str = Field(description="YYYY-MM-DD")
    return_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    passengers: int = Field(default=1, ge=1, le=9)
    cabin_class: Literal["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"] = "ECONOMY"


class HotelSearchRequest(BaseModel):
    destination: str = Field(min_length=2, max_length=100)
    check_in_date: str = Field(description="YYYY-MM-DD")
    check_out_date: str = Field(description="YYYY-MM-DD")
    guests: int = Field(default=1, ge=1, le=10)
    rooms: int = Field(default=1, ge=1, le=5)


class OfficialSearchLink(BaseModel):
    provider_name: str
    label: str
    url: str
    notes: str


class FlightOffer(BaseModel):
    id: str
    provider: str
    airline: str
    flight_number: str
    origin: str
    destination: str
    departure_time: str
    arrival_time: str
    duration_minutes: int
    stops: int
    total_price: float
    currency: str = "INR"
    fare_rules: str = "Standard non-refundable"
    baggage_allowance: str = "15 kg check-in, 7 kg cabin"
    expires_at: Optional[str] = None


class HotelOffer(BaseModel):
    id: str
    provider: str
    hotel_name: str
    address: str
    star_rating: Optional[float] = None
    check_in_date: str
    check_out_date: str
    room_type: str
    total_price: float
    currency: str = "INR"
    cancellation_policy: str = "Free cancellation until 48 hours prior"
    expires_at: Optional[str] = None


class TravelSearchResult(BaseModel):
    search_type: Literal["FLIGHTS", "HOTELS"]
    provider: str
    configured: bool
    live_inventory_available: bool
    offers: List[Dict[str, Any]] = Field(default_factory=list)
    message: str
    official_search_links: List[OfficialSearchLink] = Field(default_factory=list)


class RevalidationResult(BaseModel):
    offer_id: str
    provider: str
    still_available: bool
    price_changed: bool
    current_price: Optional[float] = None
    currency: str = "INR"
    message: str


class BookingHandoff(BaseModel):
    offer_id: str
    provider: str
    handoff_type: Literal["DIRECT_API", "OFFICIAL_LINK", "UNAVAILABLE"]
    checkout_url: Optional[str] = None
    total_amount: Optional[float] = None
    currency: str = "INR"
    instructions: str
    requires_user_confirmation: bool = True

