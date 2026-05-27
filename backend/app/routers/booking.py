import os
import logging
import requests
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.booking import schema
from app.entities.booking.model import BookingStatus
from app.entities.booking.service import BookingService
from app.entities.vendor.service import VendorService
from app.services.email import (
    _fire_and_forget,
    send_booking_confirmation_to_customer,
    send_booking_request_to_vendor,
    send_booking_accepted_to_customer,
    send_booking_declined_to_customer,
)

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("", response_model=schema.BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: schema.BookingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new booking (customer only)"""
    if current_user.role.value != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can create bookings"
        )

    # Verify Payment if reference provided
    if booking_data.payment_reference:
        PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
        if PAYSTACK_SECRET_KEY:
            try:
                verify_headers = {
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json",
                }
                verification_url = f"https://api.paystack.co/transaction/verify/{booking_data.payment_reference}"
                response = requests.get(verification_url, headers=verify_headers, timeout=10)

                if response.status_code == 200:
                    data = response.json()
                    if data["data"]["status"] != "success":
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Payment verification failed: Transaction not successful"
                        )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Payment verification failed: Could not verify transaction"
                    )
            except HTTPException:
                raise
            except Exception as e:
                logger.error("Payment verification error for reference %s: %s", booking_data.payment_reference, str(e))
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Payment verification service unavailable. Please try again."
                )

    booking = BookingService.create_booking(db, booking_data, current_user.id)

    # Fire email notifications in background (non-blocking)
    try:
        vendor = VendorService.get_vendor_by_id(db, booking.vendor_id)
        vendor_user = db.query(User).filter(User.id == vendor.user_id).first() if vendor else None
        event_date = booking.event_date.strftime("%d %B %Y")
        event_time = booking.event_time.strftime("%I:%M %p") if booking.event_time else "TBD"
        amount = f"{float(booking.price):,.0f}"

        _fire_and_forget(
            send_booking_confirmation_to_customer,
            current_user.email,
            current_user.full_name or current_user.email,
            booking.id,
            vendor.business_name if vendor else "Vendor",
            vendor.category.value if vendor else "",
            event_date, event_time, amount,
        )

        if vendor_user and vendor:
            _fire_and_forget(
                send_booking_request_to_vendor,
                vendor_user.email,
                vendor.business_name,
                vendor_user.full_name or vendor_user.email,
                booking.id,
                current_user.full_name or current_user.email,
                current_user.phone_number or "",
                event_date, event_time, amount,
                booking.notes or "",
                vendor.business_name,
            )
    except Exception as e:
        logger.error("Failed to fire booking emails: %s", e)

    return booking


@router.get("", response_model=list[dict])
async def get_my_bookings(
    status_filter: Optional[BookingStatus] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's bookings with vendor/customer details"""
    return BookingService.get_user_bookings(
        db,
        current_user.id,
        current_user.role.value,
        status_filter
    )


@router.get("/{booking_id}", response_model=schema.BookingResponse)
async def get_booking(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get booking details"""
    booking = BookingService.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)

    if booking.customer_id != current_user.id and (not vendor or booking.vendor_id != vendor.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this booking"
        )

    return booking


@router.put("/{booking_id}/status", response_model=dict)
async def update_booking_status(
    booking_id: int,
    new_status: BookingStatus = Query(..., description="New booking status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update booking status"""
    booking = BookingService.update_booking_status(
        db,
        booking_id,
        new_status,
        current_user.id,
        current_user.role.value
    )

    vendor = VendorService.get_vendor_by_id(db, booking.vendor_id)
    customer = db.query(User).filter(User.id == booking.customer_id).first()

    # Fire status-change email to customer (non-blocking)
    try:
        if customer and vendor:
            event_date = booking.event_date.strftime("%d %B %Y")
            amount = f"{float(booking.price):,.0f}"

            if new_status == BookingStatus.CONFIRMED:
                _fire_and_forget(
                    send_booking_accepted_to_customer,
                    customer.email,
                    customer.full_name or customer.email,
                    booking.id,
                    vendor.business_name,
                    vendor.category.value,
                    event_date,
                    amount,
                )
            elif new_status in (BookingStatus.DECLINED, BookingStatus.CANCELLED):
                _fire_and_forget(
                    send_booking_declined_to_customer,
                    customer.email,
                    customer.full_name or customer.email,
                    booking.id,
                    vendor.business_name,
                    event_date,
                )
    except Exception as e:
        logger.error("Failed to fire status email: %s", e)

    return {
        "id": booking.id,
        "customer_id": booking.customer_id,
        "vendor_id": booking.vendor_id,
        "event_id": booking.event_id,
        "status": booking.status.value,
        "price": float(booking.price),
        "booking_date": booking.booking_date.isoformat(),
        "event_date": booking.event_date.isoformat(),
        "event_time": booking.event_time.isoformat() if booking.event_time else None,
        "notes": booking.notes,
        "created_at": booking.created_at.isoformat(),
        "updated_at": booking.updated_at.isoformat() if booking.updated_at else None,
        "vendor_name": vendor.business_name if vendor else None,
        "vendor_category": vendor.category.value if vendor else None,
        "customer_name": customer.full_name if customer else None,
        "customer_email": customer.email if customer else None,
    }


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a booking"""
    BookingService.delete_booking(db, booking_id, current_user.id)
    return None
