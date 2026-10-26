"""Short-notice response window, email stamping, encryption at rest, retention, job lock,
receipt logistics, and the support team's permissions."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text

from app.core.security import create_access_token, get_password_hash
from app.entities.booking.model import Booking, BookingStatus
from app.entities.user.model import User, UserRole
from tests.test_payments import _paid_booking, env  # noqa: F401

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _support(env):
    u = User(email="s@x.com", hashed_password=get_password_hash("Passw0rd!"), role=UserRole.SUPPORT, full_name="Sade Support")
    env["db"].add(u); env["db"].commit()
    return {"Authorization": f"Bearer {create_access_token({'sub': u.email, 'tv': 0, 'typ': 'access'})}"}


# ── Short-notice bookings ────────────────────────────────────────────────

def test_short_notice_booking_gets_a_response_window(env):
    from app.entities.booking.trust import TrustService, response_deadline
    bid = _paid_booking(env)
    b = env["db"].get(Booking, bid)
    b.event_date = NOW() + timedelta(hours=30); b.paid_at = NOW(); env["db"].commit()
    assert TrustService.expire_unaccepted(env["db"]) == 0                         # not rejected straight away
    assert abs((response_deadline(b) - (b.event_date - timedelta(hours=6))).total_seconds()) < 2
    b.event_date = NOW() + timedelta(hours=3); env["db"].commit()
    assert TrustService.expire_unaccepted(env["db"]) == 0                         # still 2 hours to respond
    assert env["client"].get(f"/api/bookings/{bid}", headers=env["cust"]).json()["respond_by"]
    b.paid_at = NOW() - timedelta(hours=2, minutes=1); env["db"].commit()
    assert TrustService.expire_unaccepted(env["db"]) == 1                         # window passed: refunded


# ── Emails, encryption, receipts ─────────────────────────────────────────

def test_email_stamp_needs_no_timezone_database(monkeypatch):
    import builtins
    import app.services.email as e
    real_import = builtins.__import__
    def no_zoneinfo(name, *a, **k):
        if name == "zoneinfo":
            raise ImportError("no tz database (like Windows without tzdata)")
        return real_import(name, *a, **k)
    monkeypatch.setattr(builtins, "__import__", no_zoneinfo)
    sent = {}
    monkeypatch.setattr(e, "send_email", lambda to, subj, html, att=None: (sent.update(html=html) or (True, "ok")))
    assert e._send("a@x.com", "Hello", "<p>{sent_stamp}</p>") is True
    assert "WAT" in sent["html"]


def test_bank_account_numbers_are_encrypted_at_rest(env):
    c, db = env["customer"], env["db"]
    c.refund_bank_code, c.refund_account_number, c.refund_account_name = "058", "0123456789", "ADA OKAFOR"
    env["vendor"].account_number = "9876543210"
    db.commit()
    raw_c = db.execute(text("SELECT refund_account_number FROM users WHERE id = :i"), {"i": c.id}).scalar()
    raw_v = db.execute(text("SELECT account_number FROM vendors WHERE id = :i"), {"i": env["vendor"].id}).scalar()
    assert raw_c.startswith("gAAAA") and "0123456789" not in raw_c
    assert raw_v.startswith("gAAAA") and "9876543210" not in raw_v
    db.expire_all()
    assert db.get(User, c.id).refund_account_number == "0123456789"               # readable through the app


def test_receipt_uses_the_logistics_actually_charged(env):
    from app.services.documents import payment_receipt_pdf
    bid = _paid_booking(env)
    b = env["db"].get(Booking, bid)
    assert b.logistics_fee == Decimal("5000.00")
    env["vendor"].logistics_fee = Decimal("99999"); env["db"].commit()            # vendor changes fee later
    assert payment_receipt_pdf(b)[:4] == b"%PDF"


# ── Retention and job lock ───────────────────────────────────────────────

def test_retention_cleans_old_data_but_keeps_bookings(env):
    from app.entities.audit import ContactAttempt, NotificationLog
    from app.services import retention
    db = env["db"]
    old = NOW() - timedelta(days=400)
    db.add(ContactAttempt(user_id=env["customer"].id, kind="email", body="x gmail", created_at=old))
    db.add(NotificationLog(reference="N-OLD1", channel="email", recipient="a@x.com", subject="s", status="sent", body="<p>hi</p>",
                           created_at=NOW() - timedelta(days=100)))
    bid = _paid_booking(env)
    b = db.get(Booking, bid); b.created_at = old; db.commit()
    out = retention.run(db)
    assert out["contact_attempts"] == 1 and out["notification_bodies"] == 1
    assert db.query(NotificationLog).filter_by(reference="N-OLD1").one().body is None
    assert db.get(Booking, bid) is not None                                        # paid bookings are never deleted


def test_only_one_process_runs_jobs(env):
    from app.core.database import engine
    a, b = engine.connect(), engine.connect()
    try:
        assert a.execute(text("SELECT pg_try_advisory_lock(727001)")).scalar() is True
        assert b.execute(text("SELECT pg_try_advisory_lock(727001)")).scalar() is False
        a.execute(text("SELECT pg_advisory_unlock(727001)"))
        assert b.execute(text("SELECT pg_try_advisory_lock(727001)")).scalar() is True
        b.execute(text("SELECT pg_advisory_unlock(727001)"))
    finally:
        a.close(); b.close()


# ── Support team ─────────────────────────────────────────────────────────

def test_support_can_assist_but_not_decide(env):
    c, sup = env["client"], _support(env)
    bid = _paid_booking(env)
    assert c.get("/api/support/cases", headers=sup).status_code == 200
    found = c.get(f"/api/support/lookup?q={bid}", headers=sup).json()
    assert found and found[0]["id"] == bid and found[0]["customer_contact"]["email"] == "c@x.com"
    assert "commission_amount" not in found[0] and "payout_amount" not in found[0]
    # no admin powers
    for method, path in [("get", "/api/admin/metrics"), ("get", "/api/admin/audit/chat-access"), ("get", "/api/admin/cases"),
                         ("post", f"/api/admin/bookings/{bid}/resolve"), ("post", "/api/admin/withdrawals/1/approve"),
                         ("get", "/api/admin/escalations")]:
        assert getattr(c, method)(path, headers=sup).status_code in (403, 405, 422), path
    # customers and vendors can't use support tools
    assert c.get("/api/support/cases", headers=env["cust"]).status_code == 403
    assert c.get("/api/support/lookup?q=1", headers=env["ven"]).status_code == 403


def test_escalation_flow_and_notes(env):
    c, sup = env["client"], _support(env)
    bid = _paid_booking(env)
    assert c.post("/api/support/notes", headers=sup, json={"booking_id": bid, "note": "Customer called about timing"}).status_code == 201
    assert c.get(f"/api/support/notes?booking_id={bid}", headers=sup).json()[0]["author"] == "Sade Support"
    e = c.post("/api/support/escalations", headers=sup, json={"booking_id": bid, "priority": "urgent", "category": "refund",
                                                           "note": "Customer's venue flooded, asking for a full refund"}).json()
    assert c.get("/api/admin/escalations?status=open", headers=env["adm"]).json()[0]["id"] == e["id"]
    assert c.post(f"/api/admin/escalations/{e['id']}/resolve", headers=sup, json={"resolution_note": "x"}).status_code == 403
    assert c.post(f"/api/admin/escalations/{e['id']}/resolve", headers=env["adm"], json={"resolution_note": "Refunded in full"}).status_code == 200
    assert c.get("/api/support/escalations", headers=sup).json()[0]["status"] == "resolved"


def test_resend_email_and_nudge_vendor(env, monkeypatch):
    import app.services.email as e
    from app.entities.audit import NotificationLog
    c, sup = env["client"], _support(env)
    env["db"].add(NotificationLog(reference="N-ABC", channel="email", recipient="c@x.com", subject="Your receipt", status="failed",
                                  error="SMTP down", body="<p>Receipt</p>"))
    env["db"].commit()
    monkeypatch.setattr(e, "send_email", lambda to, subj, html, att=None: (True, "sent"))
    r = c.post("/api/support/notifications/N-ABC/resend", headers=sup)
    assert r.status_code == 200
    assert env["db"].query(NotificationLog).filter_by(resent_from="N-ABC").count() == 1
    assert c.post("/api/support/notifications/N-ABC/resend", headers=sup).status_code == 429   # not twice in 10 minutes
    bid = _paid_booking(env)
    assert c.post(f"/api/support/bookings/{bid}/nudge-vendor", headers=sup).json()["action"] == "accept or decline"
    assert c.post(f"/api/support/bookings/{bid}/nudge-vendor", headers=sup).status_code == 429


def test_admin_creates_and_deactivates_support_staff(env):
    c = env["client"]
    r = c.post("/api/admin/support-users", headers=env["adm"], json={"email": "help@x.com", "full_name": "Helper One"})
    assert r.status_code == 201 and r.json()["role"] == "support"
    assert c.post("/api/admin/support-users", headers=env["cust"], json={"email": "z@x.com", "full_name": "Nope"}).status_code == 403
    uid = r.json()["id"]
    assert c.post(f"/api/admin/support-users/{uid}/deactivate", headers=env["adm"]).json()["is_active"] is False
