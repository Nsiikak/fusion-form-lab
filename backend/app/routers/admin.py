from pydantic import BaseModel, EmailStr, Field
"""Admin endpoints — vendor verification and the cases queue.

Every route requires an admin user. Create one with:  python create_admin.py you@example.com
"""
from datetime import datetime, timezone
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.booking.model import Booking, BookingStatus
from app.entities.booking.notifications import notify_resolution
from app.entities.booking.schema import ResolveRequest
from app.entities.booking.service import BookingService, serialize_booking
from app.entities.user.model import User
from app.entities.vendor.model import Vendor, VerificationStatus
from app.services.email import _fire_and_forget, send_notice_email, send_vendor_approved_email

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")
    return current_user


# ── Overview ─────────────────────────────────────────────────────────────────

CASE_FILTER = or_(
    (Booking.status == BookingStatus.DISPUTED) & Booking.resolution.is_(None),
    Booking.refund_status.in_(["pending_review", "failed", "needs_details"]),
    Booking.payout_status.in_(["failed", "awaiting_approval", "awaiting_otp"]),
)

# Payout states where the vendor's share is still sitting in our Paystack balance
UNPAID_PAYOUT = ["not_due", "awaiting_approval", "awaiting_otp", "processing", "failed"]
ACTIVE = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.AWAITING_CONFIRMATION, BookingStatus.DISPUTED]


