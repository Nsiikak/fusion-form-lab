from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Index, Text, Numeric, Time, JSON, Sequence
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

# Gap-free-enough sequential numbers for financial documents (one per document type).
RECEIPT_SEQ = Sequence("receipt_number_seq", metadata=Base.metadata)
PAYOUT_STATEMENT_SEQ = Sequence("payout_statement_seq", metadata=Base.metadata)


class BookingStatus(str, enum.Enum):
    AWAITING_PAYMENT = "awaiting_payment"  # checkout started, Paystack payment not yet confirmed
    PENDING = "pending"                    # paid, waiting for vendor to accept
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    AWAITING_CONFIRMATION = "awaiting_confirmation"  # vendor marked done, waiting for customer
    DISPUTED = "disputed"                  # customer reported a problem — escrow frozen for admin
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
        Index("ix_bookings_payment_reference", "payment_reference", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)  # vendor_total: what the vendor charges, before commission
    booking_date = Column(DateTime(timezone=True), server_default=func.now())
    event_date = Column(DateTime(timezone=True), nullable=False)
    event_time = Column(Time, nullable=True)
    notes = Column(Text, nullable=True)
    event_address = Column(JSON, nullable=True)   # {venue_name, city, state, delivery_instructions}
    paid_out = Column(Boolean, default=False, nullable=False)  # atomic claim flag — set once a payout is initiated

    # ── Payment (customer side) ──
    platform_fee = Column(Numeric(12, 2), nullable=True)      # 2.5% customer fee
    customer_total = Column(Numeric(12, 2), nullable=True)    # amount charged via Paystack
    payment_reference = Column(String(100), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    refund_status = Column(String(20), nullable=False, default="none", server_default="none")
    # none | pending_review | processing | needs_details | refunded | failed | declined
    refund_id = Column(String(50), nullable=True)            # Paystack refund id (for retries)
    refunded_at = Column(DateTime(timezone=True), nullable=True)

    # ── Documents ──
    receipt_number = Column(String(30), nullable=True, unique=True)           # issued when payment is confirmed
    payout_statement_number = Column(String(30), nullable=True, unique=True)  # issued when the payout lands
    payout_paid_at = Column(DateTime(timezone=True), nullable=True)

    # ── Cancellation & trust ──
    policy_snapshot = Column(JSON, nullable=True)                 # vendor's policy at the time of booking
    cancelled_by = Column(String(10), nullable=True)              # customer | vendor | admin | system
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    refund_amount = Column(Numeric(12, 2), nullable=True)         # what actually went back to the customer
    penalty_deducted = Column(Numeric(12, 2), nullable=True)      # vendor fees recovered from this payout
    reconfirmed_at = Column(DateTime(timezone=True), nullable=True)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    reminders = Column(JSON, nullable=True)                       # {"t7": iso, "t2": iso, "day": iso, ...}
    dispute_kind = Column(String(20), nullable=True)              # general | no_show
    response_due_at = Column(DateTime(timezone=True), nullable=True)
    vendor_responded_at = Column(DateTime(timezone=True), nullable=True)

    # ── Mobilisation advance (released at reconfirmation; deducted from the final payout) ──
    advance_amount = Column(Numeric(12, 2), nullable=True)
    advance_status = Column(String(20), nullable=True)      # None | paid | failed
    advance_paid_at = Column(DateTime(timezone=True), nullable=True)
    advance_error = Column(Text, nullable=True)

    # A quote the vendor sent from chat: waits for the customer until this time, then expires
    quote_expires_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)     # vendor accepted (for response times)
    logistics_fee = Column(Numeric(12, 2), nullable=True)            # logistics actually charged on this booking

    # ── Payout (vendor side — never exposed to customers) ──
    commission_amount = Column(Numeric(12, 2), nullable=True)
    payout_amount = Column(Numeric(12, 2), nullable=True)
    payout_status = Column(String(20), nullable=False, default="not_due", server_default="not_due")
    # not_due | processing | paid | failed
    payout_reference = Column(String(100), nullable=True)
    payout_error = Column(Text, nullable=True)

    # ── Disputes & admin decisions ──
    dispute_reason = Column(Text, nullable=True)
    disputed_at = Column(DateTime(timezone=True), nullable=True)
    resolution = Column(String(20), nullable=True)        # refund | release
    resolution_note = Column(Text, nullable=True)         # shown to both parties
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    service_items_snapshot = Column(JSON, nullable=True)
    vendor_confirmed_at = Column(DateTime(timezone=True), nullable=True)  # when vendor marked complete
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id], backref="customer_bookings")
    vendor = relationship("Vendor", backref="bookings")
    event = relationship("Event", backref="bookings")

