"""Payment-flow tests. Run from backend/:  pytest -q

Needs a throwaway Postgres database (override with DATABASE_URL). Paystack is faked, so no network.
"""
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal


import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.services.email as email_module  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import create_access_token, get_password_hash  # noqa: E402
from app.entities.booking.model import Booking, BookingStatus  # noqa: E402
from app.entities.booking.addon import BookingAddon  # noqa: F401  (create_all needs the table)
from app.entities.service_item.model import ServiceItem  # noqa: E402
from app.entities.user.model import User, UserRole  # noqa: E402
from app.entities.vendor.model import BusinessSize, Vendor, VendorCategory, VerificationStatus  # noqa: E402
from app.services import paystack as paystack_module  # noqa: E402
from app.services.pricing import to_kobo  # noqa: E402
from main import app  # noqa: E402

FUTURE = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()


class FakePaystack:
    def __init__(self):
        self.transactions = {}   # reference -> data
        self.transfers = []
        self.refunds = []
        self.fail_transfer = False
        self.transfer_status = "pending"

    def pay(self, reference, amount_kobo, currency="NGN"):
        self.transactions[reference] = {
            "status": "success", "reference": reference, "amount": amount_kobo, "currency": currency,
        }

    def verify_transaction(self, reference):
        if reference not in self.transactions:
            return {"status": "abandoned", "reference": reference, "amount": 0}
        return self.transactions[reference]

    def initiate_transfer(self, amount, recipient_code, reference, reason):
        if self.fail_transfer:
            raise paystack_module.PaystackError("Insufficient balance")
        self.transfers.append((Decimal(amount), recipient_code, reference))
        return {"status": self.transfer_status}

    def verify_transfer(self, reference):
        return {"status": self.transfer_status, "reference": reference}

    refund_response = {"id": 991, "status": "pending"}
    resolved_name = "ADA OKAFOR"

    def refund(self, reference, reason="", amount=None):
        self.refunds.append(reference)
        self.refund_amounts = getattr(self, "refund_amounts", []) + [amount]
        return dict(self.refund_response)

    def retry_refund_with_details(self, refund_id, account_number, bank_code):
        self.refund_retries = getattr(self, "refund_retries", []) + [(refund_id, account_number, bank_code)]
        return {"status": "processing"}

    def resolve_account_number(self, account_number, bank_code):
        if account_number == "0000000000":
            return {"status": False, "paystack_message": "Could not resolve account name"}
        return {"status": True, "data": {"account_name": self.resolved_name, "account_number": account_number}}

    def verify_webhook_signature(self, raw, sig):
        return paystack_module.PaystackService().verify_webhook_signature(raw, sig)


