"""Search ranking: a quality score per vendor, recomputed by the background job.

Score (0–100):
  35  completed bookings (full marks at 20)
  20  rating (average of reviews; new vendors get a neutral 3.5/5)
  15  acceptance rate of paid requests (neutral 70% until there are 3)
  10  responsiveness (median hours to accept: ≤2h full marks, 48h+ none)
  10  photos (full marks at 4)
  10  profile completeness (description, services, logistics, bank account)
 −15  per strike in the last 90 days
 +15  new-vendor boost for the first 30 days with no completed booking, so newcomers get seen
"""
from datetime import datetime, timedelta, timezone
from statistics import median

from sqlalchemy.orm import Session

from app.entities.booking.model import Booking, BookingStatus
from app.entities.vendor.incident import VendorIncident
from app.entities.vendor.model import Vendor


def recompute(db: Session) -> int:
    from app.entities.review.model import Review
    from app.entities.service_item.model import ServiceItem
    now = datetime.now(timezone.utc)
    vendors = db.query(Vendor).all()
    for v in vendors:
        bookings = db.query(Booking).filter(Booking.vendor_id == v.id, Booking.paid_at.isnot(None)).all()
        completed = sum(1 for b in bookings if b.status == BookingStatus.COMPLETED)
        decided = [b for b in bookings if b.accepted_at or b.status == BookingStatus.DECLINED]
        accepted = sum(1 for b in decided if b.accepted_at)
        ratings = [r.rating for r in db.query(Review).filter(Review.vendor_id == v.id).all() if getattr(r, "rating", None)]
        hours = [(b.accepted_at - b.paid_at).total_seconds() / 3600 for b in bookings if b.accepted_at and b.paid_at]
        recent = [h for h in hours if h >= 0][-20:]
        v.response_hours = round(median(recent), 1) if len(recent) >= 2 else None
        strikes = db.query(VendorIncident).filter(
            VendorIncident.vendor_id == v.id, VendorIncident.severity.in_(["strike", "severe"]),
            VendorIncident.created_at >= now - timedelta(days=90)).count()
        has_items = db.query(ServiceItem.id).filter(ServiceItem.vendor_id == v.id, ServiceItem.is_active == True).first() is not None  # noqa: E712
        photos = len(v.gallery_images or [])
        created = v.created_at if v.created_at and v.created_at.tzinfo else (v.created_at or now).replace(tzinfo=timezone.utc)

        score = 35 * min(completed, 20) / 20
        score += 20 * ((sum(ratings) / len(ratings)) if ratings else 3.5) / 5
        score += 15 * ((accepted / len(decided)) if len(decided) >= 3 else 0.7)
        if v.response_hours is not None:
            score += 10 * max(0.0, min(1.0, (48 - v.response_hours) / 46))
        else:
            score += 5
        score += 10 * min(photos, 4) / 4
        score += 2.5 * sum([bool(v.description), has_items, v.logistics_fee is not None, bool(v.recipient_code)])
        score -= 15 * strikes
        if completed == 0 and now - created < timedelta(days=30):
            score += 15
        v.quality_score = round(max(0.0, score), 2)
    db.commit()
    return len(vendors)


def unavailable_days(db: Session, vendor: Vendor, start, end) -> set:
    """Days the vendor can't take a booking: blocked by them, or already at their daily capacity."""
    from sqlalchemy import func
    from app.entities.vendor.model import VendorBlockedDate
    days = {d.day for d in db.query(VendorBlockedDate).filter(
        VendorBlockedDate.vendor_id == vendor.id, VendorBlockedDate.day >= start, VendorBlockedDate.day <= end).all()}
    if vendor.daily_capacity:
        live = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.AWAITING_CONFIRMATION]
        rows = db.query(func.date(Booking.event_date), func.count(Booking.id)).filter(
            Booking.vendor_id == vendor.id, Booking.status.in_(live),
            func.date(Booking.event_date) >= start, func.date(Booking.event_date) <= end,
        ).group_by(func.date(Booking.event_date)).all()
        days |= {d for d, n in rows if n >= vendor.daily_capacity}
    return days
