from datetime import datetime, timedelta, timezone
"""Single source of truth for booking prices.

Fee model
---------
goods          = selected service items          (vendor has a menu/price list)
               = base rate                       (vendor has no items, e.g. DJ, MC — base rate is the price)
vendor_total   = goods + vendor service fee % + logistics fee
platform_fee   = vendor_total x PLATFORM_CUSTOMER_FEE_RATE   (customer pays, shown at checkout)
customer_total = vendor_total + platform_fee                 (amount charged by Paystack)
commission     = vendor_total x VENDOR_COMMISSION_RATE       (vendor-side, never shown to customers)
payout_amount  = vendor_total - commission                   (transferred to the vendor)

All arithmetic uses Decimal and rounds half-up to the kobo.
"""
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import PLATFORM_CUSTOMER_FEE_RATE, VENDOR_COMMISSION_RATE
from app.entities.vendor.model import Vendor, VerificationStatus

CENT = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)


def to_kobo(amount: Decimal) -> int:
    return int((money(amount) * 100).to_integral_value(rounding=ROUND_HALF_UP))


@dataclass
class Quote:
    base_price: Decimal
    items_total: Decimal
    vendor_service_fee: Decimal
    logistics_fee: Decimal
    vendor_total: Decimal
    platform_fee: Decimal
    customer_total: Decimal
    commission_amount: Decimal
    payout_amount: Decimal
    snapshot: Optional[list] = field(default=None)
    advance_amount: Decimal = Decimal("0")
    delivery_note: Optional[str] = None

    def customer_view(self) -> dict:
        """Breakdown safe to show customers — excludes commission and payout."""
        return {
            "base_price": float(self.base_price),
            "items_total": float(self.items_total),
            "vendor_service_fee": float(self.vendor_service_fee),
            "logistics_fee": float(self.logistics_fee),
            "vendor_total": float(self.vendor_total),
            "platform_fee": float(self.platform_fee),
            "platform_fee_rate": float(PLATFORM_CUSTOMER_FEE_RATE),
            "customer_total": float(self.customer_total),
            "items": self.snapshot or [],
            # Shown before payment: part released to the vendor at reconfirmation for preparation
            "advance_amount": float(self.advance_amount),
            "delivery_note": self.delivery_note,
        }


def get_bookable_vendor(db: Session, vendor_id: int) -> Vendor:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    if not vendor.is_active or vendor.verification_status != VerificationStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor is not available for bookings",
        )
    return vendor


def delivery_fee(vendor: Vendor, event_state: Optional[str]) -> tuple[Decimal, Optional[str]]:
    """One flat fee anywhere in the vendor's home state; interstate only if the vendor offers it."""
    local = money(vendor.logistics_fee)
    state = (event_state or "").strip()
    home = (vendor.base_state or "").strip()
    if not state or not home or state.lower() == home.lower():
        return local, None
    mode = vendor.interstate_mode or "none"
    if mode == "per_state":
        fees = {str(k).lower(): v for k, v in (vendor.state_fees or {}).items()}
        if state.lower() in fees:
            return money(fees[state.lower()]), f"Logistics to {state}"
        if vendor.interstate_fee is not None:
            return money(vendor.interstate_fee), f"Logistics to {state}"
    elif mode == "flat" and vendor.interstate_fee is not None:
        return money(vendor.interstate_fee), f"Logistics to {state}"
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"{vendor.business_name} only serves events in {home}. Choose a vendor in {state}, or ask them in chat.")


ADVANCE_MAX_PER_BOOKING = Decimal("150000")    # worst case per booking
ADVANCE_MAX_OUTSTANDING = Decimal("300000")    # worst case per vendor across unfinished bookings


def advance_eligible(db: Session, vendor: Vendor, mode: Optional[str] = None) -> bool:
    """Logistics-only advance: 3+ completed bookings, no strikes in 90 days.
    Logistics + a share: 5+ completed bookings, account 60+ days old, no strikes."""
    mode = mode or vendor.advance_mode or "none"
    if mode == "none":
        return False
    from app.entities.booking.model import Booking, BookingStatus
    from app.entities.vendor.incident import VendorIncident
    done = db.query(Booking.id).filter(Booking.vendor_id == vendor.id, Booking.status == BookingStatus.COMPLETED).count()
    strikes = db.query(VendorIncident.id).filter(
        VendorIncident.vendor_id == vendor.id, VendorIncident.severity.in_(["strike", "severe"]),
        VendorIncident.created_at >= datetime.now(timezone.utc) - timedelta(days=90)).count()
    if strikes:
        return False
    if mode == "logistics_plus":
        created = vendor.created_at if vendor.created_at and vendor.created_at.tzinfo else (vendor.created_at or datetime.now(timezone.utc)).replace(tzinfo=timezone.utc)
        return done >= 5 and datetime.now(timezone.utc) - created >= timedelta(days=60)
    return done >= 3


