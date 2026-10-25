"""Booking trust layer: cancellations with fair refund splits, vendor accountability,
reconfirmation and check-in, the no-show fast track, and the countdown check-ins.

Everything money-related goes through BookingService.refund / initiate_payout, so the usual
guarantees still hold (one refund, one payout, admin approval above the threshold)."""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.entities.booking.model import Booking, BookingStatus
from app.entities.booking.service import BookingService
from app.entities.vendor.incident import VendorIncident
from app.entities.vendor.model import Vendor
from app.services import cancellation as rules
from app.services.pricing import money

logger = logging.getLogger(__name__)

ACCEPT_WINDOW = timedelta(hours=48)       # vendor must accept a paid request within this
MIN_RESPONSE = timedelta(hours=2)         # short-notice bookings: never less than this to respond
RESPONSE_BUFFER = timedelta(hours=6)      # ...and normally at least this long before the event
RECONFIRM_WINDOW = timedelta(hours=48)    # after the 7-day reminder
NO_SHOW_RESPONSE = timedelta(hours=24)    # vendor's time to answer a no-show report
CHECK_IN_OPENS = timedelta(hours=6)       # before the event start
ADVANCE_WINDOW = timedelta(days=3)        # advances go out no earlier than 3 days before the event
STRIKE_WINDOW = timedelta(days=90)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)



def response_deadline(booking) -> datetime:
    """When a paid request must be accepted: 48 hours after payment or 6 hours before the event,
    whichever is sooner — but never less than 2 hours after payment, and never after the event starts."""
    paid, event = _aware(booking.paid_at), _aware(booking.event_date)
    due = min(paid + ACCEPT_WINDOW, event - RESPONSE_BUFFER)
    return min(max(due, paid + MIN_RESPONSE), event)


def _vendor_of(db: Session, user_id: int) -> Optional[Vendor]:
    return db.query(Vendor).filter(Vendor.user_id == user_id).first()


def _chat_note(db: Session, booking: Booking, text: str) -> None:
    try:
        from app.entities.chat.service import ChatService
        ChatService.system_message(db, booking.customer_id, booking.vendor_id, text)
    except Exception as exc:
        logger.error("Couldn't post chat note for booking %s: %s", booking.id, exc)


