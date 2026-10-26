"""Vendor wallet and on-request withdrawals (Paystack Transfers).

Money flow:
  customer pays → held in the Plagohive Paystack balance (escrow)
  booking settles in the vendor's favour → vendor's share credited to their wallet (no transfer yet)
  vendor taps Withdraw → one Paystack transfer from our balance to their saved bank account
  transfer.success → withdrawal paid · transfer.failed / transfer.reversed → money back in the wallet
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import config
from app.entities.vendor.model import Vendor
from app.entities.wallet.model import WalletEntry, Withdrawal
from app.services.paystack import PaystackError, PaystackUnreachable, paystack_service
from app.services.pricing import money

logger = logging.getLogger(__name__)

IN_FLIGHT = ("awaiting_approval", "processing", "awaiting_otp")

# Paystack transfer status → withdrawal status
_TRANSFER_STATUS = {
    "success": "paid",
    "otp": "awaiting_otp",
    "failed": "failed", "reversed": "failed", "abandoned": "failed", "blocked": "failed", "rejected": "failed",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def balance(db: Session, vendor_id: int) -> Decimal:
    total = db.query(func.coalesce(func.sum(WalletEntry.amount), 0)).filter(WalletEntry.vendor_id == vendor_id).scalar()
    return money(total or 0)


def credit(db: Session, vendor_id: int, amount, kind: str, booking_id: Optional[int] = None, note: str = "") -> bool:
    """Add money to a vendor's wallet. At most once per (booking, kind): a repeat is ignored."""
    amount = money(amount)
    if amount <= 0:
        return False
    try:
        with db.begin_nested():
            db.add(WalletEntry(vendor_id=vendor_id, amount=amount, kind=kind, booking_id=booking_id, note=note[:200] or None))
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False


# ── Withdrawals ──────────────────────────────────────────────────────────────

def request_withdrawal(db: Session, vendor: Vendor, amount: Optional[Decimal] = None) -> Withdrawal:
    """Vendor asks to withdraw `amount` (default: everything). Debits the wallet, then sends the
    transfer — or holds it for an admin when it's above PAYOUT_APPROVAL_THRESHOLD."""
    # Lock the vendor row so two taps on Withdraw can't both spend the same balance
    vendor = db.query(Vendor).filter(Vendor.id == vendor.id).with_for_update().one()
    if not vendor.recipient_code:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Add your bank account in Payout Settings before withdrawing.")
    if db.query(Withdrawal.id).filter(Withdrawal.vendor_id == vendor.id, Withdrawal.status.in_(IN_FLIGHT)).first():
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="You already have a withdrawal in progress. Wait for it to finish first.")
    available = balance(db, vendor.id)
    amount = money(amount) if amount is not None else available
    if amount < config.WITHDRAWAL_MINIMUM:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"The minimum withdrawal is ₦{config.WITHDRAWAL_MINIMUM:,.0f}.")
    if amount > available:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"You can withdraw up to ₦{available:,.2f}.")

    needs_approval = amount > config.PAYOUT_APPROVAL_THRESHOLD
    w = Withdrawal(vendor_id=vendor.id, amount=amount, recipient_code=vendor.recipient_code,
                   status="awaiting_approval" if needs_approval else "processing", reference=f"tmp-{secrets.token_hex(8)}")
    db.add(w)
    db.flush()
    w.reference = f"PLG-WD-{w.id}"
    db.add(WalletEntry(vendor_id=vendor.id, amount=-amount, kind="withdrawal", withdrawal_id=w.id,
                       note=f"Withdrawal {w.reference}"))
    db.commit()
    db.refresh(w)
    if not needs_approval:
        _send(db, w)
    return w


def approve(db: Session, w: Withdrawal, admin_id: int) -> Withdrawal:
    claimed = (db.query(Withdrawal).filter(Withdrawal.id == w.id, Withdrawal.status == "awaiting_approval")
               .update({"status": "processing", "approved_by": admin_id}, synchronize_session=False))
    db.commit()
    db.refresh(w)
    if not claimed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This withdrawal isn't awaiting approval")
    _send(db, w)
    return w


def reject(db: Session, w: Withdrawal, admin_id: int, reason: str) -> Withdrawal:
    if w.status != "awaiting_approval":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only withdrawals awaiting approval can be rejected")
    w.approved_by = admin_id
    db.commit()
    mark_failed(db, w, f"Not approved: {reason}".strip())
    return w


def _send(db: Session, w: Withdrawal) -> None:
    """Ask Paystack to transfer the withdrawal and record what it says."""
    try:
        result = paystack_service.initiate_transfer(
            amount=money(w.amount), recipient_code=w.recipient_code, reference=w.reference,
            reason=f"Plagohive withdrawal {w.reference}",
        )
    except PaystackUnreachable as exc:
        # We don't know whether Paystack got it. Leave it processing; the sync job asks Paystack.
        w.error = str(exc)[:1000]
        db.commit()
        return
    except (PaystackError, HTTPException) as exc:
        mark_failed(db, w, str(getattr(exc, "detail", exc)))
        return
    w.transfer_code = (result or {}).get("transfer_code") or w.transfer_code
    new_status = _TRANSFER_STATUS.get((result or {}).get("status"), "processing")
    if new_status == "paid":
        mark_paid(db, w)
    elif new_status == "failed":
        mark_failed(db, w, f"Paystack transfer {(result or {}).get('status')}")
    else:
        w.status = new_status
        w.error = ("Paystack is waiting for an OTP. Finalise it in the Paystack dashboard, or switch off "
                   "transfer OTP so withdrawals go out automatically.") if new_status == "awaiting_otp" else None
        db.commit()


