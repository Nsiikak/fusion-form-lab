from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from fastapi import HTTPException, status
from app.entities.vendor.model import Vendor, VerificationStatus, VendorCategory
from app.entities.vendor.schema import VendorCreate
from app.entities.user.model import User, UserRole
from app.entities.user.service import UserService
from app.core.security import get_password_hash

class VendorService:
    @staticmethod
    def get_vendor_by_user_id(db: Session, user_id: int) -> Vendor | None:
        """Get vendor by user ID"""
        return db.query(Vendor).filter(Vendor.user_id == user_id).first()
    
    @staticmethod
    def get_vendor_by_id(db: Session, vendor_id: int) -> Vendor | None:
        """Get vendor by ID"""
        return db.query(Vendor).filter(Vendor.id == vendor_id).first()
    
    @staticmethod
    def create_vendor(db: Session, vendor_data: VendorCreate) -> Vendor:
        """Create a new vendor and associated user account"""
        # Check if user already exists
        existing_user = UserService.get_user_by_email(db, vendor_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create user account first
        hashed_password = get_password_hash(vendor_data.password)
        db_user = User(
            email=vendor_data.email,
            hashed_password=hashed_password,
            full_name=vendor_data.contact_name,
            phone_number=vendor_data.phone_number,
            role=UserRole.VENDOR
        )
        db.add(db_user)
        db.flush()  # Flush to get user ID
        
        # Create vendor profile
        db_vendor = Vendor(
            user_id=db_user.id,
            business_name=vendor_data.business_name,
            contact_name=vendor_data.contact_name,
            category=vendor_data.category,
            location=vendor_data.location,
            description=vendor_data.description,
            starting_price=vendor_data.starting_price,
            business_size=vendor_data.business_size,
            registration_number=vendor_data.registration_number,
            verification_status=VerificationStatus.PENDING
        )
        
        db.add(db_vendor)
        db.commit()
        db.refresh(db_vendor)
        
        return db_vendor
    
    @staticmethod
    def update_vendor(db: Session, vendor_id: int, vendor_data: dict, user_id: int) -> Vendor:
        """Update vendor profile (only owner can update)"""
        vendor = VendorService.get_vendor_by_id(db, vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        if vendor.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this vendor"
            )
        
        # Update fields
        for key, value in vendor_data.dict(exclude_unset=True).items():
            setattr(vendor, key, value)
            
        # usage of paystack service to create recipient if bank details change
        if vendor_data.account_number and vendor_data.bank_code:
            try:
                from app.services.paystack import paystack_service
                # Get bank name for recipient creation (optional, but good for data)
                # For now just use business name
                recipient_code = paystack_service.create_transfer_recipient(
                    name=vendor.business_name,
                    account_number=vendor_data.account_number,
                    bank_code=vendor_data.bank_code
                )
                vendor.recipient_code = recipient_code
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to verify bank account: {str(e)}"
                )

        db.commit()
        db.refresh(vendor)
        return vendor
    
    @staticmethod
    def list_vendors(
        db: Session,
        category: Optional[VendorCategory] = None,
        location: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
        only_verified: bool = True
    ) -> tuple[List[Vendor], int]:
        """List vendors with filters and pagination"""
        query = db.query(Vendor).filter(Vendor.is_active == True)
        
        # Only show approved vendors by default
        if only_verified:
            query = query.filter(Vendor.verification_status == VerificationStatus.APPROVED)
        
        # Apply filters
        if category:
            query = query.filter(Vendor.category == category)
        
        if location:
            query = query.filter(Vendor.location.ilike(f"%{location}%"))
        
        if min_price is not None:
            query = query.filter(Vendor.starting_price >= min_price)
        
        if max_price is not None:
            query = query.filter(Vendor.starting_price <= max_price)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Vendor.business_name.ilike(search_term),
                    Vendor.description.ilike(search_term),
                    Vendor.location.ilike(search_term)
                )
            )
        
        # Get total count before pagination
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        vendors = query.order_by(Vendor.created_at.desc()).offset(offset).limit(limit).all()
        
        return vendors, total
    
    @staticmethod
    def get_vendor_with_reviews(db: Session, vendor_id: int) -> Optional[Vendor]:
        """Get vendor by ID with related data"""
        return db.query(Vendor).filter(Vendor.id == vendor_id).first()

