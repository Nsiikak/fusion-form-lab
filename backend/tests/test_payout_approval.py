"""Vendor wallet withdrawals: on-request Paystack transfers, large-withdrawal approval, OTP,
webhook/sync reconciliation, failures returning money to the wallet, and the escrow figure.
Run: pytest -q"""
import hashlib
import hmac
import json
from decimal import Decimal

import pytest

from app.core import config
from app.entities.booking.model import Booking
from app.entities.wallet.model import Withdrawal
from tests.test_payments import _complete, _paid_booking, env  # noqa: F401

# Fixture booking: vendor total 115,000 (incl. 5,000 delivery) → commission 11,000 (none on delivery), payout 104,000, customer fee 2,875


@pytest.fixture()
def threshold(monkeypatch):
    monkeypatch.setattr(config, "PAYOUT_APPROVAL_THRESHOLD", Decimal("100000"))


@pytest.fixture(autouse=True)
def automatic(request, monkeypatch):
    """Withdrawals go out without approval unless a test asks for the `threshold` fixture."""
    if "threshold" not in request.fixturenames:
        monkeypatch.setattr(config, "PAYOUT_APPROVAL_THRESHOLD", Decimal("1000000"))


def _webhook(env, payload):
    raw = json.dumps(payload).encode()
    sig = hmac.new(b"sk_test_dummy", raw, hashlib.sha512).hexdigest()
    return env["client"].post("/api/payments/webhook/paystack", content=raw,
                              headers={"x-paystack-signature": sig, "content-type": "application/json"})


def _wallet(env):
    return env["client"].get("/api/vendors/me/wallet", headers=env["ven"]).json()


def _withdraw(env, amount=None):
    return env["client"].post("/api/vendors/me/withdrawals", headers=env["ven"], json={"amount": amount} if amount else {})


def _settled(env):
    bid = _paid_booking(env)
    assert _complete(env, bid).status_code == 200
    return bid


def test_withdrawal_sends_one_transfer_from_balance(env):
    _settled(env)
    r = _withdraw(env)
    assert r.status_code == 201, r.text
    w = r.json()["withdrawal"]
    assert w["status"] == "processing" and w["amount"] == 104000.0
    assert env["fake"].transfers == [(Decimal("104000.00"), "RCP_123", w["reference"])]
    assert _wallet(env)["balance"] == 0 and _wallet(env)["pending_withdrawal"]["id"] == w["id"]
    # One at a time: a second request while this one is in flight is refused
    assert _withdraw(env).status_code in (400, 409)
    # transfer.success finalises it — delivered twice, still one email
    _webhook(env, {"event": "transfer.success", "data": {"reference": w["reference"]}})
    _webhook(env, {"event": "transfer.success", "data": {"reference": w["reference"]}})
    env["db"].expire_all()
    assert env["db"].get(Withdrawal, w["id"]).status == "paid"
    assert len([c for c in env["calls"] if c[0] == "send_notice_email" and "sent to your bank" in c[1][2]]) == 1
    assert _wallet(env)["pending_withdrawal"] is None


def test_partial_withdrawal_and_limits(env, monkeypatch):
    monkeypatch.setattr(config, "WITHDRAWAL_MINIMUM", Decimal("1000"))
    _settled(env)
    assert _withdraw(env, 500).status_code == 400                     # below minimum
    assert _withdraw(env, 200000).status_code == 400                  # more than the balance
    r = _withdraw(env, 4000)
    assert r.status_code == 201 and r.json()["wallet"]["balance"] == 100000.0


def test_no_bank_account_no_withdrawal(env):
    _settled(env)
    env["vendor"].recipient_code = None
    env["db"].commit()
    r = _withdraw(env)
    assert r.status_code == 400 and "bank" in r.json()["detail"].lower()
    assert env["fake"].transfers == [] and _wallet(env)["balance"] == 104000.0


@pytest.mark.parametrize("event", ["transfer.failed", "transfer.reversed"])
def test_failed_or_reversed_transfer_returns_money_to_wallet(env, event):
    _settled(env)
    w = _withdraw(env).json()["withdrawal"]
    _webhook(env, {"event": event, "data": {"reference": w["reference"], "reason": "Account closed"}})
    _webhook(env, {"event": event, "data": {"reference": w["reference"]}})          # duplicate delivery
    env["db"].expire_all()
    assert env["db"].get(Withdrawal, w["id"]).status == "failed"
    wallet = _wallet(env)
    assert wallet["balance"] == 104000.0 and wallet["can_withdraw"] is True           # returned exactly once
    assert [e["kind"] for e in wallet["entries"]][:2] == ["withdrawal_reversal", "withdrawal"]
    assert wallet["withdrawals"][0]["error"] is None                                  # Paystack's text is staff-only
    assert _withdraw(env).status_code == 201                                          # vendor can try again


def test_reversal_after_success_also_returns_money(env):
    _settled(env)
    w = _withdraw(env).json()["withdrawal"]
    _webhook(env, {"event": "transfer.success", "data": {"reference": w["reference"]}})
    _webhook(env, {"event": "transfer.reversed", "data": {"reference": w["reference"]}})
    assert _wallet(env)["balance"] == 104000.0


