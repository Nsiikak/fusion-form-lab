from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class VendorIncident(Base):
    """A vendor letting a customer down: late cancellation or no-show.
    Doubles as the ledger for late-cancellation fees still owed (recovered from future payouts)."""
    __tablename__ = "vendor_incidents"
    __table_args__ = (Index("ix_vendor_incidents_vendor", "vendor_id", "created_at"),)

    id = Column(Integer, primary_key=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    kind = Column(String(20), nullable=False)          # cancellation | no_show
    severity = Column(String(10), nullable=False)      # logged | strike | severe
    reason = Column(Text, nullable=True)
    fee = Column(Numeric(12, 2), nullable=False, default=0)
    fee_remaining = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
