from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime, time, timezone
from decimal import Decimal
from app.entities.booking.model import BookingStatus


class ServiceItemOrder(BaseModel):
    service_item_id: int
    quantity: int = Field(..., ge=1, le=10000)

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
        now = datetime.now(timezone.utc)
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v <= now:
            raise ValueError("Event date must be in the future")
        return v

class BookingCreate(BookingBase):
    payment_reference: Optional[str] = None
    service_items: Optional[List[ServiceItemOrder]] = None

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

