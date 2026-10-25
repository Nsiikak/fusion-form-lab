from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class BookingAddon(Base):
    """Something added to a booking after it was paid: priced by the vendor, paid by the customer.
    Each add-on is its own Paystack payment; once paid it is folded into the booking's totals."""
    __tablename__ = "booking_addons"
    __table_args__ = (Index("ix_booking_addons_booking", "booking_id"),)

    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    items = Column(JSON, nullable=False)            # [{name, quantity, unit_price, subtotal}]
    note = Column(Text, nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)          # vendor price added
    platform_fee = Column(Numeric(12, 2), nullable=False)
    customer_total = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="proposed")  # proposed | paid | declined | withdrawn | refunded
    payment_reference = Column(String(64), nullable=True, unique=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    refund_id = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
