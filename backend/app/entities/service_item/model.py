from sqlalchemy import JSON, Column, Integer, String, Boolean, DateTime, ForeignKey, Index, Text, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ServiceItem(Base):
    __tablename__ = "service_items"
    __table_args__ = (
        Index("ix_service_items_vendor_id", "vendor_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    unit_price = Column(Numeric(12, 2), nullable=False)
    unit_label = Column(String(50), nullable=False, default="each")
    is_active = Column(Boolean, default=True, nullable=False)
    # unit: price per unit with a quantity (plates, hours, trays) · package: one bundle with what's included
    # quote: no fixed price — the customer asks and the vendor sends a priced add-on or quote
    pricing_type = Column(String(10), nullable=False, default="unit", server_default="unit")
    min_quantity = Column(Integer, nullable=False, default=1, server_default="1")
    max_quantity = Column(Integer, nullable=True)
    included = Column(JSON, nullable=True)            # ["Setup and clean-up", "2 servers", ...]
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    vendor = relationship("Vendor", backref="service_items")
