from app.core.crypto import EncryptedString
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    VENDOR = "vendor"
    ADMIN = "admin"
    SUPPORT = "support"       # support team: can look up, assist and escalate; no money decisions

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Optional refund account (customers). Only used when Paystack can't send a refund back
    # to the original payment method ("needs-attention" refunds).
    refund_bank_code = Column(String(20), nullable=True)
    refund_bank_name = Column(String(100), nullable=True)
    refund_account_number = Column(EncryptedString, nullable=True)   # encrypted at rest
    refund_account_name = Column(String(200), nullable=True)
    refund_account_updated_at = Column(DateTime(timezone=True), nullable=True)
    # Bumped on password reset / "sign out everywhere": every older token stops working
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    # Account deletion: requested -> 30-day grace period (signing in cancels it) -> personal data
    # anonymised by the daily retention job. The row itself stays so bookings/payments keep their history.
    deletion_requested_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

