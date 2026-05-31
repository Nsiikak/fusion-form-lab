from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal

UNIT_LABELS = ["each", "per hour", "per head", "per plate", "per table", "per day", "flat rate"]


class ServiceItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    unit_price: Decimal = Field(..., gt=0)
    unit_label: str = Field(default="each")
    is_active: bool = True


class ServiceItemCreate(ServiceItemBase):
    pass


class ServiceItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, gt=0)
    unit_label: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceItemResponse(ServiceItemBase):
    id: int
    vendor_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
