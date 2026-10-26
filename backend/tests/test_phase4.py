"""Delivery by state, flexible service items, mobilisation advance, reductions, event-date guard,
new categories. Run: pytest -q"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.entities.booking.model import Booking, BookingStatus
from app.entities.service_item.model import ServiceItem
from app.entities.vendor.incident import VendorIncident
from tests.test_payments import _credited, _paid_booking, _status, env  # noqa: F401

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _quote(env, **kw):
    return env["client"].post("/api/bookings/quote", headers=env["cust"], json={"vendor_id": env["vendor"].id, **kw})


def _b(env, bid):
    env["db"].expire_all()
    return env["db"].get(Booking, bid)


# ── Delivery by state ─────────────────────────────────────────────────────

def test_delivery_fee_by_state(env):
    v = env["vendor"]; v.base_state = "Lagos"; env["db"].commit()
    assert _quote(env, event_state="Lagos").json()["logistics_fee"] == 5000
    r = _quote(env, event_state="Ogun")
    assert r.status_code == 400 and "only serves events in Lagos" in r.json()["detail"]
    v.interstate_mode = "flat"; v.interstate_fee = Decimal("40000"); env["db"].commit()
    q = _quote(env, event_state="Ogun").json()
    assert q["logistics_fee"] == 40000 and q["delivery_note"] == "Logistics to Ogun"
    v.interstate_mode = "per_state"; v.state_fees = {"FCT": 150000}; env["db"].commit()
    assert _quote(env, event_state="FCT").json()["logistics_fee"] == 150000
    assert _quote(env, event_state="Oyo").json()["logistics_fee"] == 40000     # falls back to the flat fee


def test_no_commission_on_delivery(env):
    bid = _paid_booking(env)
    b = _b(env, bid)
    assert b.commission_amount == Decimal("11000.00") and b.payout_amount == Decimal("104000.00")


# ── Flexible service items ─────────────────────────────────────────────────

def _item(env, **kw):
    it = ServiceItem(vendor_id=env["vendor"].id, name=kw.pop("name", "Item"), unit_label=kw.pop("unit_label", "each"), **kw)
    env["db"].add(it); env["db"].commit(); return it


def test_item_types_and_quantities(env):
    plates = _item(env, name="Jollof", unit_price=Decimal("3000"), unit_label="per plate", min_quantity=50, max_quantity=500)
    gold = _item(env, name="Gold package", unit_price=Decimal("250000"), pricing_type="package", included=["Setup", "2 servers"])
    custom = _item(env, name="Custom cake", unit_price=Decimal("0"), pricing_type="quote")
    q = lambda items: _quote(env, service_items=items)  # noqa: E731
    assert "at least 50" in q([{"service_item_id": plates.id, "quantity": 10}]).json()["detail"]
    assert "at most 500" in q([{"service_item_id": plates.id, "quantity": 600}]).json()["detail"]
    assert "on request" in q([{"service_item_id": custom.id, "quantity": 1}]).json()["detail"]
    r = q([{"service_item_id": plates.id, "quantity": 100, "note": "Less pepper please"},
           {"service_item_id": gold.id, "quantity": 7}]).json()
    assert r["items_total"] == 300000 + 250000                       # package is always one
    assert r["items"][0]["note"] == "Less pepper please" and r["items"][1]["quantity"] == 1


def test_service_item_api_accepts_new_fields(env):
    c = env["client"]
    r = c.post("/api/service-items", headers=env["ven"], json={"name": "Cocktail bar", "pricing_type": "quote"})
    assert r.status_code in (200, 201), r.text
    bad = c.post("/api/service-items", headers=env["ven"], json={"name": "Free stuff", "pricing_type": "unit", "unit_price": 0})
    assert bad.status_code == 422


# ── Mobilisation advance ────────────────────────────────────────────────────

def _make_eligible(env):
    v = env["vendor"]; v.advance_mode = "logistics_plus"; v.advance_percent = 20
    v.created_at = NOW() - timedelta(days=90); env["db"].commit()
    for _ in range(5):
        bid = _paid_booking(env)
        b = _b(env, bid); b.status = BookingStatus.COMPLETED
        env["db"].commit()


def test_no_advance_without_track_record(env):
    env["vendor"].advance_mode = "logistics"; env["db"].commit()
    assert _quote(env).json()["advance_amount"] == 0


def test_advance_released_at_reconfirm_and_deducted_from_payout(env):
    _make_eligible(env)
    q = _quote(env).json()
    assert q["advance_amount"] == 5000 + 22000                        # delivery + 20% of 110,000
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    b = _b(env, bid); b.event_date = NOW() + timedelta(days=5); env["db"].commit()
    env["client"].post(f"/api/bookings/{bid}/reconfirm", headers=env["ven"])
    assert _b(env, bid).advance_status is None                       # too early: 5 days out
    b = _b(env, bid); b.event_date = NOW() + timedelta(days=2); env["db"].commit()
    from app.entities.booking.trust import TrustService
    TrustService.run_countdown(env["db"])                            # released by the countdown job
    b = _b(env, bid)
    assert b.advance_status == "paid" and _credited(env, "advance") == [(Decimal("27000.00"), bid)]
    # complete → only the rest is paid out
    b.event_date = NOW() - timedelta(hours=2); env["db"].commit()
    _status(env, bid, "awaiting_confirmation", "ven")
    _status(env, bid, "completed", "cust")
    assert _credited(env)[-1][0] == Decimal("77000.00")               # 104,000 − 27,000
    assert env["fake"].transfers == []                                # both sit in the wallet until withdrawn


def test_vendor_cancel_after_advance_creates_debt(env):
    _make_eligible(env)
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    b = _b(env, bid); b.event_date = NOW() + timedelta(days=2); b.paid_at = NOW() - timedelta(days=3); env["db"].commit()
    env["client"].post(f"/api/bookings/{bid}/reconfirm", headers=env["ven"])
    env["client"].post(f"/api/bookings/{bid}/vendor-cancel", headers=env["ven"], json={"reason": "Van broke down"})
    debt = env["db"].query(VendorIncident).filter(VendorIncident.kind == "advance_recovery").one()
    assert debt.fee_remaining == Decimal("27000.00")


# ── Reductions ──────────────────────────────────────────────────────────────

def _booking_with_items(env, days_out=10):
    plates = _item(env, name="Jollof", unit_price=Decimal("3000"), unit_label="per plate")
    co = env["client"].post("/api/bookings", headers=env["cust"], json={
        "vendor_id": env["vendor"].id, "event_date": (NOW() + timedelta(days=30)).isoformat(),
        "service_items": [{"service_item_id": plates.id, "quantity": 100}]}).json()
    env["fake"].pay(co["reference"], co["amount_kobo"])
    env["client"].post(f"/api/bookings/{co['booking_id']}/verify-payment", headers=env["cust"])
    bid = co["booking_id"]
    _status(env, bid, "confirmed", "ven")
    b = _b(env, bid); b.event_date = NOW() + timedelta(days=days_out); b.paid_at = NOW() - timedelta(days=3); env["db"].commit()
    return bid


def test_customer_reduction_follows_policy(env):
    bid = _booking_with_items(env, days_out=10)            # standard policy → 50%
    before = _b(env, bid)
    before_price, before_total = before.price, before.customer_total
    lines = {"lines": [{"index": 0, "quantity": 20}]}       # 20 plates = 60,000
    p = env["client"].post(f"/api/bookings/{bid}/reductions/preview", headers=env["cust"], json=lines).json()
    assert p["amount_removed"] == 60000 and p["refund_pct"] == 50 and p["refund_amount"] == 30000 and p["vendor_keeps"] == 30000
    r = env["client"].post(f"/api/bookings/{bid}/reductions", headers=env["cust"], json=lines)
    assert r.status_code == 200 and env["fake"].refund_amounts[-1] == Decimal("30000.00")
    b = _b(env, bid)
    assert b.service_items_snapshot[0]["quantity"] == 80
    assert b.price == before_price - Decimal("30000") and b.customer_total == before_total - Decimal("30000")
    assert before_price == Decimal("305000.00")             # 300,000 items + 5,000 logistics (no service fee)


def test_vendor_removal_refunds_in_full_and_cannot_remove_everything(env):
    bid = _booking_with_items(env)
    p = env["client"].post(f"/api/bookings/{bid}/reductions/preview", headers=env["ven"], json={"lines": [{"index": 0, "quantity": 10}]}).json()
    assert p["refund_pct"] == 100 and p["refund_amount"] == 30750               # 30,000 + 2.5% fee
    all_out = env["client"].post(f"/api/bookings/{bid}/reductions/preview", headers=env["cust"], json={"lines": [{"index": 0, "quantity": 100}]})
    assert all_out.status_code == 400 and "Cancel the booking" in all_out.json()["detail"]


# ── Event-date guard, categories ───────────────────────────────────────────

def test_cannot_book_before_the_event_date(env):
    c = env["client"]
    e = c.post("/api/events", headers=env["cust"], json={"name": "Wedding", "date": (NOW() + timedelta(days=60)).date().isoformat(),
                                                         "location": "Lagos", "event_type": "wedding"}).json()
    r = c.post("/api/bookings", headers=env["cust"], json={"vendor_id": env["vendor"].id, "event_id": e["id"],
                                                          "event_date": (NOW() + timedelta(days=30)).isoformat()})
    assert r.status_code == 400 and "pick that date or later" in r.json()["detail"]
    ok = c.post("/api/bookings", headers=env["cust"], json={"vendor_id": env["vendor"].id, "event_id": e["id"],
                                                           "event_date": (NOW() + timedelta(days=60, hours=2)).isoformat()})
    assert ok.status_code == 201


def test_new_categories(env):
    from app.entities.vendor.model import VendorCategory
    assert {"cakes", "drinks", "beauty", "fashion", "planning", "rentals", "sound_lighting", "souvenirs", "ushers_security"} <= {c.value for c in VendorCategory}


def test_share_advance_needs_stronger_track_record(env):
    v = env["vendor"]; v.advance_mode = "logistics_plus"; v.advance_percent = 20; env["db"].commit()
    for _ in range(3):
        bid = _paid_booking(env); b = _b(env, bid); b.status = BookingStatus.COMPLETED; env["db"].commit()
    assert _quote(env).json()["advance_amount"] == 5000              # only logistics until 5 bookings + 60 days


def test_advance_caps(env):
    _make_eligible(env)
    v = env["vendor"]; v.logistics_fee = Decimal("400000"); env["db"].commit()
    assert _quote(env).json()["advance_amount"] == 150000            # per-booking cap
