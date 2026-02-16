from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.entities.vendor.model import VendorCategory, BusinessSize, VerificationStatus

class VendorBase(BaseModel):
    business_name: str
    contact_name: str
    category: VendorCategory
    location: str
    description: Optional[str] = None
    starting_price: Decimal
    business_size: BusinessSize
    registration_number: Optional[str] = None

class VendorCreate(VendorBase):
    email: EmailStr
    password: str
    phone_number: Optional[str] = None

class VendorUpdate(BaseModel):
    business_name: Optional[str] = None
    contact_name: Optional[str] = None
    category: Optional[VendorCategory] = None
    location: Optional[str] = None
    description: Optional[str] = None
    starting_price: Optional[Decimal] = None
    business_size: Optional[BusinessSize] = None
    registration_number: Optional[str] = None
    # Bank details for update
    bank_code: Optional[str] = None
    account_number: Optional[str] = None
    
class VendorResponse(VendorBase):
    id: int
    user_id: int
    verification_status: VerificationStatus
    is_active: bool
    # Bank details
    bank_code: Optional[str] = None
    account_number: Optional[str] = None
    # We do not expose recipient_code
    
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class VendorListResponse(BaseModel):
    vendors: list[VendorResponse]
    total: int
    page: int
    limit: int
    total_pages: int

