from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime, time, timezone
from decimal import Decimal
from app.entities.booking.model import BookingStatus


def _ensure_future(v: datetime) -> datetime:
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    if v <= datetime.now(timezone.utc):
        raise ValueError("Event date must be in the future")
    return v


class ServiceItemOrder(BaseModel):
    service_item_id: int
    quantity: int = Field(..., ge=1, le=10000)
    note: Optional[str] = Field(None, max_length=500)   # e.g. "jollof less pepper", "Gold package, red and gold theme"

class EventAddress(BaseModel):
    venue_name: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    delivery_instructions: Optional[str] = Field(None, max_length=500)

class EventAddress(BaseModel):
    venue_name: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    delivery_instructions: Optional[str] = Field(None, max_length=500)

class BookingBase(BaseModel):
    vendor_id: int
    event_id: Optional[int] = None
    price: Decimal = Field(..., gt=0, description="Must be greater than zero")
    event_date: datetime
    event_time: Optional[time] = None
    notes: Optional[str] = Field(None, max_length=2000)
    event_address: Optional[EventAddress] = None

    @field_validator("event_date")
    @classmethod
    def event_date_must_be_future(cls, v: datetime) -> datetime:
        return _ensure_future(v)

class QuoteRequest(BaseModel):
    vendor_id: int
    service_items: Optional[List[ServiceItemOrder]] = Field(None, max_length=100)
    event_state: Optional[str] = Field(None, max_length=40)


class BookingCreate(BaseModel):
    """Starts checkout. Price is always computed server-side — never sent by the client."""
    vendor_id: int
    event_id: Optional[int] = None
    event_date: datetime
    event_time: Optional[time] = None
    notes: Optional[str] = Field(None, max_length=2000)
    event_address: Optional[EventAddress] = None
    service_items: Optional[List[ServiceItemOrder]] = Field(None, max_length=100)

    @field_validator("event_date")
    @classmethod
    def event_date_must_be_future(cls, v: datetime) -> datetime:
        return _ensure_future(v)

class BookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    price: Optional[Decimal] = None
    event_date: Optional[datetime] = None
    event_time: Optional[time] = None
    notes: Optional[str] = None

class BookingResponse(BookingBase):
    id: int
    customer_id: int
    status: BookingStatus
    booking_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BookingWithDetails(BookingResponse):
    """Booking with vendor and customer details"""
    vendor_name: Optional[str] = None
    vendor_category: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    service_items_snapshot: Optional[Any] = None



class DisputeRequest(BaseModel):
    reason: str = Field(..., min_length=10, max_length=2000)
    no_show: bool = False


class CancelRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=2000)
    request_review: bool = False   # exceptional circumstances → admin decides


class VendorCancelRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=2000)


class NoShowResponse(BaseModel):
    message: str = Field(..., min_length=5, max_length=2000)


class ResolveRequest(BaseModel):
    outcome: str = Field(..., pattern="^(refund|release)$")
    note: str = Field(..., min_length=5, max_length=2000, description="Shown to both customer and vendor")


class AddonItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    quantity: int = Field(1, ge=1, le=10000)
    unit_price: Decimal = Field(..., gt=0)


class AddonRequest(BaseModel):
    items: List[AddonItem] = Field(..., min_length=1, max_length=20)
    note: Optional[str] = Field(None, max_length=1000)


class QuoteItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    quantity: int = Field(1, ge=1, le=10000)
    unit_price: Decimal = Field(..., gt=0)


class QuoteRequest2(BaseModel):
    items: List[QuoteItem] = Field(..., min_length=1, max_length=30)
    event_date: datetime
    event_time: Optional[time] = None
    event_address: Optional[EventAddress] = None
    note: Optional[str] = Field(None, max_length=2000)
    include_logistics: bool = True
    valid_days: int = Field(3, ge=1, le=14)


class ReductionLine(BaseModel):
    index: int = Field(..., ge=0)          # position in the booking's items
    quantity: int = Field(..., ge=1, le=10000)


class ReductionRequest(BaseModel):
    lines: List[ReductionLine] = Field(..., min_length=1, max_length=50)
    reason: Optional[str] = Field(None, max_length=1000)


class VerifyPaymentRequest(BaseModel):
    reference: Optional[str] = Field(None, max_length=100)   # the reference Paystack returned to the browser
