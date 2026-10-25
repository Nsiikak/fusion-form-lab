"""In-app chat between customers and vendors.

Handlers are plain `def` (FastAPI runs them in a threadpool). Clients poll:
the open thread every few seconds with ?after_id=, the inbox/badge less often.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.chat.service import ChatService
from app.entities.user.model import User
from app.entities.booking.schema import QuoteRequest2 as QuoteBody
from sqlalchemy.orm import Session

router = APIRouter()


class StartRequest(BaseModel):
    vendor_id: int


class SendRequest(BaseModel):
    body: str = Field("", max_length=2000)
    attachments: Optional[list[dict]] = None


@router.get("/conversations")
def list_conversations(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return ChatService.list_for_user(db, current_user)


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role.value == "admin":
        return {"unread": 0}
    return {"unread": ChatService.total_unread(db, current_user)}


@router.post("/conversations")
def start_conversation(body: StartRequest, current_user: User = Depends(get_current_active_user),
                       db: Session = Depends(get_db)):
    conv = ChatService.start(db, current_user, body.vendor_id)
    return ChatService.summary(db, conv, "customer")


@router.get("/conversations/for-booking/{booking_id}")
def conversation_for_booking(booking_id: int, current_user: User = Depends(get_current_active_user),
                             db: Session = Depends(get_db)):
    """Open (or create) the chat for a booking's customer and vendor — used by "Message" buttons."""
    from app.entities.booking.model import Booking
    from app.entities.chat.model import Conversation
    from app.entities.vendor.model import Vendor
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    vendor = db.query(Vendor).filter(Vendor.user_id == current_user.id).first()
    if not booking or not (booking.customer_id == current_user.id or (vendor and booking.vendor_id == vendor.id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    conv = db.query(Conversation).filter(
        Conversation.customer_id == booking.customer_id, Conversation.vendor_id == booking.vendor_id
    ).first()
    if not conv:
        conv = Conversation(customer_id=booking.customer_id, vendor_id=booking.vendor_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return {"id": conv.id}


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, after_id: int = Query(0, ge=0),
                     current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    conv, role = ChatService.get_for_user(db, conversation_id, current_user)
    return {"conversation": ChatService.summary(db, conv, role), **ChatService.messages(db, conv, role, after_id)}


@router.post("/conversations/{conversation_id}/messages")
def send_message(conversation_id: int, body: SendRequest, current_user: User = Depends(get_current_active_user),
                 db: Session = Depends(get_db)):
    conv, role = ChatService.get_for_user(db, conversation_id, current_user)
    msg = ChatService.send(db, conv, current_user, role, body.body, body.attachments)
    return ChatService.serialize(msg, role, ChatService.contact_allowed(db, conv))


@router.post("/conversations/{conversation_id}/photos")
async def upload_photo(conversation_id: int, file: UploadFile = File(...),
                       current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Upload a photo to attach to a message (mood boards, menus, venue shots)."""
    await run_in_threadpool(ChatService.get_for_user, db, conversation_id, current_user)
    from app.services.upload import upload_image
    url = await upload_image(file, folder="chat-photos")
    return {"url": url, "type": "image"}


@router.post("/conversations/{conversation_id}/quote", status_code=201)
def send_quote(conversation_id: int, body: "QuoteBody", current_user: User = Depends(get_current_active_user),
               db: Session = Depends(get_db)):
    """Vendor sends a priced quote; it appears in the chat with Accept & pay for the customer."""
    from app.entities.booking.quotes import create_quote
    conv, role = ChatService.get_for_user(db, conversation_id, current_user)
    if role != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only vendors can send quotes")
    booking = create_quote(db, conv, current_user, body)
    from app.entities.chat.model import Message
    from sqlalchemy.sql import func as _f
    msg = Message(conversation_id=conv.id, sender_id=current_user.id, sender_role="vendor",
                  body=f"Quote for booking #{booking.id}: \u20a6{booking.customer_total:,.2f}",
                  attachments=[{"type": "quote", "booking_id": booking.id}])
    db.add(msg)
    conv.last_message_at, conv.last_message_preview = _f.now(), f"Quote: \u20a6{booking.customer_total:,.2f}"
    db.commit()
    db.refresh(msg)
    ChatService._maybe_email(db, conv, recipient_role="customer")
    return {"booking_id": booking.id, "message_id": msg.id}
