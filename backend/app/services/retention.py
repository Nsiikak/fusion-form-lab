"""Data retention: delete or trim data once its purpose has passed. Runs once a day.

Periods (days) can be changed with environment variables; defaults follow the privacy notice.
Bookings, receipts and payout statements are NEVER deleted here (accounting records)."""
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _days(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, default)))
    except ValueError:
        return default


POLICY = {
    "contact_attempts": ("RETENTION_CONTACT_ATTEMPTS_DAYS", 180),     # blocked chat messages
    "notification_bodies": ("RETENTION_NOTIFICATION_BODY_DAYS", 90),  # email HTML kept for resends
    "notification_log": ("RETENTION_NOTIFICATION_LOG_DAYS", 730),
    "chat_access_log": ("RETENTION_CHAT_ACCESS_DAYS", 730),
    "reset_tokens": ("RETENTION_RESET_TOKENS_DAYS", 7),               # after expiry
    "abandoned_checkouts": ("RETENTION_ABANDONED_CHECKOUT_DAYS", 90),  # never-paid, cancelled
    "inactive_chats": ("RETENTION_CHAT_DAYS", 730),                    # no messages and no bookings for this long
}


def policy_table() -> list[dict]:
    return [{"data": k, "env": env, "days": _days(env, d)} for k, (env, d) in POLICY.items()]


def run(db: Session) -> dict:
    from app.entities.audit import ChatAccessLog, ContactAttempt, NotificationLog
    from app.entities.booking.model import Booking, BookingStatus
    from app.entities.chat.model import Conversation, Message
    from app.entities.user.reset_token import PasswordResetToken
    now = datetime.now(timezone.utc)
    cut = {k: now - timedelta(days=_days(env, d)) for k, (env, d) in POLICY.items()}
    out = {}
    out["contact_attempts"] = db.query(ContactAttempt).filter(ContactAttempt.created_at < cut["contact_attempts"]).delete(synchronize_session=False)
    out["notification_bodies"] = db.query(NotificationLog).filter(
        NotificationLog.created_at < cut["notification_bodies"], NotificationLog.body.isnot(None)).update({"body": None}, synchronize_session=False)
    out["notification_log"] = db.query(NotificationLog).filter(NotificationLog.created_at < cut["notification_log"]).delete(synchronize_session=False)
    out["chat_access_log"] = db.query(ChatAccessLog).filter(ChatAccessLog.created_at < cut["chat_access_log"]).delete(synchronize_session=False)
    out["reset_tokens"] = db.query(PasswordResetToken).filter(PasswordResetToken.expires_at < cut["reset_tokens"]).delete(synchronize_session=False)
    out["abandoned_checkouts"] = db.query(Booking).filter(
        Booking.status == BookingStatus.CANCELLED, Booking.paid_at.is_(None), Booking.created_at < cut["abandoned_checkouts"]
    ).delete(synchronize_session=False)
    # Conversations with no messages and no bookings between the pair for the retention period
    stale = 0
    for c in db.query(Conversation).filter(Conversation.last_message_at < cut["inactive_chats"]).limit(500).all():
        recent = db.query(Booking.id).filter(Booking.customer_id == c.customer_id, Booking.vendor_id == c.vendor_id,
                                             Booking.created_at >= cut["inactive_chats"]).first()
        if not recent:
            db.query(Message).filter(Message.conversation_id == c.id).delete(synchronize_session=False)
            db.delete(c)
            stale += 1
    out["inactive_chats"] = stale
    db.commit()
    from app.entities.user.deletion import erase_due
    out["deleted_accounts"] = erase_due(db)   # grace period: ACCOUNT_DELETION_GRACE_DAYS (default 30)
    if any(out.values()):
        logger.info("Retention clean-up: %s", out)
    return out
