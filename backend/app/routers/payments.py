"""Paystack webhook. Configure in the Paystack dashboard as:
    https://<api-domain>/api/payments/webhook/paystack
"""
import json
import logging

from fastapi import APIRouter, HTTPException, Request, status
from starlette.concurrency import run_in_threadpool

from app.core.database import SessionLocal
from app.entities.booking.model import Booking
from app.entities.booking.notifications import notify_booking_paid
from app.entities.booking.service import BookingService
from app.services.paystack import paystack_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _handle_event(event: str, data: dict) -> None:
    db = SessionLocal()
    try:
        if event == "charge.success" and str(data.get("reference") or "").startswith("PLG-ADD-"):
            from app.entities.booking.addon import BookingAddon
            from app.entities.booking.addons_service import AddonService
            addon = db.query(BookingAddon).filter(BookingAddon.payment_reference == data.get("reference")).first()
            if addon:
                try:
                    AddonService.confirm_payment(db, addon, data)
                except HTTPException as exc:
                    logger.error("Webhook could not confirm add-on %s: %s", addon.id, exc.detail)
            return

        if event == "charge.success":
            booking = db.query(Booking).filter(Booking.payment_reference == data.get("reference")).first()
            if not booking:
                logger.warning("charge.success for unknown reference %s", data.get("reference"))
                return
            try:
                if BookingService.confirm_payment(db, booking, data):
                    notify_booking_paid(db, booking)
            except HTTPException as exc:  # amount mismatch etc. — already logged
                logger.error("Webhook could not confirm booking %s: %s", booking.id, exc.detail)

        elif event in ("transfer.success", "transfer.failed", "transfer.reversed"):
            booking = db.query(Booking).filter(Booking.payout_reference == data.get("reference")).first()
            if not booking:
                return
            if event == "transfer.success":
                BookingService.mark_payout_paid(db, booking)
            else:
                booking.payout_status = "failed"
                booking.payout_error = f"Paystack {event}: {data.get('reason') or data.get('status') or ''}"[:1000]
                db.commit()

        elif event.startswith("refund."):
            ref = data.get("transaction_reference") or (data.get("transaction") or {}).get("reference")
            booking = db.query(Booking).filter(Booking.payment_reference == ref).first()
            if not booking:
                return
            if data.get("id") and not booking.refund_id:
                booking.refund_id = str(data["id"])
                db.commit()
            if event == "refund.processed":
                BookingService.mark_refunded(db, booking)
            elif event == "refund.failed":
                booking.refund_status = "failed"
                db.commit()
            elif event == "refund.needs-attention":
                BookingService.refund_needs_attention(db, booking)
    finally:
        db.close()


@router.post("/webhook/paystack", status_code=status.HTTP_200_OK)
async def paystack_webhook(request: Request):
    raw = await request.body()
    if not paystack_service.verify_webhook_signature(raw, request.headers.get("x-paystack-signature")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    try:
        payload = json.loads(raw)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    await run_in_threadpool(_handle_event, payload.get("event", ""), payload.get("data") or {})
    return {"status": "ok"}
