from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.vendor import schema
from app.entities.vendor.service import VendorService

router = APIRouter()

@router.post("/register", response_model=schema.VendorResponse, status_code=status.HTTP_201_CREATED)
async def register_vendor(
    vendor_data: schema.VendorCreate,
    db: Session = Depends(get_db)
):
    """Register a new vendor"""
    return VendorService.create_vendor(db, vendor_data)

@router.get("/me", response_model=schema.VendorResponse)
async def get_my_vendor(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current vendor's profile"""
    if current_user.role.value != "vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can access this endpoint"
        )
    
    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    return vendor

@router.put("/me", response_model=schema.VendorResponse)
async def update_my_vendor(
    vendor_update: schema.VendorUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current vendor's profile"""
    if current_user.role.value != "vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can access this endpoint"
        )
    
    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    # Convert Pydantic model to dict, excluding None values
    update_data = vendor_update.model_dump(exclude_unset=True)
    return VendorService.update_vendor(db, vendor.id, update_data, current_user.id)