@router.get("/overview", response_model=dict)
def overview(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    count = lambda q: q.scalar() or 0  # noqa: E731
    return {
        "vendors_pending": count(db.query(func.count(Vendor.id)).filter(
            Vendor.verification_status == VerificationStatus.PENDING, Vendor.is_active == True)),  # noqa: E712
        "open_disputes": count(db.query(func.count(Booking.id)).filter(
            Booking.status == BookingStatus.DISPUTED, Booking.resolution.is_(None))),
        "refund_reviews": count(db.query(func.count(Booking.id)).filter(Booking.refund_status == "pending_review")),
        "failed_payouts": count(db.query(func.count(Booking.id)).filter(Booking.payout_status == "failed")),
        "failed_refunds": count(db.query(func.count(Booking.id)).filter(
            Booking.refund_status.in_(["failed", "needs_details"]))),
        "payouts_awaiting_approval": count(db.query(func.count(Booking.id)).filter(
            Booking.payout_status == "awaiting_approval")),
        "payouts_awaiting_otp": count(db.query(func.count(Booking.id)).filter(Booking.payout_status == "awaiting_otp")),
        # Money we're holding for someone: full customer payment on live bookings, plus the
        # vendor's share on settled bookings until their transfer actually lands.
        "escrow_held": float(
            count(db.query(func.coalesce(func.sum(Booking.customer_total), 0)).filter(
                Booking.paid_at.isnot(None), Booking.status.in_(ACTIVE)))
            + count(db.query(func.coalesce(func.sum(Booking.payout_amount), 0)).filter(
                Booking.paid_out == True, Booking.payout_status.in_(UNPAID_PAYOUT)))  # noqa: E712
        ),
        # Commission + customer fee on every booking where the vendor's payout has been triggered
        "platform_earnings": float(count(db.query(
            func.coalesce(func.sum(func.coalesce(Booking.commission_amount, 0) + func.coalesce(Booking.platform_fee, 0)), 0)
        ).filter(Booking.paid_out == True))),  # noqa: E712
    }


# ── Vendor verification ──────────────────────────────────────────────────────

def _reliability(vendor_id: int) -> dict:
    from app.core.database import SessionLocal
    from app.entities.booking.trust import TrustService
    db = SessionLocal()
    try:
        return TrustService.reliability(db, vendor_id)
    finally:
        db.close()


def _vendor_row(v: Vendor) -> dict:
    owner = v.user
    return {
        "id": v.id,
        "business_name": v.business_name,
        "contact_name": v.contact_name,
        "email": owner.email if owner else None,
        "phone_number": owner.phone_number if owner else None,
        "category": v.category.value,
        "location": v.location,
        "description": v.description,
        "business_size": v.business_size.value,
        "starting_price": float(v.starting_price),
        "logistics_fee": float(v.logistics_fee) if v.logistics_fee is not None else None,
        "registration_number": v.registration_number,
        "cac_verified_name": v.cac_verified_name,
        "cac_verification_attempted": bool(v.cac_verification_attempted),
        "has_bank_account": bool(v.recipient_code),
        "profile_image_url": v.profile_image_url,
        "gallery_images": v.gallery_images or [],
        "verification_status": v.verification_status.value,
        "verification_note": v.verification_note,
        "verified_at": v.verified_at.isoformat() if v.verified_at else None,
        "auto_verified": v.verification_status == VerificationStatus.APPROVED and v.verified_by is None,
        "is_active": bool(v.is_active),
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "cancellation_policy": v.cancellation_policy,
        "reliability": _reliability(v.id),
    }


@router.get("/vendors", response_model=dict)
def list_vendors(
    status_filter: str = Query("pending", alias="status", pattern="^(pending|approved|rejected|suspended|all)$"),
    q: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = db.query(Vendor).options(joinedload(Vendor.user))
    if status_filter == "suspended":
        query = query.filter(Vendor.is_active == False)  # noqa: E712
    elif status_filter != "all":
        query = query.filter(
            Vendor.verification_status == VerificationStatus(status_filter),
            Vendor.is_active == True,  # noqa: E712
        )
    if q:
        like = f"%{q.strip()}%"
        query = query.join(User, User.id == Vendor.user_id).filter(
            or_(Vendor.business_name.ilike(like), Vendor.contact_name.ilike(like), User.email.ilike(like))
        )
    total = query.count()
    # Oldest first for the pending queue (first come, first served); newest first otherwise
    order = Vendor.created_at.asc() if status_filter == "pending" else Vendor.created_at.desc()
    rows = query.order_by(order).offset((page - 1) * limit).limit(limit).all()
    return {
        "vendors": [_vendor_row(v) for v in rows],
        "total": total,
        "page": page,
        "total_pages": max(1, ceil(total / limit)),
    }


class VerificationDecision(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected)$")
    note: Optional[str] = Field(None, max_length=1000, description="Required when rejecting; emailed to the vendor")


@router.post("/vendors/{vendor_id}/verification", response_model=dict)
def decide_verification(
    vendor_id: int,
    body: VerificationDecision,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    vendor = db.query(Vendor).options(joinedload(Vendor.user)).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    note = (body.note or "").strip()
    if body.decision == "rejected" and len(note) < 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Give the vendor a reason for rejection")

    vendor.verification_status = VerificationStatus(body.decision)
    vendor.verification_note = note or None
    vendor.verified_at = datetime.now(timezone.utc)
    vendor.verified_by = admin.id
    db.commit()
    db.refresh(vendor)

    owner = vendor.user
    if owner:
        name = owner.full_name or owner.email
        if body.decision == "approved":
            _fire_and_forget(send_vendor_approved_email, owner.email, name, vendor.business_name)
        else:
            _fire_and_forget(
                send_notice_email, owner.email, name,
                f"Update on your Plagohive application — {vendor.business_name}",
                "Verification", "We couldn't verify your business yet",
                [
                    f"Thanks for applying to sell on Plagohive. We weren't able to approve {vendor.business_name} "
                    "at this stage. Here's why:",
                    note,
                    "You can update your profile and reply to this email when you're ready for us to take "
                    "another look.",
                ],
                "Update my profile", "/profile",
            )
    return _vendor_row(vendor)


class ActiveRequest(BaseModel):
    is_active: bool
    note: Optional[str] = Field(None, max_length=1000)


@router.post("/vendors/{vendor_id}/active", response_model=dict)
def set_vendor_active(
    vendor_id: int,
    body: ActiveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Suspend or reinstate a vendor. Suspended vendors disappear from search and can't be booked;
    existing bookings continue."""
    vendor = db.query(Vendor).options(joinedload(Vendor.user)).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    note = (body.note or "").strip()
    if not body.is_active and len(note) < 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Give a reason for suspending")
    vendor.is_active = body.is_active
    if note:
        vendor.verification_note = note
    db.commit()
    db.refresh(vendor)

    owner = vendor.user
    if owner and not body.is_active:
        _fire_and_forget(
            send_notice_email, owner.email, owner.full_name or owner.email,
            f"Your Plagohive listing has been paused — {vendor.business_name}",
            "Account", "Your listing has been paused",
            [
                f"We've temporarily paused {vendor.business_name}, so it won't appear in search or take new "
                "bookings. Your existing bookings are not affected.",
                f"Reason: {note}",
                "If you think this is a mistake, just reply to this email.",
            ],
            "View my dashboard", "/vendor-dashboard",
        )
    return _vendor_row(vendor)


# ── Cases: disputes, refund decisions, failed money movements ────────────────

def _case_row(b: Booking) -> dict:
    row = serialize_booking(b, "admin")
    row["case_type"] = BookingService.case_type(b)
    return row


@router.get("/cases", response_model=list[dict])
def list_cases(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    rows = (
        db.query(Booking)
        .options(joinedload(Booking.vendor).joinedload(Vendor.user), joinedload(Booking.customer))
        .filter(CASE_FILTER)
        .order_by(func.coalesce(Booking.disputed_at, Booking.updated_at, Booking.created_at).asc())
        .all()
    )
    # Disputes first — they block both parties
    priority = {"dispute": 0, "refund_review": 1, "payout_approval": 2, "failed_payout": 3,
                "refund_needs_details": 4, "awaiting_otp": 5, "failed_refund": 6}
    return sorted((_case_row(b) for b in rows), key=lambda r: priority.get(r["case_type"], 9))


@router.get("/cases/history", response_model=list[dict])
def resolved_cases(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rows = (
        db.query(Booking)
        .options(joinedload(Booking.vendor).joinedload(Vendor.user), joinedload(Booking.customer))
        .filter(Booking.resolved_at.isnot(None))
        .order_by(Booking.resolved_at.desc())
        .limit(limit)
        .all()
    )
    return [_case_row(b) for b in rows]


def _load_booking(db: Session, booking_id: int) -> Booking:
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.vendor).joinedload(Vendor.user), joinedload(Booking.customer))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


@router.post("/bookings/{booking_id}/resolve", response_model=dict)
def resolve_case(
    booking_id: int,
    body: ResolveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Decide a dispute or a late-cancellation refund: full refund to the customer, or release to the vendor."""
    booking = BookingService.resolve(db, _load_booking(db, booking_id), body.outcome, body.note, admin.id)
    notify_resolution(db, booking)
    return _case_row(booking)


@router.post("/bookings/{booking_id}/approve-payout", response_model=dict)
def approve_payout(booking_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Send a payout that was held because it's above PAYOUT_APPROVAL_THRESHOLD."""
    booking = _load_booking(db, booking_id)
    BookingService.approve_payout(db, booking)
    return _case_row(booking)


@router.post("/bookings/{booking_id}/sync-payout", response_model=dict)
def sync_payout(booking_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Check a sent payout's status directly with Paystack."""
    booking = _load_booking(db, booking_id)
    BookingService.sync_payout(db, booking)
    return _case_row(booking)


@router.post("/bookings/{booking_id}/retry-payout", response_model=dict)
def retry_payout(booking_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    booking = _load_booking(db, booking_id)
    BookingService.retry_payout(db, booking)
    return _case_row(booking)


@router.post("/bookings/{booking_id}/retry-refund", response_model=dict)
def retry_refund(booking_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    booking = _load_booking(db, booking_id)
    if booking.refund_status != "failed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only failed refunds can be retried")
    BookingService.refund(db, booking, "Refund retry by admin")
    db.refresh(booking)
    return _case_row(booking)


@router.get("/conversations/between")
def conversation_for_booking(booking_id: int, reason: str = Query(..., min_length=5, max_length=300),
                             db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Full, unmasked chat between a booking's customer and vendor — evidence for disputes.
    Every view is logged with the admin, the time and the reason."""
    from app.entities.audit import ChatAccessLog
    from app.entities.chat.model import Conversation
    from app.entities.chat.service import ChatService
    booking = _load_booking(db, booking_id)
    conv = db.query(Conversation).filter(
        Conversation.customer_id == booking.customer_id, Conversation.vendor_id == booking.vendor_id
    ).first()
    db.add(ChatAccessLog(admin_id=admin.id, conversation_id=conv.id if conv else None, booking_id=booking.id, reason=reason.strip()))
    db.commit()
    if not conv:
        return {"messages": [], "customer_name": booking.customer.full_name, "vendor_name": booking.vendor.business_name}
    return {
        "customer_name": booking.customer.full_name,
        "vendor_name": booking.vendor.business_name,
        **ChatService.messages(db, conv, "admin"),
    }


@router.get("/upcoming")
def upcoming_events(days: int = Query(7, ge=1, le=30), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Paid bookings with events in the next few days, with a green/amber/red health signal."""
    from app.entities.booking.trust import TrustService
    return TrustService.upcoming_board(db, days)


# ── KPIs and reports ─────────────────────────────────────────────────────────

def _period(days: Optional[int], start: Optional[str], end: Optional[str]):
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    if start:
        s = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
        e = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) + timedelta(days=1) if end else now
        return s, e
    if days:
        return now - timedelta(days=days), now
    return datetime(2026, 1, 1, tzinfo=timezone.utc), now   # all time


@router.get("/metrics")
def metrics(days: Optional[int] = Query(30, ge=1, le=3650), start: Optional[str] = None, end: Optional[str] = None,
            all_time: bool = False, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from app.services.metrics import compute
    s, e = _period(None if all_time else days, start, end)
    return compute(db, s, e)


@router.get("/metrics/report")
def metrics_report(format: str = Query("pdf", pattern="^(pdf|csv)$"), days: Optional[int] = Query(30, ge=1, le=3650),
                   start: Optional[str] = None, end: Optional[str] = None, all_time: bool = False,
                   db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from fastapi import Response
    from app.services.metrics import compute, report_csv, report_pdf
    s, e = _period(None if all_time else days, start, end)
    m = compute(db, s, e)
    name = f"plagohive-kpis-{s:%Y%m%d}-{e:%Y%m%d}.{format}"
    data, mime = (report_pdf(m), "application/pdf") if format == "pdf" else (report_csv(m), "text/csv")
    return Response(content=data, media_type=mime,
                    headers={"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "no-store"})



# ── Audit ────────────────────────────────────────────────────────────────────

@router.get("/audit/chat-access")
def chat_access_log(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from app.entities.audit import ChatAccessLog
    rows = db.query(ChatAccessLog).order_by(ChatAccessLog.created_at.desc()).limit(limit).all()
    names = {u.id: u.email for u in db.query(User).filter(User.id.in_({r.admin_id for r in rows if r.admin_id})).all()} if rows else {}
    return [{"id": r.id, "admin": names.get(r.admin_id, "deleted"), "booking_id": r.booking_id, "conversation_id": r.conversation_id,
             "reason": r.reason, "at": r.created_at.isoformat() if r.created_at else None} for r in rows]


@router.get("/audit/flagged")
def flagged_users(days: int = Query(30, ge=1, le=180), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """People who repeatedly tried to send contact details, most attempts first, with their latest attempts."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func
    from app.entities.audit import ContactAttempt
    since = datetime.now(timezone.utc) - timedelta(days=days)
    counts = (db.query(ContactAttempt.user_id, func.count(ContactAttempt.id)).filter(ContactAttempt.created_at >= since)
              .group_by(ContactAttempt.user_id).order_by(func.count(ContactAttempt.id).desc()).limit(50).all())
    out = []
    for uid, n in counts:
        u = db.query(User).filter(User.id == uid).first()
        recent = (db.query(ContactAttempt).filter(ContactAttempt.user_id == uid).order_by(ContactAttempt.created_at.desc()).limit(5).all())
        out.append({"user_id": uid, "name": u.full_name if u else "deleted", "email": u.email if u else "", "role": u.role.value if u else "",
                    "attempts": n, "recent": [{"kind": a.kind, "body": a.body, "at": a.created_at.isoformat() if a.created_at else None} for a in recent]})
    return out


@router.get("/audit/notifications")
def notification_log(limit: int = Query(100, ge=1, le=500), status_filter: Optional[str] = Query(None, alias="status"),
                     db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from app.entities.audit import NotificationLog
    q = db.query(NotificationLog)
    if status_filter in ("sent", "failed"):
        q = q.filter(NotificationLog.status == status_filter)
    return [{"reference": r.reference, "channel": r.channel, "recipient": r.recipient, "subject": r.subject, "status": r.status,
             "error": r.error, "at": r.created_at.isoformat() if r.created_at else None}
            for r in q.order_by(NotificationLog.created_at.desc()).limit(limit).all()]



# ── Support team: escalations, staff accounts, retention policy ──────────────

class EscalationResolve(BaseModel):
    resolution_note: str = Field(..., min_length=2, max_length=2000)


@router.get("/escalations")
def all_escalations(status_filter: Optional[str] = Query(None, alias="status"), db: Session = Depends(get_db),
                    admin: User = Depends(require_admin)):
    from app.entities.support import Escalation
    from app.routers.support import escalation_rows
    q = db.query(Escalation)
    if status_filter in ("open", "resolved"):
        q = q.filter(Escalation.status == status_filter)
    return escalation_rows(db, q)


@router.post("/escalations/{escalation_id}/resolve")
def resolve_escalation(escalation_id: int, body: EscalationResolve, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from datetime import datetime, timezone
    from app.entities.support import Escalation
    e = db.query(Escalation).filter(Escalation.id == escalation_id, Escalation.status == "open").first()
    if not e:
        raise HTTPException(status_code=404, detail="Open escalation not found")
    e.status, e.resolution_note, e.resolved_by, e.resolved_at = "resolved", body.resolution_note.strip(), admin.id, datetime.now(timezone.utc)
    db.commit()
    return {"id": e.id, "status": e.status}


class SupportUserIn(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=120)


@router.post("/support-users", status_code=201)
def create_support_user(body: SupportUserIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Create a support team account. They get an email to set their own password."""
    import hashlib, secrets
    from datetime import datetime, timedelta, timezone
    from app.core.security import get_password_hash
    from app.entities.user.model import UserRole
    from app.entities.user.reset_token import PasswordResetToken
    from app.services.email import _fire_and_forget, send_password_reset_email
    if db.query(User.id).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    u = User(email=body.email, full_name=body.full_name.strip(), role=UserRole.SUPPORT, is_active=True,
             hashed_password=get_password_hash(secrets.token_urlsafe(32)))
    db.add(u)
    db.commit()
    token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(user_id=u.id, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                              expires_at=datetime.now(timezone.utc) + timedelta(hours=48)))
    db.commit()
    _fire_and_forget(send_password_reset_email, u.email, u.full_name, token)
    return {"id": u.id, "email": u.email, "role": "support"}


@router.get("/support-users")
def list_support_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from app.entities.user.model import UserRole
    return [{"id": u.id, "email": u.email, "full_name": u.full_name, "is_active": u.is_active}
            for u in db.query(User).filter(User.role == UserRole.SUPPORT).order_by(User.created_at.desc()).all()]


@router.post("/support-users/{user_id}/deactivate")
def deactivate_support_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from app.entities.user.model import UserRole
    u = db.query(User).filter(User.id == user_id, User.role == UserRole.SUPPORT).first()
    if not u:
        raise HTTPException(status_code=404, detail="Support user not found")
    u.is_active = False
    u.token_version = int(u.token_version or 0) + 1      # signs them out everywhere
    db.commit()
    return {"id": u.id, "is_active": False}


@router.get("/retention")
def retention_policy(admin: User = Depends(require_admin)):
    from app.services.retention import policy_table
    return policy_table()
