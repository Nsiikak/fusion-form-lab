"""Large-payout approval, Paystack OTP handling and the escrow figure. Run: pytest -q"""
import hashlib
import hmac
import json
from decimal import Decimal

import pytest

from app.core import config
from app.entities.booking.model import Booking
from tests.test_payments import _complete, _paid_booking, env  # noqa: F401

# Fixture booking: vendor total 115,000 (incl. 5,000 delivery) → commission 11,000 (none on delivery), payout 104,000, customer fee 2,875


@pytest.fixture()
def threshold(monkeypatch):
    monkeypatch.setattr(config, "PAYOUT_APPROVAL_THRESHOLD", Decimal("100000"))


def _webhook(env, payload):
    raw = json.dumps(payload).encode()
    sig = hmac.new(b"sk_test_dummy", raw, hashlib.sha512).hexdigest()
    return env["client"].post("/api/payments/webhook/paystack", content=raw,
                              headers={"x-paystack-signature": sig, "content-type": "application/json"})


def test_payout_above_threshold_waits_for_admin(env, threshold):
    bid = _paid_booking(env)
    assert _complete(env, bid).status_code == 200
    env["db"].expire_all()
    b = env["db"].get(Booking, bid)
    assert b.payout_status == "awaiting_approval" and env["fake"].transfers == []

    cases = env["client"].get("/api/admin/cases", headers=env["adm"]).json()
    assert [(c["id"], c["case_type"]) for c in cases] == [(bid, "payout_approval")]
    assert env["client"].get("/api/admin/overview", headers=env["adm"]).json()["payouts_awaiting_approval"] == 1

    # Only admins can approve
    assert env["client"].post(f"/api/admin/bookings/{bid}/approve-payout", headers=env["ven"]).status_code == 403
    r = env["client"].post(f"/api/admin/bookings/{bid}/approve-payout", headers=env["adm"])
    assert r.json()["payout_status"] == "processing"
    assert env["fake"].transfers == [(Decimal("104000.00"), "RCP_123", f"PLG-PAYOUT-{bid}")]
    # Approving twice never pays twice
    assert env["client"].post(f"/api/admin/bookings/{bid}/approve-payout", headers=env["adm"]).status_code == 409
    assert len(env["fake"].transfers) == 1


def test_payout_at_or_below_threshold_is_automatic(env, monkeypatch):
    monkeypatch.setattr(config, "PAYOUT_APPROVAL_THRESHOLD", Decimal("104000"))  # exactly equal → automatic
    bid = _paid_booking(env)
    _complete(env, bid)
    assert len(env["fake"].transfers) == 1


def test_paystack_otp_response_is_surfaced_not_hidden(env):
    env["fake"].transfer_status = "otp"
    bid = _paid_booking(env)
    _complete(env, bid)
    env["db"].expire_all()
    b = env["db"].get(Booking, bid)
    assert b.payout_status == "awaiting_otp" and "OTP" in b.payout_error
    cases = env["client"].get("/api/admin/cases", headers=env["adm"]).json()
    assert cases[0]["case_type"] == "awaiting_otp"
    # Admin finalises it in Paystack → webhook marks it paid and the case clears
    _webhook(env, {"event": "transfer.success", "data": {"reference": f"PLG-PAYOUT-{bid}"}})
    env["db"].expire_all()
    assert env["db"].get(Booking, bid).payout_status == "paid"
    assert env["client"].get("/api/admin/cases", headers=env["adm"]).json() == []


def test_escrow_keeps_vendor_share_until_transfer_lands(env, threshold):
    bid = _paid_booking(env)
    o = env["client"].get("/api/admin/overview", headers=env["adm"]).json()
    assert o["escrow_held"] == 117875.0 and o["platform_earnings"] == 0

    _complete(env, bid)  # held for approval
    o = env["client"].get("/api/admin/overview", headers=env["adm"]).json()
    assert o["escrow_held"] == 104000.0              # vendor's share still with us
    assert o["platform_earnings"] == 13875.0         # 11,000 commission + 2,875 customer fee

    env["client"].post(f"/api/admin/bookings/{bid}/approve-payout", headers=env["adm"])
    _webhook(env, {"event": "transfer.success", "data": {"reference": f"PLG-PAYOUT-{bid}"}})
    o = env["client"].get("/api/admin/overview", headers=env["adm"]).json()
    assert o["escrow_held"] == 0 and o["platform_earnings"] == 13875.0


def test_admin_can_check_payout_with_paystack_when_no_webhook_arrives(env):
    env["fake"].transfer_status = "otp"
    bid = _paid_booking(env)
    _complete(env, bid)
    # Still waiting for the OTP → nothing changes
    r = env["client"].post(f"/api/admin/bookings/{bid}/sync-payout", headers=env["adm"])
    assert r.json()["payout_status"] == "awaiting_otp"
    # Admin enters the OTP in Paystack; no webhook reaches us (e.g. localhost)
    env["fake"].transfer_status = "success"
    r = env["client"].post(f"/api/admin/bookings/{bid}/sync-payout", headers=env["adm"])
    assert r.json()["payout_status"] == "paid" and r.json()["case_type"] is None
    assert env["client"].get("/api/admin/cases", headers=env["adm"]).json() == []


def test_background_task_reconciles_stuck_payouts(env):
    from app.entities.booking.service import BookingService
    bid = _paid_booking(env)
    _complete(env, bid)                     # sent, status "processing"
    env["fake"].transfer_status = "failed"
    assert BookingService.sync_pending_payouts(env["db"]) == 1
    env["db"].expire_all()
    b = env["db"].get(Booking, bid)
    assert b.payout_status == "failed" and "failed" in b.payout_error