@pytest.fixture()
def env(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    fake = FakePaystack()
    for mod in ("app.entities.booking.service", "app.routers.booking", "app.routers.payments", "app.routers.account", "app.entities.booking.addons_service", "app.entities.booking.reductions"):
        monkeypatch.setattr(f"{mod}.paystack_service", fake)
    sent = []
    monkeypatch.setattr(email_module, "_send", lambda *a, **k: sent.append(a) or True)
    def record(fn, *a, **k):
        sent.append(fn.__name__)
        env_calls.append((fn.__name__, a, k))
    env_calls = []
    monkeypatch.setattr("app.entities.booking.notifications._fire_and_forget", record)
    monkeypatch.setattr("app.services.email._fire_and_forget", record)

    db = SessionLocal()
    pw = get_password_hash("Passw0rd!")
    customer = User(email="c@x.com", hashed_password=pw, role=UserRole.CUSTOMER, full_name="Ada Okafor", phone_number="08031112222")
    vendor_user = User(email="v@x.com", hashed_password=pw, role=UserRole.VENDOR, full_name="Ven")
    admin = User(email="a@x.com", hashed_password=pw, role=UserRole.ADMIN)
    db.add_all([customer, vendor_user, admin])
    db.commit()
    vendor = Vendor(
        user_id=vendor_user.id, business_name="Chop Life", contact_name="Ven",
        category=VendorCategory.CATERING, location="Lagos", business_size=BusinessSize.SMALL,
        starting_price=Decimal("110000"),
        logistics_fee=Decimal("5000"), verification_status=VerificationStatus.APPROVED,
        is_active=True, recipient_code="RCP_123",
    )
    db.add(vendor)
    db.commit()

    def headers(user):
        return {"Authorization": f"Bearer {create_access_token({'sub': user.email})}"}

    ctx = dict(
        client=TestClient(app), db=db, fake=fake, sent=sent, vendor=vendor,
        cust=headers(customer), ven=headers(vendor_user), adm=headers(admin), calls=env_calls,
        customer=customer, headers=headers,
    )
    yield ctx
    db.close()


def _checkout(env, items=None):
    body = {"vendor_id": env["vendor"].id, "event_date": FUTURE}
    if items:
        body["service_items"] = items
    r = env["client"].post("/api/bookings", json=body, headers=env["cust"])
    assert r.status_code == 201, r.text
    return r.json()


def _paid_booking(env):
    co = _checkout(env)
    env["fake"].pay(co["reference"], co["amount_kobo"])
    r = env["client"].post(f"/api/bookings/{co['booking_id']}/verify-payment", headers=env["cust"])
    assert r.status_code == 200, r.text
    return co["booking_id"]


def _status(env, bid, new, who):
    return env["client"].put(f"/api/bookings/{bid}/status?new_status={new}", headers=env[who])


# ── Pricing ──────────────────────────────────────────────────────────────────

def _add_item(env, price="12500"):
    item = ServiceItem(vendor_id=env["vendor"].id, name="Jollof tray", unit_price=Decimal(price), unit_label="tray")
    env["db"].add(item)
    env["db"].commit()
    return item


def test_fixed_rate_vendor_is_charged_base_rate(env):
    # No service items (e.g. a DJ): base rate is the price
    q = env["client"].post("/api/bookings/quote", json={"vendor_id": env["vendor"].id}).json()
    assert q["base_price"] == 110000
    assert q["vendor_total"] == 115000          # 110,000 + 5,000 logistics (no separate service fee)


def test_menu_vendor_charges_items_only_and_hides_commission(env):
    item = _add_item(env)
    r = env["client"].post("/api/bookings/quote", json={
        "vendor_id": env["vendor"].id,
        "service_items": [{"service_item_id": item.id, "quantity": 2}],
    })
    q = r.json()
    # items 25,000 (base rate NOT charged) + 5,000 logistics = 30,000 (no separate service fee)
    assert q["base_price"] == 0
    assert q["vendor_total"] == 30000
    assert q["platform_fee"] == 750             # 2.5%
    assert q["customer_total"] == 30750
    assert "commission_amount" not in q and "payout_amount" not in q


def test_menu_vendor_requires_at_least_one_item(env):
    _add_item(env)
    r = env["client"].post("/api/bookings/quote", json={"vendor_id": env["vendor"].id})
    assert r.status_code == 400 and "at least one" in r.json()["detail"]
    r = env["client"].post("/api/bookings", json={"vendor_id": env["vendor"].id, "event_date": FUTURE}, headers=env["cust"])
    assert r.status_code == 400


def test_unapproved_vendor_cannot_be_booked(env):
    env["vendor"].verification_status = VerificationStatus.PENDING
    env["db"].commit()
    r = env["client"].post("/api/bookings", json={"vendor_id": env["vendor"].id, "event_date": FUTURE}, headers=env["cust"])
    assert r.status_code == 400


def test_client_cannot_set_price(env):
    co = _checkout(env)
    b = env["db"].get(Booking, co["booking_id"])
    assert b.price == Decimal("115000.00")       # 100,000 + 10% + 5,000 logistics
    assert co["amount_kobo"] == to_kobo(Decimal("117875.00"))


# ── Checkout & payment confirmation ──────────────────────────────────────────

def test_unpaid_checkout_is_invisible_to_vendor(env):
    co = _checkout(env)
    assert env["client"].get("/api/bookings", headers=env["ven"]).json() == []
    assert env["client"].get(f"/api/bookings/{co['booking_id']}", headers=env["ven"]).status_code == 403
    assert env["sent"] == []                     # nobody emailed before payment


def test_verify_payment_marks_paid_and_notifies_once(env):
    co = _checkout(env)
    env["fake"].pay(co["reference"], co["amount_kobo"])
    for _ in range(3):
        r = env["client"].post(f"/api/bookings/{co['booking_id']}/verify-payment", headers=env["cust"])
        assert r.status_code == 200
    assert r.json()["status"] == "pending"
    assert env["sent"].count("send_booking_request_to_vendor") == 1


def test_unpaid_verify_returns_402(env):
    co = _checkout(env)
    r = env["client"].post(f"/api/bookings/{co['booking_id']}/verify-payment", headers=env["cust"])
    assert r.status_code == 402


def test_underpayment_is_rejected(env):
    co = _checkout(env)
    env["fake"].pay(co["reference"], co["amount_kobo"] - 100)
    r = env["client"].post(f"/api/bookings/{co['booking_id']}/verify-payment", headers=env["cust"])
    assert r.status_code == 400
    assert env["db"].get(Booking, co["booking_id"]).paid_at is None


def test_role_views_of_money(env):
    bid = _paid_booking(env)
    cust = env["client"].get(f"/api/bookings/{bid}", headers=env["cust"]).json()
    ven = env["client"].get(f"/api/bookings/{bid}", headers=env["ven"]).json()
    assert cust["price"] == 117875.0 and "commission_amount" not in cust and "payout_amount" not in cust
    assert ven["price"] == 115000.0 and ven["commission_amount"] == 11000.0 and ven["payout_amount"] == 104000.0
    assert "platform_fee" not in ven


# ── Webhook ──────────────────────────────────────────────────────────────────

def _signed(payload):
    raw = json.dumps(payload).encode()
    sig = hmac.new(b"sk_test_dummy", raw, hashlib.sha512).hexdigest()
    return raw, {"x-paystack-signature": sig, "content-type": "application/json"}


def test_webhook_rejects_bad_signature(env):
    r = env["client"].post("/api/payments/webhook/paystack", content=b"{}", headers={"x-paystack-signature": "nope"})
    assert r.status_code == 401


def test_webhook_confirms_payment_if_browser_never_returns(env):
    co = _checkout(env)
    raw, h = _signed({"event": "charge.success", "data": {
        "status": "success", "reference": co["reference"], "amount": co["amount_kobo"], "currency": "NGN"}})
    assert env["client"].post("/api/payments/webhook/paystack", content=raw, headers=h).status_code == 200
    env["db"].expire_all()
    assert env["db"].get(Booking, co["booking_id"]).status == BookingStatus.PENDING


def test_late_payment_on_expired_checkout_is_refunded(env):
    co = _checkout(env)
    b = env["db"].get(Booking, co["booking_id"])
    b.created_at = datetime.now(timezone.utc) - timedelta(hours=3)
    env["db"].commit()
    from app.entities.booking.service import BookingService
    assert BookingService.expire_unpaid_checkouts(env["db"]) == 1
    env["fake"].pay(co["reference"], co["amount_kobo"])
    r = env["client"].post(f"/api/bookings/{co['booking_id']}/verify-payment", headers=env["cust"])
    assert r.status_code == 409
    assert env["fake"].refunds == [co["reference"]]


# ── Refunds & payouts ────────────────────────────────────────────────────────

def test_vendor_decline_refunds_customer(env):
    bid = _paid_booking(env)
    assert _status(env, bid, "declined", "ven").status_code == 200
    assert len(env["fake"].refunds) == 1


def test_cancel_after_acceptance_goes_to_admin_review(env):
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    from datetime import datetime, timedelta, timezone
    b = env["db"].get(Booking, bid); b.paid_at = datetime.now(timezone.utc) - timedelta(days=3); env["db"].commit()
    r = env["client"].post(f"/api/bookings/{bid}/cancel", headers=env["cust"],
                           json={"reason": "Family emergency", "request_review": True})
    assert r.json()["refund_status"] == "pending_review"
    assert env["fake"].refunds == []
    cases = env["client"].get("/api/admin/cases", headers=env["adm"]).json()
    assert [(c["id"], c["case_type"]) for c in cases] == [(bid, "refund_review")]
    r = env["client"].post(f"/api/admin/bookings/{bid}/resolve", headers=env["adm"],
                           json={"outcome": "refund", "note": "Cancelled two weeks before the event"})
    assert r.status_code == 200, r.text
    assert len(env["fake"].refunds) == 1


def _complete(env, bid):
    _status(env, bid, "confirmed", "ven")
    b = env["db"].get(Booking, bid)
    b.event_date = datetime.now(timezone.utc) - timedelta(hours=1)
    env["db"].commit()
    assert _status(env, bid, "awaiting_confirmation", "ven").status_code == 200
    return _status(env, bid, "completed", "cust")


def test_completion_pays_vendor_net_of_commission_once(env):
    bid = _paid_booking(env)
    assert _complete(env, bid).status_code == 200
    assert env["fake"].transfers == [(Decimal("104000.00"), "RCP_123", f"PLG-PAYOUT-{bid}")]
    # Transfer webhook finalises it
    raw, h = _signed({"event": "transfer.success", "data": {"reference": f"PLG-PAYOUT-{bid}"}})
    env["client"].post("/api/payments/webhook/paystack", content=raw, headers=h)
    env["db"].expire_all()
    assert env["db"].get(Booking, bid).payout_status == "paid"


def test_failed_payout_is_recorded_and_retryable(env):
    bid = _paid_booking(env)
    env["fake"].fail_transfer = True
    _complete(env, bid)
    env["db"].expire_all()
    b = env["db"].get(Booking, bid)
    assert b.payout_status == "failed" and "Insufficient balance" in b.payout_error
    env["fake"].fail_transfer = False
    r = env["client"].post(f"/api/admin/bookings/{bid}/retry-payout", headers=env["adm"])
    assert r.json()["payout_status"] == "processing"
    assert len(env["fake"].transfers) == 1


def test_paid_booking_cannot_be_deleted(env):
    bid = _paid_booking(env)
    assert env["client"].delete(f"/api/bookings/{bid}", headers=env["cust"]).status_code == 400
