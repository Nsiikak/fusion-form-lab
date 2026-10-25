from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.event import schema
from app.entities.event.model import EventStatus
from app.entities.event.service import EventService

router = APIRouter()

@router.post("", response_model=schema.EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: schema.EventCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new event (customer only)"""
    if current_user.role.value != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can create events"
        )
    
    return EventService.create_event(db, event_data, current_user.id)

@router.get("", response_model=list[schema.EventResponse])
async def get_my_events(
    status_filter: Optional[EventStatus] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's events"""
    if current_user.role.value != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access events"
        )

    offset = (page - 1) * limit
    return EventService.get_user_events(db, current_user.id, status_filter, limit=limit, offset=offset)

@router.get("/{event_id}", response_model=schema.EventResponse)
async def get_event(
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get event details"""
    event = EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this event"
        )
    
    return event

@router.put("/{event_id}", response_model=schema.EventResponse)
async def update_event(
    event_id: int,
    event_update: schema.EventUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an event"""
    update_data = event_update.model_dump(exclude_unset=True)
    return EventService.update_event(db, event_id, update_data, current_user.id)

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an event"""
    EventService.delete_event(db, event_id, current_user.id)
    return None

@router.get("/{event_id}/bookings", response_model=list[dict])
async def get_event_bookings(
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get bookings for an event"""
    event = EventService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this event's bookings"
        )
    
    bookings = EventService.get_event_bookings(db, event_id)
    return [
        {
            "id": b.id,
            "vendor_id": b.vendor_id,
            "status": b.status.value,
            "price": float(b.customer_total if b.customer_total is not None else b.price),
            "event_date": b.event_date.isoformat(),
        }
        for b in bookings
        if b.paid_at is not None
    ]