def test_paystack_rejection_returns_money_immediately(env):
    _settled(env)
    env["fake"].fail_transfer = True                                   # e.g. "business is inactive"
    r = _withdraw(env)
    assert r.status_code == 201 and r.json()["withdrawal"]["status"] == "failed"
    assert r.json()["wallet"]["balance"] == 104000.0


def test_large_withdrawal_waits_for_admin(env, threshold):
    _settled(env)
    w = _withdraw(env).json()["withdrawal"]
    assert w["status"] == "awaiting_approval" and env["fake"].transfers == []
    assert env["client"].get("/api/admin/overview", headers=env["adm"]).json()["payouts_awaiting_approval"] == 1
    # Only admins can approve
    assert env["client"].post(f"/api/admin/withdrawals/{w['id']}/approve", headers=env["ven"]).status_code == 403
    r = env["client"].post(f"/api/admin/withdrawals/{w['id']}/approve", headers=env["adm"])
    assert r.json()["status"] == "processing"
    assert env["fake"].transfers == [(Decimal("104000.00"), "RCP_123", w["reference"])]
    # Approving twice never pays twice
    assert env["client"].post(f"/api/admin/withdrawals/{w['id']}/approve", headers=env["adm"]).status_code == 409
    assert len(env["fake"].transfers) == 1


def test_admin_rejection_returns_money_with_reason(env, threshold):
    _settled(env)
    w = _withdraw(env).json()["withdrawal"]
    r = env["client"].post(f"/api/admin/withdrawals/{w['id']}/reject", headers=env["adm"], json={"reason": "Confirm your bank details"})
    assert r.json()["status"] == "failed"
    wallet = _wallet(env)
    assert wallet["balance"] == 104000.0 and "Confirm your bank details" in wallet["withdrawals"][0]["error"]


def test_at_threshold_is_automatic(env, monkeypatch, automatic):
    monkeypatch.setattr(config, "PAYOUT_APPROVAL_THRESHOLD", Decimal("104000"))   # exactly equal → automatic
    _settled(env)
    _withdraw(env)
    assert len(env["fake"].transfers) == 1


def test_paystack_otp_is_surfaced_then_reconciled(env):
    env["fake"].transfer_status = "otp"
    _settled(env)
    w = _withdraw(env).json()["withdrawal"]
    env["db"].expire_all()
    row = env["db"].get(Withdrawal, w["id"])
    assert row.status == "awaiting_otp" and "OTP" in row.error
    assert env["client"].get("/api/admin/overview", headers=env["adm"]).json()["payouts_awaiting_otp"] == 1
    # Still waiting → nothing changes; then the OTP is entered and no webhook reaches us
    assert env["client"].post(f"/api/admin/withdrawals/{w['id']}/sync", headers=env["adm"]).json()["status"] == "awaiting_otp"
    env["fake"].transfer_status = "success"
    assert env["client"].post(f"/api/admin/withdrawals/{w['id']}/sync", headers=env["adm"]).json()["status"] == "paid"


def test_background_task_reconciles_stuck_withdrawals(env):
    from app.entities.wallet.service import sync_pending
    _settled(env)
    w = _withdraw(env).json()["withdrawal"]                            # sent, "processing"
    env["fake"].transfer_status = "failed"
    assert sync_pending(env["db"]) == 1
    env["db"].expire_all()
    assert env["db"].get(Withdrawal, w["id"]).status == "failed" and _wallet(env)["balance"] == 104000.0


def test_escrow_counts_wallets_until_money_leaves(env):
    bid = _paid_booking(env)
    o = env["client"].get("/api/admin/overview", headers=env["adm"]).json()
    assert o["escrow_held"] == 117875.0 and o["platform_earnings"] == 0

    _complete(env, bid)                                                # credited to the wallet
    o = env["client"].get("/api/admin/overview", headers=env["adm"]).json()
    assert o["escrow_held"] == 104000.0 and o["wallet_balances"] == 104000.0
    assert o["platform_earnings"] == 13875.0                           # 11,000 commission + 2,875 customer fee

    w = _withdraw(env).json()["withdrawal"]
    assert env["client"].get("/api/admin/overview", headers=env["adm"]).json()["escrow_held"] == 104000.0   # in flight
    _webhook(env, {"event": "transfer.success", "data": {"reference": w["reference"]}})
    o = env["client"].get("/api/admin/overview", headers=env["adm"]).json()
    assert o["escrow_held"] == 0 and o["platform_earnings"] == 13875.0


def test_legacy_failed_transfer_moves_into_wallet(env):
    """A per-booking transfer sent before the wallet existed fails → it lands in the wallet instead."""
    bid = _settled(env)
    b = env["db"].get(Booking, bid)
    from app.entities.wallet.model import WalletEntry
    env["db"].query(WalletEntry).delete()
    b.payout_status, b.payout_reference, b.payout_paid_at, b.payout_statement_number = "processing", f"PLG-PAYOUT-{bid}", None, None
    env["db"].commit()
    _webhook(env, {"event": "transfer.failed", "data": {"reference": f"PLG-PAYOUT-{bid}"}})
    env["db"].expire_all()
    assert env["db"].get(Booking, bid).payout_status == "credited" and _wallet(env)["balance"] == 104000.0


def test_vendor_with_balance_cannot_delete_account(env):
    _settled(env)
    r = env["client"].post("/api/account/delete", headers=env["ven"], json={"password": "Passw0rd!"})
    assert r.status_code == 409 and "wallet" in r.json()["detail"]
