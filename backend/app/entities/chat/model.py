from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Conversation(Base):
    """One thread per customer–vendor pair. Bookings between them show up inside it."""
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("customer_id", "vendor_id", name="uq_conversation_pair"),
        Index("ix_conversations_customer", "customer_id", "last_message_at"),
        Index("ix_conversations_vendor", "vendor_id", "last_message_at"),
    )

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    last_message_preview = Column(String(160), nullable=True)

    customer_last_read_id = Column(Integer, nullable=False, default=0, server_default="0")
    vendor_last_read_id = Column(Integer, nullable=False, default=0, server_default="0")
    # When we last emailed each side about unread messages (keeps alerts to one per burst)
    customer_notified_at = Column(DateTime(timezone=True), nullable=True)
    vendor_notified_at = Column(DateTime(timezone=True), nullable=True)

    customer = relationship("User", foreign_keys=[customer_id])
    vendor = relationship("Vendor", foreign_keys=[vendor_id])


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation_id", "conversation_id", "id"),)

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)   # NULL = system message
    sender_role = Column(String(10), nullable=False)                    # customer | vendor | system
    body = Column(Text, nullable=False, default="")                     # always stored as written (admins see this)
    attachments = Column(JSON, nullable=True)                           # [{"url": ..., "type": "image"}]
    contains_contact = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
