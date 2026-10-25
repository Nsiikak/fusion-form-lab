"""Payment confirmation robustness, phone at checkout, profile updates, vendor removals."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.entities.booking.model import Booking, BookingStatus
from app.entities.vendor.incident import VendorIncident
from tests.test_payments import _status, env  # noqa: F401

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _checkout(env):
    return env["client"].post("/api/bookings", headers=env["cust"], json={
        "vendor_id": env["vendor"].id, "event_date": (NOW() + timedelta(days=30)).isoformat()}).json()


def test_paystack_reference_from_browser_is_accepted_when_it_matches(env):
    co = _checkout(env)
    # Paystack used its own reference; ours is unknown to it
    env["fake"].transactions["PSK-OWN-123"] = {"status": "success", "reference": "PSK-OWN-123", "amount": co["amount_kobo"],
                                               "currency": "NGN", "customer": {"email": "c@x.com"}}
    r = env["client"].post(f"/api/bookings/{co['booking_id']}/verify-payment", headers=env["cust"], json={"reference": "PSK-OWN-123"})
    assert r.status_code == 200
    env["db"].expire_all()
    b = env["db"].get(Booking, co["booking_id"])
    assert b.paid_at and b.payment_reference == "PSK-OWN-123"


def test_browser_reference_rejected_if_amount_or_payer_differs(env):
    co = _checkout(env)
    env["fake"].transactions["PSK-CHEAP"] = {"status": "success", "reference": "PSK-CHEAP", "amount": 100, "currency": "NGN",
                                             "customer": {"email": "c@x.com"}}
    env["fake"].transactions["PSK-OTHER"] = {"status": "success", "reference": "PSK-OTHER", "amount": co["amount_kobo"],
                                             "currency": "NGN", "customer": {"email": "someone@else.com"}}
    for ref in ("PSK-CHEAP", "PSK-OTHER"):
        r = env["client"].post(f"/api/bookings/{co['booking_id']}/verify-payment", headers=env["cust"], json={"reference": ref})
        assert r.status_code == 402
    env["db"].expire_all()
    assert env["db"].get(Booking, co["booking_id"]).paid_at is None


def test_background_reconcile_picks_up_missed_payments(env):
    from app.entities.booking.service import BookingService
    co = _checkout(env)
    env["fake"].pay(co["reference"], co["amount_kobo"])          # paid at Paystack, browser never came back
    assert BookingService.reconcile_unpaid(env["db"]) == 1
    env["db"].expire_all()
    assert env["db"].get(Booking, co["booking_id"]).status == BookingStatus.PENDING


def test_phone_required_at_checkout_and_profile_update(env):
    c = env["client"]
    env["customer"].phone_number = None; env["db"].commit()
    r = c.post("/api/bookings", headers=env["cust"], json={"vendor_id": env["vendor"].id, "event_date": (NOW() + timedelta(days=30)).isoformat()})
    assert r.status_code == 400 and "phone number" in r.json()["detail"]
    assert c.patch("/api/auth/me", headers=env["cust"], json={"phone_number": "12345"}).status_code == 400
    ok = c.patch("/api/auth/me", headers=env["cust"], json={"phone_number": "+234 803 111 2222"}).json()
    assert ok["phone_number"] == "08031112222"
    assert _checkout(env)["booking_id"]


def test_vendor_removal_needs_reason_and_is_recorded(env):
    from tests.test_phase4 import _booking_with_items
    bid = _booking_with_items(env, days_out=1)
    lines = {"lines": [{"index": 0, "quantity": 10}]}
    assert env["client"].post(f"/api/bookings/{bid}/reductions", headers=env["ven"], json=lines).status_code == 400
    r = env["client"].post(f"/api/bookings/{bid}/reductions", headers=env["ven"], json={**lines, "reason": "Supplier ran out of goat meat"})
    assert r.status_code == 200
    inc = env["db"].query(VendorIncident).filter(VendorIncident.kind == "item_removed").one()
    assert inc.severity == "strike"                                # within 48 hours of the event
