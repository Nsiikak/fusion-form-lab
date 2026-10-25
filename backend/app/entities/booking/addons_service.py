"""Add-ons after booking: the vendor prices extra items, the customer approves and pays the difference.

A paid add-on becomes part of the booking: its price, platform fee, commission and payout are folded
into the booking's totals, so cancellations, refunds, receipts and payouts all include it."""
import logging
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import PLATFORM_CUSTOMER_FEE_RATE, VENDOR_COMMISSION_RATE
from app.entities.booking.addon import BookingAddon
from app.entities.booking.model import Booking, BookingStatus
from app.entities.vendor.model import Vendor
from app.services.paystack import PaystackError, paystack_service
from app.services.pricing import money, to_kobo

logger = logging.getLogger(__name__)
OPEN_STATUSES = (BookingStatus.PENDING, BookingStatus.CONFIRMED)


def serialize_addon(a: BookingAddon) -> dict:
    return {
        "id": a.id, "items": a.items, "note": a.note, "amount": float(a.amount),
        "platform_fee": float(a.platform_fee), "customer_total": float(a.customer_total),
        "status": a.status, "paid_at": a.paid_at.isoformat() if a.paid_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _chat(db, booking, text):
    try:
        from app.entities.chat.service import ChatService
        ChatService.system_message(db, booking.customer_id, booking.vendor_id, text)
    except Exception as exc:
        logger.error("Couldn't post add-on note for booking %s: %s", booking.id, exc)


class AddonService:
    @staticmethod
    def _booking_for(db: Session, booking_id: int, user) -> tuple[Booking, str]:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if booking and booking.customer_id == user.id:
            return booking, "customer"
        vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
        if booking and vendor and booking.vendor_id == vendor.id:
            return booking, "vendor"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    @staticmethod
    def list_for(db: Session, booking_id: int, user) -> list[dict]:
        booking, _ = AddonService._booking_for(db, booking_id, user)
        rows = db.query(BookingAddon).filter(BookingAddon.booking_id == booking.id).order_by(BookingAddon.id).all()
        return [serialize_addon(a) for a in rows]

    @staticmethod
    def propose(db: Session, booking_id: int, user, items: list[dict], note: str = "") -> BookingAddon:
        booking, role = AddonService._booking_for(db, booking_id, user)
        if role != "vendor":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Ask the vendor in chat; they'll send you a priced add-on to approve.")
        if booking.status not in OPEN_STATUSES or booking.paid_at is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add-ons can only be added to upcoming paid bookings")
        event_at = booking.event_date if booking.event_date.tzinfo else booking.event_date.replace(tzinfo=timezone.utc)
        if event_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This event has already started")
        clean = []
        for it in items:
            name = str(it.get("name") or "").strip()[:120]
            qty = int(it.get("quantity") or 1)
            unit = money(it.get("unit_price") or 0)
            if not name or qty < 1 or qty > 10000 or unit <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Each item needs a name, a quantity and a price")
            clean.append({"name": name, "quantity": qty, "unit_price": float(unit), "subtotal": float(money(unit * qty)), "addon": True})
        if not clean:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add at least one item")
        amount = money(sum(money(c["subtotal"]) for c in clean))
        fee = money(amount * PLATFORM_CUSTOMER_FEE_RATE)
        addon = BookingAddon(booking_id=booking.id, items=clean, note=(note or "").strip()[:1000] or None,
                             amount=amount, platform_fee=fee, customer_total=money(amount + fee), status="proposed")
        db.add(addon)
        db.commit()
        db.refresh(addon)
        names = ", ".join(f"{c['name']} \u00d7 {c['quantity']}" for c in clean)
        _chat(db, booking, f"The vendor added an add-on to booking #{booking.id}: {names} for \u20a6{addon.customer_total:,.2f}. Approve and pay it from your booking.")
        from app.entities.booking.notifications import notify_addon_proposed
        notify_addon_proposed(db, booking, addon)
        return addon

    @staticmethod
    def _addon(db, booking, addon_id) -> BookingAddon:
        a = db.query(BookingAddon).filter(BookingAddon.id == addon_id, BookingAddon.booking_id == booking.id).first()
        if not a:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Add-on not found")
        return a

    @staticmethod
    def checkout(db: Session, booking_id: int, addon_id: int, user) -> dict:
        booking, role = AddonService._booking_for(db, booking_id, user)
        if role != "customer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the customer can pay for an add-on")
        a = AddonService._addon(db, booking, addon_id)
        if a.status != "proposed":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This add-on is no longer waiting for payment")
        if booking.status not in OPEN_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This booking can no longer be changed")
        a.payment_reference = f"PLG-ADD-{a.id}-{secrets.token_hex(4).upper()}"
        db.commit()
        return {"reference": a.payment_reference, "amount_kobo": to_kobo(a.customer_total),
                "customer_total": float(a.customer_total), "email": user.email}

    @staticmethod
    def confirm_payment(db: Session, a: BookingAddon, data: dict) -> bool:
        """Mark an add-on paid (once) and fold it into the booking. Returns True if this call did it."""
        if data.get("status") != "success" or int(data.get("amount") or 0) != to_kobo(a.customer_total):
            logger.error("Add-on %s payment did not match: %s", a.id, data)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment could not be confirmed")
        claimed = db.query(BookingAddon).filter(BookingAddon.id == a.id, BookingAddon.status == "proposed").update(
            {"status": "paid", "paid_at": datetime.now(timezone.utc)}, synchronize_session=False)
        db.commit()
        if not claimed:
            return False
        db.refresh(a)
        booking = db.query(Booking).filter(Booking.id == a.booking_id).with_for_update().first()
        commission = money(a.amount * VENDOR_COMMISSION_RATE)
        booking.price = money(booking.price + a.amount)
        booking.platform_fee = money((booking.platform_fee or 0) + a.platform_fee)
        booking.customer_total = money((booking.customer_total or 0) + a.customer_total)
        booking.commission_amount = money((booking.commission_amount or 0) + commission)
        booking.payout_amount = money((booking.payout_amount or 0) + a.amount - commission)
        booking.service_items_snapshot = list(booking.service_items_snapshot or []) + list(a.items)
        db.commit()
        db.refresh(booking)
        _chat(db, booking, f"Add-on paid: \u20a6{a.customer_total:,.2f} added to booking #{booking.id}. It's held safely with the rest of the payment.")
        from app.entities.booking.notifications import notify_addon_paid
        notify_addon_paid(db, booking, a)
        return True

    @staticmethod
    def verify(db: Session, booking_id: int, addon_id: int, user) -> BookingAddon:
        booking, role = AddonService._booking_for(db, booking_id, user)
        a = AddonService._addon(db, booking, addon_id)
        if a.status == "paid":
            return a
        if not a.payment_reference:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No payment started for this add-on")
        try:
            data = paystack_service.verify_transaction(a.payment_reference)
        except PaystackError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                                detail="We couldn't reach Paystack. If you were charged, it will confirm automatically.") from exc
        AddonService.confirm_payment(db, a, data)
        db.refresh(a)
        return a

    @staticmethod
    def respond(db: Session, booking_id: int, addon_id: int, user, action: str) -> BookingAddon:
        booking, role = AddonService._booking_for(db, booking_id, user)
        a = AddonService._addon(db, booking, addon_id)
        if a.status != "proposed":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This add-on can no longer be changed")
        if action == "decline" and role == "customer":
            a.status = "declined"
            _chat(db, booking, f"The customer declined the add-on on booking #{booking.id}.")
        elif action == "withdraw" and role == "vendor":
            a.status = "withdrawn"
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
        db.commit()
        return a

    @staticmethod
    def refund_plan(db: Session, booking: Booking, amount):
        """Split a refund across the original payment and paid add-ons (each is its own Paystack payment).
        amount None = everything back; otherwise shared in proportion to what each payment was."""
        paid = db.query(BookingAddon).filter(BookingAddon.booking_id == booking.id, BookingAddon.status == "paid").all()
        if not paid:
            return [(booking.payment_reference, amount, None)]
        if amount is None:
            return [(booking.payment_reference, None, None)] + [(a.payment_reference, None, a) for a in paid]
        total = money(booking.customer_total)
        plan, given = [], money(0)
        for a in paid:
            share = money(money(amount) * money(a.customer_total) / total)
            if share > 0:
                plan.append((a.payment_reference, share, a)); given += share
        main = money(money(amount) - given)
        return ([(booking.payment_reference, main, None)] if main > 0 else []) + plan
