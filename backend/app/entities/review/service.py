from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from fastapi import HTTPException, status
from app.entities.review.model import Review
from app.entities.review.schema import ReviewCreate
from app.entities.booking.model import Booking, BookingStatus

class ReviewService:
    @staticmethod
    def get_review_by_id(db: Session, review_id: int) -> Optional[Review]:
        """Get review by ID"""
        return db.query(Review).filter(Review.id == review_id).first()
    
    @staticmethod
    def get_vendor_reviews(db: Session, vendor_id: int) -> List[Review]:
        """Get all reviews for a vendor"""
        return db.query(Review).filter(Review.vendor_id == vendor_id).order_by(Review.created_at.desc()).all()
    
    @staticmethod
    def get_user_reviews(db: Session, user_id: int, user_role: str) -> List[Review]:
        """Get reviews for a user (customer's reviews or vendor's received reviews)"""
        if user_role == "customer":
            return db.query(Review).filter(Review.customer_id == user_id).order_by(Review.created_at.desc()).all()
        elif user_role == "vendor":
            from app.entities.vendor.service import VendorService
            vendor = VendorService.get_vendor_by_user_id(db, user_id)
            if not vendor:
                return []
            return db.query(Review).filter(Review.vendor_id == vendor.id).order_by(Review.created_at.desc()).all()
        return []
    
    @staticmethod
    def calculate_vendor_rating(db: Session, vendor_id: int) -> dict:
        """Calculate average rating and total reviews for a vendor"""
        result = db.query(
            func.avg(Review.rating).label('average_rating'),
            func.count(Review.id).label('total_reviews')
        ).filter(Review.vendor_id == vendor_id).first()
        
        return {
            "average_rating": float(result.average_rating) if result.average_rating else 0.0,
            "total_reviews": result.total_reviews or 0
        }
    
    @staticmethod
    def create_review(db: Session, review_data: ReviewCreate, customer_id: int) -> Review:
        """Create a new review"""
        # Verify booking exists and belongs to customer (if booking_id provided)
        if review_data.booking_id:
            booking = db.query(Booking).filter(Booking.id == review_data.booking_id).first()
            if not booking:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Booking not found"
                )
            
            if booking.customer_id != customer_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to review this booking"
                )
            
            # Check if review already exists for this booking
            existing_review = db.query(Review).filter(Review.booking_id == review_data.booking_id).first()
            if existing_review:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Review already exists for this booking"
                )
        
        # Verify vendor exists
        from app.entities.vendor.service import VendorService
        vendor = VendorService.get_vendor_by_id(db, review_data.vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        # Create review
        db_review = Review(
            customer_id=customer_id,
            vendor_id=review_data.vendor_id,
            booking_id=review_data.booking_id,
            rating=review_data.rating,
            comment=review_data.comment
        )
        
        db.add(db_review)
        db.commit()
        db.refresh(db_review)
        
        return db_review
    
    @staticmethod
    def update_review(
        db: Session,
        review_id: int,
        review_data: dict,
        user_id: int
    ) -> Review:
        """Update a review (only customer who created it can update)"""
        review = ReviewService.get_review_by_id(db, review_id)
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        if review.customer_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this review"
            )
        
        for field, value in review_data.items():
            if value is not None:
                setattr(review, field, value)
        
        db.commit()
        db.refresh(review)
        return review
    
    @staticmethod
    def delete_review(db: Session, review_id: int, user_id: int) -> bool:
        """Delete a review (only customer who created it can delete)"""
        review = ReviewService.get_review_by_id(db, review_id)
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        if review.customer_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this review"
            )
        
        db.delete(review)
        db.commit()
        return True

