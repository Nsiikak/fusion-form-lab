import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import CHECKOUT_EXPIRY_MINUTES
from app.entities.booking.model import Booking, BookingStatus
from app.entities.booking.schema import BookingCreate
from app.entities.vendor.model import Vendor
from app.services.paystack import PaystackError, paystack_service
from app.services.pricing import calculate_quote, get_bookable_vendor, money, to_kobo
from app.services import cancellation as cancellation_rules

logger = logging.getLogger(__name__)


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def _num(value) -> Optional[float]:
    return float(value) if value is not None else None


def _respond_by(booking) -> Optional[str]:
    if booking.status != BookingStatus.PENDING or not booking.paid_at:
        return None
    from app.entities.booking.trust import response_deadline
    return response_deadline(booking).isoformat()


def serialize_booking(booking: Booking, role: str, has_review: bool = False) -> dict:
    """Role-aware booking payload.

    Customers see what they paid (`price` = customer_total) and never see commission or payout.
    Vendors see their own price (`price` = vendor_total), commission and payout, but not the
    customer-side platform fee.
    """
    vendor = booking.vendor
    customer = booking.customer
    data = {
        "id": booking.id,
        "customer_id": booking.customer_id,
        "vendor_id": booking.vendor_id,
        "event_id": booking.event_id,
        "status": booking.status.value,
        "booking_date": _iso(booking.booking_date),
        "event_date": _iso(booking.event_date),
        "event_time": booking.event_time.isoformat() if booking.event_time else None,
        "notes": booking.notes,
        "created_at": _iso(booking.created_at),
        "updated_at": _iso(booking.updated_at),
        "vendor_name": vendor.business_name if vendor else None,
        "vendor_category": vendor.category.value if vendor else None,
        "customer_name": customer.full_name if customer else None,
        "customer_email": customer.email if customer else None,
        "has_review": has_review,
        "service_items_snapshot": booking.service_items_snapshot,
        "event_address": booking.event_address,
        "vendor_confirmed_at": _iso(booking.vendor_confirmed_at),
        "paid_at": _iso(booking.paid_at),
        "refund_status": booking.refund_status,
        "dispute_reason": booking.dispute_reason,
        "disputed_at": _iso(booking.disputed_at),
        "resolution": booking.resolution,
        "resolution_note": booking.resolution_note,
        "resolved_at": _iso(booking.resolved_at),
        "refunded_at": _iso(booking.refunded_at),
        "cancelled_by": booking.cancelled_by,
        "cancellation_reason": booking.cancellation_reason,
        "refund_amount": _num(booking.refund_amount),
        "policy": ({k: booking.policy_snapshot.get(k) for k in ("key", "label", "summary")}
                   if booking.policy_snapshot else None),
        "reconfirmed_at": _iso(booking.reconfirmed_at),
        "checked_in_at": _iso(booking.checked_in_at),
        "dispute_kind": booking.dispute_kind,
        "response_due_at": _iso(booking.response_due_at),
        "vendor_responded_at": _iso(booking.vendor_responded_at),
        "quote_expires_at": _iso(booking.quote_expires_at),
        "respond_by": _respond_by(booking),
        "advance_amount": _num(booking.advance_amount),
        "advance_status": booking.advance_status,
        "advance_paid_at": _iso(booking.advance_paid_at),
    }
    # Phone numbers are shared once the vendor reconfirms (7 days out)
    if booking.reconfirmed_at and booking.status in (BookingStatus.CONFIRMED, BookingStatus.AWAITING_CONFIRMATION,
                                                     BookingStatus.DISPUTED):
        if role == "customer" and vendor and vendor.user:
            data["counterpart_phone"] = vendor.user.phone_number
        elif role == "vendor" and customer:
            data["counterpart_phone"] = customer.phone_number
    if role in ("customer", "admin"):
        data["receipt_number"] = booking.receipt_number
    if role in ("vendor", "admin"):
        data["payout_statement_number"] = booking.payout_statement_number
        data["penalty_deducted"] = _num(booking.penalty_deducted)
        data["payout_paid_at"] = _iso(booking.payout_paid_at)
    if role == "vendor":
        data.update({
            "price": _num(booking.price),
            "commission_amount": _num(booking.commission_amount),
            "payout_amount": _num(booking.payout_amount),
            "payout_status": booking.payout_status,
        })
    else:
        data.update({
            "price": _num(booking.customer_total if booking.customer_total is not None else booking.price),
            "vendor_total": _num(booking.price),
            "platform_fee": _num(booking.platform_fee),
        })
    if role == "admin":
        vendor_user = vendor.user if vendor else None
        data.update({
            "price": _num(booking.customer_total if booking.customer_total is not None else booking.price),
            "vendor_total": _num(booking.price),
            "platform_fee": _num(booking.platform_fee),
            "customer_phone": customer.phone_number if customer else None,
            "vendor_email": vendor_user.email if vendor_user else None,
            "vendor_phone": vendor_user.phone_number if vendor_user else None,
            "vendor_has_bank_account": bool(vendor and vendor.recipient_code),
            "customer_refund_account": (
                {"bank_name": customer.refund_bank_name, "account_number": customer.refund_account_number,
                 "account_name": customer.refund_account_name}
                if customer and customer.refund_account_number else None
            ),
            "commission_amount": _num(booking.commission_amount),
            "payout_amount": _num(booking.payout_amount),
            "payout_status": booking.payout_status,
            "payout_reference": booking.payout_reference,
            "payout_error": booking.payout_error,
            "payment_reference": booking.payment_reference,
        })
    return data


