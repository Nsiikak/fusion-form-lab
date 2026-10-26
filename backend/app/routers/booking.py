"""Booking endpoints.

Route handlers are plain `def` (not `async def`) on purpose: they make blocking
database and Paystack calls, and FastAPI runs sync handlers in a threadpool so
they don't stall the event loop.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.booking import schema
from app.entities.booking.model import Booking, BookingStatus
from app.entities.booking.notifications import notify_booking_paid, notify_dispute_opened, notify_status_change
from app.entities.booking.service import BookingService, serialize_booking
from app.entities.user.model import User
from app.entities.vendor.service import VendorService
from app.services.paystack import PaystackError, paystack_service
from app.services.pricing import calculate_quote, get_bookable_vendor, to_kobo

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_owned_booking(db: Session, booking_id: int, user: User) -> Booking:
    booking = BookingService.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if user.role.value == "admin":
        return booking
    if booking.customer_id == user.id:
        return booking
    vendor = VendorService.get_vendor_by_user_id(db, user.id)
    if vendor and booking.vendor_id == vendor.id and booking.paid_at is not None:
        return booking
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this booking")


@router.post("/quote", response_model=dict)
def get_quote(request: schema.QuoteRequest, db: Session = Depends(get_db)):
    """Customer-facing price breakdown. The checkout UI displays this instead of computing totals itself."""
    vendor = get_bookable_vendor(db, request.vendor_id)
    return calculate_quote(db, vendor, request.service_items, request.event_state).customer_view()


@router.get("/policies", response_model=dict)
def cancellation_policies():
    """The three cancellation policies vendors can choose from (shown at setup and checkout)."""
    from app.services.cancellation import POLICIES
    return {k: {"label": v["label"], "summary": v["summary"], "tiers": v["tiers"]} for k, v in POLICIES.items()}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def start_checkout(
    booking_data: schema.BookingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Step 1 of checkout: reserve an unpaid booking and return what the Paystack popup needs.
    The vendor is not notified until payment is confirmed."""
    if current_user.role.value != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only customers can create bookings")

    booking = BookingService.start_checkout(db, booking_data, current_user.id)
    return {
        "booking_id": booking.id,
        "reference": booking.payment_reference,
        "amount_kobo": to_kobo(booking.customer_total),
        "currency": "NGN",
        "email": current_user.email,
        "customer_total": float(booking.customer_total),
    }


