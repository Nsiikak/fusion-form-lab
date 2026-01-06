from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.booking.model import Booking, BookingStatus
from app.entities.event.model import Event, EventStatus
from app.entities.review.model import Review
from app.entities.vendor.service import VendorService
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/customer")
async def get_customer_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get customer dashboard statistics"""
    if current_user.role.value != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access this endpoint"
        )
    
    # Get upcoming events count
    today = datetime.now().date()
    upcoming_events = db.query(Event).filter(
        Event.customer_id == current_user.id,
        Event.date >= today,
        Event.status != EventStatus.CANCELLED
    ).count()
    
    # Get bookings stats
    all_bookings = db.query(Booking).filter(Booking.customer_id == current_user.id).all()
    active_bookings = [b for b in all_bookings if b.status.value in ["pending", "confirmed"]]
    confirmed_bookings = [b for b in all_bookings if b.status == BookingStatus.CONFIRMED]
    pending_bookings = [b for b in all_bookings if b.status == BookingStatus.PENDING]
    
    return {
        "upcoming_events": upcoming_events,
        "active_bookings": len(active_bookings),
        "confirmed_bookings": len(confirmed_bookings),
        "pending_bookings": len(pending_bookings),
    }

@router.get("/vendor")
async def get_vendor_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get vendor dashboard statistics"""
    if current_user.role.value != "vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can access this endpoint"
        )
    
    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    # Get bookings stats
    all_bookings = db.query(Booking).filter(Booking.vendor_id == vendor.id).all()
    active_bookings = [b for b in all_bookings if b.status.value in ["pending", "confirmed"]]
    confirmed_bookings = [b for b in all_bookings if b.status == BookingStatus.CONFIRMED]
    completed_bookings = [b for b in all_bookings if b.status == BookingStatus.COMPLETED]
    
    # Calculate total earnings from confirmed and completed bookings
    total_earnings = sum(float(b.price) for b in confirmed_bookings + completed_bookings)
    
    # Get unique customers count
    unique_customers = len(set(b.customer_id for b in all_bookings))
    
    # Get rating stats
    rating_result = db.query(
        func.avg(Review.rating).label('average_rating'),
        func.count(Review.id).label('total_reviews')
    ).filter(Review.vendor_id == vendor.id).first()
    
    average_rating = float(rating_result.average_rating) if rating_result.average_rating else 0.0
    total_reviews = rating_result.total_reviews or 0
    
    # Calculate growth (bookings in last 30 days vs previous 30 days)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    sixty_days_ago = datetime.now() - timedelta(days=60)
    
    recent_bookings = [b for b in all_bookings if b.created_at >= thirty_days_ago]
    previous_bookings = [b for b in all_bookings if sixty_days_ago <= b.created_at < thirty_days_ago]
    
    growth_percentage = 0
    if len(previous_bookings) > 0:
        growth_percentage = ((len(recent_bookings) - len(previous_bookings)) / len(previous_bookings)) * 100
    elif len(recent_bookings) > 0:
        growth_percentage = 100
    
    return {
        "total_earnings": total_earnings,
        "active_bookings": len(active_bookings),
        "average_rating": average_rating,
        "total_reviews": total_reviews,
        "total_clients": unique_customers,
        "growth_percentage": round(growth_percentage, 1),
        "total_bookings": len(all_bookings),
    }

