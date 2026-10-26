"""Admin dashboard: vendor verification, disputes and case resolution. Run: pytest -q"""
from datetime import datetime, timedelta, timezone

from app.entities.booking.model import Booking, BookingStatus
from app.entities.booking.service import BookingService
from app.entities.vendor.model import VerificationStatus
from tests.test_payments import _credited, FUTURE, _complete, _paid_booking, _status, env  # noqa: F401


def _past_event(env, bid):
    b = env["db"].get(Booking, bid)
    b.event_date = datetime.now(timezone.utc) - timedelta(hours=1)
    env["db"].commit()


def _awaiting_confirmation(env):
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    _past_event(env, bid)
    assert _status(env, bid, "awaiting_confirmation", "ven").status_code == 200
    return bid


def _dispute(env, bid, reason="The caterer never showed up to the venue."):
    return env["client"].post(f"/api/bookings/{bid}/dispute", json={"reason": reason}, headers=env["cust"])


# ── Access ───────────────────────────────────────────────────────────────────

def test_admin_routes_reject_non_admins(env):
    for who in ("cust", "ven"):
        assert env["client"].get("/api/admin/overview", headers=env[who]).status_code == 403
        assert env["client"].get("/api/admin/cases", headers=env[who]).status_code == 403
    assert env["client"].get("/api/admin/overview").status_code == 401


# ── Vendor verification ──────────────────────────────────────────────────────

def test_pending_vendor_queue_and_approval(env):
    env["vendor"].verification_status = VerificationStatus.PENDING
    env["db"].commit()
    c = env["client"]
    assert c.get("/api/admin/overview", headers=env["adm"]).json()["vendors_pending"] == 1
    queue = c.get("/api/admin/vendors?status=pending", headers=env["adm"]).json()
    assert [v["business_name"] for v in queue["vendors"]] == ["Chop Life"]
    assert queue["vendors"][0]["has_bank_account"] is True
    assert "account_number" not in queue["vendors"][0]

    r = c.post(f"/api/admin/vendors/{env['vendor'].id}/verification", json={"decision": "approved"}, headers=env["adm"])
    assert r.status_code == 200 and r.json()["verification_status"] == "approved"
    assert r.json()["auto_verified"] is False
    assert c.post("/api/bookings/quote", json={"vendor_id": env["vendor"].id}).status_code == 200


def test_rejection_requires_reason_and_blocks_booking(env):
    c, vid = env["client"], env["vendor"].id
    r = c.post(f"/api/admin/vendors/{vid}/verification", json={"decision": "rejected"}, headers=env["adm"])
    assert r.status_code == 400
    r = c.post(f"/api/admin/vendors/{vid}/verification",
               json={"decision": "rejected", "note": "RC number doesn't match the business name."}, headers=env["adm"])
    assert r.json()["verification_status"] == "rejected"
    assert c.post("/api/bookings/quote", json={"vendor_id": vid}).status_code == 400


def test_suspend_hides_vendor_and_blocks_booking(env):
    c, vid = env["client"], env["vendor"].id
    assert c.post(f"/api/admin/vendors/{vid}/active", json={"is_active": False}, headers=env["adm"]).status_code == 400
    r = c.post(f"/api/admin/vendors/{vid}/active",
               json={"is_active": False, "note": "Multiple no-show complaints"}, headers=env["adm"])
    assert r.json()["is_active"] is False
    assert c.post("/api/bookings/quote", json={"vendor_id": vid}).status_code == 400
    suspended = c.get("/api/admin/vendors?status=suspended", headers=env["adm"]).json()["vendors"]
    assert [v["id"] for v in suspended] == [vid]
    c.post(f"/api/admin/vendors/{vid}/active", json={"is_active": True}, headers=env["adm"])
    assert c.post("/api/bookings/quote", json={"vendor_id": vid}).status_code == 200


# ── Disputes ─────────────────────────────────────────────────────────────────

def test_cannot_dispute_before_event(env):
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    assert _dispute(env, bid).status_code == 400


def test_vendor_no_show_can_be_disputed_after_event_date(env):
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    _past_event(env, bid)
    r = _dispute(env, bid)
    assert r.status_code == 200 and r.json()["status"] == "disputed"


