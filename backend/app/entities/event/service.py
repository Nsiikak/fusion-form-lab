from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException, status
from app.entities.event.model import Event, EventStatus
from app.entities.event.schema import EventCreate
from app.entities.booking.model import Booking, BookingStatus
from decimal import Decimal

class EventService:
    @staticmethod
    def get_event_by_id(db: Session, event_id: int) -> Optional[Event]:
        """Get event by ID"""
        return db.query(Event).filter(Event.id == event_id).first()
    
    @staticmethod
    def get_user_events(
        db: Session,
        user_id: int,
        status_filter: Optional[EventStatus] = None
    ) -> List[Event]:
        """Get events for a user"""
        query = db.query(Event).filter(Event.customer_id == user_id)
        
        if status_filter:
            query = query.filter(Event.status == status_filter)
        
        return query.order_by(Event.date.asc()).all()
    
    @staticmethod
    def create_event(db: Session, event_data: EventCreate, customer_id: int) -> Event:
        """Create a new event"""
        db_event = Event(
            customer_id=customer_id,
            name=event_data.name,
            date=event_data.date,
            location=event_data.location,
            description=event_data.description,
            total_budget=event_data.total_budget,
            status=EventStatus.PLANNING
        )
        
        db.add(db_event)
        db.commit()
        db.refresh(db_event)
        
        return db_event
    
    @staticmethod
    def update_event(
        db: Session,
        event_id: int,
        event_data: dict,
        user_id: int
    ) -> Event:
        """Update an event"""
        event = EventService.get_event_by_id(db, event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        
        if event.customer_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this event"
            )
        
        for field, value in event_data.items():
            if value is not None:
                setattr(event, field, value)
        
        db.commit()
        db.refresh(event)
        return event
    
    @staticmethod
    def delete_event(db: Session, event_id: int, user_id: int) -> bool:
        """Delete an event"""
        event = EventService.get_event_by_id(db, event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        
        if event.customer_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this event"
            )
        
        db.delete(event)
        db.commit()
        return True
    
    @staticmethod
    def get_event_bookings(db: Session, event_id: int) -> List[Booking]:
        """Get all bookings for an event"""
        return db.query(Booking).filter(Booking.event_id == event_id).all()
    
    @staticmethod
    def get_event_stats(db: Session, event_id: int) -> dict:
        """Get event statistics (booking count, total cost)"""
        bookings = EventService.get_event_bookings(db, event_id)
        confirmed_bookings = [b for b in bookings if b.status == BookingStatus.CONFIRMED]
        
        return {
            "booking_count": len(confirmed_bookings),
            "total_cost": sum(Decimal(str(b.price)) for b in confirmed_bookings)
        }

