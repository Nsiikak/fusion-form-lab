"""Cancellation rules — the single source of truth for who gets what when a booking is cancelled.

Customer cancels after the vendor accepted
------------------------------------------
The refund is a percentage of the *vendor's price*, by how much notice is given and which policy
the vendor chose. The vendor keeps the rest for preparation already done (minus the usual
commission, taken only on what they keep). The 2.5% platform fee is not refunded at this stage.

Always a full refund (incl. platform fee):
  * before the vendor accepts
  * within 24 hours of paying, if the event is 7+ days away (cooling-off)
  * whenever the vendor is at fault

Vendor at fault (vendor cancels after accepting, or no-show)
------------------------------------------------------------
  14+ days before   → no fee, logged
  2–13 days before  → 10% late-cancellation fee + strike
  under 48h/no-show → 20% fee + severe strike + listing paused
Fees are deducted from the vendor's future payouts.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from app.core.config import VENDOR_COMMISSION_RATE
from app.services.pricing import money

# (minimum days of notice, % of vendor price refunded) — checked top to bottom
POLICIES: dict[str, dict] = {
    "flexible": {
        "label": "Flexible",
        "summary": "Full refund up to 7 days before, 50% up to 48 hours before.",
        "tiers": [(7, 100), (2, 50)],
    },
    "standard": {
        "label": "Standard",
        "summary": "Full refund up to 14 days before, 50% up to 7 days, 25% up to 48 hours.",
        "tiers": [(14, 100), (7, 50), (2, 25)],
    },
    "strict": {
        "label": "Strict",
        "summary": "50% refund up to 14 days before, 25% up to 7 days. Best for perishables and custom work.",
        "tiers": [(14, 50), (7, 25)],
    },
}
DEFAULT_POLICY = "standard"
COOLING_OFF = timedelta(hours=24)

FAULT_FEES = [(14, Decimal("0"), "logged"), (2, Decimal("0.10"), "strike")]   # else 20%, severe
SEVERE_FEE = Decimal("0.20")


def policy_snapshot(policy_key: Optional[str]) -> dict:
    key = policy_key if policy_key in POLICIES else DEFAULT_POLICY
    p = POLICIES[key]
    return {"key": key, "label": p["label"], "summary": p["summary"], "tiers": p["tiers"]}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def days_before(event_dt: datetime, now: datetime) -> float:
    return (_aware(event_dt) - now).total_seconds() / 86400


def schedule(policy: dict, event_dt: datetime) -> list[dict]:
    """Human schedule with real dates, e.g. for checkout: [{until: date, refund_pct: 100}, ...]."""
    event_dt = _aware(event_dt)
    rows = [{"until": (event_dt - timedelta(days=d)).isoformat(), "refund_pct": pct} for d, pct in policy["tiers"]]
    rows.append({"until": event_dt.isoformat(), "refund_pct": 0})
    return rows


@dataclass
class CancellationOutcome:
    refund_amount: Decimal          # back to the customer
    refund_pct: int                 # % of the vendor price refunded (100 for full refunds)
    full_refund: bool               # includes the platform fee
    vendor_retained: Decimal        # vendor price the vendor keeps
    vendor_payout: Decimal          # what actually reaches the vendor (after commission)
    commission: Decimal
    reason: str                     # one plain sentence

    def as_dict(self) -> dict:
        return {
            "refund_amount": float(self.refund_amount), "refund_pct": self.refund_pct,
            "full_refund": self.full_refund, "vendor_retained": float(self.vendor_retained),
            "vendor_payout": float(self.vendor_payout), "commission": float(self.commission),
            "reason": self.reason,
        }


def customer_cancellation(booking, now: Optional[datetime] = None) -> CancellationOutcome:
    """What happens if the customer cancels this booking right now."""
    now = now or datetime.now(timezone.utc)
    vendor_total = money(booking.price)
    customer_total = money(booking.customer_total if booking.customer_total is not None else booking.price)
    status = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    d = days_before(booking.event_date, now)

    def full(reason: str) -> CancellationOutcome:
        return CancellationOutcome(customer_total, 100, True, Decimal("0"), Decimal("0"), Decimal("0"), reason)

    if status == "pending":
        return full("The vendor hasn't accepted yet, so you get everything back.")
    if booking.paid_at and now - _aware(booking.paid_at) <= COOLING_OFF and d >= 7:
        return full("You're within 24 hours of booking, so you get everything back.")

    policy = booking.policy_snapshot or policy_snapshot(DEFAULT_POLICY)
    pct = 0
    for min_days, tier_pct in policy["tiers"]:
        if d >= min_days:
            pct = tier_pct
            break
    refund = money(vendor_total * Decimal(pct) / 100)
    retained = money(vendor_total - refund)
    commission = money(retained * VENDOR_COMMISSION_RATE)
    if pct == 100:
        reason = f"You're cancelling with plenty of notice under {policy['label']} terms."
    elif pct == 0:
        reason = (f"Under the vendor's {policy['label']} policy there's no refund this close to the event — "
                  "they've likely already prepared.")
    else:
        reason = (f"Under the vendor's {policy['label']} policy you get {pct}% of their price back; "
                  "they keep the rest for preparation already done.")
    return CancellationOutcome(refund, pct, False, retained, money(retained - commission), commission, reason)


@dataclass
class FaultOutcome:
    fee: Decimal
    fee_rate: Decimal
    severity: str            # logged | strike | severe

    def as_dict(self) -> dict:
        return {"fee": float(self.fee), "fee_rate": float(self.fee_rate), "severity": self.severity}


def vendor_fault(booking, now: Optional[datetime] = None, no_show: bool = False) -> FaultOutcome:
    now = now or datetime.now(timezone.utc)
    vendor_total = money(booking.price)
    if not no_show:
        d = days_before(booking.event_date, now)
        for min_days, rate, severity in FAULT_FEES:
            if d >= min_days:
                return FaultOutcome(money(vendor_total * rate), rate, severity)
    return FaultOutcome(money(vendor_total * SEVERE_FEE), SEVERE_FEE, "severe")
