"""Cancellation policies, vendor accountability, reconfirm/check-in, no-show fast track,
countdown check-ins and the admin board. Run: pytest -q

Fixture booking: vendor price ₦115,000, customer paid ₦117,875 (incl. ₦2,875 platform fee)."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.entities.booking.model import Booking, BookingStatus
from app.entities.booking.trust import TrustService
from app.entities.vendor.incident import VendorIncident
from tests.test_payments import _credited, _complete, _paid_booking, _status, env  # noqa: F401

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _confirmed(env, days_out=10, paid_hours_ago=72, policy="standard"):
    env["vendor"].cancellation_policy = policy
    env["db"].commit()
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    b = env["db"].get(Booking, bid)
    b.event_date = NOW() + timedelta(days=days_out)
    b.paid_at = NOW() - timedelta(hours=paid_hours_ago)
    env["db"].commit()
    return bid


def _b(env, bid):
    env["db"].expire_all()
    return env["db"].get(Booking, bid)


# ── Customer cancellations ───────────────────────────────────────────────────

def test_standard_policy_10_days_out_splits_50_50(env):
    bid = _confirmed(env, days_out=10)
    p = env["client"].get(f"/api/bookings/{bid}/cancellation-preview", headers=env["cust"]).json()
    assert p["refund_pct"] == 50 and p["refund_amount"] == 57500 and not p["full_refund"]
    env["client"].post(f"/api/bookings/{bid}/cancel", headers=env["cust"], json={"reason": "Date moved"})
    b = _b(env, bid)
    assert b.status == BookingStatus.CANCELLED and b.cancelled_by == "customer"
    assert env["fake"].refund_amounts[-1] == Decimal("57500.00")                 # partial refund
    assert _credited(env)[-1][0] == Decimal("51750.00")                        # vendor keeps 57,500 − 10%
    assert b.commission_amount == Decimal("5750.00")


def test_strict_policy_10_days_out_refunds_25(env):
    bid = _confirmed(env, days_out=10, policy="strict")
    env["client"].post(f"/api/bookings/{bid}/cancel", headers=env["cust"], json={})
    assert env["fake"].refund_amounts[-1] == Decimal("28750.00")


def test_under_48_hours_no_refund_vendor_paid(env):
    bid = _confirmed(env, days_out=1)
    p = env["client"].get(f"/api/bookings/{bid}/cancellation-preview", headers=env["cust"]).json()
    assert p["refund_amount"] == 0
    env["client"].post(f"/api/bookings/{bid}/cancel", headers=env["cust"], json={})
    assert env["fake"].refunds == []
    assert _credited(env)[-1][0] == Decimal("103500.00")


def test_full_refund_cases(env):
    # Before the vendor accepts
    bid = _paid_booking(env)
    env["client"].post(f"/api/bookings/{bid}/cancel", headers=env["cust"], json={})
    assert env["fake"].refund_amounts[-1] is None and _b(env, bid).refund_amount == Decimal("117875.00")
    # Cooling-off: paid 2 hours ago, event 30 days away
    bid2 = _confirmed(env, days_out=30, paid_hours_ago=2, policy="strict")
    p = env["client"].get(f"/api/bookings/{bid2}/cancellation-preview", headers=env["cust"]).json()
    assert p["full_refund"] is True and "24 hours" in p["reason"]


def test_policy_is_locked_in_at_booking(env):
    bid = _confirmed(env, days_out=10, policy="standard")
    env["vendor"].cancellation_policy = "strict"        # vendor changes policy later
    env["db"].commit()
    p = env["client"].get(f"/api/bookings/{bid}/cancellation-preview", headers=env["cust"]).json()
    assert p["refund_pct"] == 50


# ── Vendor fault ─────────────────────────────────────────────────────────────

def test_vendor_cancels_10_days_out(env):
    bid = _confirmed(env, days_out=10)
    pre = env["client"].get(f"/api/bookings/{bid}/vendor-cancel-preview", headers=env["ven"]).json()
    assert pre["fee"] == 11500 and pre["severity"] == "strike"
    r = env["client"].post(f"/api/bookings/{bid}/vendor-cancel", headers=env["ven"], json={"reason": "Equipment failure"})
    assert r.status_code == 200
    assert env["fake"].refund_amounts[-1] is None                      # full refund incl. platform fee
    inc = env["db"].query(VendorIncident).one()
    assert inc.fee == Decimal("11500.00") and inc.severity == "strike"
    env["db"].refresh(env["vendor"])
    assert env["vendor"].is_active is True                               # one strike: still listed
    assert any(c[0] == "send_notice_email" and "full refund" in c[1][2] for c in env["calls"])


def test_two_strikes_pause_the_listing(env):
    for _ in range(2):
        bid = _confirmed(env, days_out=10)
        env["client"].post(f"/api/bookings/{bid}/vendor-cancel", headers=env["ven"], json={"reason": "Double booked"})
    env["db"].refresh(env["vendor"])
    assert env["vendor"].is_active is False


def test_last_minute_vendor_cancel_is_severe(env):
    bid = _confirmed(env, days_out=1)
    env["client"].post(f"/api/bookings/{bid}/vendor-cancel", headers=env["ven"], json={"reason": "Fell sick"})
    inc = env["db"].query(VendorIncident).one()
    assert inc.severity == "severe" and inc.fee == Decimal("23000.00")
    env["db"].refresh(env["vendor"])
    assert env["vendor"].is_active is False


def test_owed_fees_are_recovered_from_next_payout(env):
    bid = _confirmed(env, days_out=10)
    env["client"].post(f"/api/bookings/{bid}/vendor-cancel", headers=env["ven"], json={"reason": "Clash"})
    bid2 = _paid_booking(env)
    _complete(env, bid2)
    assert _credited(env)[-1][0] == Decimal("92500.00")                  # 104,000 − 11,500
    b2 = _b(env, bid2)
    assert b2.penalty_deducted == Decimal("11500.00")
    assert env["db"].query(VendorIncident).one().fee_remaining == 0


# ── Reconfirm, phone sharing, check-in ───────────────────────────────────────

def test_reconfirm_reveals_phone_numbers(env):
    env["customer"].phone_number = "08031112222"
    env["db"].commit()
    bid = _confirmed(env, days_out=5)
    assert "counterpart_phone" not in env["client"].get(f"/api/bookings/{bid}", headers=env["ven"]).json()
    env["client"].post(f"/api/bookings/{bid}/reconfirm", headers=env["ven"])
    assert env["client"].get(f"/api/bookings/{bid}", headers=env["ven"]).json()["counterpart_phone"] == "08031112222"


def test_check_in_opens_six_hours_before(env):
    bid = _confirmed(env, days_out=1)
    assert env["client"].post(f"/api/bookings/{bid}/check-in", headers=env["ven"]).status_code == 400
    b = _b(env, bid)
    b.event_date = NOW() + timedelta(hours=3)
    env["db"].commit()
    assert env["client"].post(f"/api/bookings/{bid}/check-in", headers=env["ven"]).json()["checked_in_at"]


# ── No-show fast track ───────────────────────────────────────────────────────

def _no_show(env):
    bid = _confirmed(env, days_out=1)
    b = _b(env, bid)
    b.event_date = NOW() - timedelta(hours=2)
    env["db"].commit()
    r = env["client"].post(f"/api/bookings/{bid}/dispute", headers=env["cust"],
                           json={"reason": "Nobody turned up at the venue at all.", "no_show": True})
    assert r.status_code == 200
    return bid


def test_unanswered_no_show_is_refunded_automatically(env):
    bid = _no_show(env)
    b = _b(env, bid)
    assert b.dispute_kind == "no_show" and b.response_due_at is not None
    b.response_due_at = NOW() - timedelta(minutes=1)
    env["db"].commit()
    assert TrustService.resolve_overdue_no_shows(env["db"]) == 1
    b = _b(env, bid)
    assert b.status == BookingStatus.CANCELLED and b.resolution == "refund"
    assert env["db"].query(VendorIncident).one().severity == "severe"


def test_vendor_response_stops_the_auto_refund(env):
    bid = _no_show(env)
    env["client"].post(f"/api/bookings/{bid}/no-show-response", headers=env["ven"],
                       json={"message": "We were there from 3pm — photos sent in chat."})
    b = _b(env, bid)
    b.response_due_at = NOW() - timedelta(minutes=1)
    env["db"].commit()
    assert TrustService.resolve_overdue_no_shows(env["db"]) == 0
    assert _b(env, bid).status == BookingStatus.DISPUTED                 # admin decides


# ── Scheduled jobs ───────────────────────────────────────────────────────────

def test_unaccepted_request_expires_with_full_refund(env):
    bid = _paid_booking(env)
    b = _b(env, bid)
    b.paid_at = NOW() - timedelta(hours=49)
    env["db"].commit()
    assert TrustService.expire_unaccepted(env["db"]) == 1
    b = _b(env, bid)
    assert b.status == BookingStatus.DECLINED and b.cancelled_by == "system"
    assert len(env["fake"].refunds) == 1


def test_countdown_check_ins_are_sent_once(env):
    bid = _confirmed(env, days_out=6)
    before = len(env["calls"])
    assert TrustService.run_countdown(env["db"])["t7"] == 1
    assert TrustService.run_countdown(env["db"])["t7"] == 0             # idempotent
    assert len(env["calls"]) - before == 2                               # customer + vendor
    # Not reconfirmed 48h later → chase
    b = _b(env, bid)
    b.reminders = {"t7": (NOW() - timedelta(hours=49)).isoformat()}
    env["db"].commit()
    assert TrustService.run_countdown(env["db"])["chase"] == 1
    # 2 days out → final details
    b = _b(env, bid)
    b.event_date = NOW() + timedelta(days=1, hours=12)
    env["db"].commit()
    assert TrustService.run_countdown(env["db"])["t2"] == 1


def test_upcoming_board_health(env):
    bid = _confirmed(env, days_out=3)
    board = env["client"].get("/api/admin/upcoming", headers=env["adm"]).json()
    assert board[0]["id"] == bid and board[0]["health"] == "amber"
    env["client"].post(f"/api/bookings/{bid}/reconfirm", headers=env["ven"])
    board = env["client"].get("/api/admin/upcoming", headers=env["adm"]).json()
    assert board[0]["health"] == "green"


def test_policies_endpoint(env):
    p = env["client"].get("/api/bookings/policies").json()
    assert set(p) == {"flexible", "standard", "strict"} and p["standard"]["tiers"][0] == [14, 100]
