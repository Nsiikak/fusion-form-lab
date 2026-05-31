import logging
from sqlalchemy.orm import Session, joinedload
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

        # Eagerly load related objects to avoid N+1 queries
        query = query.options(joinedload(Booking.vendor), joinedload(Booking.customer))
        bookings = query.order_by(Booking.created_at.desc()).all()

        # Determine which bookings already have a review (1 query for all IDs)
        from app.entities.review.model import Review
        reviewed_ids: set[int] = set()
        if bookings:
            reviewed_ids = {
                row[0]
                for row in db.query(Review.booking_id)
                .filter(Review.booking_id.in_([b.id for b in bookings]))
                .all()
            }

        result = []
        for booking in bookings:
            vendor = booking.vendor
            customer = booking.customer

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
                "has_review": booking.id in reviewed_ids,
                "service_items_snapshot": booking.service_items_snapshot,
                "vendor_confirmed_at": booking.vendor_confirmed_at.isoformat() if booking.vendor_confirmed_at else None,
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
        
        from app.entities.vendor.model import VerificationStatus
        if not vendor.is_active or vendor.verification_status == VerificationStatus.REJECTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vendor is not available for bookings",
            )

        # If service items provided, compute price server-side (never trust client total)
        snapshot = None
        computed_price = booking_data.price

        if booking_data.service_items:
            from app.entities.service_item.model import ServiceItem
            snapshot = []
            total = 0
            for order in booking_data.service_items:
                item = db.query(ServiceItem).filter(
                    ServiceItem.id == order.service_item_id,
                    ServiceItem.vendor_id == vendor.id,
                    ServiceItem.is_active == True,  # noqa: E712
                ).first()
                if not item:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Service item {order.service_item_id} not found or unavailable",
                    )
                subtotal = float(item.unit_price) * order.quantity
                total += subtotal
                snapshot.append({
                    "service_item_id": item.id,
                    "name": item.name,
                    "unit_price": float(item.unit_price),
                    "unit_label": item.unit_label,
                    "quantity": order.quantity,
                    "subtotal": subtotal,
                })
            computed_price = total

        # Server-side price validation — client cannot set an arbitrary price
        if computed_price < float(vendor.starting_price):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total cannot be less than the vendor's starting price "
                       f"(₦{float(vendor.starting_price):,.2f})",
            )

        # Create booking
        db_booking = Booking(
            customer_id=customer_id,
            vendor_id=booking_data.vendor_id,
            event_id=booking_data.event_id,
            price=computed_price,
            event_date=booking_data.event_date,
            event_time=booking_data.event_time,
            notes=booking_data.notes,
            status=BookingStatus.PENDING,
            service_items_snapshot=snapshot,
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
        user_role: str,
        force: bool = False,
    ) -> Booking:
        """Update booking status (vendor can accept/decline, customer can cancel)"""
        booking = BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Valid status transitions per role.
        # Escrow flow: vendor → awaiting_confirmation → customer confirms → completed → payout.
        # Auto-release fires after 24h if customer does not confirm.
        VALID_TRANSITIONS: dict[str, dict[BookingStatus, list[BookingStatus]]] = {
            "vendor": {
                BookingStatus.PENDING: [BookingStatus.CONFIRMED, BookingStatus.DECLINED],
                BookingStatus.CONFIRMED: [BookingStatus.AWAITING_CONFIRMATION],
                BookingStatus.AWAITING_CONFIRMATION: [],
                BookingStatus.DECLINED: [],
                BookingStatus.CANCELLED: [],
                BookingStatus.COMPLETED: [],
            },
            "customer": {
                BookingStatus.PENDING: [BookingStatus.CANCELLED],
                BookingStatus.CONFIRMED: [BookingStatus.CANCELLED],
                BookingStatus.AWAITING_CONFIRMATION: [BookingStatus.COMPLETED],
                BookingStatus.DECLINED: [],
                BookingStatus.CANCELLED: [],
                BookingStatus.COMPLETED: [],
            },
        }

        if user_role == "vendor":
            vendor = db.query(Vendor).filter(Vendor.user_id == user_id).first()
            if not vendor or booking.vendor_id != vendor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this booking",
                )
        elif user_role == "customer":
            if booking.customer_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this booking",
                )
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

        allowed = VALID_TRANSITIONS.get(user_role, {}).get(booking.status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from '{booking.status.value}' to '{new_status.value}'",
            )

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        # Vendor can only initiate completion on or after the event date (admin may override).
        if new_status == BookingStatus.AWAITING_CONFIRMATION and not force:
            event_dt = booking.event_date
            if event_dt.tzinfo is None:
                event_dt = event_dt.replace(tzinfo=timezone.utc)
            if now < event_dt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Cannot mark complete before the event date "
                        f"({event_dt.strftime('%d %b %Y, %H:%M UTC')})"
                    ),
                )

        booking.status = new_status

        # Stamp the time vendor initiated completion — used for 24-hour auto-release countdown
        if new_status == BookingStatus.AWAITING_CONFIRMATION:
            booking.vendor_confirmed_at = now
        db.commit()
        db.refresh(booking)

        # Trigger payout if completed — use atomic UPDATE to prevent double payout on concurrent requests
        if new_status == BookingStatus.COMPLETED:
            rows_claimed = (
                db.query(Booking)
                .filter(Booking.id == booking.id, Booking.paid_out == False)  # noqa: E712
                .update({"paid_out": True}, synchronize_session=False)
            )
            db.commit()

            if rows_claimed == 1:
                try:
                    vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
                    if vendor and vendor.recipient_code:
                        amount = float(booking.price) * 0.90
                        paystack_service.initiate_transfer(
                            amount=amount,
                            recipient_code=vendor.recipient_code,
                            reference=f"BKG_{booking.id}",
                            reason=f"Payout for Booking #{booking.id}",
                        )
                except Exception as e:
                    logger.error("Payout failed for booking %s: %s", booking.id, str(e))
        
        return booking
    
    @staticmethod
    def auto_release_expired_bookings(db: Session) -> int:
        """Release payment for bookings where customer did not confirm within 24 hours.
        Called by the background task every 15 minutes. Returns number of bookings released."""
        from datetime import datetime, timezone, timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

        expired = (
            db.query(Booking)
            .filter(
                Booking.status == BookingStatus.AWAITING_CONFIRMATION,
                Booking.vendor_confirmed_at != None,  # noqa: E711
                Booking.vendor_confirmed_at <= cutoff,
            )
            .all()
        )

        released = 0
        for booking in expired:
            rows_claimed = (
                db.query(Booking)
                .filter(Booking.id == booking.id, Booking.paid_out == False)  # noqa: E712
                .update({"paid_out": True, "status": BookingStatus.COMPLETED}, synchronize_session=False)
            )
            db.commit()

            if rows_claimed == 1:
                released += 1
                try:
                    vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
                    if vendor and vendor.recipient_code:
                        amount = float(booking.price) * 0.90
                        paystack_service.initiate_transfer(
                            amount=amount,
                            recipient_code=vendor.recipient_code,
                            reference=f"BKG_{booking.id}_AUTO",
                            reason=f"Auto-released payout for Booking #{booking.id}",
                        )
                except Exception as e:
                    logger.error("Auto-release payout failed for booking %s: %s", booking.id, str(e))

        if released:
            logger.info("Auto-released %d booking(s) after 24-hour window", released)
        return released

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

