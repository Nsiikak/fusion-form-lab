"""Quotes from chat, password reset tokens, email escaping, security headers, countdown wording."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.entities.booking.model import Booking, BookingStatus
from tests.test_payments import _status, env  # noqa: F401

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _conv(env):
    return env["client"].post("/api/messages/conversations", json={"vendor_id": env["vendor"].id}, headers=env["cust"]).json()["id"]


def _quote(env, cid, **kw):
    body = {"items": [{"name": "Custom 3-tier cake", "quantity": 1, "unit_price": 180000}],
            "event_date": (NOW() + timedelta(days=20)).isoformat(), "note": "Red and gold", "valid_days": 3, **kw}
    return env["client"].post(f"/api/messages/conversations/{cid}/quote", headers=env["ven"], json=body)


def test_vendor_sends_quote_customer_pays_and_it_is_confirmed(env):
    cid = _conv(env)
    assert _quote(env, cid).status_code == 201
    assert env["client"].post(f"/api/messages/conversations/{cid}/quote", headers=env["cust"], json={}).status_code in (403, 422)
    r = _quote(env, cid).json()
    env["db"].expire_all()
    b = env["db"].get(Booking, r["booking_id"])
    assert b.status == BookingStatus.AWAITING_PAYMENT and b.quote_expires_at is not None
    assert b.price == Decimal("185000.00")                         # 180,000 + 5,000 logistics
    assert b.commission_amount == Decimal("18000.00")              # none on logistics
    t = env["client"].get(f"/api/messages/conversations/{cid}", headers=env["cust"]).json()
    assert any(a.get("type") == "quote" for m in t["messages"] for a in m["attachments"])
    env["fake"].pay(b.payment_reference, int(b.customer_total * 100))
    assert env["client"].post(f"/api/bookings/{b.id}/verify-payment", headers=env["cust"]).status_code == 200
    env["db"].expire_all()
    assert env["db"].get(Booking, b.id).status == BookingStatus.CONFIRMED   # vendor already agreed


def test_quote_decline_and_expiry(env):
    from app.entities.booking.service import BookingService
    cid = _conv(env)
    q1 = _quote(env, cid).json()["booking_id"]
    assert env["client"].post(f"/api/bookings/{q1}/quote/decline", headers=env["cust"]).json()["status"] == "cancelled"
    q2 = _quote(env, cid).json()["booking_id"]
    b = env["db"].get(Booking, q2); b.created_at = NOW() - timedelta(hours=5); env["db"].commit()
    BookingService.expire_unpaid_checkouts(env["db"])
    env["db"].expire_all()
    assert env["db"].get(Booking, q2).status == BookingStatus.AWAITING_PAYMENT     # quotes outlive the 60-minute checkout
    b = env["db"].get(Booking, q2); b.quote_expires_at = NOW() - timedelta(minutes=1); env["db"].commit()
    BookingService.expire_unpaid_checkouts(env["db"])
    env["db"].expire_all()
    assert env["db"].get(Booking, q2).status == BookingStatus.CANCELLED


def test_password_reset_tokens_are_hashed_and_single_use(env):
    import re
    from app.entities.user.reset_token import PasswordResetToken
    c = env["client"]
    tokens = []
    import app.routers.auth as auth
    auth._fire_and_forget = lambda fn, email, name, token: tokens.append(token)
    assert c.post("/api/auth/forgot-password", json={"email": "c@x.com"}).status_code == 200
    raw = tokens[-1]
    row = env["db"].query(PasswordResetToken).one()
    assert row.token_hash != raw and len(row.token_hash) == 64           # only the hash is stored
    assert c.post("/api/auth/reset-password", json={"token": raw, "new_password": "NewPassw0rd!"}).status_code == 200
    assert c.post("/api/auth/reset-password", json={"token": raw, "new_password": "Another1!x"}).status_code == 400
    assert c.post("/api/auth/forgot-password", json={"email": "nobody@x.com"}).status_code == 200   # no enumeration


def test_emails_escape_user_text():
    from app.services.email import _render
    out = _render("<p>{name}</p>{body_html}", name='<img src=x onerror="alert(1)">', body_html="<b>ok</b>")
    assert "<img" not in out and "&lt;img" in out and "<b>ok</b>" in out


def test_security_headers(env):
    r = env["client"].get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"


def test_three_days_out_skips_the_week_email(env):
    from app.entities.booking.trust import TrustService
    from tests.test_payments import _paid_booking
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    b = env["db"].get(Booking, bid); b.event_date = NOW() + timedelta(days=3); env["db"].commit()
    sent = TrustService.run_countdown(env["db"])
    assert sent["t7"] == 0
    env["db"].expire_all()
    assert env["db"].get(Booking, bid).reminders["t7"] == "skipped"


def test_reset_enforces_the_password_policy(env):
    import app.routers.auth as auth
    tokens = []
    auth._fire_and_forget = lambda fn, email, name, token: tokens.append(token)
    env["client"].post("/api/auth/forgot-password", json={"email": "c@x.com"})
    tok = tokens[-1]
    for weak, why in [("short1!", "8 characters"), ("password!!", "number"), ("12345678!", "letter"), ("Password1", "special")]:
        r = env["client"].post("/api/auth/reset-password", json={"token": tok, "new_password": weak})
        assert r.status_code == 400 and why in r.json()["detail"], (weak, r.json())
    assert env["client"].post("/api/auth/reset-password", json={"token": tok, "new_password": "Str0ng!pass"}).status_code == 200


def test_email_links_never_relative(monkeypatch):
    import importlib
    import app.core.config as cfg
    monkeypatch.setenv("FRONTEND_URL", "  ")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:8080")
    importlib.reload(cfg)
    try:
        assert cfg.FRONTEND_URL == "http://localhost:8080"
    finally:
        monkeypatch.undo()
        importlib.reload(cfg)