def advance_headroom(db: Session, vendor: Vendor) -> Decimal:
    """How much more advance this vendor can hold before their outstanding total hits the cap."""
    from sqlalchemy import func
    from app.entities.booking.model import Booking, BookingStatus
    out = db.query(func.coalesce(func.sum(Booking.advance_amount), 0)).filter(
        Booking.vendor_id == vendor.id, Booking.advance_status == "paid",
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.AWAITING_CONFIRMATION, BookingStatus.DISPUTED])).scalar() or 0
    return max(Decimal("0"), ADVANCE_MAX_OUTSTANDING - Decimal(str(out)))


def calculate_quote(db: Session, vendor: Vendor, service_items: Optional[List] = None, event_state: Optional[str] = None) -> Quote:
    from app.entities.service_item.model import ServiceItem as _SI

    items_total = Decimal("0")
    snapshot = None
    vendor_has_items = db.query(_SI.id).filter(_SI.vendor_id == vendor.id, _SI.is_active == True).first() is not None  # noqa: E712
    priced_items = db.query(_SI.id).filter(_SI.vendor_id == vendor.id, _SI.is_active == True,  # noqa: E712
                                           _SI.pricing_type != "quote").first() is not None
    if priced_items and not service_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select at least one service to book this vendor")
    # Base rate is charged only for vendors with no price list at all
    base = Decimal("0") if vendor_has_items else money(vendor.starting_price)
    if vendor_has_items and not priced_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This vendor prices on request. Message them for a quote.")

    if service_items:
        snapshot = []
        seen: set[int] = set()
        for order in service_items:
            if order.service_item_id in seen:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Service item {order.service_item_id} listed more than once")
            seen.add(order.service_item_id)
            item = db.query(_SI).filter(_SI.id == order.service_item_id, _SI.vendor_id == vendor.id,
                                        _SI.is_active == True).first()  # noqa: E712
            if not item:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Service item {order.service_item_id} not found or unavailable")
            kind = item.pricing_type or "unit"
            if kind == "quote":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"\"{item.name}\" is priced on request. Message the vendor for a quote.")
            qty = 1 if kind == "package" else order.quantity
            if kind == "unit":
                if qty < (item.min_quantity or 1):
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"\"{item.name}\" needs at least {item.min_quantity} {item.unit_label}")
                if item.max_quantity and qty > item.max_quantity:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"\"{item.name}\" allows at most {item.max_quantity}")
            unit_price = money(item.unit_price)
            subtotal = money(unit_price * qty)
            items_total += subtotal
            entry = {"service_item_id": item.id, "name": item.name, "unit_price": float(unit_price),
                     "unit_label": item.unit_label, "quantity": qty, "subtotal": float(subtotal), "pricing_type": kind}
            note = (getattr(order, "note", None) or "").strip()
            if note:
                entry["note"] = note[:500]
            snapshot.append(entry)

    goods = base + items_total
    vendor_service_fee = Decimal("0")   # no separate service fee: vendors build it into their prices
    logistics_fee, delivery_note = delivery_fee(vendor, event_state)
    vendor_total = money(goods + vendor_service_fee + logistics_fee)

    platform_fee = money(vendor_total * PLATFORM_CUSTOMER_FEE_RATE)
    customer_total = money(vendor_total + platform_fee)
    # No commission on delivery: it is a pass-through cost for the vendor
    commission = money((vendor_total - logistics_fee) * VENDOR_COMMISSION_RATE)
    payout = money(vendor_total - commission)

    advance = Decimal("0")
    mode = vendor.advance_mode or "none"
    if mode == "logistics_plus" and not advance_eligible(db, vendor, "logistics_plus"):
        mode = "logistics"   # not yet trusted for a share: fall back to logistics only
    if mode != "none" and advance_eligible(db, vendor, "logistics"):
        advance = logistics_fee
        if mode == "logistics_plus":
            advance += money((goods + vendor_service_fee) * Decimal(min(int(vendor.advance_percent or 0), 30)) / 100)
        advance = min(money(advance), payout, ADVANCE_MAX_PER_BOOKING, advance_headroom(db, vendor))

    return Quote(
        base_price=base, items_total=items_total, vendor_service_fee=vendor_service_fee, logistics_fee=logistics_fee,
        vendor_total=vendor_total, platform_fee=platform_fee, customer_total=customer_total,
        commission_amount=commission, payout_amount=payout, snapshot=snapshot,
        advance_amount=advance, delivery_note=delivery_note,
    )
