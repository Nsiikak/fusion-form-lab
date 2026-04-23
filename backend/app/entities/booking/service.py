import logging
from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException, status
from app.entities.booking.model import Booking, BookingStatus
from app.entities.booking.schema import BookingCreate
from app.entities.vendor.model import Vendor
from app.entities.user.model import User
from app.services.paystack import paystack_service

logger = logging.getLogger(__name__)

class BookingService:
    @staticmethod
    def get_booking_by_id(db: Session, booking_id: int) -> Optional[Booking]:
        """Get booking by ID"""
        return db.query(Booking).filter(Booking.id == booking_id).first()
    
    @staticmethod
    def get_user_bookings(
        db: Session,
        user_id: int,
        user_role: str,
        status_filter: Optional[BookingStatus] = None
    ) -> List[dict]:
        """Get bookings for a user (customer or vendor) with related data"""
        query = db.query(Booking)
        
        if user_role == "customer":
            query = query.filter(Booking.customer_id == user_id)
        elif user_role == "vendor":
            # Get vendor_id from user_id
            vendor = db.query(Vendor).filter(Vendor.user_id == user_id).first()
            if not vendor:
                return []
            query = query.filter(Booking.vendor_id == vendor.id)
        else:
            return []
        
        if status_filter:
            query = query.filter(Booking.status == status_filter)
        
        bookings = query.order_by(Booking.created_at.desc()).all()
        
        # Enrich with vendor and customer details
        result = []
        for booking in bookings:
            vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
            customer = db.query(User).filter(User.id == booking.customer_id).first()
            
            result.append({
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
            })
        
        return result
    
    @staticmethod
    def create_booking(db: Session, booking_data: BookingCreate, customer_id: int) -> Booking:
        """Create a new booking"""
        # Verify vendor exists and is active
        vendor = db.query(Vendor).filter(Vendor.id == booking_data.vendor_id).first()
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        if not vendor.is_active or vendor.verification_status.value != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vendor is not available for bookings"
            )
        
        # Create booking
        db_booking = Booking(
            customer_id=customer_id,
            vendor_id=booking_data.vendor_id,
            event_id=booking_data.event_id,
            price=booking_data.price,
            event_date=booking_data.event_date,
            event_time=booking_data.event_time,
            notes=booking_data.notes,
            status=BookingStatus.PENDING
        )
        
        db.add(db_booking)
        db.commit()
        db.refresh(db_booking)
        
        return db_booking
    
    @staticmethod
    def update_booking_status(
        db: Session,
        booking_id: int,
        new_status: BookingStatus,
        user_id: int,
        user_role: str
    ) -> Booking:
        """Update booking status (vendor can accept/decline, customer can cancel)"""
        booking = BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Check authorization
        if user_role == "vendor":
            vendor = db.query(Vendor).filter(Vendor.user_id == user_id).first()
            if not vendor or booking.vendor_id != vendor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this booking"
                )
            # Vendors can only change to confirmed, declined, or completed
            if new_status not in [BookingStatus.CONFIRMED, BookingStatus.DECLINED, BookingStatus.COMPLETED]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Vendors can only confirm, decline, or complete bookings"
                )
        elif user_role == "customer":
            if booking.customer_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this booking"
                )
            # Customers can only cancel or complete (to release funds)
            if new_status not in [BookingStatus.CANCELLED, BookingStatus.COMPLETED]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Customers can only cancel or complete bookings"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        booking.status = new_status
        db.commit()
        db.refresh(booking)
        
        # Trigger Payout if Completed
        if new_status == BookingStatus.COMPLETED:
            try:
                vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
                
                if vendor and vendor.recipient_code:
                    # Calculate amount (90% to vendor, 10% platform fee)
                    amount = float(booking.price) * 0.90

                    paystack_service.initiate_transfer(
                        amount=amount,
                        recipient_code=vendor.recipient_code,
                        reference=f"BKG_{booking.id}",
                        reason=f"Payout for Booking #{booking.id}"
                    )
            except Exception as e:
                logger.error("Payout failed for booking %s: %s", booking.id, str(e))
                # We don't rollback the status update, but we should probably log this error properly
                # or have a retry mechanism. For now, we log to console.
        
        return booking
    
    @staticmethod
    def delete_booking(db: Session, booking_id: int, user_id: int) -> bool:
        """Delete a booking (only customer can delete pending bookings)"""
        booking = BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        if booking.customer_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this booking"
            )
        
        if booking.status != BookingStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only delete pending bookings"
            )
        
        db.delete(booking)
        db.commit()
        return True