class BookingService:
    @staticmethod
    def get_booking_by_id(db: Session, booking_id: int) -> Optional[Booking]:
        return db.query(Booking).filter(Booking.id == booking_id).first()

    @staticmethod
    def get_user_bookings(
        db: Session,
        user_id: int,
        user_role: str,
        status_filter: Optional[BookingStatus] = None,
    ) -> List[dict]:
        """Paid bookings for a customer or vendor. Abandoned/unpaid checkouts are never listed."""
        query = db.query(Booking).filter(Booking.paid_at.isnot(None))

        if user_role == "customer":
            query = query.filter(Booking.customer_id == user_id)
        elif user_role == "vendor":
            vendor = db.query(Vendor).filter(Vendor.user_id == user_id).first()
            if not vendor:
                return []
            query = query.filter(Booking.vendor_id == vendor.id)
        else:
            return []

        if status_filter:
            query = query.filter(Booking.status == status_filter)

        query = query.options(joinedload(Booking.vendor), joinedload(Booking.customer))
        bookings = query.order_by(Booking.created_at.desc()).all()

        from app.entities.review.model import Review
        reviewed_ids: set[int] = set()
        if bookings:
            reviewed_ids = {
                row[0]
                for row in db.query(Review.booking_id)
                .filter(Review.booking_id.in_([b.id for b in bookings]))
                .all()
            }

        return [serialize_booking(b, user_role, b.id in reviewed_ids) for b in bookings]

    # ── Checkout ─────────────────────────────────────────────────────────────
    @staticmethod
    def start_checkout(db: Session, booking_data: BookingCreate, customer_id: int) -> Booking:
        """Create an AWAITING_PAYMENT booking with a server-computed price and a fresh reference."""
        vendor = get_bookable_vendor(db, booking_data.vendor_id)
        from app.entities.user.model import User as _User
        customer = db.query(_User).filter(_User.id == customer_id).first()
        if customer and not customer.phone_number:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Add your phone number so the vendor can reach you on the day.")
        state = booking_data.event_address.state if booking_data.event_address else None
        from app.services.ranking import unavailable_days
        day = booking_data.event_date.date()
        if day in unavailable_days(db, vendor, day, day):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"{vendor.business_name} isn't available on {day:%d %b %Y}. Pick another date or another vendor.")
        quote = calculate_quote(db, vendor, booking_data.service_items, state)

        if booking_data.event_id is not None:
            from app.entities.event.model import Event
            event = db.query(Event).filter(Event.id == booking_data.event_id).first()
            if not event or event.customer_id != customer_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event not found")
            # Vendors for an event can't be booked for a day before the event itself
            if booking_data.event_date.date() < event.date:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"This booking is for \"{event.name}\" on {event.date:%d %b %Y}; pick that date or later.")

        booking = Booking(
            customer_id=customer_id,
            vendor_id=vendor.id,
            event_id=booking_data.event_id,
            status=BookingStatus.AWAITING_PAYMENT,
            price=quote.vendor_total,
            platform_fee=quote.platform_fee,
            customer_total=quote.customer_total,
            commission_amount=quote.commission_amount,
            payout_amount=quote.payout_amount,
            event_date=booking_data.event_date,
            event_time=booking_data.event_time,
            notes=booking_data.notes,
            event_address=booking_data.event_address.model_dump() if booking_data.event_address else None,
            service_items_snapshot=quote.snapshot,
            policy_snapshot=cancellation_rules.policy_snapshot(vendor.cancellation_policy),
            advance_amount=quote.advance_amount if quote.advance_amount > 0 else None,
            logistics_fee=quote.logistics_fee,
            payment_reference=f"PLG-{secrets.token_hex(8).upper()}",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking

    @staticmethod
    def confirm_payment(db: Session, booking: Booking, tx: dict) -> bool:
        """Validate a Paystack transaction against the booking and mark it paid.

        `tx` is the transaction `data` object from Paystack (verify API or webhook).
        Returns True only the first time the booking becomes paid, so callers can send
        notifications exactly once. Safe to call repeatedly and concurrently.
        """
        reference = tx.get("reference")
        if tx.get("status") != "success" or reference != booking.payment_reference:
            return False

        expected_kobo = to_kobo(booking.customer_total)
        if int(tx.get("amount") or 0) != expected_kobo or (tx.get("currency") or "NGN") != "NGN":
            logger.error(
                "Payment mismatch on booking %s: expected %s kobo NGN, got %s %s",
                booking.id, expected_kobo, tx.get("amount"), tx.get("currency"),
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount does not match this booking. Please contact support.",
            )

        now = datetime.now(timezone.utc)
        claimed = (
            db.query(Booking)
            .filter(Booking.id == booking.id, Booking.status == BookingStatus.AWAITING_PAYMENT)
            .update({"status": BookingStatus.CONFIRMED if booking.quote_expires_at else BookingStatus.PENDING, "paid_at": now}, synchronize_session=False)
        )
        db.commit()
        db.refresh(booking)

        if claimed:
            BookingService._assign_number(db, booking, "receipt_number", "receipt_number_seq", "PLG-RCT", booking.paid_at)
            try:
                from app.entities.chat.service import ChatService
                ChatService.system_message(
                    db, booking.customer_id, booking.vendor_id,
                    f"Booking #{booking.id} is paid and held safely. Once the vendor reconfirms, you'll see each other's phone numbers on the booking (not in chat).",
                )
            except Exception as exc:  # chat must never break payment confirmation
                logger.error("Couldn't post booking message for %s: %s", booking.id, exc)
            return True

        # Paid after the checkout already expired → money received for a cancelled booking.
        if booking.status == BookingStatus.CANCELLED and booking.paid_at is None:
            db.query(Booking).filter(Booking.id == booking.id, Booking.paid_at.is_(None)).update(
                {"paid_at": now}, synchronize_session=False
            )
            db.commit()
            db.refresh(booking)
            logger.warning("Late payment on expired booking %s — refunding", booking.id)
            BookingService.refund(db, booking, "Payment received after checkout expired")
        return False

    @staticmethod
    def verify_and_confirm(db: Session, booking: Booking, user=None, client_reference: Optional[str] = None):
        """Check a booking's payment with Paystack. Returns True if this call marked it paid, False if not
        paid (yet), None if Paystack couldn't be reached. If Paystack doesn't know our reference but the
        browser reports the one Paystack used, that reference is accepted only when the amount matches
        exactly, the payer's email matches the customer and no other booking uses it."""
        try:
            tx = paystack_service.verify_transaction(booking.payment_reference)
            if BookingService.confirm_payment(db, booking, tx):
                return True
            if tx.get("status") == "success":
                return False
        except PaystackError:
            tx = None
        if client_reference and client_reference != booking.payment_reference and user is not None:
            try:
                alt = paystack_service.verify_transaction(client_reference)
            except PaystackError:
                return None if tx is None else False
            payer = ((alt.get("customer") or {}).get("email") or "").lower()
            taken = db.query(Booking.id).filter(Booking.payment_reference == client_reference, Booking.id != booking.id).first()
            if (alt.get("status") == "success" and int(alt.get("amount") or 0) == to_kobo(booking.customer_total)
                    and payer == (user.email or "").lower() and not taken):
                booking.payment_reference = client_reference
                db.commit()
                return BookingService.confirm_payment(db, booking, alt)
            logger.warning("Rejected alternate reference %s for booking %s", client_reference, booking.id)
        return None if tx is None else False

    @staticmethod
    def reconcile_unpaid(db: Session, limit: int = 50) -> int:
        """Background backstop for missed webhooks: re-check recent unpaid checkouts and open quotes."""
        from sqlalchemy import or_, and_
        now = datetime.now(timezone.utc)
        rows = (db.query(Booking).filter(
            Booking.status == BookingStatus.AWAITING_PAYMENT, Booking.payment_reference.isnot(None),
            or_(and_(Booking.quote_expires_at.is_(None), Booking.created_at >= now - timedelta(hours=2)),
                Booking.quote_expires_at > now))
            .order_by(Booking.created_at.desc()).limit(limit).all())
        n = 0
        for b in rows:
            try:
                if BookingService.verify_and_confirm(db, b):
                    from app.entities.booking.notifications import notify_booking_paid
                    notify_booking_paid(db, b)
                    n += 1
            except Exception as exc:  # one bad row must not stop the rest
                logger.error("Reconcile failed for booking %s: %s", b.id, exc)
        return n

    @staticmethod
    def _nudge_abandoned(db: Session, cutoff) -> list:
        """Unpaid checkouts about to expire: send one friendly 'finish your booking' email each."""
        rows = db.query(Booking).filter(Booking.status == BookingStatus.AWAITING_PAYMENT, Booking.created_at <= cutoff,
                                        Booking.quote_expires_at.is_(None)).all()
        for b in rows:
            try:
                from app.entities.booking.notifications import notify_checkout_abandoned
                notify_checkout_abandoned(db, b)
            except Exception as exc:
                logger.error("Abandoned-checkout email failed for %s: %s", b.id, exc)
        return rows

    @staticmethod
    def expire_unpaid_checkouts(db: Session) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=CHECKOUT_EXPIRY_MINUTES)
        count = (
            db.query(Booking)
            .filter(Booking.id.in_([b.id for b in BookingService._nudge_abandoned(db, cutoff)]))
            .update({"status": BookingStatus.CANCELLED}, synchronize_session=False)
        )
        count += (
            db.query(Booking)
            .filter(Booking.status == BookingStatus.AWAITING_PAYMENT, Booking.quote_expires_at.isnot(None),
                    Booking.quote_expires_at <= datetime.now(timezone.utc))
            .update({"status": BookingStatus.CANCELLED, "cancelled_by": "system",
                     "cancellation_reason": "The quote expired before it was paid."}, synchronize_session=False)
        )
        db.commit()
        if count:
            logger.info("Expired %d unpaid checkout(s)", count)
        return count

    # ── Refunds ──────────────────────────────────────────────────────────────
    @staticmethod
    def refund(db: Session, booking: Booking, reason: str, amount=None) -> None:
        """Refund the customer — in full, or `amount` naira (partial refunds under a cancellation
        policy). Idempotent: only one refund is ever initiated per booking."""
        if booking.paid_at is None or not booking.payment_reference:
            return
        claimed = (
            db.query(Booking)
            .filter(Booking.id == booking.id, Booking.refund_status.in_(["none", "pending_review", "failed"]))
            .update({"refund_status": "processing"}, synchronize_session=False)
        )
        db.commit()
        if not claimed:
            return
        try:
            from app.entities.booking.addons_service import AddonService
            data = {}
            for ref, amt, addon in AddonService.refund_plan(db, booking, amount):
                result = (paystack_service.refund(ref, reason, amount=amt)
                          if amt is not None else paystack_service.refund(ref, reason)) or {}
                if addon is None:
                    data = result
                    if result.get("id"):
                        booking.refund_id = str(result["id"])
                else:
                    addon.refund_id = str(result.get("id") or "") or None
                    if amt is None:
                        addon.status = "refunded"
                db.commit()
            if data.get("status") == "needs-attention":
                BookingService.refund_needs_attention(db, booking)
        except (PaystackError, HTTPException) as exc:
            logger.error("Refund failed for booking %s: %s", booking.id, exc)
            booking.refund_status = "failed"
            db.commit()
        db.refresh(booking)

    @staticmethod
    def refund_needs_attention(db: Session, booking: Booking) -> bool:
        """Paystack couldn't send the refund back automatically and needs a bank account.
        Use the customer's saved refund account if there is one; otherwise ask them for it.
        Returns True if the refund was retried."""
        from app.entities.user.model import User

        customer = db.query(User).filter(User.id == booking.customer_id).first()
        if customer and customer.refund_account_number and customer.refund_bank_code and booking.refund_id:
            try:
                paystack_service.retry_refund_with_details(
                    booking.refund_id, customer.refund_account_number, customer.refund_bank_code
                )
                booking.refund_status = "processing"
                db.commit()
                logger.info("Refund for booking %s retried with the customer's saved account", booking.id)
                return True
            except (PaystackError, HTTPException) as exc:
                logger.error("Refund retry with saved account failed for booking %s: %s", booking.id, exc)

        first_time = booking.refund_status != "needs_details"
        booking.refund_status = "needs_details"
        db.commit()
        if first_time and customer:
            from app.entities.booking.notifications import notify_refund_needs_account
            notify_refund_needs_account(db, booking, customer)
        return False

    @staticmethod
    def retry_refunds_waiting_for(db: Session, customer_id: int) -> int:
        """Customer just saved a refund account — finish any refunds that were waiting for it."""
        waiting = db.query(Booking).filter(
            Booking.customer_id == customer_id, Booking.refund_status == "needs_details"
        ).all()
        return sum(1 for b in waiting if BookingService.refund_needs_attention(db, b))

    @staticmethod
    def mark_refunded(db: Session, booking: Booking) -> None:
        booking.refund_status = "refunded"
        booking.refunded_at = booking.refunded_at or datetime.now(timezone.utc)
        db.commit()

    # ── Documents ────────────────────────────────────────────────────────────
    @staticmethod
    def _assign_number(db: Session, booking: Booking, field: str, sequence: str, prefix: str, when) -> None:
        """Give the booking a document number (e.g. PLG-RCT-2026-000042) once, never twice."""
        if getattr(booking, field):
            return
        from sqlalchemy import text

        seq = db.execute(text(f"SELECT nextval('{sequence}')")).scalar()
        year = (when or datetime.now(timezone.utc)).year
        number = f"{prefix}-{year}-{int(seq):06d}"
        db.query(Booking).filter(Booking.id == booking.id, getattr(Booking, field).is_(None)).update(
            {field: number}, synchronize_session=False
        )
        db.commit()
        db.refresh(booking)

    @staticmethod
    def mark_payout_paid(db: Session, booking: Booking) -> None:
        """The vendor's money has landed: record it, number the payout statement, email it.
        Called from the webhook, the status check and the transfer response — whichever is first."""
        newly = (
            db.query(Booking)
            .filter(Booking.id == booking.id, Booking.payout_paid_at.is_(None))
            .update({"payout_status": "paid", "payout_error": None,
                     "payout_paid_at": datetime.now(timezone.utc)}, synchronize_session=False)
        )
        db.commit()
        db.refresh(booking)
        if newly:
            BookingService._assign_number(db, booking, "payout_statement_number", "payout_statement_seq",
                                          "PLG-PAY", booking.payout_paid_at)
            from app.entities.booking.notifications import notify_payout_sent
            notify_payout_sent(db, booking)

    # ── Payouts ──────────────────────────────────────────────────────────────
    @staticmethod
    def initiate_payout(db: Session, booking: Booking) -> None:
        """Settle a booking in the vendor's favour: credit their share to their wallet.

        No money moves yet — the vendor withdraws to their bank when they choose (see
        app.entities.wallet.service). The paid_out flag is an atomic claim, so a booking can only
        ever be settled once."""
        claimed = (
            db.query(Booking)
            .filter(Booking.id == booking.id, Booking.paid_out == False)  # noqa: E712
            .update({"paid_out": True, "payout_status": "processing"}, synchronize_session=False)
        )
        db.commit()
        db.refresh(booking)
        if not claimed:
            return

        # Deduct the mobilisation advance already paid; anything it over-covered becomes a debt
        from app.entities.booking.trust import TrustService
        if booking.advance_status == "paid" and booking.advance_amount:
            remaining = money(money(booking.payout_amount) - money(booking.advance_amount))
            if remaining < 0:
                from app.entities.vendor.incident import VendorIncident
                db.add(VendorIncident(vendor_id=booking.vendor_id, booking_id=booking.id, kind="advance_recovery",
                                      severity="logged", reason="Advance exceeded the vendor's share after cancellation",
                                      fee=-remaining, fee_remaining=-remaining))
                remaining = money(0)
            booking.payout_amount = remaining
            db.commit()
        # Recover any late-cancellation fees this vendor owes from this payout
        recovered = TrustService.recover_fees(db, booking.vendor_id, money(booking.payout_amount))
        if recovered > 0:
            booking.penalty_deducted = recovered
            booking.payout_amount = money(money(booking.payout_amount) - recovered)
        if money(booking.payout_amount) <= 0:
            booking.payout_status = "paid"
            booking.payout_error = "Fully offset by late-cancellation fees owed"
            db.commit()
            return
        db.commit()
        from app.entities.wallet import service as wallet
        wallet.credit(db, booking.vendor_id, booking.payout_amount, "earning", booking_id=booking.id,
                      note=f"Booking #{booking.id}")
        BookingService.mark_payout_credited(db, booking)

    @staticmethod
    def mark_payout_credited(db: Session, booking: Booking) -> None:
        """The vendor's share is in their wallet: record it, number the payout statement, email it."""
        newly = (
            db.query(Booking)
            .filter(Booking.id == booking.id, Booking.payout_paid_at.is_(None))
            .update({"payout_status": "credited", "payout_error": None,
                     "payout_paid_at": datetime.now(timezone.utc)}, synchronize_session=False)
        )
        db.commit()
        db.refresh(booking)
        if newly:
            BookingService._assign_number(db, booking, "payout_statement_number", "payout_statement_seq",
                                          "PLG-PAY", booking.payout_paid_at)
            from app.entities.booking.notifications import notify_payout_sent
            notify_payout_sent(db, booking)

    # Paystack transfer status → our payout_status
    _TRANSFER_STATUS = {
        "success": "paid",
        "otp": "awaiting_otp",
        "failed": "failed", "reversed": "failed", "abandoned": "failed", "blocked": "failed", "rejected": "failed",
    }

    @staticmethod
    def sync_payout(db: Session, booking: Booking) -> str:
        """Legacy: per-booking transfers sent before the wallet existed. Ask Paystack where one
        stands and update the booking (covers a missed webhook)."""
        if booking.payout_status not in ("processing", "awaiting_otp") or not booking.payout_reference:
            return booking.payout_status
        try:
            data = paystack_service.verify_transfer(booking.payout_reference)
        except PaystackError as exc:
            logger.warning("Couldn't check payout %s: %s", booking.payout_reference, exc)
            return booking.payout_status
        new_status = BookingService._TRANSFER_STATUS.get(data.get("status"), "processing")
        if new_status == "paid":
            BookingService.mark_payout_paid(db, booking)
        elif new_status == "failed":
            BookingService.legacy_transfer_failed(db, booking)
        elif new_status != booking.payout_status:
            booking.payout_status = new_status
            db.commit()
            db.refresh(booking)
        return booking.payout_status

    @staticmethod
    def legacy_transfer_failed(db: Session, booking: Booking) -> None:
        """A legacy per-booking transfer failed: the money is still ours, so put it in the vendor's
        wallet — they withdraw it like any other earning."""
        if booking.payout_paid_at is not None:
            return
        booking.payout_reference = None
        db.commit()
        from app.entities.wallet import service as wallet
        wallet.credit(db, booking.vendor_id, booking.payout_amount, "earning", booking_id=booking.id,
                      note=f"Booking #{booking.id}")
        BookingService.mark_payout_credited(db, booking)

    @staticmethod
    def sync_pending_payouts(db: Session) -> int:
        """Background task: reconcile every payout still waiting on Paystack, and finish any wallet
        credit interrupted mid-way (claimed but not credited — crediting is idempotent)."""
        changed = 0
        stranded = db.query(Booking).filter(Booking.paid_out == True, Booking.payout_status == "processing",  # noqa: E712
                                            Booking.payout_reference.is_(None), Booking.payout_paid_at.is_(None)).all()
        from app.entities.wallet import service as wallet
        for booking in stranded:
            wallet.credit(db, booking.vendor_id, booking.payout_amount, "earning", booking_id=booking.id,
                          note=f"Booking #{booking.id}")
            BookingService.mark_payout_credited(db, booking)
            changed += 1
        pending = db.query(Booking).filter(Booking.payout_status.in_(["processing", "awaiting_otp"]),
                                           Booking.payout_reference.isnot(None)).all()
        for booking in pending:
            before = booking.payout_status
            if BookingService.sync_payout(db, booking) != before:
                changed += 1
        if changed:
            logger.info("Reconciled %d payout(s) with Paystack", changed)
        return changed

    # ── Status changes ───────────────────────────────────────────────────────
    VALID_TRANSITIONS: dict = {
        "vendor": {
            BookingStatus.PENDING: [BookingStatus.CONFIRMED, BookingStatus.DECLINED],
            BookingStatus.CONFIRMED: [BookingStatus.AWAITING_CONFIRMATION],
        },
        "customer": {
            BookingStatus.AWAITING_PAYMENT: [BookingStatus.CANCELLED],
            BookingStatus.PENDING: [BookingStatus.CANCELLED],
            BookingStatus.CONFIRMED: [BookingStatus.CANCELLED],
            BookingStatus.AWAITING_CONFIRMATION: [BookingStatus.COMPLETED],
        },
    }

    @staticmethod
    def update_booking_status(
        db: Session,
        booking_id: int,
        new_status: BookingStatus,
        user_id: int,
        user_role: str,
        force: bool = False,
    ) -> Booking:
        """Escrow flow: awaiting_payment → pending (paid) → confirmed → awaiting_confirmation
        → completed (payout). Auto-release fires 24h after the vendor marks complete."""
        booking = BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

        if user_role == "vendor":
            vendor = db.query(Vendor).filter(Vendor.user_id == user_id).first()
            if not vendor or booking.vendor_id != vendor.id or booking.paid_at is None:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this booking")
        elif user_role == "customer":
            if booking.customer_id != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this booking")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

        if user_role == "customer" and new_status == BookingStatus.CANCELLED:
            from app.entities.booking.trust import TrustService
            return TrustService.cancel_by_customer(db, booking, user_id)

        previous = booking.status
        allowed = BookingService.VALID_TRANSITIONS.get(user_role, {}).get(previous, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from '{previous.value}' to '{new_status.value}'",
            )

        now = datetime.now(timezone.utc)
        if new_status == BookingStatus.AWAITING_CONFIRMATION and not force:
            event_dt = booking.event_date
            if event_dt.tzinfo is None:
                event_dt = event_dt.replace(tzinfo=timezone.utc)
            if now < event_dt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark complete before the event date ({event_dt.strftime('%d %b %Y')})",
                )

        # Atomic transition — guards against a concurrent change (e.g. auto-release, double click).
        updates = {"status": new_status}
        if new_status == BookingStatus.AWAITING_CONFIRMATION:
            updates["vendor_confirmed_at"] = now
        if new_status == BookingStatus.CONFIRMED:
            updates["accepted_at"] = now
        changed = (
            db.query(Booking)
            .filter(Booking.id == booking.id, Booking.status == previous)
            .update(updates, synchronize_session=False)
        )
        db.commit()
        db.refresh(booking)
        if not changed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking was updated by someone else. Please refresh.")

        # Money side effects
        if new_status == BookingStatus.CONFIRMED:
            try:
                from app.entities.booking.notifications import sms_accepted
                sms_accepted(db, booking)
            except Exception as exc:
                logger.error("SMS alert failed for %s: %s", booking.id, exc)
        if new_status == BookingStatus.COMPLETED:
            BookingService.initiate_payout(db, booking)
        elif new_status == BookingStatus.DECLINED:
            BookingService.refund(db, booking, "Vendor declined booking")

        return booking

    # ── Disputes & admin decisions ───────────────────────────────────────────
    @staticmethod
    def open_dispute(db: Session, booking_id: int, customer_id: int, reason: str, no_show: bool = False) -> Booking:
        """Customer reports a problem. Freezes escrow: auto-release only touches
        AWAITING_CONFIRMATION, so a DISPUTED booking waits for an admin."""
        booking = BookingService.get_booking_by_id(db, booking_id)
        if not booking or booking.customer_id != customer_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

        now = datetime.now(timezone.utc)
        event_dt = booking.event_date if booking.event_date.tzinfo else booking.event_date.replace(tzinfo=timezone.utc)
        allowed = booking.status == BookingStatus.AWAITING_CONFIRMATION or (
            booking.status == BookingStatus.CONFIRMED and now >= event_dt  # vendor no-show
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can report a problem once the event date has passed and before you confirm the service.",
            )

        changed = (
            db.query(Booking)
            .filter(Booking.id == booking.id, Booking.status == booking.status)
            .update(
                {"status": BookingStatus.DISPUTED, "dispute_reason": reason.strip(), "disputed_at": now,
                 # A no-show the vendor never checked in for is fast-tracked: 24h to respond
                 "dispute_kind": "no_show" if (no_show and not booking.checked_in_at) else "general",
                 "response_due_at": now + timedelta(hours=24) if (no_show and not booking.checked_in_at) else None},
                synchronize_session=False,
            )
        )
        db.commit()
        db.refresh(booking)
        if not changed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking was updated. Please refresh.")
        return booking

    @staticmethod
    def case_type(booking: Booking) -> Optional[str]:
        if booking.status == BookingStatus.DISPUTED and booking.resolution is None:
            return "dispute"
        if booking.refund_status == "pending_review":
            return "refund_review"
        if booking.refund_status == "needs_details":
            return "refund_needs_details"
        if booking.payout_status == "awaiting_otp":   # legacy per-booking transfer
            return "awaiting_otp"
        if booking.refund_status == "failed":
            return "failed_refund"
        return None

    @staticmethod
    def resolve(db: Session, booking: Booking, outcome: str, note: str, admin_id: int) -> Booking:
        """Admin decision on a dispute or a late cancellation.
        outcome="refund"  → full refund to the customer (booking ends cancelled)
        outcome="release" → escrow released to the vendor (dispute ends completed)."""
        case = BookingService.case_type(booking)
        if case not in ("dispute", "refund_review"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This booking has no open decision")
        if outcome not in ("refund", "release"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Outcome must be 'refund' or 'release'")
        if outcome == "refund" and booking.payout_status in ("processing", "paid", "awaiting_otp", "credited"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vendor has already been paid out")

        now = datetime.now(timezone.utc)
        updates = {"resolution": outcome, "resolution_note": note.strip(), "resolved_at": now, "resolved_by": admin_id}
        if case == "dispute":
            updates["status"] = BookingStatus.CANCELLED if outcome == "refund" else BookingStatus.COMPLETED
            claim = (Booking.status == BookingStatus.DISPUTED) & Booking.resolution.is_(None)
        else:
            if outcome == "release":
                updates["refund_status"] = "declined"
            claim = Booking.refund_status == "pending_review"

        claimed = (
            db.query(Booking).filter(Booking.id == booking.id, claim).update(updates, synchronize_session=False)
        )
        db.commit()
        db.refresh(booking)
        if not claimed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already resolved by someone else")

        if outcome == "refund":
            BookingService.refund(db, booking, f"Admin decision: {note.strip()}"[:200])
        else:
            BookingService.initiate_payout(db, booking)
        db.refresh(booking)
        return booking

    @staticmethod
    def auto_release_expired_bookings(db: Session) -> int:
        """Complete bookings the customer didn't confirm within 24h of the vendor marking them done."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        expired = (
            db.query(Booking)
            .filter(
                Booking.status == BookingStatus.AWAITING_CONFIRMATION,
                Booking.vendor_confirmed_at.isnot(None),
                Booking.vendor_confirmed_at <= cutoff,
            )
            .all()
        )
        released = 0
        for booking in expired:
            changed = (
                db.query(Booking)
                .filter(Booking.id == booking.id, Booking.status == BookingStatus.AWAITING_CONFIRMATION)
                .update({"status": BookingStatus.COMPLETED}, synchronize_session=False)
            )
            db.commit()
            if changed:
                released += 1
                db.refresh(booking)
                BookingService.initiate_payout(db, booking)
        if released:
            logger.info("Auto-released %d booking(s) after 24-hour window", released)
        return released

    @staticmethod
    def delete_booking(db: Session, booking_id: int, user_id: int) -> bool:
        """Delete an unpaid checkout. Paid bookings are never deleted — cancel them instead so
        the payment and refund stay on record."""
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
        
        if booking.paid_at is not None or booking.status not in (
            BookingStatus.AWAITING_PAYMENT, BookingStatus.CANCELLED
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paid bookings can't be deleted. Cancel the booking instead."
            )
        
        db.delete(booking)
        db.commit()
        return True

