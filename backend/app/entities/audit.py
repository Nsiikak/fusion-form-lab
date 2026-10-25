"""Audit trail: who read which chat and why, blocked contact-sharing attempts, and every notification sent."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class ChatAccessLog(Base):
    """An admin opened a conversation (always tied to a reason, usually a case)."""
    __tablename__ = "chat_access_log"
    id = Column(Integer, primary_key=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    conversation_id = Column(Integer, nullable=True, index=True)
    booking_id = Column(Integer, nullable=True)
    reason = Column(String(300), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class ContactAttempt(Base):
    """A chat message blocked for containing contact details (kept 180 days for fraud review)."""
    __tablename__ = "contact_attempts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(Integer, nullable=True)
    kind = Column(String(20), nullable=False)          # phone | email | link | social | handle
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class NotificationLog(Base):
    """Every email and SMS we tried to send, with its outcome."""
    __tablename__ = "notification_log"
    id = Column(Integer, primary_key=True)
    reference = Column(String(24), nullable=False, unique=True)
    channel = Column(String(10), nullable=False)        # email | sms
    recipient = Column(String(255), nullable=False)
    subject = Column(String(300), nullable=True)
    status = Column(String(10), nullable=False)         # sent | failed | skipped
    error = Column(Text, nullable=True)
    body = Column(Text, nullable=True)                  # email HTML, kept 90 days so support can resend it
    resent_from = Column(String(24), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


def log_notification(channel: str, recipient: str, subject: str, ok: bool, error: str = "", reference: str = "",
                     body: str = None, resent_from: str = None) -> None:
    """Best effort: an audit-log hiccup must never stop a notification."""
    import logging, secrets
    from app.core.database import SessionLocal
    try:
        db = SessionLocal()
        try:
            db.add(NotificationLog(reference=reference or f"N-{secrets.token_hex(5).upper()}", channel=channel,
                                   recipient=recipient[:255], subject=(subject or "")[:300],
                                   status="sent" if ok else "failed", error=(error or None) and error[:1000],
                                   body=body, resent_from=resent_from))
            db.commit()
        finally:
            db.close()
    except Exception as exc:
        logging.getLogger(__name__).error("Couldn't write notification log: %s", exc)