def mark_paid(db: Session, w: Withdrawal) -> None:
    claimed = (db.query(Withdrawal).filter(Withdrawal.id == w.id, Withdrawal.status.in_(IN_FLIGHT))
               .update({"status": "paid", "paid_at": _now(), "error": None}, synchronize_session=False))
    db.commit()
    db.refresh(w)
    if claimed:
        from app.entities.wallet.notifications import notify_withdrawal_paid
        notify_withdrawal_paid(db, w)


def mark_failed(db: Session, w: Withdrawal, reason: str) -> None:
    """The transfer didn't (or no longer does) reach the vendor: put the money back in their wallet.
    Also covers a transfer Paystack reverses after it succeeded."""
    claimed = (db.query(Withdrawal).filter(Withdrawal.id == w.id, Withdrawal.status != "failed")
               .update({"status": "failed", "failed_at": _now(), "error": reason[:1000]}, synchronize_session=False))
    db.commit()
    db.refresh(w)
    if not claimed:
        return
    try:
        with db.begin_nested():
            db.add(WalletEntry(vendor_id=w.vendor_id, amount=money(w.amount), kind="withdrawal_reversal",
                               withdrawal_id=w.id, note=f"Returned: {w.reference}"))
        db.commit()
    except IntegrityError:   # already returned
        db.rollback()
    logger.warning("Withdrawal %s failed, %s returned to vendor %s's wallet: %s", w.reference, w.amount, w.vendor_id, reason)
    from app.entities.wallet.notifications import notify_withdrawal_failed
    notify_withdrawal_failed(db, w)


def sync(db: Session, w: Withdrawal) -> str:
    """Ask Paystack where a transfer stands (covers a missed webhook or a network error on send)."""
    if w.status not in ("processing", "awaiting_otp"):
        return w.status
    try:
        data = paystack_service.verify_transfer(w.reference)
    except PaystackUnreachable:
        return w.status
    except PaystackError as exc:
        # Paystack has no such transfer: the send never reached them. Return the money.
        if _now() - (w.created_at or _now()) > timedelta(minutes=15):
            mark_failed(db, w, f"Transfer was never created at Paystack ({exc})")
        return w.status
    new_status = _TRANSFER_STATUS.get(data.get("status"), "processing")
    if new_status == "paid":
        mark_paid(db, w)
    elif new_status == "failed":
        mark_failed(db, w, f"Paystack transfer {data.get('status')}: {data.get('reason') or ''}")
    elif new_status != w.status:
        w.status = new_status
        db.commit()
    return w.status


def sync_pending(db: Session) -> int:
    """Background task: reconcile every withdrawal still waiting on Paystack."""
    changed = 0
    for w in db.query(Withdrawal).filter(Withdrawal.status.in_(["processing", "awaiting_otp"])).all():
        before = w.status
        if sync(db, w) != before:
            changed += 1
    if changed:
        logger.info("Reconciled %d withdrawal(s) with Paystack", changed)
    return changed


def handle_transfer_event(db: Session, event: str, data: dict) -> bool:
    """Webhook: returns True if the reference was one of our withdrawals."""
    w = db.query(Withdrawal).filter(Withdrawal.reference == data.get("reference")).first()
    if not w:
        return False
    if event == "transfer.success":
        mark_paid(db, w)
    else:
        mark_failed(db, w, f"Paystack {event}: {data.get('reason') or data.get('status') or ''}")
    return True


# ── Views ────────────────────────────────────────────────────────────────────

def withdrawal_view(w: Withdrawal) -> dict:
    return {
        "id": w.id, "amount": float(w.amount), "status": w.status, "reference": w.reference,
        # Vendors only see an admin's rejection reason; Paystack's error text is for staff (see admin view)
        "error": w.error if w.status == "failed" and (w.error or "").startswith("Not approved:") else None,
        "created_at": w.created_at.isoformat() if w.created_at else None,
        "paid_at": w.paid_at.isoformat() if w.paid_at else None,
        "failed_at": w.failed_at.isoformat() if w.failed_at else None,
    }


def summary(db: Session, vendor: Vendor) -> dict:
    available = balance(db, vendor.id)
    pending = db.query(Withdrawal).filter(Withdrawal.vendor_id == vendor.id, Withdrawal.status.in_(IN_FLIGHT)).first()
    entries = (db.query(WalletEntry).filter(WalletEntry.vendor_id == vendor.id)
               .order_by(WalletEntry.created_at.desc(), WalletEntry.id.desc()).limit(20).all())
    withdrawals = (db.query(Withdrawal).filter(Withdrawal.vendor_id == vendor.id)
                   .order_by(Withdrawal.created_at.desc()).limit(10).all())
    return {
        "balance": float(available),
        "minimum": float(config.WITHDRAWAL_MINIMUM),
        "approval_threshold": float(config.PAYOUT_APPROVAL_THRESHOLD),
        "has_bank_account": bool(vendor.recipient_code),
        "pending_withdrawal": withdrawal_view(pending) if pending else None,
        "can_withdraw": bool(vendor.recipient_code) and pending is None and available >= config.WITHDRAWAL_MINIMUM,
        "entries": [{"id": e.id, "amount": float(e.amount), "kind": e.kind, "booking_id": e.booking_id,
                     "note": e.note, "created_at": e.created_at.isoformat() if e.created_at else None} for e in entries],
        "withdrawals": [withdrawal_view(w) for w in withdrawals],
    }
