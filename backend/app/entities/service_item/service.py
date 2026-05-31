from sqlalchemy.orm import Session
from typing import List
from fastapi import HTTPException
from app.entities.service_item.model import ServiceItem
from app.entities.service_item.schema import ServiceItemCreate, ServiceItemUpdate


class ServiceItemService:
    @staticmethod
    def get_vendor_items(db: Session, vendor_id: int, active_only: bool = True) -> List[ServiceItem]:
        q = db.query(ServiceItem).filter(ServiceItem.vendor_id == vendor_id)
        if active_only:
            q = q.filter(ServiceItem.is_active == True)  # noqa: E712
        return q.order_by(ServiceItem.id).all()

    @staticmethod
    def get_item(db: Session, item_id: int, vendor_id: int) -> ServiceItem:
        item = db.query(ServiceItem).filter(
            ServiceItem.id == item_id,
            ServiceItem.vendor_id == vendor_id,
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="Service item not found")
        return item

    @staticmethod
    def create_item(db: Session, vendor_id: int, data: ServiceItemCreate) -> ServiceItem:
        item = ServiceItem(vendor_id=vendor_id, **data.model_dump())
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def update_item(db: Session, item_id: int, vendor_id: int, data: ServiceItemUpdate) -> ServiceItem:
        item = ServiceItemService.get_item(db, item_id, vendor_id)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(item, k, v)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete_item(db: Session, item_id: int, vendor_id: int) -> None:
        item = ServiceItemService.get_item(db, item_id, vendor_id)
        db.delete(item)
        db.commit()
