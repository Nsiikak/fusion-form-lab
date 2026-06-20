from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Index, Text, Numeric, Time, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    AWAITING_CONFIRMATION = "awaiting_confirmation"  # vendor marked done, waiting for customer
    COMPLETED = "completed"

class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_bookings_customer_id", "customer_id"),
        Index("ix_bookings_vendor_id", "vendor_id"),
        Index("ix_bookings_status", "status"),
        Index("ix_bookings_event_id", "event_id"),
        Index("ix_bookings_event_date", "event_date"),
        Index("ix_bookings_created_at", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    booking_date = Column(DateTime(timezone=True), server_default=func.now())
    event_date = Column(DateTime(timezone=True), nullable=False)
    event_time = Column(Time, nullable=True)
    notes = Column(Text, nullable=True)
    event_address = Column(JSON, nullable=True)   # {venue_name, city, state, delivery_instructions}
    paid_out = Column(Boolean, default=False, nullable=False)
    service_items_snapshot = Column(JSON, nullable=True)
    vendor_confirmed_at = Column(DateTime(timezone=True), nullable=True)  # when vendor marked complete
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id], backref="customer_bookings")
    vendor = relationship("Vendor", backref="bookings")
    event = relationship("Event", backref="bookings")

