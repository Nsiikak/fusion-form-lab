"""Receipts, payout statements, refund accounts and stuck refunds. Run: pytest -q"""
import hashlib
import hmac
import json
from io import BytesIO

from pypdf import PdfReader

from app.entities.booking.model import Booking
from tests.test_payments import _complete, _paid_booking, _status, env  # noqa: F401


def _text(pdf_bytes: bytes) -> str:
    assert pdf_bytes[:4] == b"%PDF"
    return " ".join(p.extract_text() for p in PdfReader(BytesIO(pdf_bytes)).pages)


def _webhook(env, event, data):
    raw = json.dumps({"event": event, "data": data}).encode()
    sig = hmac.new(b"sk_test_dummy", raw, hashlib.sha512).hexdigest()
    return env["client"].post("/api/payments/webhook/paystack", content=raw,
                              headers={"x-paystack-signature": sig, "content-type": "application/json"})


# ── Receipts ─────────────────────────────────────────────────────────────────

def test_receipts_are_numbered_in_order_and_downloadable(env):
    b1, b2 = _paid_booking(env), _paid_booking(env)
    env["db"].expire_all()
    n1 = env["db"].get(Booking, b1).receipt_number
    n2 = env["db"].get(Booking, b2).receipt_number
    assert n1.startswith("PLG-RCT-") and n1.endswith("000001") and n2.endswith("000002")

    r = env["client"].get(f"/api/bookings/{b1}/receipt", headers=env["cust"])
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    text = _text(r.content)
    assert "PAYMENT RECEIPT" in text and n1 in text and "PAID" in text
    assert "NGN 117,875.00" in text            # what the customer paid
    assert "commission" not in text.lower()   # never shown to customers
    assert env["client"].get(f"/api/bookings/{b1}", headers=env["cust"]).json()["receipt_number"] == n1


def test_receipt_permissions(env):
    bid = _paid_booking(env)
    assert env["client"].get(f"/api/bookings/{bid}/receipt", headers=env["ven"]).status_code == 404
    assert env["client"].get(f"/api/bookings/{bid}/receipt", headers=env["adm"]).status_code == 200
    unpaid = env["client"].post("/api/bookings", json={"vendor_id": env["vendor"].id,
                                "event_date": "2099-01-01T12:00:00+00:00"}, headers=env["cust"]).json()["booking_id"]
    assert env["client"].get(f"/api/bookings/{unpaid}/receipt", headers=env["cust"]).status_code == 400


def test_receipt_is_attached_to_the_payment_email(env):
    _paid_booking(env)
    name, args, kwargs = next(c for c in env["calls"] if c[0] == "send_booking_confirmation_to_customer")
    filename, data = kwargs["attachments"][0]
    assert filename.endswith(".pdf") and data[:4] == b"%PDF"


# ── Payout statements ────────────────────────────────────────────────────────

def test_payout_statement_issued_and_emailed_when_money_lands(env):
    bid = _paid_booking(env)
    _complete(env, bid)
    assert env["client"].get(f"/api/bookings/{bid}", headers=env["ven"]).json()["payout_statement_number"] is None
    _webhook(env, "transfer.success", {"reference": f"PLG-PAYOUT-{bid}"})
    env["db"].expire_all()
    b = env["db"].get(Booking, bid)
    assert b.payout_status == "paid" and b.payout_statement_number.startswith("PLG-PAY-")

    sent = [c for c in env["calls"] if c[0] == "send_notice_email" and "paid" in c[1][2]]
    assert sent and sent[0][2]["attachments"][0][1][:4] == b"%PDF"
    # webhook delivered twice → still one statement, one email
    _webhook(env, "transfer.success", {"reference": f"PLG-PAYOUT-{bid}"})
    assert len([c for c in env["calls"] if c[0] == "send_notice_email" and "paid" in c[1][2]]) == 1

    r = env["client"].get(f"/api/bookings/{bid}/payout-statement", headers=env["ven"])
    text = _text(r.content)
    assert "PAYOUT STATEMENT" in text and "NGN 104,000.00" in text and "NGN 11,000.00" in text
    assert "117,875" not in text            # customer fee isn't the vendor's business
    assert env["client"].get(f"/api/bookings/{bid}/payout-statement", headers=env["cust"]).status_code == 404


def test_no_statement_before_payout(env):
    bid = _paid_booking(env)
    assert env["client"].get(f"/api/bookings/{bid}/payout-statement", headers=env["ven"]).status_code == 400


# ── Refund account & stuck refunds ───────────────────────────────────────────

def test_save_refund_account_verifies_with_bank(env):
    c = env["client"]
    assert c.get("/api/account/refund-account", headers=env["cust"]).json()["refund_account"] is None
    bad = c.put("/api/account/refund-account", headers=env["cust"],
                json={"bank_code": "058", "bank_name": "GTBank", "account_number": "0000000000"})
    assert bad.status_code == 400
    r = c.put("/api/account/refund-account", headers=env["cust"],
              json={"bank_code": "058", "bank_name": "GTBank", "account_number": "0123456789"}).json()
    assert r["refund_account"]["account_name"] == "ADA OKAFOR"
    assert r["refund_account"]["account_number_masked"] == "******6789"
    assert r["name_matches"] is True
    assert c.delete("/api/account/refund-account", headers=env["cust"]).status_code == 204
    assert c.get("/api/account/refund-account", headers=env["cust"]).json()["refund_account"] is None


def test_stuck_refund_waits_for_account_then_completes(env):
    bid = _paid_booking(env)
    _status(env, bid, "declined", "ven")                       # refund starts (Paystack id 991)
    _webhook(env, "refund.needs-attention", {"id": 991, "transaction_reference": env["db"].get(Booking, bid).payment_reference})
    env["db"].expire_all()
    assert env["db"].get(Booking, bid).refund_status == "needs_details"
    assert any(c[0] == "send_notice_email" and "refund" in c[1][2].lower() for c in env["calls"])
    cases = env["client"].get("/api/admin/cases", headers=env["adm"]).json()
    assert cases[0]["case_type"] == "refund_needs_details" and cases[0]["customer_refund_account"] is None

    r = env["client"].put("/api/account/refund-account", headers=env["cust"],
                          json={"bank_code": "058", "bank_name": "GTBank", "account_number": "0123456789"}).json()
    assert r["refunds_resumed"] == 1
    assert env["fake"].refund_retries == [("991", "0123456789", "058")]
    env["db"].expire_all()
    assert env["db"].get(Booking, bid).refund_status == "processing"

    _webhook(env, "refund.processed", {"id": 991, "transaction_reference": env["db"].get(Booking, bid).payment_reference})
    env["db"].expire_all()
    b = env["db"].get(Booking, bid)
    assert b.refund_status == "refunded" and b.refunded_at is not None
    assert "REFUNDED" in _text(env["client"].get(f"/api/bookings/{bid}/receipt", headers=env["cust"]).content)


def test_saved_account_is_used_automatically(env):
    env["client"].put("/api/account/refund-account", headers=env["cust"],
                      json={"bank_code": "058", "bank_name": "GTBank", "account_number": "0123456789"})
    env["fake"].refund_response = {"id": 555, "status": "needs-attention"}
    bid = _paid_booking(env)
    _status(env, bid, "declined", "ven")
    env["db"].expire_all()
    assert env["db"].get(Booking, bid).refund_status == "processing"
    assert env["fake"].refund_retries == [("555", "0123456789", "058")]
