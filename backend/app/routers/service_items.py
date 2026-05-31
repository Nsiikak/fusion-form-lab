from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.entities.user.model import User
from app.entities.vendor.service import VendorService
from app.entities.service_item.schema import ServiceItemCreate, ServiceItemUpdate, ServiceItemResponse
from app.entities.service_item.service import ServiceItemService

router = APIRouter()


def _require_vendor(current_user: User, db: Session):
    if current_user.role.value != "vendor":
        raise HTTPException(status_code=403, detail="Only vendors can manage service items")
    vendor = VendorService.get_vendor_by_user_id(db, current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    return vendor


@router.get("/vendor/{vendor_id}", response_model=List[ServiceItemResponse])
async def get_vendor_service_items(vendor_id: int, db: Session = Depends(get_db)):
    """Public — list active service items for a vendor"""
    return ServiceItemService.get_vendor_items(db, vendor_id, active_only=True)


@router.get("/me", response_model=List[ServiceItemResponse])
async def get_my_service_items(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Vendor's own items including inactive ones"""
    vendor = _require_vendor(current_user, db)
    return ServiceItemService.get_vendor_items(db, vendor.id, active_only=False)


@router.post("", response_model=ServiceItemResponse, status_code=status.HTTP_201_CREATED)
async def create_service_item(
    data: ServiceItemCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    vendor = _require_vendor(current_user, db)
    return ServiceItemService.create_item(db, vendor.id, data)


@router.put("/{item_id}", response_model=ServiceItemResponse)
async def update_service_item(
    item_id: int,
    data: ServiceItemUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    vendor = _require_vendor(current_user, db)
    return ServiceItemService.update_item(db, item_id, vendor.id, data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_item(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    vendor = _require_vendor(current_user, db)
    ServiceItemService.delete_item(db, item_id, vendor.id)
    return None
