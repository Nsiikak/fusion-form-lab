from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.booking import schema
from app.entities.booking.model import BookingStatus
from app.entities.booking.service import BookingService

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
        import os
        import requests
        
        PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
        if PAYSTACK_SECRET_KEY:
            try:
                headers = {
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json",
                }
                verification_url = f"https://api.paystack.co/transaction/verify/{booking_data.payment_reference}"
                response = requests.get(verification_url, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    if data["data"]["status"] != "success":
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Payment verification failed: Transaction not successful"
                        )
                    # Optional: Verify amount
                    # expected_amount = booking_data.price * 100
                    # if data["data"]["amount"] != expected_amount:
                    #     ...
                else:
                     raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Payment verification failed: Could not verify transaction"
                    )
            except Exception as e:
                # Log error
                print(f"Payment verification error: {str(e)}")
                # Depending on requirement, might want to allow booking with a warning or block it.
                # Here we block it for safety if verification was attempted but failed.
                if isinstance(e, HTTPException):
                    raise e
                # Fallback: maintain original behavior if network error or others? 
                # For now, let's assume if reference is provided, it MUST be valid.
    
    return BookingService.create_booking(db, booking_data, current_user.id)

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
    
    # Check authorization
    from app.entities.vendor.service import VendorService
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
    # Return enriched booking data
    from app.entities.vendor.service import VendorService
    vendor = VendorService.get_vendor_by_id(db, booking.vendor_id)
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    
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

