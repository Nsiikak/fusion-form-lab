"""Add-ons after booking, countdown timing for late bookings, admin KPIs and reports, occasions.
Run: pytest -q   (fixture booking: vendor price ₦115,000, customer paid ₦117,875)"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.entities.booking.addon import BookingAddon
from app.entities.booking.model import Booking
from app.entities.booking.trust import TrustService
from tests.test_payments import _credited, _complete, _paid_booking, _status, env  # noqa: F401

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _b(env, bid):
    env["db"].expire_all()
    return env["db"].get(Booking, bid)


def _confirmed(env, days_out=10, paid_hours_ago=72):
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    b = env["db"].get(Booking, bid)
    b.event_date = NOW() + timedelta(days=days_out)
    b.paid_at = NOW() - timedelta(hours=paid_hours_ago)
    env["db"].commit()
    return bid


# ── Countdown: no "one week to go" for an event 36 hours away ──────────────

def test_late_booking_gets_only_the_stage_that_fits(env):
    bid = _confirmed(env, days_out=1.5)
    before = len(env["calls"])
    sent = TrustService.run_countdown(env["db"])
    assert sent["t7"] == 0 and sent["t2"] == 1
    assert len(env["calls"]) - before == 2                         # customer + vendor, once
    assert _b(env, bid).reminders["t7"] == "skipped"
    assert TrustService.run_countdown(env["db"])["t2"] == 0        # never repeated


def test_same_day_booking_gets_only_the_day_reminder(env):
    bid = _confirmed(env, days_out=0.2)
    sent = TrustService.run_countdown(env["db"])
    assert sent == {"t7": 0, "chase": 0, "t2": 0, "day": 1}
    r = _b(env, bid).reminders
    assert r["t7"] == r["t2"] == "skipped"


# ── Add-ons ────────────────────────────────────────────────────────────────

def _propose(env, bid, price="10000", qty=2):
    return env["client"].post(f"/api/bookings/{bid}/addons", headers=env["ven"],
                              json={"items": [{"name": "Extra small chops tray", "quantity": qty, "unit_price": price}],
                                    "note": "For the extra 30 guests"})


def _pay_addon(env, bid, aid):
    co = env["client"].post(f"/api/bookings/{bid}/addons/{aid}/checkout", headers=env["cust"]).json()
    env["fake"].pay(co["reference"], co["amount_kobo"])
    return env["client"].post(f"/api/bookings/{bid}/addons/{aid}/verify", headers=env["cust"])


def test_vendor_proposes_customer_pays_and_booking_grows(env):
    bid = _confirmed(env)
    assert env["client"].post(f"/api/bookings/{bid}/addons", headers=env["cust"],
                              json={"items": [{"name": "x", "quantity": 1, "unit_price": "100"}]}).status_code == 403
    a = _propose(env, bid).json()
    assert a["amount"] == 20000 and a["platform_fee"] == 500 and a["customer_total"] == 20500 and a["status"] == "proposed"
    assert any(c[0] == "send_notice_email" and "add-on" in c[1][2].lower() for c in env["calls"])
    r = _pay_addon(env, bid, a["id"])
    assert r.status_code == 200 and r.json()["status"] == "paid"
    b = _b(env, bid)
    assert b.price == Decimal("135000.00") and b.customer_total == Decimal("138375.00")
    assert b.payout_amount == Decimal("122000.00")                 # 135,000 − 10% of 130,000 (no commission on delivery)
    assert any(i.get("addon") for i in b.service_items_snapshot)
    # confirming again changes nothing; a second checkout is refused
    env["client"].post(f"/api/bookings/{bid}/addons/{a['id']}/verify", headers=env["cust"])
    assert _b(env, bid).price == Decimal("135000.00")
    assert env["client"].post(f"/api/bookings/{bid}/addons/{a['id']}/checkout", headers=env["cust"]).status_code == 400
    # payout at completion includes the add-on
    b.event_date = NOW() - timedelta(hours=1)
    env["db"].commit()
    _complete(env, bid)
    assert _credited(env)[-1][0] == Decimal("122000.00")


def test_webhook_confirms_addon(env):
    import hashlib, hmac, json
    bid = _confirmed(env)
    a = _propose(env, bid).json()
    co = env["client"].post(f"/api/bookings/{bid}/addons/{a['id']}/checkout", headers=env["cust"]).json()
    raw = json.dumps({"event": "charge.success", "data": {"reference": co["reference"], "status": "success",
                                                         "amount": co["amount_kobo"]}}).encode()
    sig = hmac.new(b"sk_test_dummy", raw, hashlib.sha512).hexdigest()
    env["client"].post("/api/payments/webhook/paystack", content=raw,
                       headers={"x-paystack-signature": sig, "content-type": "application/json"})
    assert _b(env, bid).price == Decimal("135000.00")


def test_refunds_cover_addon_payments(env):
    bid = _confirmed(env)
    a = _propose(env, bid).json()
    _pay_addon(env, bid, a["id"])
    env["client"].post(f"/api/bookings/{bid}/vendor-cancel", headers=env["ven"], json={"reason": "Equipment failure"})
    refs = env["fake"].refunds
    assert len(refs) == 2 and any(r.startswith("PLG-ADD-") for r in refs)    # original + add-on, both in full


def test_partial_refund_is_split_across_payments(env):
    bid = _confirmed(env, days_out=10)                             # standard policy → 50%
    a = _propose(env, bid).json()
    _pay_addon(env, bid, a["id"])
    env["client"].post(f"/api/bookings/{bid}/cancel", headers=env["cust"], json={})
    amounts = [x for x in env["fake"].refund_amounts if x is not None]
    assert sum(amounts) == Decimal("67500.00")                     # 50% of 135,000, across both payments
    assert len(amounts) == 2


def test_decline_and_withdraw(env):
    bid = _confirmed(env)
    a1 = _propose(env, bid).json()
    assert env["client"].post(f"/api/bookings/{bid}/addons/{a1['id']}/decline", headers=env["cust"]).json()["status"] == "declined"
    a2 = _propose(env, bid).json()
    assert env["client"].post(f"/api/bookings/{bid}/addons/{a2['id']}/withdraw", headers=env["ven"]).json()["status"] == "withdrawn"
    assert env["client"].post(f"/api/bookings/{bid}/addons/{a2['id']}/checkout", headers=env["cust"]).status_code == 400
    assert len(env["client"].get(f"/api/bookings/{bid}/addons", headers=env["cust"]).json()) == 2


# ── Admin KPIs and reports ─────────────────────────────────────────────────

def test_metrics_and_reports(env):
    b1, b2 = _paid_booking(env), _paid_booking(env)
    _status(env, b2, "declined", "ven")
    m = env["client"].get("/api/admin/metrics?days=30", headers=env["adm"]).json()
    k = m["kpis"]
    assert k["paid_bookings"] == 2 and k["gmv"] == 230000 and k["average_booking_value"] == 115000
    assert k["unique_customers"] == 1 and k["acceptance_rate_pct"] == 0.0
    assert k["revenue"] == 13875.0                                  # b1 only: 11,000 commission + 2,875 fee
    assert m["series"] and m["period"]["unit"] == "day"
    pdf = env["client"].get("/api/admin/metrics/report?format=pdf&days=30", headers=env["adm"])
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    csv = env["client"].get("/api/admin/metrics/report?format=csv&all_time=true", headers=env["adm"])
    assert "Average booking value" in csv.text and csv.headers["content-type"].startswith("text/csv")
    assert env["client"].get("/api/admin/metrics", headers=env["cust"]).status_code == 403


# ── Occasions on events ────────────────────────────────────────────────────

def test_event_type_and_checklist(env):
    c = env["client"]
    e = c.post("/api/events", headers=env["cust"], json={"name": "Ada & Tunde's wedding", "date": "2027-04-24",
                                                         "location": "Lekki", "event_type": "wedding"}).json()
    assert e["event_type"] == "wedding"
    u = c.put(f"/api/events/{e['id']}", headers=env["cust"], json={"checklist": {"set-budget": True, "book-venue": True}}).json()
    assert u["checklist"] == {"set-budget": True, "book-venue": True}
