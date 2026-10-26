from pydantic import BaseModel, Field
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from math import ceil
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.vendor import schema
from app.entities.vendor.schema import VendorResponse, VendorPublicResponse
from app.entities.vendor.model import VendorCategory, Vendor, VerificationStatus
from app.entities.vendor.service import VendorService
from app.services.email import _fire_and_forget, send_vendor_welcome_email, send_cac_verification_email
from app.services.upload import upload_image, delete_image

router = APIRouter()

@router.post("/register", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def register_vendor(
    vendor_data: schema.VendorCreate,
    db: Session = Depends(get_db)
):
    """Register a new vendor"""
    vendor = VendorService.create_vendor(db, vendor_data)
    owner = db.query(User).filter(User.id == vendor.user_id).first()
    if owner:
        _fire_and_forget(
            send_vendor_welcome_email,
            owner.email, owner.full_name or owner.email, vendor.business_name
        )
        # Always send CAC verification outcome so vendor knows their status
        if vendor_data.registration_number:
            _fire_and_forget(
                send_cac_verification_email,
                owner.email,
                owner.full_name or owner.email,
                vendor.business_name,
                vendor.verification_status.value == "approved",
                vendor.cac_verified_name,
            )
    return vendor


@router.get("/me", response_model=VendorResponse)
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

@router.put("/me", response_model=VendorResponse)
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
    if vendor_update.advance_mode and vendor_update.advance_mode != "none":
        from app.services.pricing import advance_eligible
        me = VendorService.get_vendor_by_user_id(db, current_user.id)
        if me and not advance_eligible(db, me, vendor_update.advance_mode):
            need = ("5 completed bookings and an account at least 60 days old" if vendor_update.advance_mode == "logistics_plus"
                    else "3 completed bookings")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"This advance option unlocks after {need}, with no strikes in the last 90 days.")
    
    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    # Convert Pydantic model to dict, excluding None values
    update_data = vendor_update.model_dump(exclude_unset=True)
    return VendorService.update_vendor(db, vendor.id, update_data, current_user.id)

