"""Leak audit: walks EVERY route in the app.

1. Anonymous callers get nothing from protected routes.
2. Customers and vendors can't reach admin or support routes.
3. One customer can't read another's bookings, receipts, chats or add-ons.
4. Public responses never contain secrets (passwords, bank details, tokens).
5. Secrets are not stored in plain text in the database."""
import re

from sqlalchemy import text

from app.core.security import create_access_token, get_password_hash
from app.entities.user.model import User, UserRole
from tests.test_payments import _paid_booking, env  # noqa: F401

PUBLIC = [  # routes anyone may call (prefix match)
    "/api/auth/login", "/api/auth/login-json", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password",
    "/api/auth/refresh", "/api/vendors", "/api/payments/webhook", "/api/health", "/sitemap.xml", "/api/bookings/policies",
    "/api/reviews/vendor", "/api/service-items/vendor", "/docs", "/redoc", "/openapi.json", "/", "/api/stats/public",
    "/api/categories", "/api/events/types",
]
VENDOR_PUBLIC = re.compile(r"^/api/vendors(/\{vendor_id\}(/availability|/reviews)?)?$|^/api/vendors/(search|recommended|featured)")
SECRET_KEYS = {"hashed_password", "account_number", "bank_code", "recipient_code", "refund_account_number",
               "token_version", "token_hash", "refund_bank_code"}


def _routes(app):
    from fastapi.routing import APIRoute
    for r in app.routes:
        if isinstance(r, APIRoute):
            for m in r.methods - {"HEAD", "OPTIONS"}:
                yield m, r.path


def _fill(path, bid=1):
    return re.sub(r"\{[^}]+\}", str(bid), path)


def _is_public(method, path):
    if VENDOR_PUBLIC.match(path) and method == "GET":
        return True
    return any(path == p or (p != "/" and path.startswith(p + "/")) or path == p.rstrip("/") for p in PUBLIC) and not path.startswith("/api/vendors/me")


def test_anonymous_callers_get_nothing_from_protected_routes(env):
    from main import app
    leaks = []
    for method, path in _routes(app):
        if _is_public(method, path):
            continue
        r = env["client"].request(method, _fill(path), json={})
        if r.status_code < 400:
            leaks.append((method, path, r.status_code))
    assert not leaks, f"Protected routes answered anonymous callers: {leaks}"


def test_customers_and_vendors_cannot_reach_admin_or_support(env):
    from main import app
    leaks = []
    for method, path in _routes(app):
        if not (path.startswith("/api/admin") or path.startswith("/api/support")):
            continue
        for who in ("cust", "ven"):
            r = env["client"].request(method, _fill(path), headers=env[who], json={})
            if r.status_code < 400 or r.status_code not in (401, 403, 404, 405, 422):
                leaks.append((who, method, path, r.status_code))
    assert not leaks, f"Non-admins reached admin/support routes: {leaks}"


def test_one_customer_cannot_read_another_customers_records(env):
    from main import app
    bid = _paid_booking(env)
    other = User(email="other@x.com", hashed_password=get_password_hash("Passw0rd!"), role=UserRole.CUSTOMER, full_name="Other")
    env["db"].add(other); env["db"].commit()
    h = {"Authorization": f"Bearer {create_access_token({'sub': other.email, 'tv': 0, 'typ': 'access'})}"}
    leaks = []
    for method, path in _routes(app):
        if method != "GET" or not path.startswith("/api/bookings/{booking_id}"):
            continue
        r = env["client"].get(_fill(path, bid), headers=h)
        if r.status_code < 400:
            leaks.append((path, r.status_code))
    assert not leaks, f"Another customer could read booking data: {leaks}"


def _walk_keys(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from _walk_keys(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_keys(v)


def test_public_and_counterparty_responses_hold_no_secrets(env):
    env["vendor"].account_number, env["vendor"].bank_code, env["vendor"].recipient_code = "9876543210", "058", "RCP_123"
    env["db"].commit()
    bid = _paid_booking(env)
    vid = env["vendor"].id
    checks = [("anon", f"/api/vendors/{vid}"), ("anon", "/api/vendors"), ("cust", f"/api/bookings/{bid}"),
              ("cust", "/api/bookings"), ("ven", f"/api/bookings/{bid}"), ("cust", "/api/auth/me"), ("cust", "/api/account/favorites")]
    found = []
    for who, path in checks:
        r = env["client"].get(path, headers=env[who] if who != "anon" else {})
        if r.status_code == 200:
            bad = SECRET_KEYS & set(_walk_keys(r.json()))
            if bad:
                found.append((who, path, sorted(bad)))
            assert "9876543210" not in r.text and "RCP_123" not in r.text, (who, path)
    assert not found, f"Secrets in responses: {found}"


def test_secrets_are_not_stored_in_plain_text(env):
    db = env["db"]
    env["customer"].refund_account_number = "0123456789"
    db.commit()
    for col, table in (("hashed_password", "users"), ("refund_account_number", "users")):
        for (value,) in db.execute(text(f"SELECT {col} FROM {table} WHERE {col} IS NOT NULL")).fetchall():
            assert not re.fullmatch(r"\d{10}", value) and value != "Passw0rd!", (table, col)
