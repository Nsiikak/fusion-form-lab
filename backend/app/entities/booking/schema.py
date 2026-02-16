from pydantic import BaseModel
from typing import Optional
from datetime import datetime, time
from decimal import Decimal
from app.entities.booking.model import BookingStatus

class BookingBase(BaseModel):
    vendor_id: int
    event_id: Optional[int] = None
    price: Decimal
    event_date: datetime
    event_time: Optional[time] = None
    notes: Optional[str] = None

class BookingCreate(BookingBase):
    payment_reference: Optional[str] = None

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

