from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.entities.vendor.model import Vendor, VerificationStatus
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
        for field, value in vendor_data.items():
            if value is not None:
                setattr(vendor, field, value)
        
        db.commit()
        db.refresh(vendor)
        return vendor

