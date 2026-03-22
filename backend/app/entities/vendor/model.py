from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text, Numeric
from sqlalchemy.sql import func
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

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    business_name = Column(String, nullable=False)
    contact_name = Column(String, nullable=False)
    category = Column(Enum(VendorCategory), nullable=False)
    location = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    starting_price = Column(Numeric(10, 2), nullable=False)
    business_size = Column(Enum(BusinessSize), nullable=False)
    registration_number = Column(String, nullable=True)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Banking Details
    bank_code = Column(String, nullable=True)
    account_number = Column(String, nullable=True)
    recipient_code = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", backref="vendor")

