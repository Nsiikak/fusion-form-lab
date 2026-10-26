"""Account deletion, done the way large platforms do it:

1. Request  — the account is signed out everywhere and hidden (a vendor drops out of search).
2. Grace    — for GRACE_DAYS the user can change their mind: signing in restores everything.
3. Erase    — the daily retention job anonymises personal data. The user/vendor rows stay (ids are
              never reused) so bookings, receipts and payout statements keep their accounting history.
"""
import asyncio
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.entities.booking.model import Booking, BookingStatus
from app.entities.user.model import User, UserRole
from app.entities.user.reset_token import PasswordResetToken
from app.entities.vendor.model import Favorite, Vendor

logger = logging.getLogger(__name__)

GRACE_DAYS = max(1, int(os.getenv("ACCOUNT_DELETION_GRACE_DAYS", "30")))

# Bookings where money or a service is still in flight — deleting now would strand someone
_OPEN_STATUSES = (BookingStatus.PENDING, BookingStatus.CONFIRMED,
                  BookingStatus.AWAITING_CONFIRMATION, BookingStatus.DISPUTED)
_OPEN_REFUNDS = ("pending_review", "processing", "needs_details")
_OPEN_PAYOUTS = ("processing", "awaiting_approval", "failed")


def delete_on(user: User) -> datetime:
    return user.deletion_requested_at + timedelta(days=GRACE_DAYS)


def blockers(db: Session, user: User) -> list[str]:
    """Reasons the account can't be deleted yet (empty = OK)."""
    reasons = []
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    mine = Booking.vendor_id == vendor.id if vendor else Booking.customer_id == user.id
    if db.query(Booking.id).filter(mine, Booking.status.in_(_OPEN_STATUSES)).first():
        reasons.append("You have bookings that are still in progress. Finish or cancel them first.")
    if db.query(Booking.id).filter(mine, Booking.refund_status.in_(_OPEN_REFUNDS)).first():
        reasons.append("A refund is still being processed.")
    if vendor and db.query(Booking.id).filter(mine, Booking.payout_status.in_(_OPEN_PAYOUTS)).first():
        reasons.append("A payout to you hasn't gone through yet.")
    return reasons


def request_deletion(db: Session, user: User, password: str) -> datetime:
    if user.role in (UserRole.ADMIN, UserRole.SUPPORT):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Staff accounts are removed by an admin, not self-deleted.")
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect password.")
    reasons = blockers(db, user)
    if reasons:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=" ".join(reasons))

    user.deletion_requested_at = datetime.now(timezone.utc)
    user.token_version = int(user.token_version or 0) + 1     # sign out every session
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if vendor and vendor.is_active:
        vendor.is_active = False
        vendor.hidden_for_deletion = True
    db.commit()
    return delete_on(user)


def cancel_deletion(db: Session, user: User) -> bool:
    """Called on a successful sign-in. Returns True if a pending deletion was cancelled."""
    if not user.deletion_requested_at or user.deleted_at:
        return False
    user.deletion_requested_at = None
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if vendor and vendor.hidden_for_deletion:   # don't undo an admin suspension
        vendor.is_active = True
        vendor.hidden_for_deletion = False
    db.commit()
    return True


def _delete_images(urls: list[str]) -> None:
    from app.services.upload import delete_image
    for url in urls:
        try:
            asyncio.run(delete_image(url))
        except Exception as exc:   # an orphaned image file is not worth failing the erase over
            logger.warning("Couldn't delete image of erased vendor: %s", exc)


def erase(db: Session, user: User) -> None:
    """Anonymise one account. Keeps the rows; removes everything that identifies the person."""
    from app.entities.service_item.model import ServiceItem
    user.email = f"deleted-user-{user.id}@deleted.invalid"
    user.hashed_password = get_password_hash(secrets.token_urlsafe(32))
    user.full_name = "Deleted user"
    user.phone_number = None
    user.refund_bank_code = user.refund_bank_name = user.refund_account_number = None
    user.refund_account_name = user.refund_account_updated_at = None
    user.is_active = False
    user.token_version = int(user.token_version or 0) + 1
    user.deleted_at = datetime.now(timezone.utc)

    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if vendor:
        images = [u for u in [vendor.profile_image_url, *(vendor.gallery_images or [])] if u]
        vendor.business_name = vendor.contact_name = "Deleted vendor"
        vendor.description = None
        vendor.registration_number = vendor.cac_id = vendor.cac_verified_name = None
        vendor.bank_code = vendor.account_number = vendor.recipient_code = None
        vendor.profile_image_url = None
        vendor.gallery_images = None
        vendor.is_active = False
        vendor.hidden_for_deletion = False
        db.query(ServiceItem).filter(ServiceItem.vendor_id == vendor.id).update({"is_active": False}, synchronize_session=False)
        db.query(Favorite).filter(Favorite.vendor_id == vendor.id).delete(synchronize_session=False)
        _delete_images(images)

    db.query(Favorite).filter(Favorite.user_id == user.id).delete(synchronize_session=False)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete(synchronize_session=False)


def erase_due(db: Session) -> int:
    """Anonymise every account whose grace period has ended. Run daily by the retention job."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=GRACE_DAYS)
    due = db.query(User).filter(User.deletion_requested_at.isnot(None), User.deletion_requested_at < cutoff,
                                User.deleted_at.is_(None)).limit(200).all()
    erased = 0
    for user in due:
        reasons = blockers(db, user)   # e.g. a dispute opened during the grace period
        if reasons:
            logger.warning("Account %s is due for deletion but still has open business: %s", user.id, " ".join(reasons))
            continue
        erase(db, user)
        erased += 1
    db.commit()
    return erased
