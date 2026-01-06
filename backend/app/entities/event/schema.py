from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.entities.event.model import EventStatus

class EventBase(BaseModel):
    name: str
    date: date
    location: str
    description: Optional[str] = None
    total_budget: Optional[Decimal] = None

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[date] = None
    location: Optional[str] = None
    description: Optional[str] = None
    total_budget: Optional[Decimal] = None
    status: Optional[EventStatus] = None

class EventResponse(EventBase):
    id: int
    customer_id: int
    status: EventStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EventWithBookings(EventResponse):
    """Event with booking count and total cost"""
    booking_count: int = 0
    total_cost: Decimal = Decimal("0.00")

