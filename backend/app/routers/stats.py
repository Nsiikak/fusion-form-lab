from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.booking.model import Booking, BookingStatus
from app.entities.event.model import Event, EventStatus
from app.entities.review.model import Review
from app.entities.vendor.service import VendorService
from datetime import datetime, timedelta, timezone

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

    today = datetime.now().date()
    # Upcoming events: count distinct future-dated bookings that are active (pending/confirmed)
    # Falls back to Events table count when events are created; bookings are the primary source
    upcoming_bookings_count = db.query(func.count(Booking.id)).filter(
        Booking.customer_id == current_user.id,
        Booking.event_date >= datetime.now(timezone.utc),
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
    ).scalar() or 0

    formal_events_count = db.query(func.count(Event.id)).filter(
        Event.customer_id == current_user.id,
        Event.date >= today,
        Event.status != EventStatus.CANCELLED,
    ).scalar() or 0

    upcoming_events = max(upcoming_bookings_count, formal_events_count)

    base = db.query(Booking).filter(Booking.customer_id == current_user.id)
    active_bookings = base.filter(
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
    ).count()
    confirmed_bookings = base.filter(Booking.status == BookingStatus.CONFIRMED).count()
    pending_bookings = base.filter(Booking.status == BookingStatus.PENDING).count()

    return {
        "upcoming_events": upcoming_events,
        "active_bookings": active_bookings,
        "confirmed_bookings": confirmed_bookings,
        "pending_bookings": pending_bookings,
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

    base = db.query(Booking).filter(Booking.vendor_id == vendor.id, Booking.paid_at.isnot(None))

    active_bookings = base.filter(
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
    ).count()

    # Only count released payouts — COMPLETED means customer confirmed or 24h auto-release fired
    # Earnings = net payouts actually sent to the vendor (after commission)
    total_earnings = db.query(func.coalesce(func.sum(Booking.payout_amount), 0)).filter(
        Booking.vendor_id == vendor.id,
        Booking.status == BookingStatus.COMPLETED,
        Booking.payout_status.in_(["processing", "paid"]),
    ).scalar() or 0

    unique_customers = db.query(func.count(distinct(Booking.customer_id))).filter(
        Booking.vendor_id == vendor.id, Booking.paid_at.isnot(None)
    ).scalar() or 0

    total_bookings = base.count()

    rating_result = db.query(
        func.avg(Review.rating).label("average_rating"),
        func.count(Review.id).label("total_reviews"),
    ).filter(Review.vendor_id == vendor.id).first()

    average_rating = float(rating_result.average_rating) if rating_result.average_rating else 0.0
    total_reviews = rating_result.total_reviews or 0

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)

    recent_bookings = base.filter(Booking.created_at >= thirty_days_ago).count()
    previous_bookings = base.filter(
        Booking.created_at >= sixty_days_ago,
        Booking.created_at < thirty_days_ago,
    ).count()

    if previous_bookings > 0:
        growth_percentage = ((recent_bookings - previous_bookings) / previous_bookings) * 100
    elif recent_bookings > 0:
        growth_percentage = 100.0
    else:
        growth_percentage = 0.0

    from app.entities.booking.model import BookingStatus as _BS
    completed_bookings = base.filter(Booking.status == _BS.COMPLETED).count()

    return {
        "completed_bookings": completed_bookings,
        "total_earnings": float(total_earnings),
        "active_bookings": active_bookings,
        "average_rating": average_rating,
        "total_reviews": total_reviews,
        "total_clients": unique_customers,
        "growth_percentage": round(growth_percentage, 1),
        "total_bookings": total_bookings,
    }
