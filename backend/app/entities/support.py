"""Support team records: escalations to admins and internal notes on bookings."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Escalation(Base):
    """Support asks an admin to decide something support can't (refunds, releases, payouts, suspensions)."""
    __tablename__ = "escalations"
    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=True, index=True)
    raised_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    priority = Column(String(10), nullable=False, default="normal")     # normal | urgent
    category = Column(String(30), nullable=False, default="other")      # refund | release | payout | vendor | fraud | other
    note = Column(Text, nullable=False)
    status = Column(String(10), nullable=False, default="open")         # open | resolved
    resolution_note = Column(Text, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class SupportNote(Base):
    """An internal note on a booking (customers and vendors never see these)."""
    __tablename__ = "support_notes"
    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
