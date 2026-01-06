from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from math import ceil
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.vendor import schema
from app.entities.vendor.model import VendorCategory, Vendor, VerificationStatus
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

@router.get("", response_model=schema.VendorListResponse)
async def list_vendors(
    category: Optional[VendorCategory] = Query(None, description="Filter by category"),
    location: Optional[str] = Query(None, description="Filter by location"),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    search: Optional[str] = Query(None, description="Search term"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """List vendors with filters and pagination"""
    vendors, total = VendorService.list_vendors(
        db=db,
        category=category,
        location=location,
        min_price=min_price,
        max_price=max_price,
        search=search,
        page=page,
        limit=limit
    )
    
    total_pages = ceil(total / limit) if total > 0 else 0
    
    return {
        "vendors": vendors,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.get("/{vendor_id}", response_model=schema.VendorResponse)
async def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db)
):
    """Get vendor details by ID"""
    vendor = VendorService.get_vendor_with_reviews(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    if not vendor.is_active or vendor.verification_status.value != "approved":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    return vendor

@router.get("/recommended", response_model=list[schema.VendorResponse])
async def get_recommended_vendors(
    limit: int = Query(6, ge=1, le=20, description="Number of recommendations"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get recommended vendors for the current user"""
    if current_user.role.value != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can access recommended vendors"
        )
    
    # Get user's booking history to determine preferences
    from app.entities.booking.model import Booking
    user_bookings = db.query(Booking).filter(Booking.customer_id == current_user.id).all()
    
    # Get categories from user's bookings
    booked_vendor_ids = [b.vendor_id for b in user_bookings]
    booked_categories = set()
    if booked_vendor_ids:
        booked_vendors = db.query(Vendor).filter(Vendor.id.in_(booked_vendor_ids)).all()
        booked_categories = {v.category.value for v in booked_vendors}
    
    # Get user's location if available (from bookings or profile)
    user_location = None
    if user_bookings:
        # Try to get location from most recent booking's vendor
        latest_booking = sorted(user_bookings, key=lambda b: b.created_at, reverse=True)[0]
        vendor = VendorService.get_vendor_by_id(db, latest_booking.vendor_id)
        if vendor:
            user_location = vendor.location
    
    # Get recommended vendors
    # Priority: Same category as booked vendors, same location, then verified vendors
    query = db.query(Vendor).filter(
        Vendor.is_active == True,
        Vendor.verification_status == VerificationStatus.APPROVED
    )
    
    # Exclude already booked vendors
    if booked_vendor_ids:
        query = query.filter(~Vendor.id.in_(booked_vendor_ids))
    
    # Order by: category match, location match, then by rating (if reviews exist)
    vendors = query.order_by(Vendor.created_at.desc()).limit(limit * 2).all()
    
    # Sort by relevance
    def relevance_score(vendor):
        score = 0
        if booked_categories and vendor.category.value in booked_categories:
            score += 10
        if user_location and user_location.lower() in vendor.location.lower():
            score += 5
        return score
    
    vendors_sorted = sorted(vendors, key=relevance_score, reverse=True)
    
    return vendors_sorted[:limit]

