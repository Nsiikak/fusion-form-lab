"""Vendor emails for the wallet: money credited, withdrawal paid, withdrawal failed."""
import logging

from sqlalchemy.orm import Session

from app.entities.user.model import User
from app.entities.vendor.model import Vendor
from app.services.email import _fire_and_forget, send_notice_email

logger = logging.getLogger(__name__)


def _fmt(amount) -> str:
    return f"{float(amount or 0):,.0f}"


def _vendor_user(db: Session, vendor_id: int):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    return db.query(User).filter(User.id == vendor.user_id).first() if vendor else None


def notify_withdrawal_paid(db: Session, w) -> None:
    try:
        user = _vendor_user(db, w.vendor_id)
        if not user:
            return
        _fire_and_forget(
            send_notice_email, user.email, user.full_name or user.email,
            f"₦{_fmt(w.amount)} has been sent to your bank", "Withdrawal sent", f"₦{_fmt(w.amount)} is on its way",
            ["Your withdrawal has been sent to your bank account. Depending on your bank, it can take a few minutes to show."],
            "View my wallet", "/vendor-dashboard",
            details=[("Reference", w.reference), ("Amount", f"₦{_fmt(w.amount)}")],
        )
    except Exception as exc:
        logger.error("Failed to send withdrawal-paid email for %s: %s", w.reference, exc)


def notify_withdrawal_failed(db: Session, w) -> None:
    try:
        user = _vendor_user(db, w.vendor_id)
        if not user:
            return
        _fire_and_forget(
            send_notice_email, user.email, user.full_name or user.email,
            "Your withdrawal didn't go through", "Withdrawal", "Your money is back in your wallet",
            [f"We couldn't complete your ₦{_fmt(w.amount)} withdrawal, so the full amount is back in your Plagohive wallet.",
             *([w.error.replace("Not approved:", "Reason:", 1).strip()] if (w.error or "").startswith("Not approved:") else []),
             "Check your bank details in Payout Settings, then withdraw again. If it keeps failing, contact support."],
            "Open my wallet", "/vendor-dashboard",
            details=[("Reference", w.reference), ("Amount", f"₦{_fmt(w.amount)}")],
        )
    except Exception as exc:
        logger.error("Failed to send withdrawal-failed email for %s: %s", w.reference, exc)
