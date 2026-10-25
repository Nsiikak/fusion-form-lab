import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.entities.booking.model import Booking, BookingStatus
from app.entities.chat.contact_filter import find_contact, mask_contact
from app.entities.chat.model import Conversation, Message
from app.entities.user.model import User
from app.entities.vendor.model import Vendor, VerificationStatus

logger = logging.getLogger(__name__)

EMAIL_QUIET_PERIOD = timedelta(minutes=15)   # at most one "new messages" email per burst
MAX_BODY = 2000

# Bookings that make sharing contact details OK (paid and not cancelled/declined)
LIVE_PAID = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.AWAITING_CONFIRMATION,
             BookingStatus.DISPUTED, BookingStatus.COMPLETED]


class ChatService:
    # ── Access ───────────────────────────────────────────────────────────────
    @staticmethod
    def role_in(db: Session, conv: Conversation, user: User) -> str:
        if conv.customer_id == user.id:
            return "customer"
        vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
        if vendor and conv.vendor_id == vendor.id:
            return "vendor"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    @staticmethod
    def get_for_user(db: Session, conversation_id: int, user: User) -> tuple[Conversation, str]:
        conv = (
            db.query(Conversation)
            .options(joinedload(Conversation.customer), joinedload(Conversation.vendor).joinedload(Vendor.user))
            .filter(Conversation.id == conversation_id)
            .first()
        )
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return conv, ChatService.role_in(db, conv, user)

    @staticmethod
    def contact_allowed(db: Session, conv: Conversation) -> bool:
        """Contact details are never exchanged in chat. Phone numbers appear only on the booking card,
        from the vendor's reconfirmation until the event is over. This keeps repeat business on Plagohive."""
        return False

    # ── Conversations ────────────────────────────────────────────────────────
    @staticmethod
    def start(db: Session, customer: User, vendor_id: int) -> Conversation:
        if customer.role.value != "customer":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only customers can start a chat with a vendor")
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor or not vendor.is_active or vendor.verification_status != VerificationStatus.APPROVED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not available")
        conv = db.query(Conversation).filter(
            Conversation.customer_id == customer.id, Conversation.vendor_id == vendor_id
        ).first()
        if conv:
            return conv
        conv = Conversation(customer_id=customer.id, vendor_id=vendor_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv

    @staticmethod
    def list_for_user(db: Session, user: User) -> list[dict]:
        vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first() if user.role.value == "vendor" else None
        q = db.query(Conversation).options(
            joinedload(Conversation.customer), joinedload(Conversation.vendor)
        )
        if vendor:
            q = q.filter(Conversation.vendor_id == vendor.id, Conversation.last_message_at.isnot(None))
            role = "vendor"
        else:
            q = q.filter(Conversation.customer_id == user.id)
            role = "customer"
        convs = q.order_by(func.coalesce(Conversation.last_message_at, Conversation.created_at).desc()).all()
        return [ChatService.summary(db, c, role) for c in convs]

    @staticmethod
    def unread_count(db: Session, conv: Conversation, role: str) -> int:
        last_read = conv.customer_last_read_id if role == "customer" else conv.vendor_last_read_id
        return db.query(func.count(Message.id)).filter(
            Message.conversation_id == conv.id,
            Message.id > last_read,
            Message.sender_role != role,
        ).scalar() or 0

    @staticmethod
    def total_unread(db: Session, user: User) -> int:
        return sum(c["unread"] for c in ChatService.list_for_user(db, user))

    @staticmethod
    def summary(db: Session, conv: Conversation, role: str) -> dict:
        other = (
            {"name": conv.vendor.business_name, "image": conv.vendor.profile_image_url,
             "subtitle": conv.vendor.category.value.title(), "vendor_id": conv.vendor_id}
            if role == "customer" else
            {"name": conv.customer.full_name or conv.customer.email.split("@")[0], "image": None,
             "subtitle": "Customer", "vendor_id": conv.vendor_id}
        )
        upcoming = (
            db.query(Booking)
            .filter(Booking.customer_id == conv.customer_id, Booking.vendor_id == conv.vendor_id,
                    Booking.paid_at.isnot(None), Booking.status.in_(LIVE_PAID[:-1]))
            .order_by(Booking.event_date.asc())
            .first()
        )
        preview = conv.last_message_preview or ""
        if preview and not ChatService.contact_allowed(db, conv):
            preview = mask_contact(preview)
        return {
            "id": conv.id,
            "other": other,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "last_message_preview": preview,
            "unread": ChatService.unread_count(db, conv, role),
            "booking": (
                {"id": upcoming.id, "status": upcoming.status.value, "event_date": upcoming.event_date.isoformat()}
                if upcoming else None
            ),
        }

    # ── Messages ─────────────────────────────────────────────────────────────
    @staticmethod
    def serialize(msg: Message, viewer_role: str, contact_ok: bool) -> dict:
        hidden = msg.contains_contact and not contact_ok and viewer_role != "admin"
        return {
            "id": msg.id,
            "sender_role": msg.sender_role,
            "mine": msg.sender_role == viewer_role,
            "body": mask_contact(msg.body) if hidden else msg.body,
            "contact_hidden": hidden,
            "attachments": msg.attachments or [],
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        }

    @staticmethod
    def messages(db: Session, conv: Conversation, role: str, after_id: int = 0, limit: int = 200) -> dict:
        contact_ok = ChatService.contact_allowed(db, conv)
        rows = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id, Message.id > after_id)
            .order_by(Message.id.asc())
            .limit(limit)
            .all()
        )
        # Mark as read
        if rows and role in ("customer", "vendor"):
            field = Conversation.customer_last_read_id if role == "customer" else Conversation.vendor_last_read_id
            db.query(Conversation).filter(Conversation.id == conv.id, field < rows[-1].id).update(
                {field: rows[-1].id}, synchronize_session=False
            )
            db.commit()
        other_read = conv.vendor_last_read_id if role == "customer" else conv.customer_last_read_id
        return {
            "messages": [ChatService.serialize(m, role, contact_ok) for m in rows],
            "contact_allowed": contact_ok,
            "other_last_read_id": other_read,
        }

    @staticmethod
    def send(db: Session, conv: Conversation, sender: User, role: str, body: str, attachments=None) -> Message:
        body = (body or "").strip()
        attachments = [a for a in (attachments or []) if isinstance(a, dict) and a.get("url")
                       and str(a["url"]).startswith(("https://", "/"))][:6]
        if not body and not attachments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Write a message or add a photo")
        if len(body) > MAX_BODY:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Messages are limited to {MAX_BODY} characters")

        from app.entities.chat.contact_filter import classify
        kind = classify(body)
        has_contact = kind is not None
        if has_contact and not ChatService.contact_allowed(db, conv):
            from app.entities.audit import ContactAttempt
            db.add(ContactAttempt(user_id=sender.id, conversation_id=conv.id, kind=kind, body=body[:2000]))
            db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Phone numbers, emails and social handles can't be sent in chat. Once the vendor reconfirms a booking, you'll both see each other's numbers on the booking itself.")
        ChatService._rate_limit(sender.id)
        msg = Message(conversation_id=conv.id, sender_id=sender.id, sender_role=role, body=body,
                      attachments=attachments or None, contains_contact=has_contact)
        db.add(msg)
        db.flush()
        preview = body[:150] if body else "📷 Photo"
        updates = {Conversation.last_message_at: func.now(), Conversation.last_message_preview: preview}
        updates[Conversation.customer_last_read_id if role == "customer" else Conversation.vendor_last_read_id] = msg.id
        db.query(Conversation).filter(Conversation.id == conv.id).update(updates, synchronize_session=False)
        db.commit()
        db.refresh(msg)
        db.refresh(conv)

        if has_contact and not ChatService.contact_allowed(db, conv):
            logger.info("Contact details shared before booking in conversation %s by %s", conv.id, role)
        ChatService._maybe_email(db, conv, recipient_role="vendor" if role == "customer" else "customer")
        return msg

    @staticmethod
    def system_message(db: Session, customer_id: int, vendor_id: int, text: str) -> None:
        """Booking events shown inside the thread (e.g. "Booking #42 confirmed")."""
        conv = db.query(Conversation).filter(
            Conversation.customer_id == customer_id, Conversation.vendor_id == vendor_id
        ).first()
        if not conv:
            conv = Conversation(customer_id=customer_id, vendor_id=vendor_id)
            db.add(conv)
            db.flush()
        db.add(Message(conversation_id=conv.id, sender_id=None, sender_role="system", body=text))
        conv.last_message_at = datetime.now(timezone.utc)
        conv.last_message_preview = text[:150]
        db.commit()

    _sent: dict = {}

    @staticmethod
    def _rate_limit(user_id: int, limit: int = 20, window: int = 60) -> None:
        """At most `limit` messages per user per minute (stops spam and scripted scraping)."""
        import time
        now = time.time()
        recent = [t for t in ChatService._sent.get(user_id, []) if now - t < window]
        if len(recent) >= limit:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You're sending messages too fast. Wait a moment.")
        recent.append(now)
        ChatService._sent[user_id] = recent

    # ── Email alerts (batched) ───────────────────────────────────────────────
    @staticmethod
    def _maybe_email(db: Session, conv: Conversation, recipient_role: str) -> None:
        now = datetime.now(timezone.utc)
        field = Conversation.customer_notified_at if recipient_role == "customer" else Conversation.vendor_notified_at
        claimed = (
            db.query(Conversation)
            .filter(Conversation.id == conv.id, or_(field.is_(None), field < now - EMAIL_QUIET_PERIOD))
            .update({field: now}, synchronize_session=False)
        )
        db.commit()
        if not claimed:
            return
        try:
            from app.services.email import _fire_and_forget, send_notice_email

            if recipient_role == "customer":
                user, sender_name, path = conv.customer, conv.vendor.business_name, f"/messages/{conv.id}"
            else:
                user = conv.vendor.user
                sender_name = conv.customer.full_name or "A customer"
                path = f"/messages/{conv.id}"
            if not user:
                return
            _fire_and_forget(
                send_notice_email, user.email, user.full_name or user.email,
                f"New message from {sender_name}", "Messages", f"{sender_name} sent you a message",
                ["Reply on Plagohive so your booking, payment and any agreements stay protected."],
                "Read and reply", path,
            )
        except Exception as exc:
            logger.error("Couldn't send message alert for conversation %s: %s", conv.id, exc)
