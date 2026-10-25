"""Quotes: after agreeing a price in chat, the vendor sends a priced quote. The customer accepts and pays
it like any booking; because the vendor already agreed, a paid quote is confirmed straight away."""
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import PLATFORM_CUSTOMER_FEE_RATE, VENDOR_COMMISSION_RATE
from app.entities.booking.model import Booking, BookingStatus
from app.services import cancellation as rules
from app.services.pricing import delivery_fee, get_bookable_vendor, money


def create_quote(db: Session, conv, vendor_user, body) -> Booking:
    from app.entities.vendor.model import Vendor
    vendor = db.query(Vendor).filter(Vendor.user_id == vendor_user.id).first()
    if not vendor or vendor.id != conv.vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the vendor in this chat can send a quote")
    vendor = get_bookable_vendor(db, vendor.id)
    event_dt = body.event_date if body.event_date.tzinfo else body.event_date.replace(tzinfo=timezone.utc)
    if event_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The event date must be in the future")
    items, total = [], Decimal("0")
    for it in body.items:
        sub = money(Decimal(str(it.unit_price)) * it.quantity)
        total += sub
        items.append({"name": it.name.strip()[:120], "quantity": it.quantity, "unit_price": float(money(it.unit_price)),
                      "unit_label": "each", "subtotal": float(sub), "pricing_type": "quote"})
    state = body.event_address.state if body.event_address else None
    logistics, _ = delivery_fee(vendor, state) if body.include_logistics else (money(0), None)
    vendor_total = money(total + logistics)
    fee = money(vendor_total * PLATFORM_CUSTOMER_FEE_RATE)
    commission = money((vendor_total - logistics) * VENDOR_COMMISSION_RATE)
    booking = Booking(
        customer_id=conv.customer_id, vendor_id=vendor.id, status=BookingStatus.AWAITING_PAYMENT,
        price=vendor_total, platform_fee=fee, customer_total=money(vendor_total + fee),
        commission_amount=commission, payout_amount=money(vendor_total - commission),
        event_date=event_dt, event_time=body.event_time, notes=(body.note or "").strip()[:2000] or None,
        event_address=body.event_address.model_dump() if body.event_address else None,
        service_items_snapshot=items + ([{"name": "Logistics", "quantity": 1, "unit_price": float(logistics), "unit_label": "each",
                                          "subtotal": float(logistics), "pricing_type": "logistics"}] if logistics > 0 else []),
        policy_snapshot=rules.policy_snapshot(vendor.cancellation_policy),
        payment_reference=f"PLG-{secrets.token_hex(8).upper()}",
        quote_expires_at=datetime.now(timezone.utc) + timedelta(days=body.valid_days),
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def decline_quote(db: Session, booking: Booking, user) -> Booking:
    from app.entities.vendor.model import Vendor
    v = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if booking.quote_expires_at is None or booking.status != BookingStatus.AWAITING_PAYMENT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This quote can no longer be changed")
    if booking.customer_id == user.id:
        who = "customer"
    elif v and booking.vendor_id == v.id:
        who = "vendor"
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    booking.status, booking.cancelled_by, booking.cancelled_at = BookingStatus.CANCELLED, who, datetime.now(timezone.utc)
    booking.cancellation_reason = "Quote declined" if who == "customer" else "Quote withdrawn"
    db.commit()
    return booking