@router.post("/{booking_id}/verify-payment", response_model=dict)
def verify_payment(
    booking_id: int,
    body: Optional[schema.VerifyPaymentRequest] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Step 2 of checkout: called by the frontend after the Paystack popup succeeds.
    The Paystack webhook does the same thing as a backstop if this call never arrives."""
    booking = BookingService.get_booking_by_id(db, booking_id)
    if not booking or booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.paid_at is None:
        paid = BookingService.verify_and_confirm(db, booking, current_user,
                                                 client_reference=(body.reference if body else None))
        if paid:
            notify_booking_paid(db, booking)
        elif paid is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="We couldn't confirm your payment yet. If you were charged, your booking will "
                       "update automatically within a few minutes.",
            )
        db.refresh(booking)

    if booking.paid_at is None:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Payment not completed")
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This checkout expired before payment arrived. Your payment is being refunded.",
        )
    return serialize_booking(booking, "customer")


@router.get("", response_model=list[dict])
def get_my_bookings(
    status_filter: Optional[BookingStatus] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return BookingService.get_user_bookings(db, current_user.id, current_user.role.value, status_filter)


@router.get("/{booking_id}", response_model=dict)
def get_booking(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    booking = _get_owned_booking(db, booking_id, current_user)
    return serialize_booking(booking, current_user.role.value)


def _pdf(data: bytes, filename: str) -> Response:
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/{booking_id}/receipt")
def download_receipt(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Customer's payment receipt (PDF). Available once the payment is confirmed."""
    booking = BookingService.get_booking_by_id(db, booking_id)
    if not booking or (booking.customer_id != current_user.id and current_user.role.value != "admin"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.paid_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No receipt yet — this booking hasn't been paid")
    from app.services.documents import payment_receipt_pdf
    return _pdf(payment_receipt_pdf(booking), f"Plagohive-receipt-{booking.receipt_number or booking.id}.pdf")


@router.get("/{booking_id}/payout-statement")
def download_payout_statement(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Vendor's payout statement (PDF). Available once the payout has been sent."""
    booking = BookingService.get_booking_by_id(db, booking_id)
    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    allowed = current_user.role.value == "admin" or (vendor and booking and booking.vendor_id == vendor.id)
    if not booking or not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.payout_status not in ("processing", "awaiting_otp", "paid", "credited"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No payout statement yet — the payout hasn't been sent")
    from app.services.documents import payout_statement_pdf
    return _pdf(payout_statement_pdf(booking), f"Plagohive-payout-{booking.payout_statement_number or booking.id}.pdf")


@router.put("/{booking_id}/status", response_model=dict)
def update_booking_status(
    booking_id: int,
    new_status: BookingStatus = Query(..., description="New booking status"),
    force: bool = Query(False, description="Admin override: skip event-date restriction"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    admin_force = force and current_user.role.value == "admin"
    booking = BookingService.update_booking_status(
        db, booking_id, new_status, current_user.id, current_user.role.value, force=admin_force
    )
    notify_status_change(db, booking, new_status)
    return serialize_booking(booking, current_user.role.value)


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    BookingService.delete_booking(db, booking_id, current_user.id)
    return None


@router.post("/{booking_id}/dispute", response_model=dict)
def open_dispute(
    booking_id: int,
    body: schema.DisputeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Customer reports a problem (service not delivered, not as agreed, vendor no-show).
    Payment stays in escrow until an admin decides."""
    if current_user.role.value != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only customers can report a problem")
    booking = BookingService.open_dispute(db, booking_id, current_user.id, body.reason, no_show=body.no_show)
    notify_dispute_opened(db, booking)
    return serialize_booking(booking, "customer")


# ── Cancellations, reconfirmation, check-in ──────────────────────────────────

@router.get("/{booking_id}/cancellation-preview", response_model=dict)
def cancellation_preview(booking_id: int, current_user: User = Depends(get_current_active_user),
                         db: Session = Depends(get_db)):
    """Exactly what the customer gets back if they cancel now — shown before they confirm."""
    from app.services.cancellation import customer_cancellation
    booking = BookingService.get_booking_by_id(db, booking_id)
    if not booking or booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if not booking.paid_at:
        return {"refund_amount": 0, "refund_pct": 100, "full_refund": True, "reason": "You haven't been charged."}
    return customer_cancellation(booking).as_dict() | {"policy": booking.policy_snapshot}


@router.post("/{booking_id}/cancel", response_model=dict)
def cancel_booking(booking_id: int, body: schema.CancelRequest, current_user: User = Depends(get_current_active_user),
                   db: Session = Depends(get_db)):
    from app.entities.booking.trust import TrustService
    booking = BookingService.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    booking = TrustService.cancel_by_customer(db, booking, current_user.id, body.reason or "", body.request_review)
    return serialize_booking(booking, "customer")


@router.post("/{booking_id}/vendor-cancel", response_model=dict)
def vendor_cancel(booking_id: int, body: schema.VendorCancelRequest, current_user: User = Depends(get_current_active_user),
                  db: Session = Depends(get_db)):
    from app.entities.booking.trust import TrustService
    booking = BookingService.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    booking = TrustService.cancel_by_vendor(db, booking, current_user.id, body.reason)
    return serialize_booking(booking, "vendor")


@router.get("/{booking_id}/vendor-cancel-preview", response_model=dict)
def vendor_cancel_preview(booking_id: int, current_user: User = Depends(get_current_active_user),
                          db: Session = Depends(get_db)):
    from app.services.cancellation import vendor_fault
    booking = BookingService.get_booking_by_id(db, booking_id)
    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not booking or not vendor or booking.vendor_id != vendor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return vendor_fault(booking).as_dict()


@router.post("/{booking_id}/reconfirm", response_model=dict)
def reconfirm(booking_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from app.entities.booking.trust import TrustService
    return serialize_booking(TrustService.reconfirm(db, booking_id, current_user.id), "vendor")


@router.post("/{booking_id}/check-in", response_model=dict)
def check_in(booking_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from app.entities.booking.trust import TrustService
    return serialize_booking(TrustService.check_in(db, booking_id, current_user.id), "vendor")


@router.post("/{booking_id}/no-show-response", response_model=dict)
def no_show_response(booking_id: int, body: schema.NoShowResponse, current_user: User = Depends(get_current_active_user),
                     db: Session = Depends(get_db)):
    from app.entities.booking.trust import TrustService
    return serialize_booking(TrustService.respond_to_no_show(db, booking_id, current_user.id, body.message), "vendor")


# ── Add-ons after booking ────────────────────────────────────────────────────

@router.get("/{booking_id}/addons", response_model=list)
def list_addons(booking_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from app.entities.booking.addons_service import AddonService
    return AddonService.list_for(db, booking_id, current_user)


@router.post("/{booking_id}/addons", response_model=dict, status_code=status.HTTP_201_CREATED)
def propose_addon(booking_id: int, body: schema.AddonRequest, current_user: User = Depends(get_current_active_user),
                  db: Session = Depends(get_db)):
    from app.entities.booking.addons_service import AddonService, serialize_addon
    return serialize_addon(AddonService.propose(db, booking_id, current_user, [i.model_dump() for i in body.items], body.note or ""))


@router.post("/{booking_id}/addons/{addon_id}/checkout", response_model=dict)
def addon_checkout(booking_id: int, addon_id: int, current_user: User = Depends(get_current_active_user),
                   db: Session = Depends(get_db)):
    from app.entities.booking.addons_service import AddonService
    return AddonService.checkout(db, booking_id, addon_id, current_user)


@router.post("/{booking_id}/addons/{addon_id}/verify", response_model=dict)
def addon_verify(booking_id: int, addon_id: int, current_user: User = Depends(get_current_active_user),
                 db: Session = Depends(get_db)):
    from app.entities.booking.addons_service import AddonService, serialize_addon
    return serialize_addon(AddonService.verify(db, booking_id, addon_id, current_user))


@router.post("/{booking_id}/addons/{addon_id}/{action}", response_model=dict)
def addon_respond(booking_id: int, addon_id: int, action: str, current_user: User = Depends(get_current_active_user),
                  db: Session = Depends(get_db)):
    from app.entities.booking.addons_service import AddonService, serialize_addon
    if action not in ("decline", "withdraw"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown action")
    return serialize_addon(AddonService.respond(db, booking_id, addon_id, current_user, action))


@router.post("/{booking_id}/quote/decline", response_model=dict)
def decline_quote(booking_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from app.entities.booking.quotes import decline_quote as _decline
    b = BookingService.get_booking_by_id(db, booking_id)
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    b = _decline(db, b, current_user)
    return serialize_booking(b, "customer" if b.customer_id == current_user.id else "vendor")


# ── Reductions after booking ─────────────────────────────────────────────────

@router.post("/{booking_id}/reductions/preview", response_model=dict)
def reduction_preview(booking_id: int, body: schema.ReductionRequest, current_user: User = Depends(get_current_active_user),
                      db: Session = Depends(get_db)):
    from app.entities.booking import reductions
    return reductions.preview(db, booking_id, current_user, body.lines)


@router.post("/{booking_id}/reductions", response_model=dict)
def reduce_booking(booking_id: int, body: schema.ReductionRequest, current_user: User = Depends(get_current_active_user),
                   db: Session = Depends(get_db)):
    from app.entities.booking import reductions
    r = reductions.apply(db, booking_id, current_user, body.lines, body.reason or "")
    b = BookingService.get_booking_by_id(db, booking_id)
    return {"refund_amount": float(r.refund_amount), "refund_pct": r.refund_pct,
            "booking": serialize_booking(b, "customer" if b.customer_id == current_user.id else "vendor")}
