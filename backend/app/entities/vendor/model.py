from app.core.crypto import EncryptedString
from sqlalchemy import Date, UniqueConstraint, Float, Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Index, Text, Numeric, JSON
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class VendorCategory(str, enum.Enum):
    CATERING = "catering"
    DECORATION = "decoration"
    PHOTOGRAPHY = "photography"
    ENTERTAINMENT = "entertainment"
    LOGISTICS = "logistics"
    VENUE = "venue"
    CAKES = "cakes"                      # cakes and pastries
    DRINKS = "drinks"                    # drinks, bar and cocktails
    BEAUTY = "beauty"                    # make-up, gele and hair
    FASHION = "fashion"                  # tailoring and aso-ebi
    PLANNING = "planning"                # planners and coordinators
    RENTALS = "rentals"                  # chairs, tables, canopies
    SOUND_LIGHTING = "sound_lighting"    # sound, lighting and screens
    SOUVENIRS = "souvenirs"              # souvenirs, printing, IV cards
    USHERS_SECURITY = "ushers_security"  # ushers, hostesses and security

class BusinessSize(str, enum.Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"

class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class Vendor(Base):
    __tablename__ = "vendors"
    __table_args__ = (
        Index("ix_vendors_user_id", "user_id"),
        Index("ix_vendors_category", "category"),
        Index("ix_vendors_verification_status", "verification_status"),
        Index("ix_vendors_is_active", "is_active"),
        Index(
            "ix_vendors_business_name_gin",
            text("to_tsvector('english', business_name)"),
            postgresql_using="gin",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    business_name = Column(String, nullable=False)
    contact_name = Column(String, nullable=False)
    category = Column(Enum(VendorCategory), nullable=False)
    location = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    starting_price = Column(Numeric(10, 2), nullable=False)
    logistics_fee = Column(Numeric(10, 2), nullable=True)            # fixed delivery charge
    cancellation_policy = Column(String(20), nullable=False, default="standard", server_default="standard")
    # Delivery: one flat fee (logistics_fee) anywhere in base_state; interstate optional
    base_state = Column(String(40), nullable=True)
    interstate_mode = Column(String(10), nullable=False, default="none", server_default="none")  # none | flat | per_state
    interstate_fee = Column(Numeric(10, 2), nullable=True)
    state_fees = Column(JSON, nullable=True)          # {"Ogun": 25000, "FCT": 150000}
    # Mobilisation advance released at reconfirmation: none | logistics | logistics_plus (+ advance_percent of items)
    advance_mode = Column(String(20), nullable=False, default="none", server_default="none")
    advance_percent = Column(Integer, nullable=False, default=0, server_default="0")
    # Search ranking and responsiveness (recomputed by the background job)
    quality_score = Column(Float, nullable=False, default=0, server_default="0")
    response_hours = Column(Float, nullable=True)        # median hours from payment to acceptance
    daily_capacity = Column(Integer, nullable=True)      # max bookings per day; None = no limit
    business_size = Column(Enum(BusinessSize), nullable=False)
    registration_number = Column(String, nullable=True)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False)
    verification_note = Column(Text, nullable=True)     # admin's reason, shown to the vendor
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # NULL = automatic (CAC match)
    is_active = Column(Boolean, default=True)
    
    # Banking Details
    bank_code = Column(String, nullable=True)
    account_number = Column(EncryptedString, nullable=True)   # encrypted at rest
    recipient_code = Column(String, nullable=True)

    # Images
    profile_image_url = Column(String, nullable=True)
    gallery_images = Column(JSON, nullable=True)  # list of URLs

    # CAC Verification
    cac_id = Column(String, nullable=True)
    cac_verified_name = Column(String, nullable=True)
    cac_verification_attempted = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", foreign_keys=[user_id], backref="vendor")



class VendorBlockedDate(Base):
    """A day the vendor isn't available (booked elsewhere, travelling, holiday)."""
    __tablename__ = "vendor_blocked_dates"
    __table_args__ = (UniqueConstraint("vendor_id", "day", name="uq_vendor_blocked_day"),)
    id = Column(Integer, primary_key=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    day = Column(Date, nullable=False)


class Favorite(Base):
    """A customer's saved vendor."""
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "vendor_id", name="uq_favorite"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
