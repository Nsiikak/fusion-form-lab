from pydantic import BaseModel, Field, model_validator
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

UNIT_LABELS = ["each", "per hour", "per head", "per plate", "per table", "per day", "flat rate"]


class ServiceItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1500)
    unit_price: Decimal = Field(Decimal("0"), ge=0)
    unit_label: str = Field(default="each")
    is_active: bool = True
    pricing_type: str = Field("unit", pattern="^(unit|package|quote)$")
    min_quantity: int = Field(1, ge=1, le=10000)
    max_quantity: Optional[int] = Field(None, ge=1, le=10000)
    included: Optional[List[str]] = Field(None, max_length=20)

    @model_validator(mode="after")
    def price_rules(self):
        if self.pricing_type in ("unit", "package") and self.unit_price <= 0:
            raise ValueError("Set a price, or choose 'Price on request'")
        if self.max_quantity and self.max_quantity < self.min_quantity:
            raise ValueError("Maximum quantity can't be less than the minimum")
        return self


class ServiceItemCreate(ServiceItemBase):
    pass


class ServiceItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, ge=0)
    unit_label: Optional[str] = None
    is_active: Optional[bool] = None
    pricing_type: Optional[str] = Field(None, pattern="^(unit|package|quote)$")
    min_quantity: Optional[int] = Field(None, ge=1, le=10000)
    max_quantity: Optional[int] = Field(None, ge=1, le=10000)
    included: Optional[List[str]] = Field(None, max_length=20)


class ServiceItemResponse(ServiceItemBase):
    id: int
    vendor_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
