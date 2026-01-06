from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.review import schema
from app.entities.review.service import ReviewService

router = APIRouter()

@router.post("", response_model=schema.ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: schema.ReviewCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new review (customer only)"""
    if current_user.role.value != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can create reviews"
        )
    
    return ReviewService.create_review(db, review_data, current_user.id)

@router.get("/vendor/{vendor_id}", response_model=list[schema.ReviewResponse])
async def get_vendor_reviews(
    vendor_id: int,
    db: Session = Depends(get_db)
):
    """Get all reviews for a vendor"""
    return ReviewService.get_vendor_reviews(db, vendor_id)

@router.get("/vendor/{vendor_id}/rating", response_model=dict)
async def get_vendor_rating(
    vendor_id: int,
    db: Session = Depends(get_db)
):
    """Get vendor rating statistics"""
    return ReviewService.calculate_vendor_rating(db, vendor_id)

@router.get("", response_model=list[schema.ReviewResponse])
async def get_my_reviews(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's reviews"""
    return ReviewService.get_user_reviews(db, current_user.id, current_user.role.value)

@router.put("/{review_id}", response_model=schema.ReviewResponse)
async def update_review(
    review_id: int,
    review_update: schema.ReviewUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a review"""
    update_data = review_update.model_dump(exclude_unset=True)
    return ReviewService.update_review(db, review_id, update_data, current_user.id)

@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a review"""
    ReviewService.delete_review(db, review_id, current_user.id)
    return None

