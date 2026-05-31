from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ReviewBase(BaseModel):
    vendor_id: int
    booking_id: int  # required — must link to a completed booking you own
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=2000)

class ReviewCreate(ReviewBase):
    pass

class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)

class ReviewResponse(ReviewBase):
    id: int
    customer_id: int
    customer_name: Optional[str] = None  # populated via Review.customer relationship
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

