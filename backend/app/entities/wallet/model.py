"""Vendor wallet: earnings are credited here and the vendor withdraws them to their bank on request.

The wallet is a ledger. A vendor's balance is the sum of their entries, so it can always be
recomputed and audited:
  earning              +  vendor's share of a settled booking
  advance              +  mobilisation advance released before the event
  withdrawal           −  money sent (or being sent) to the vendor's bank
  withdrawal_reversal  +  a withdrawal that failed or was reversed — the money is back
"""
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class WalletEntry(Base):
    __tablename__ = "wallet_entries"
    __table_args__ = (
        # One credit per booking and kind, one debit/reversal per withdrawal — retries can't double-count
        Index("uq_wallet_booking_kind", "booking_id", "kind", unique=True, postgresql_where="booking_id IS NOT NULL"),
        Index("uq_wallet_withdrawal_kind", "withdrawal_id", "kind", unique=True, postgresql_where="withdrawal_id IS NOT NULL"),
    )

    id = Column(Integer, primary_key=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)   # signed: + credit, − debit
    kind = Column(String(24), nullable=False)          # earning | advance | withdrawal | withdrawal_reversal
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    withdrawal_id = Column(Integer, ForeignKey("withdrawals.id"), nullable=True)
    note = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class Withdrawal(Base):
    """A vendor's request to move wallet money to their bank (one Paystack transfer)."""
    __tablename__ = "withdrawals"

    id = Column(Integer, primary_key=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    # awaiting_approval → processing → paid   (or → awaiting_otp → paid)   |   → failed (money back in wallet)
    status = Column(String(20), nullable=False, index=True)
    reference = Column(String(100), nullable=False, unique=True)   # Paystack transfer reference
    recipient_code = Column(String(100), nullable=True)            # bank account it was sent to
    transfer_code = Column(String(100), nullable=True)
    error = Column(Text, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
