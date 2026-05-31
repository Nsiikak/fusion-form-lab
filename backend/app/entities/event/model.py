from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Index, Text, Numeric, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class EventStatus(str, enum.Enum):
    PLANNING = "planning"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_customer_id", "customer_id"),
        Index("ix_events_date", "date"),
        Index("ix_events_status", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    location = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    total_budget = Column(Numeric(10, 2), nullable=True)
    status = Column(Enum(EventStatus), default=EventStatus.PLANNING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    customer = relationship("User", backref="events")

