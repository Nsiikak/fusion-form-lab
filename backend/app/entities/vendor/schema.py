import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.entities.vendor.model import VendorCategory, BusinessSize, VerificationStatus


class VendorBase(BaseModel):
    business_name: str = Field(..., max_length=200)
    contact_name: str = Field(..., max_length=200)
    category: VendorCategory
    location: str = Field(..., max_length=300)
    description: Optional[str] = Field(None, max_length=5000)
    starting_price: Decimal
    service_fee_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    logistics_fee: Optional[Decimal] = Field(None, ge=0)
    business_size: BusinessSize
    registration_number: Optional[str] = Field(None, max_length=50)


class VendorCreate(VendorBase):
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone_number: Optional[str] = Field(None, max_length=20)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        errors = []
        if not re.search(r"[A-Za-z]", v):
            errors.append("at least one letter")
        if not re.search(r"[0-9]", v):
            errors.append("at least one number")
        if not re.search(r"[^A-Za-z0-9]", v):
            errors.append("at least one special character")
        if errors:
            raise ValueError("Password must contain " + ", ".join(errors))
        return v


class VendorUpdate(BaseModel):
    business_name: Optional[str] = Field(None, max_length=200)
    contact_name: Optional[str] = Field(None, max_length=200)
    category: Optional[VendorCategory] = None
    location: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = Field(None, max_length=5000)
    starting_price: Optional[Decimal] = None
    service_fee_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    logistics_fee: Optional[Decimal] = Field(None, ge=0)
    business_size: Optional[BusinessSize] = None
    registration_number: Optional[str] = Field(None, max_length=50)
    bank_code: Optional[str] = Field(None, max_length=10)
    account_number: Optional[str] = Field(None, max_length=10)


# ── Public response — safe for unauthenticated access ─────────────────────────
# No financial data (account_number, bank_code) exposed here.
class VendorPublicResponse(VendorBase):
    id: int
    user_id: int
    verification_status: VerificationStatus
    is_active: bool
    profile_image_url: Optional[str] = None
    gallery_images: Optional[list[str]] = None
    average_rating: Optional[float] = None
    # CAC verification (read-only metadata, no sensitive financial data)
    cac_verified_name: Optional[str] = None
    cac_verification_attempted: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Private response — only returned to the authenticated vendor owner ─────────
class VendorResponse(VendorPublicResponse):
    """Full vendor profile including financial details. Never return this to unauthenticated callers."""
    bank_code: Optional[str] = None
    account_number: Optional[str] = None
    cac_id: Optional[str] = None


# ── List response — uses public schema ────────────────────────────────────────
class VendorListResponse(BaseModel):
    vendors: list[VendorPublicResponse]
    total: int
    page: int
    limit: int
    total_pages: int