def test_dispute_freezes_auto_release(env):
    bid = _awaiting_confirmation(env)
    assert _dispute(env, bid, "short").status_code == 422          # reason too short
    assert _dispute(env, bid).status_code == 200
    b = env["db"].get(Booking, bid)
    b.vendor_confirmed_at = datetime.now(timezone.utc) - timedelta(days=3)
    env["db"].commit()
    assert BookingService.auto_release_expired_bookings(env["db"]) == 0
    assert env["fake"].transfers == []
    # Customer can no longer release it themselves either
    assert _status(env, bid, "completed", "cust").status_code == 400
    # Vendor sees the reason
    ven = env["client"].get(f"/api/bookings/{bid}", headers=env["ven"]).json()
    assert ven["status"] == "disputed" and "never showed up" in ven["dispute_reason"]


def test_resolve_dispute_with_refund(env):
    bid = _awaiting_confirmation(env)
    _dispute(env, bid)
    cases = env["client"].get("/api/admin/cases", headers=env["adm"]).json()
    assert cases[0]["case_type"] == "dispute" and cases[0]["vendor_email"] == "v@x.com"
    r = env["client"].post(f"/api/admin/bookings/{bid}/resolve", headers=env["adm"],
                           json={"outcome": "refund", "note": "Vendor confirmed they could not attend."})
    assert r.json()["status"] == "cancelled" and r.json()["refund_status"] == "processing"
    assert len(env["fake"].refunds) == 1 and env["fake"].transfers == []
    assert env["client"].get("/api/admin/cases", headers=env["adm"]).json() == []
    history = env["client"].get("/api/admin/cases/history", headers=env["adm"]).json()
    assert history[0]["resolution"] == "refund"
    cust = env["client"].get(f"/api/bookings/{bid}", headers=env["cust"]).json()
    assert cust["resolution_note"] == "Vendor confirmed they could not attend."


def test_resolve_dispute_with_release_pays_vendor_once(env):
    bid = _awaiting_confirmation(env)
    _dispute(env, bid)
    body = {"outcome": "release", "note": "Photos show the service was delivered."}
    r = env["client"].post(f"/api/admin/bookings/{bid}/resolve", headers=env["adm"], json=body)
    assert r.json()["status"] == "completed" and r.json()["payout_status"] == "credited"
    again = env["client"].post(f"/api/admin/bookings/{bid}/resolve", headers=env["adm"], json=body)
    assert again.status_code == 400
    assert len(_credited(env)) == 1 and env["fake"].refunds == []


def test_late_cancellation_release_declines_refund(env):
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    b = env["db"].get(Booking, bid); b.paid_at = datetime.now(timezone.utc) - timedelta(days=3); env["db"].commit()
    env["client"].post(f"/api/bookings/{bid}/cancel", headers=env["cust"], json={"request_review": True})
    r = env["client"].post(f"/api/admin/bookings/{bid}/resolve", headers=env["adm"],
                           json={"outcome": "release", "note": "Cancelled the day before; vendor had bought stock."})
    assert r.json()["refund_status"] == "declined" and r.json()["status"] == "cancelled"
    assert len(_credited(env)) == 1


def test_failed_refund_shows_up_and_can_be_retried(env):
    bid = _paid_booking(env)
    real_refund = env["fake"].refund
    def boom(*a, **k):
        from app.services.paystack import PaystackError
        raise PaystackError("Refund window closed")
    env["fake"].refund = boom
    _status(env, bid, "declined", "ven")
    cases = env["client"].get("/api/admin/cases", headers=env["adm"]).json()
    assert [(c["id"], c["case_type"]) for c in cases] == [(bid, "failed_refund")]
    env["fake"].refund = real_refund
    r = env["client"].post(f"/api/admin/bookings/{bid}/retry-refund", headers=env["adm"])
    assert r.json()["refund_status"] == "processing"


def test_overview_counts_escrow(env):
    bid = _awaiting_confirmation(env)
    _dispute(env, bid)
    o = env["client"].get("/api/admin/overview", headers=env["adm"]).json()
    assert o["open_disputes"] == 1 and o["escrow_held"] == 117875.0