class TrustService:
    # ── Customer cancels ─────────────────────────────────────────────────────
    @staticmethod
    def cancel_by_customer(db: Session, booking: Booking, customer_id: int, reason: str = "",
                           request_review: bool = False) -> Booking:
        if booking.customer_id != customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        if booking.status not in (BookingStatus.AWAITING_PAYMENT, BookingStatus.PENDING, BookingStatus.CONFIRMED):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This booking can no longer be cancelled")

        previous = booking.status
        outcome = rules.customer_cancellation(booking) if booking.paid_at else None
        claimed = (
            db.query(Booking).filter(Booking.id == booking.id, Booking.status == previous)
            .update({"status": BookingStatus.CANCELLED, "cancelled_by": "customer", "cancelled_at": _now(),
                     "cancellation_reason": (reason or "").strip()[:2000] or None}, synchronize_session=False)
        )
        db.commit()
        db.refresh(booking)
        if not claimed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking was updated. Please refresh.")
        if not booking.paid_at:
            return booking

        if request_review and not outcome.full_refund:
            # Exceptional circumstances (bereavement, venue disaster…): an admin decides.
            booking.refund_status = "pending_review"
            db.commit()
            _chat_note(db, booking, f"Booking #{booking.id} was cancelled by the customer. Plagohive is reviewing the refund.")
            return booking

        if outcome.full_refund:
            booking.refund_amount = outcome.refund_amount
            db.commit()
            BookingService.refund(db, booking, "Customer cancelled — full refund")
        else:
            booking.refund_amount = outcome.refund_amount
            booking.commission_amount = outcome.commission
            booking.payout_amount = outcome.vendor_payout
            db.commit()
            if outcome.refund_amount > 0:
                BookingService.refund(db, booking, f"Customer cancelled — {outcome.refund_pct}% refund", amount=outcome.refund_amount)
            if outcome.vendor_payout > 0:
                BookingService.initiate_payout(db, booking)
        _chat_note(db, booking, f"Booking #{booking.id} was cancelled by the customer.")
        db.refresh(booking)
        return booking

    # ── Vendor lets the customer down ────────────────────────────────────────
    @staticmethod
    def cancel_by_vendor(db: Session, booking: Booking, user_id: int, reason: str) -> Booking:
        vendor = _vendor_of(db, user_id)
        if not vendor or booking.vendor_id != vendor.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        if booking.status != BookingStatus.CONFIRMED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Only accepted, upcoming bookings can be cancelled. Use Decline for new requests.")
        claimed = (
            db.query(Booking).filter(Booking.id == booking.id, Booking.status == BookingStatus.CONFIRMED)
            .update({"status": BookingStatus.CANCELLED, "cancelled_by": "vendor", "cancelled_at": _now(),
                     "cancellation_reason": reason.strip()[:2000]}, synchronize_session=False)
        )
        db.commit()
        db.refresh(booking)
        if not claimed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking was updated. Please refresh.")
        TrustService._vendor_fault(db, booking, kind="cancellation", reason=reason)
        return booking

    @staticmethod
    def _vendor_fault(db: Session, booking: Booking, kind: str, reason: str) -> None:
        """Full refund to the customer, fee + strike for the vendor, rescue help for the customer."""
        fault = rules.vendor_fault(booking, no_show=(kind == "no_show"))
        booking.refund_amount = money(booking.customer_total)
        db.add(VendorIncident(vendor_id=booking.vendor_id, booking_id=booking.id, kind=kind,
                              severity=fault.severity, reason=reason[:2000], fee=fault.fee, fee_remaining=fault.fee))
        if booking.advance_status == "paid" and booking.advance_amount:
            # The customer is refunded in full; the advance already sent becomes a debt on future payouts
            db.add(VendorIncident(vendor_id=booking.vendor_id, booking_id=booking.id, kind="advance_recovery",
                                  severity="logged", reason="Advance paid before the vendor cancelled",
                                  fee=booking.advance_amount, fee_remaining=booking.advance_amount))
        db.commit()
        BookingService.refund(db, booking, "Vendor cancelled — full refund" if kind == "cancellation" else "Vendor no-show — full refund")
        TrustService._apply_strikes(db, booking.vendor_id, severe=(fault.severity == "severe"))

        late = rules.days_before(booking.event_date, _now()) < 7
        from app.entities.booking.notifications import notify_vendor_fault
        notify_vendor_fault(db, booking, kind=kind, fee=fault.fee, urgent=late)
        _chat_note(db, booking, f"Booking #{booking.id} was cancelled by the vendor. You're getting a full refund.")

    @staticmethod
    def _apply_strikes(db: Session, vendor_id: int, severe: bool) -> None:
        since = _now() - STRIKE_WINDOW
        strikes = db.query(func.count(VendorIncident.id)).filter(
            VendorIncident.vendor_id == vendor_id, VendorIncident.created_at >= since,
            VendorIncident.severity.in_(["strike", "severe"]),
        ).scalar() or 0
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            return
        if strikes >= 3:
            from app.entities.vendor.model import VerificationStatus
            vendor.is_active = False
            vendor.verification_status = VerificationStatus.REJECTED
            vendor.verification_note = "Removed after 3 cancellations or no-shows within 90 days."
        elif severe or strikes >= 2:
            vendor.is_active = False
            vendor.verification_note = (
                "Paused after a last-minute cancellation or no-show. Our team will review your account."
                if severe else "Paused after 2 cancellations within 90 days. Our team will review your account."
            )
        db.commit()

    @staticmethod
    def reliability(db: Session, vendor_id: int) -> dict:
        since = _now() - STRIKE_WINDOW
        rows = db.query(VendorIncident).filter(VendorIncident.vendor_id == vendor_id).all()
        return {
            "strikes_90d": sum(1 for r in rows if r.severity in ("strike", "severe") and _aware(r.created_at) >= since),
            "fees_owed": float(sum(Decimal(str(r.fee_remaining or 0)) for r in rows)),
            "incidents": len(rows),
        }

    @staticmethod
    def recover_fees(db: Session, vendor_id: int, available: Decimal) -> Decimal:
        """Take owed late-cancellation fees out of a payout (oldest first). Returns amount recovered."""
        recovered = Decimal("0")
        owed = (
            db.query(VendorIncident)
            .filter(VendorIncident.vendor_id == vendor_id, VendorIncident.fee_remaining > 0)
            .order_by(VendorIncident.created_at.asc())
            .with_for_update()
            .all()
        )
        for inc in owed:
            if available <= 0:
                break
            take = min(Decimal(str(inc.fee_remaining)), available)
            inc.fee_remaining = money(Decimal(str(inc.fee_remaining)) - take)
            available -= take
            recovered += take
        return money(recovered)

    # ── Reconfirm & check in ─────────────────────────────────────────────────
    @staticmethod
    def _vendor_booking(db: Session, booking_id: int, user_id: int) -> Booking:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        vendor = _vendor_of(db, user_id)
        if not booking or not vendor or booking.vendor_id != vendor.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        return booking

    @staticmethod
    def reconfirm(db: Session, booking_id: int, user_id: int) -> Booking:
        booking = TrustService._vendor_booking(db, booking_id, user_id)
        if booking.status != BookingStatus.CONFIRMED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only upcoming accepted bookings can be reconfirmed")
        if not booking.reconfirmed_at:
            booking.reconfirmed_at = _now()
            db.commit()
            _chat_note(db, booking, f"The vendor reconfirmed booking #{booking.id}. You can now see each other's phone numbers on the booking.")
        TrustService.release_advance(db, booking)
        return booking

    @staticmethod
    def release_advance(db: Session, booking: Booking) -> None:
        """Send the agreed mobilisation advance once the vendor reconfirms (at most once)."""
        if not booking.advance_amount or booking.advance_status == "paid" or booking.status != BookingStatus.CONFIRMED:
            return
        if _aware(booking.event_date) - _now() > ADVANCE_WINDOW:
            return   # sent later by the countdown job, once the event is 3 days away
        vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
        if not vendor or not vendor.recipient_code:
            booking.advance_status, booking.advance_error = "failed", "Vendor has no verified bank account"
            db.commit()
            return
        from app.entities.booking import service as booking_service
        from app.services.paystack import PaystackError
        try:
            booking_service.paystack_service.initiate_transfer(amount=money(booking.advance_amount), recipient_code=vendor.recipient_code,
                                               reference=f"PLG-ADV-{booking.id}", reason=f"Mobilisation advance for booking #{booking.id}")
            booking.advance_status, booking.advance_paid_at, booking.advance_error = "paid", _now(), None
            db.commit()
            _chat_note(db, booking, f"\u20a6{booking.advance_amount:,.2f} was released to the vendor for preparation. The rest stays held until you confirm the service.")
        except (PaystackError, HTTPException) as exc:
            booking.advance_status, booking.advance_error = "failed", str(exc)[:500]
            db.commit()
            logger.error("Advance transfer failed for booking %s: %s", booking.id, exc)

    @staticmethod
    def check_in(db: Session, booking_id: int, user_id: int) -> Booking:
        booking = TrustService._vendor_booking(db, booking_id, user_id)
        start = _aware(booking.event_date)
        if booking.status not in (BookingStatus.CONFIRMED, BookingStatus.DISPUTED):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This booking isn't active")
        if _now() < start - CHECK_IN_OPENS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Check-in opens 6 hours before the event starts")
        if not booking.checked_in_at:
            booking.checked_in_at = _now()
            db.commit()
            _chat_note(db, booking, "The vendor has checked in at the event.")
        return booking

    @staticmethod
    def respond_to_no_show(db: Session, booking_id: int, user_id: int, message: str) -> Booking:
        booking = TrustService._vendor_booking(db, booking_id, user_id)
        if booking.status != BookingStatus.DISPUTED or booking.dispute_kind != "no_show":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="There's no no-show report to answer")
        booking.vendor_responded_at = _now()
        db.commit()
        try:
            from app.entities.chat.service import ChatService
            from app.entities.user.model import User
            conv_user = db.query(User).filter(User.id == user_id).first()
            from app.entities.chat.model import Conversation
            conv = db.query(Conversation).filter(Conversation.customer_id == booking.customer_id,
                                                 Conversation.vendor_id == booking.vendor_id).first()
            if conv and conv_user and message.strip():
                ChatService.send(db, conv, conv_user, "vendor", f"[Response to no-show report] {message.strip()}")
        except Exception as exc:
            logger.error("Couldn't post vendor response for %s: %s", booking.id, exc)
        return booking

    # ── Scheduled work (runs every 15 minutes) ───────────────────────────────
    @staticmethod
    def expire_unaccepted(db: Session) -> int:
        """Paid requests the vendor never accepted are refunded in full automatically."""
        now = _now()
        rows = db.query(Booking).filter(Booking.status == BookingStatus.PENDING, Booking.paid_at.isnot(None)).all()
        n = 0
        for b in rows:
            if now < response_deadline(b):
                continue
            claimed = db.query(Booking).filter(Booking.id == b.id, Booking.status == BookingStatus.PENDING).update(
                {"status": BookingStatus.DECLINED, "cancelled_by": "system", "cancelled_at": now,
                 "cancellation_reason": "The vendor didn't respond in time.", "refund_amount": b.customer_total},
                synchronize_session=False)
            db.commit()
            if claimed:
                db.refresh(b)
                BookingService.refund(db, b, "Vendor didn't respond in time")
                from app.entities.booking.notifications import notify_request_expired
                notify_request_expired(db, b)
                n += 1
        return n

    @staticmethod
    def resolve_overdue_no_shows(db: Session) -> int:
        """A no-show report the vendor didn't answer within 24h is upheld automatically."""
        now = _now()
        rows = db.query(Booking).filter(
            Booking.status == BookingStatus.DISPUTED, Booking.dispute_kind == "no_show",
            Booking.vendor_responded_at.is_(None), Booking.response_due_at <= now, Booking.resolution.is_(None),
        ).all()
        for b in rows:
            claimed = db.query(Booking).filter(Booking.id == b.id, Booking.resolution.is_(None)).update(
                {"status": BookingStatus.CANCELLED, "cancelled_by": "vendor", "cancelled_at": now,
                 "resolution": "refund", "resolved_at": now,
                 "resolution_note": "The vendor didn't respond to the no-show report within 24 hours, so you've been refunded in full."},
                synchronize_session=False)
            db.commit()
            if claimed:
                db.refresh(b)
                TrustService._vendor_fault(db, b, kind="no_show", reason="Customer reported no-show; vendor did not respond")
        return len(rows)

    @staticmethod
    def run_countdown(db: Session) -> dict:
        """7-day check-in (+ vendor reconfirm), reconfirm chase, 2-day final details, event-day reminders."""
        from app.entities.booking.notifications import (
            notify_countdown_customer, notify_countdown_vendor, notify_reconfirm_overdue,
        )
        now = _now()
        sent = {"t7": 0, "chase": 0, "t2": 0, "day": 0}
        rows = db.query(Booking).filter(
            Booking.status == BookingStatus.CONFIRMED,
            Booking.event_date > now - timedelta(hours=12),
            Booking.event_date <= now + timedelta(days=7),
        ).all()
        for b in rows:
            r = dict(b.reminders or {})
            until = _aware(b.event_date) - now
            changed = False
            # Send only the stage that fits the time left. A booking made 36 hours before the event
            # gets the 2-day email, not a "one week to go" email followed by a second one.
            if until <= timedelta(hours=8):
                for stage in ("t7", "t2"):
                    if stage not in r:
                        r[stage] = "skipped"; changed = True
            elif until <= timedelta(days=3) and "t7" not in r:
                r["t7"] = "skipped"; changed = True
            if "t7" not in r:
                notify_countdown_customer(db, b, "t7")
                notify_countdown_vendor(db, b, "t7")
                r["t7"] = now.isoformat(); changed = True; sent["t7"] += 1
            t7_sent_at = datetime.fromisoformat(r["t7"]) if r.get("t7") not in (None, "skipped") else None
            if (not b.reconfirmed_at and "chase" not in r and r.get("t7") != "skipped" and until > timedelta(hours=8)
                    and ((t7_sent_at and now - t7_sent_at >= RECONFIRM_WINDOW) or until <= timedelta(days=2))):
                notify_reconfirm_overdue(db, b)
                r["chase"] = now.isoformat(); changed = True; sent["chase"] += 1
            if until <= timedelta(days=2) and "t2" not in r:
                notify_countdown_customer(db, b, "t2")
                notify_countdown_vendor(db, b, "t2")
                r["t2"] = now.isoformat(); changed = True; sent["t2"] += 1
            if b.reconfirmed_at and b.advance_amount and b.advance_status != "paid" and until <= ADVANCE_WINDOW:
                TrustService.release_advance(db, b)
            if until <= timedelta(hours=8) and "day" not in r:
                notify_countdown_customer(db, b, "day")
                notify_countdown_vendor(db, b, "day")
                from app.entities.booking.notifications import sms_event_day
                sms_event_day(db, b)
                r["day"] = now.isoformat(); changed = True; sent["day"] += 1
            if changed:
                b.reminders = r
                db.commit()
        return sent

    @staticmethod
    def upcoming_board(db: Session, days: int = 7) -> list[dict]:
        now = _now()
        rows = (
            db.query(Booking)
            .filter(Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.DISPUTED]),
                    Booking.paid_at.isnot(None),
                    Booking.event_date > now - timedelta(hours=12),
                    Booking.event_date <= now + timedelta(days=days))
            .order_by(Booking.event_date.asc())
            .all()
        )
        out = []
        for b in rows:
            until = _aware(b.event_date) - now
            if b.status == BookingStatus.DISPUTED:
                health, note = "red", "Problem reported"
            elif b.status == BookingStatus.PENDING:
                health, note = "red" if until < timedelta(days=2) else "amber", "Vendor hasn't accepted yet"
            elif until <= timedelta(hours=0) and not b.checked_in_at:
                health, note = "red", "Event started — vendor not checked in"
            elif b.checked_in_at:
                health, note = "green", "Vendor checked in"
            elif b.reconfirmed_at:
                health, note = "green", "Reconfirmed"
            elif (b.reminders or {}).get("chase"):
                health, note = "red", "Not reconfirmed — chased"
            else:
                health, note = "amber", "Waiting for reconfirmation"
            out.append({
                "id": b.id, "event_date": _aware(b.event_date).isoformat(), "status": b.status.value,
                "health": health, "note": note,
                "vendor_name": b.vendor.business_name if b.vendor else None,
                "vendor_phone": b.vendor.user.phone_number if b.vendor and b.vendor.user else None,
                "customer_name": b.customer.full_name if b.customer else None,
                "customer_phone": b.customer.phone_number if b.customer else None,
                "venue": ", ".join(x for x in [(b.event_address or {}).get("venue_name"), (b.event_address or {}).get("city")] if x),
            })
        return out
