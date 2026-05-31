from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("booking_id", name="uq_reviews_booking_id"),
        Index("ix_reviews_vendor_id", "vendor_id"),
        Index("ix_reviews_customer_id", "customer_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)  # required
    rating = Column(Integer, nullable=False)  # 1-5, validated at API layer
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id], backref="reviews")
    vendor = relationship("Vendor", backref="reviews")
    booking = relationship("Booking", backref="reviews")

    @property
    def customer_name(self) -> str | None:
        return self.customer.full_name if self.customer else None

