"""Support team API.

Support can look up, read (with a logged reason), nudge, resend, note and escalate. It cannot move
money (refund, release, approve or retry payouts), verify or suspend vendors, see revenue metrics or
read the audit logs: those stay with admins, and support escalates them."""
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.booking.model import Booking, BookingStatus
from app.entities.booking.service import BookingService, serialize_booking
from app.entities.support import Escalation, SupportNote
from app.entities.user.model import User
from app.entities.vendor.model import Vendor

router = APIRouter()

# Money internals support doesn't need to help a customer
_HIDDEN = {"commission_amount", "payout_amount", "penalty_deducted", "payout_error", "advance_error"}


def require_support(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role.value not in ("support", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Support team only")
    return current_user


def _row(b: Booking) -> dict:
    row = {k: v for k, v in serialize_booking(b, "admin").items() if k not in _HIDDEN}
    row["case_type"] = BookingService.case_type(b)
    row["customer_contact"] = {"name": b.customer.full_name if b.customer else None,
                               "email": b.customer.email if b.customer else None,
                               "phone": b.customer.phone_number if b.customer else None}
    vu = b.vendor.user if b.vendor else None
    row["vendor_contact"] = {"name": b.vendor.business_name if b.vendor else None,
                             "email": vu.email if vu else None, "phone": vu.phone_number if vu else None}
    return row


def _booking_query(db: Session):
    return db.query(Booking).options(joinedload(Booking.vendor).joinedload(Vendor.user), joinedload(Booking.customer))


@router.get("/cases")
def support_cases(db: Session = Depends(get_db), user: User = Depends(require_support)):
    """The same queue admins work, read-only."""
    from app.routers.admin import CASE_FILTER
    rows = _booking_query(db).filter(CASE_FILTER).order_by(Booking.updated_at.asc()).all()
    return [_row(b) for b in rows]


@router.get("/lookup")
def lookup(q: str = Query(..., min_length=1, max_length=120), db: Session = Depends(get_db), user: User = Depends(require_support)):
    """Find bookings by ID, payment reference, receipt number, or the customer's or vendor's email or phone."""
    q = q.strip()
    query = _booking_query(db).outerjoin(User, Booking.customer_id == User.id)
    conds = [Booking.payment_reference.ilike(q), Booking.receipt_number.ilike(q), User.email.ilike(f"%{q}%"), User.phone_number.ilike(f"%{q}%")]
    if q.lstrip("#").isdigit():
        conds.append(Booking.id == int(q.lstrip("#")))
    vendor_ids = [v.id for v in db.query(Vendor).join(User, Vendor.user_id == User.id).filter(
        or_(User.email.ilike(f"%{q}%"), User.phone_number.ilike(f"%{q}%"), Vendor.business_name.ilike(f"%{q}%"))).limit(20).all()]
    if vendor_ids:
        conds.append(Booking.vendor_id.in_(vendor_ids))
    rows = query.filter(or_(*conds), Booking.status != BookingStatus.AWAITING_PAYMENT).order_by(Booking.created_at.desc()).limit(25).all()
    return [_row(b) for b in rows]


@router.get("/upcoming")
def support_upcoming(days: int = Query(7, ge=1, le=30), db: Session = Depends(get_db), user: User = Depends(require_support)):
    from app.entities.booking.trust import TrustService
    return TrustService.upcoming_board(db, days)


@router.get("/conversations/between")
def support_conversation(booking_id: int, reason: str = Query(..., min_length=5, max_length=300),
                         db: Session = Depends(get_db), user: User = Depends(require_support)):
    """Read a booking's conversation. Every view is logged with the person, the time and the reason."""
    from app.routers.admin import conversation_for_booking
    return conversation_for_booking(booking_id=booking_id, reason=f"[support] {reason}", db=db, admin=user)


# ── Notes ────────────────────────────────────────────────────────────────────

class NoteIn(BaseModel):
    booking_id: int
    note: str = Field(..., min_length=2, max_length=2000)


@router.get("/notes")
def list_notes(booking_id: int, db: Session = Depends(get_db), user: User = Depends(require_support)):
    rows = db.query(SupportNote).filter(SupportNote.booking_id == booking_id).order_by(SupportNote.created_at.desc()).all()
    names = {u.id: u.full_name or u.email for u in db.query(User).filter(User.id.in_({r.author_id for r in rows})).all()} if rows else {}
    return [{"id": r.id, "note": r.note, "author": names.get(r.author_id, "deleted"),
             "at": r.created_at.isoformat() if r.created_at else None} for r in rows]


@router.post("/notes", status_code=201)
def add_note(body: NoteIn, db: Session = Depends(get_db), user: User = Depends(require_support)):
    if not db.query(Booking.id).filter(Booking.id == body.booking_id).first():
        raise HTTPException(status_code=404, detail="Booking not found")
    n = SupportNote(booking_id=body.booking_id, author_id=user.id, note=body.note.strip())
    db.add(n)
    db.commit()
    return {"id": n.id}


# ── Escalations ──────────────────────────────────────────────────────────────

class EscalationIn(BaseModel):
    booking_id: Optional[int] = None
    priority: str = Field("normal", pattern="^(normal|urgent)$")
    category: str = Field("other", pattern="^(refund|release|payout|vendor|fraud|other)$")
    note: str = Field(..., min_length=10, max_length=2000)


def _escalation_out(e: Escalation, names: dict) -> dict:
    return {"id": e.id, "booking_id": e.booking_id, "priority": e.priority, "category": e.category, "note": e.note,
            "status": e.status, "raised_by": names.get(e.raised_by, "deleted"), "resolution_note": e.resolution_note,
            "resolved_by": names.get(e.resolved_by) if e.resolved_by else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None}


def escalation_rows(db: Session, q) -> list:
    rows = q.order_by(Escalation.status.desc(), Escalation.created_at.desc()).limit(200).all()
    ids = {r.raised_by for r in rows} | {r.resolved_by for r in rows if r.resolved_by}
    names = {u.id: u.full_name or u.email for u in db.query(User).filter(User.id.in_(ids)).all()} if rows else {}
    return [_escalation_out(r, names) for r in rows]


@router.post("/escalations", status_code=201)
def escalate(body: EscalationIn, db: Session = Depends(get_db), user: User = Depends(require_support)):
    """Ask an admin to decide. Admins are alerted by email; urgent ones say so in the subject."""
    if body.booking_id and not db.query(Booking.id).filter(Booking.id == body.booking_id).first():
        raise HTTPException(status_code=404, detail="Booking not found")
    e = Escalation(booking_id=body.booking_id, raised_by=user.id, priority=body.priority, category=body.category, note=body.note.strip())
    db.add(e)
    db.commit()
    try:
        from app.core.config import ADMIN_ALERT_EMAILS
        from app.services.email import _fire_and_forget, send_notice_email
        for admin_email in ADMIN_ALERT_EMAILS:
            _fire_and_forget(send_notice_email, admin_email, "Admin",
                             f"{'URGENT: ' if body.priority == 'urgent' else ''}Support escalation #{e.id}"
                             + (f" for booking #{body.booking_id}" if body.booking_id else ""),
                             "Escalation", "A support colleague needs a decision",
                             [f"Category: {body.category}. Raised by {user.full_name or user.email}.", body.note.strip()],
                             "Open admin dashboard", "/admin")
    except Exception:
        pass
    return {"id": e.id}


@router.get("/escalations")
def my_escalations(db: Session = Depends(get_db), user: User = Depends(require_support)):
    return escalation_rows(db, db.query(Escalation).filter(Escalation.raised_by == user.id))


# ── Notifications ────────────────────────────────────────────────────────────

@router.get("/notifications")
def notifications(recipient: Optional[str] = Query(None, max_length=255), limit: int = Query(50, ge=1, le=200),
                  db: Session = Depends(get_db), user: User = Depends(require_support)):
    from app.entities.audit import NotificationLog
    q = db.query(NotificationLog)
    if recipient:
        q = q.filter(NotificationLog.recipient.ilike(f"%{recipient.strip()}%"))
    return [{"reference": r.reference, "channel": r.channel, "recipient": r.recipient, "subject": r.subject,
             "status": r.status, "error": r.error, "resendable": r.channel == "email" and bool(r.body),
             "resent_from": r.resent_from, "at": r.created_at.isoformat() if r.created_at else None}
            for r in q.order_by(NotificationLog.created_at.desc()).limit(limit).all()]


_resent: dict = {}


@router.post("/notifications/{reference}/resend")
def resend(reference: str, db: Session = Depends(get_db), user: User = Depends(require_support)):
    """Send an email again exactly as it was (at most once every 10 minutes per email)."""
    from app.entities.audit import NotificationLog, log_notification
    from app.services.email import send_email
    n = db.query(NotificationLog).filter(NotificationLog.reference == reference).first()
    if not n or n.channel != "email":
        raise HTTPException(status_code=404, detail="Email not found")
    if not n.body:
        raise HTTPException(status_code=400, detail="This email's content is no longer kept (older than 90 days), so it can't be resent.")
    if time.time() - _resent.get(reference, 0) < 600:
        raise HTTPException(status_code=429, detail="This email was resent less than 10 minutes ago.")
    _resent[reference] = time.time()
    ok, msg = send_email(n.recipient, n.subject, n.body)
    import secrets
    ref = f"N-{secrets.token_hex(5).upper()}"
    log_notification("email", n.recipient, n.subject, ok, "" if ok else msg, ref, body=n.body, resent_from=reference)
    if not ok:
        raise HTTPException(status_code=502, detail=f"Couldn't send: {msg}")
    return {"reference": ref, "status": "sent"}


# ── Nudges ───────────────────────────────────────────────────────────────────

_nudged: dict = {}


@router.post("/bookings/{booking_id}/nudge-vendor")
def nudge_vendor(booking_id: int, db: Session = Depends(get_db), user: User = Depends(require_support)):
    """Remind the vendor to accept or reconfirm (email, plus SMS when enabled). Once an hour per booking."""
    b = _booking_query(db).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.status not in (BookingStatus.PENDING, BookingStatus.CONFIRMED):
        raise HTTPException(status_code=400, detail="Only bookings waiting for the vendor can be nudged")
    if time.time() - _nudged.get(booking_id, 0) < 3600:
        raise HTTPException(status_code=429, detail="This vendor was nudged less than an hour ago.")
    _nudged[booking_id] = time.time()
    vu = b.vendor.user if b.vendor else None
    action = "accept or decline" if b.status == BookingStatus.PENDING else "reconfirm"
    from app.services.email import _fire_and_forget, send_notice_email
    from app.services.sms import alert
    if vu:
        _fire_and_forget(send_notice_email, vu.email, vu.full_name or b.vendor.business_name,
                         f"Action needed: please {action} booking #{b.id}", "Reminder", f"Please {action} booking #{b.id}",
                         [f"The customer is waiting on you for their event on {b.event_date:%d %b %Y}. Open your dashboard to {action}."],
                         "Open dashboard", "/vendor-dashboard")
        alert(vu.phone_number, f"Plagohive: please {action} booking #{b.id} in your dashboard. The customer is waiting.")
    db.add(SupportNote(booking_id=b.id, author_id=user.id, note=f"Nudged the vendor to {action}."))
    db.commit()
    return {"status": "sent", "action": action}
