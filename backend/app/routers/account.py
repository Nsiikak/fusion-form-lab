"""The signed-in user's own account settings.

Refund account: optional bank account a customer can save for refunds Paystack can't send back to
the original payment method automatically ("needs-attention" refunds — mostly bank transfer / USSD
payments). Card payments are always refunded to the card.
"""
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.booking.service import BookingService
from app.entities.user.model import User
from app.services.paystack import paystack_service

router = APIRouter()


def _view(user: User) -> Optional[dict]:
    if not user.refund_account_number:
        return None
    return {
        "bank_code": user.refund_bank_code,
        "bank_name": user.refund_bank_name,
        "account_name": user.refund_account_name,
        "account_number_masked": f"******{user.refund_account_number[-4:]}",
        "updated_at": user.refund_account_updated_at.isoformat() if user.refund_account_updated_at else None,
    }


def _names_overlap(a: str, b: str) -> bool:
    """Loose check that the bank account looks like it's in the user's name."""
    words = lambda s: {w for w in re.findall(r"[a-z]+", (s or "").lower()) if len(w) > 1}  # noqa: E731
    return bool(words(a) & words(b))


class RefundAccountIn(BaseModel):
    bank_code: str = Field(..., min_length=3, max_length=20)
    bank_name: str = Field(..., min_length=2, max_length=100)
    account_number: str = Field(..., pattern=r"^\d{10}$")


@router.get("/refund-account")
def get_refund_account(current_user: User = Depends(get_current_active_user)):
    return {"refund_account": _view(current_user)}


@router.put("/refund-account")
def save_refund_account(
    body: RefundAccountIn,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Verify the account with the bank (via Paystack) and save it. Any refund that was waiting for
    an account is retried immediately."""
    result = paystack_service.resolve_account_number(body.account_number, body.bank_code)
    if not result or not result.get("status"):
        detail = (result or {}).get("paystack_message") or "We couldn't verify that account. Check the bank and number."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    account_name = (result.get("data") or {}).get("account_name") or ""

    user = db.query(User).filter(User.id == current_user.id).first()
    user.refund_bank_code = body.bank_code
    user.refund_bank_name = body.bank_name
    user.refund_account_number = body.account_number
    user.refund_account_name = account_name
    user.refund_account_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    retried = BookingService.retry_refunds_waiting_for(db, user.id)
    return {
        "refund_account": _view(user),
        "name_matches": _names_overlap(account_name, user.full_name or ""),
        "refunds_resumed": retried,
    }


@router.delete("/refund-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_refund_account(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current_user.id).first()
    user.refund_bank_code = user.refund_bank_name = user.refund_account_number = user.refund_account_name = None
    user.refund_account_updated_at = None
    db.commit()
    return None



# ── Saved vendors ────────────────────────────────────────────────────────────

@router.get("/favorites")
def list_favorites(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from app.entities.vendor.model import Favorite, Vendor
    rows = (db.query(Vendor).join(Favorite, Favorite.vendor_id == Vendor.id)
            .filter(Favorite.user_id == current_user.id).order_by(Favorite.created_at.desc()).all())
    return [{"id": v.id, "business_name": v.business_name, "category": v.category.value, "location": v.location,
             "starting_price": float(v.starting_price or 0), "gallery_images": v.gallery_images or [],
             "profile_image_url": v.profile_image_url} for v in rows]


@router.put("/favorites/{vendor_id}", status_code=204)
def add_favorite(vendor_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from app.entities.vendor.model import Favorite, Vendor
    if not db.query(Vendor.id).filter(Vendor.id == vendor_id).first():
        raise HTTPException(status_code=404, detail="Vendor not found")
    if not db.query(Favorite.id).filter(Favorite.user_id == current_user.id, Favorite.vendor_id == vendor_id).first():
        db.add(Favorite(user_id=current_user.id, vendor_id=vendor_id))
        db.commit()
    return None


@router.delete("/favorites/{vendor_id}", status_code=204)
def remove_favorite(vendor_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from app.entities.vendor.model import Favorite
    db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.vendor_id == vendor_id).delete()
    db.commit()
    return None
