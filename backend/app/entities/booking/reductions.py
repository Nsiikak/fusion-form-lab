"""Reductions after booking: fewer guests, a dropped item.

Customer-initiated: the removed part is refunded by the vendor's cancellation policy (like a partial
cancellation); the vendor keeps the rest for preparation already done.
Vendor-initiated (they can't supply something): the removed part is refunded in full, fee included."""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.config import PLATFORM_CUSTOMER_FEE_RATE, VENDOR_COMMISSION_RATE
from app.core.database import Base
from app.entities.booking.model import Booking, BookingStatus
from app.services import cancellation as rules
from app.services.paystack import PaystackError, paystack_service
from app.services.pricing import money

logger = logging.getLogger(__name__)


class BookingReduction(Base):
    __tablename__ = "booking_reductions"
    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    initiated_by = Column(String(10), nullable=False)         # customer | vendor
    items = Column(JSON, nullable=False)                      # [{name, quantity, unit_price, subtotal}]
    amount_removed = Column(Numeric(12, 2), nullable=False)   # vendor price removed
    refund_pct = Column(Integer, nullable=False)
    refund_amount = Column(Numeric(12, 2), nullable=False)    # to the customer, incl. fee share when full
    reason = Column(Text, nullable=True)
    refund_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


def _role(db: Session, booking: Booking, user) -> str:
    from app.entities.vendor.model import Vendor
    if booking.customer_id == user.id:
        return "customer"
    v = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if v and booking.vendor_id == v.id:
        return "vendor"
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")


def _plan(db: Session, booking: Booking, lines, role: str) -> dict:
    if booking.status not in (BookingStatus.PENDING, BookingStatus.CONFIRMED) or not booking.paid_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only upcoming paid bookings can be reduced")
    event_at = booking.event_date if booking.event_date.tzinfo else booking.event_date.replace(tzinfo=timezone.utc)
    if event_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This event has already started")
    items = [dict(i) for i in (booking.service_items_snapshot or [])]
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This booking has no items to reduce. Cancel it instead.")
    removed, removed_items = money(0), []
    for line in lines:
        if line.index >= len(items):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown item")
        it = items[line.index]
        if line.quantity > it["quantity"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"You only booked {it['quantity']} of \"{it['name']}\"")
        part = money(Decimal(str(it["unit_price"])) * line.quantity)
        removed += part
        removed_items.append({"name": it["name"], "quantity": line.quantity, "unit_price": it["unit_price"], "subtotal": float(part)})
        it["quantity"] -= line.quantity
        it["subtotal"] = float(money(Decimal(str(it["unit_price"])) * it["quantity"]))
    remaining = [i for i in items if i["quantity"] > 0]
    if not remaining:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That removes everything. Cancel the booking instead.")

    if role == "vendor" or booking.status == BookingStatus.PENDING:
        pct, full = 100, True
        why = ("The vendor removed this, so it's refunded in full." if role == "vendor"
               else "The vendor hasn't accepted yet, so it's refunded in full.")
    else:
        outcome = rules.customer_cancellation(booking)
        pct, full = outcome.refund_pct, outcome.full_refund
        why = (f"Under the vendor's {(booking.policy_snapshot or {}).get('label', 'Standard')} policy, {pct}% of the removed part comes back; "
               "the vendor keeps the rest for preparation already done." if not full else outcome.reason)
    vendor_refund = money(removed * pct / 100)
    fee_refund = money(removed * PLATFORM_CUSTOMER_FEE_RATE) if full else money(0)
    return {"items": items, "remaining": remaining, "removed_items": removed_items, "removed": removed,
            "pct": pct, "vendor_refund": vendor_refund, "fee_refund": fee_refund,
            "refund": money(vendor_refund + fee_refund), "reason": why}


def preview(db: Session, booking_id: int, user, lines) -> dict:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    p = _plan(db, booking, lines, _role(db, booking, user))
    return {"amount_removed": float(p["removed"]), "refund_pct": p["pct"], "refund_amount": float(p["refund"]),
            "vendor_keeps": float(p["removed"] - p["vendor_refund"]), "reason": p["reason"], "items": p["removed_items"]}


def apply(db: Session, booking_id: int, user, lines, reason: str = "") -> BookingReduction:
    booking = db.query(Booking).filter(Booking.id == booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    role = _role(db, booking, user)
    if role == "vendor" and len((reason or "").strip()) < 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Tell the customer why you're removing this (at least a few words).")
    p = _plan(db, booking, lines, role)
    refund_ids = []
    if p["refund"] > 0:
        from app.entities.booking.addons_service import AddonService
        try:
            for ref, amt, _ in AddonService.refund_plan(db, booking, p["refund"]):
                data = paystack_service.refund(ref, "Booking reduced", amount=amt) or {}
                refund_ids.append(str(data.get("id") or ""))
        except (PaystackError, HTTPException) as exc:
            logger.error("Reduction refund failed for booking %s: %s", booking.id, exc)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                                detail="We couldn't process the refund right now. Nothing was changed; please try again.") from exc
    # Fold the change into the booking
    booking.service_items_snapshot = p["remaining"]
    booking.price = money(booking.price - p["vendor_refund"])
    booking.platform_fee = money((booking.platform_fee or 0) - p["fee_refund"])
    booking.customer_total = money((booking.customer_total or 0) - p["refund"])
    booking.commission_amount = money((booking.commission_amount or 0) - p["vendor_refund"] * VENDOR_COMMISSION_RATE)
    booking.payout_amount = money(booking.price - booking.commission_amount)
    r = BookingReduction(booking_id=booking.id, initiated_by=role, items=p["removed_items"], amount_removed=p["removed"],
                         refund_pct=p["pct"], refund_amount=p["refund"], reason=(reason or "").strip()[:1000] or None,
                         refund_ids=refund_ids)
    db.add(r)
    if role == "vendor":
        # Removing part of an accepted booking is a partial let-down: logged, and a strike inside 48 hours
        from app.entities.vendor.incident import VendorIncident
        event_at = booking.event_date if booking.event_date.tzinfo else booking.event_date.replace(tzinfo=timezone.utc)
        late = event_at - datetime.now(timezone.utc) < timedelta(hours=48)
        db.add(VendorIncident(vendor_id=booking.vendor_id, booking_id=booking.id, kind="item_removed",
                              severity="strike" if late else "logged", reason=(reason or "")[:2000], fee=0, fee_remaining=0))
    db.commit()
    db.refresh(r)
    try:
        from app.entities.chat.service import ChatService
        names = ", ".join(f"{i['name']} \u00d7 {i['quantity']}" for i in p["removed_items"])
        who = "The customer" if role == "customer" else "The vendor"
        ChatService.system_message(db, booking.customer_id, booking.vendor_id,
                                   f"{who} reduced booking #{booking.id}: removed {names}. \u20a6{p['refund']:,.2f} refunded to the customer.")
    except Exception as exc:
        logger.error("Couldn't post reduction note for %s: %s", booking.id, exc)
    return r