@router.post("/me/re-verify")
async def re_verify_vendor(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Re-run CAC verification for the current vendor's RC number."""
    if current_user.role.value != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only vendors can access this endpoint")

    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")

    vendor_obj, cac_result = VendorService.re_verify_vendor(db, vendor.id, current_user.id)

    # Notify vendor of verification outcome via email
    _fire_and_forget(
        send_cac_verification_email,
        current_user.email,
        current_user.full_name or current_user.email,
        vendor_obj.business_name,
        cac_result.get("verified", False),
        cac_result.get("cac_verified_name"),
    )

    return {
        "vendor": schema.VendorResponse.model_validate(vendor_obj),
        "cac": {
            "found": cac_result.get("found"),
            "verified": cac_result.get("verified"),
            "cac_verified_name": cac_result.get("cac_verified_name"),
            "similarity": cac_result.get("similarity"),
            "reason": cac_result.get("reason"),
        }
    }


@router.get("/me/resolve-account")
async def resolve_account_number(
    account_number: str = Query(..., min_length=10, max_length=10),
    bank_code: str = Query(...),
    current_user: User = Depends(get_current_active_user),
):
    """Resolve a bank account number to the account holder name via Paystack/NIBSS."""
    if current_user.role.value != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only vendors can access this endpoint")
    from app.services.paystack import paystack_service
    try:
        result = paystack_service.resolve_account_number(account_number, bank_code)
        if not result or not result.get("status"):
            ps_msg = (result or {}).get("paystack_message", "")
            detail = ps_msg if ps_msg else "Could not resolve account. Check the account number and bank."
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
        return {
            "account_name": result["data"]["account_name"],
            "account_number": result["data"]["account_number"],
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not verify account details. Please check your bank and account number.",
        )


@router.post("/me/images", response_model=dict)  # returns {"url": ..., "vendor": VendorResponse}
async def upload_vendor_image(
    image_type: str = Query("profile", description="'profile' or 'gallery'"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload a profile image or add a photo to the gallery."""
    if current_user.role.value != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only vendors can access this endpoint")
    if image_type not in ("profile", "gallery"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image_type must be 'profile' or 'gallery'")

    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")

    url = await upload_image(file, folder="vendor-images")

    if image_type == "profile":
        vendor.profile_image_url = url
    else:
        gallery = list(vendor.gallery_images or [])
        gallery.append(url)
        vendor.gallery_images = gallery

    db.commit()
    db.refresh(vendor)
    return {"url": url, "vendor": schema.VendorResponse.model_validate(vendor)}


@router.delete("/me/images", response_model=VendorResponse)
async def remove_vendor_gallery_image(
    url: str = Query(..., description="URL of the gallery image to remove"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a photo from the vendor's gallery."""
    if current_user.role.value != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only vendors can access this endpoint")

    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")

    gallery = list(vendor.gallery_images or [])
    if url not in gallery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found in gallery")

    await delete_image(url)
    vendor.gallery_images = [u for u in gallery if u != url]
    db.commit()
    db.refresh(vendor)
    return vendor


@router.get("", response_model=schema.VendorListResponse)  # uses VendorPublicResponse inside
async def list_vendors(
    category: Optional[VendorCategory] = Query(None, description="Filter by category"),
    location: Optional[str] = Query(None, description="Filter by location"),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    search: Optional[str] = Query(None, description="Search term"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    available_on: Optional[date] = Query(None, description="Only vendors free on this date"),
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
    , available_on=available_on)
    
    total_pages = ceil(total / limit) if total > 0 else 0
    
    return {
        "vendors": vendors,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@router.get("/recommended", response_model=list[VendorPublicResponse])
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
    
    from app.entities.booking.model import Booking
    from app.entities.review.model import Review
    from sqlalchemy import func

    user_bookings = db.query(Booking).filter(Booking.customer_id == current_user.id).all()

    booked_vendor_ids = [b.vendor_id for b in user_bookings]
    booked_categories: set = set()
    user_location = None

    if booked_vendor_ids:
        booked_vendors = db.query(Vendor).filter(Vendor.id.in_(booked_vendor_ids)).all()
        booked_categories = {v.category.value for v in booked_vendors}
        latest_booking = sorted(user_bookings, key=lambda b: b.created_at, reverse=True)[0]
        latest_vendor = VendorService.get_vendor_by_id(db, latest_booking.vendor_id)
        if latest_vendor:
            user_location = latest_vendor.location

    # Average rating subquery so we can order by it
    avg_rating_sq = (
        db.query(
            Review.vendor_id,
            func.coalesce(func.avg(Review.rating), 0).label("avg_rating"),
        )
        .group_by(Review.vendor_id)
        .subquery()
    )

    base_query = (
        db.query(Vendor)
        .outerjoin(avg_rating_sq, Vendor.id == avg_rating_sq.c.vendor_id)
        .filter(
            Vendor.is_active == True,  # noqa: E712
            Vendor.verification_status == VerificationStatus.APPROVED,
        )
    )

    if not booked_vendor_ids:
        # No history — show highest-rated vendors; fall back to newest if unrated
        vendors = (
            base_query
            .order_by(avg_rating_sq.c.avg_rating.desc().nullslast(), Vendor.created_at.desc())
            .limit(limit)
            .all()
        )
        return vendors

    # Has history — score by category + location match, use rating as tiebreaker
    vendors = (
        base_query
        .order_by(avg_rating_sq.c.avg_rating.desc().nullslast(), Vendor.created_at.desc())
        .limit(limit * 3)
        .all()
    )

    def relevance_score(v: Vendor) -> int:
        score = 0
        if v.category.value in booked_categories:
            score += 10
        if user_location and user_location.lower() in v.location.lower():
            score += 5
        return score

    return sorted(vendors, key=relevance_score, reverse=True)[:limit]

@router.get("/me/advance-eligibility")
def my_advance_eligibility(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """What the vendor has unlocked, and progress towards the rest (shown in profile settings)."""
    from datetime import datetime, timedelta, timezone
    from app.entities.booking.model import Booking, BookingStatus
    from app.entities.vendor.incident import VendorIncident
    from app.services.pricing import advance_eligible
    v = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    now = datetime.now(timezone.utc)
    created = v.created_at if v.created_at and v.created_at.tzinfo else (v.created_at or now).replace(tzinfo=timezone.utc)
    return {
        "completed": db.query(Booking.id).filter(Booking.vendor_id == v.id, Booking.status == BookingStatus.COMPLETED).count(),
        "account_days": (now - created).days,
        "strikes_90d": db.query(VendorIncident.id).filter(VendorIncident.vendor_id == v.id, VendorIncident.severity.in_(["strike", "severe"]),
                                                          VendorIncident.created_at >= now - timedelta(days=90)).count(),
        "logistics": advance_eligible(db, v, "logistics"),
        "logistics_plus": advance_eligible(db, v, "logistics_plus"),
        "requirements": {"logistics": {"completed": 3}, "logistics_plus": {"completed": 5, "account_days": 60}},
    }


class WithdrawRequest(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0)   # omit to withdraw the whole balance


def _my_vendor(db: Session, user: User):
    v = VendorService.get_vendor_by_user_id(db, user.id)
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    return v


@router.get("/me/wallet")
def my_wallet(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Wallet balance, recent credits/debits and withdrawals."""
    from app.entities.wallet import service as wallet
    return wallet.summary(db, _my_vendor(db, current_user))


@router.post("/me/withdrawals", status_code=status.HTTP_201_CREATED)
def request_withdrawal(body: WithdrawRequest, current_user: User = Depends(get_current_active_user),
                       db: Session = Depends(get_db)):
    """Withdraw wallet money to the vendor's saved bank account (one Paystack transfer)."""
    from app.entities.wallet import service as wallet
    v = _my_vendor(db, current_user)
    w = wallet.request_withdrawal(db, v, body.amount)
    return {"withdrawal": wallet.withdrawal_view(w), "wallet": wallet.summary(db, v)}


class AvailabilityUpdate(BaseModel):
    blocked_dates: list[date] = []
    daily_capacity: Optional[int] = None


@router.get("/me/availability")
def my_availability(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from datetime import date as _d
    from app.entities.vendor.model import VendorBlockedDate
    v = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    rows = db.query(VendorBlockedDate).filter(VendorBlockedDate.vendor_id == v.id, VendorBlockedDate.day >= _d.today()).all()
    return {"blocked_dates": sorted(r.day.isoformat() for r in rows), "daily_capacity": v.daily_capacity}


@router.put("/me/availability")
def set_my_availability(body: AvailabilityUpdate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Replace the vendor's blocked future dates and set how many bookings they can take per day."""
    from datetime import date as _d
    from app.entities.vendor.model import VendorBlockedDate
    v = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    if body.daily_capacity is not None and not (1 <= body.daily_capacity <= 50):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Daily capacity must be between 1 and 50")
    db.query(VendorBlockedDate).filter(VendorBlockedDate.vendor_id == v.id, VendorBlockedDate.day >= _d.today()).delete()
    for d in sorted(set(body.blocked_dates))[:366]:
        if d >= _d.today():
            db.add(VendorBlockedDate(vendor_id=v.id, day=d))
    v.daily_capacity = body.daily_capacity
    db.commit()
    return my_availability(current_user, db)


@router.get("/{vendor_id}/availability")
def public_availability(vendor_id: int, start: date, end: date, db: Session = Depends(get_db)):
    """Days a vendor can't be booked between two dates (blocked or fully booked)."""
    from app.services.ranking import unavailable_days
    v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    if (end - start).days > 400:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Range too long")
    return {"unavailable": sorted(d.isoformat() for d in unavailable_days(db, v, start, end))}


@router.get("/{vendor_id}", response_model=VendorPublicResponse)
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

