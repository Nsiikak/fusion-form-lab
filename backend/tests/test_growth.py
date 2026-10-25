"""Sessions, advance eligibility, availability, favourites, ranking, sitemap, abandoned checkouts."""
from datetime import datetime, timedelta, timezone

from app.entities.booking.model import Booking, BookingStatus
from tests.test_payments import _paid_booking, env  # noqa: F401

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _login(env, email="c@x.com"):
    return env["client"].post("/api/auth/login-json", json={"email": email, "password": "Passw0rd!"}).json()


def test_refresh_tokens_keep_people_signed_in_and_logout_all_ends_them(env):
    c = env["client"]
    t = _login(env)
    assert t["refresh_token"]
    assert c.get("/api/auth/me", headers={"Authorization": f"Bearer {t['refresh_token']}"}).status_code == 401  # refresh isn't an access token
    new = c.post("/api/auth/refresh", json={"refresh_token": t["refresh_token"]}).json()
    assert c.get("/api/auth/me", headers={"Authorization": f"Bearer {new['access_token']}"}).status_code == 200
    c.post("/api/auth/logout-all", headers={"Authorization": f"Bearer {new['access_token']}"})
    assert c.get("/api/auth/me", headers={"Authorization": f"Bearer {new['access_token']}"}).status_code == 401
    assert c.post("/api/auth/refresh", json={"refresh_token": new["refresh_token"]}).status_code == 401


def test_advance_options_locked_until_earned(env):
    c = env["client"]
    e = c.get("/api/vendors/me/advance-eligibility", headers=env["ven"]).json()
    assert e["logistics"] is False and e["completed"] == 0
    r = c.put("/api/vendors/me", headers=env["ven"], json={"advance_mode": "logistics"})
    assert r.status_code == 400 and "3 completed bookings" in r.json()["detail"]
    assert c.put("/api/vendors/me", headers=env["ven"], json={"advance_mode": "none"}).status_code == 200


def test_blocked_dates_stop_bookings_and_hide_vendor_in_search(env):
    c = env["client"]
    day = (NOW() + timedelta(days=40)).date()
    assert c.put("/api/vendors/me/availability", headers=env["ven"], json={"blocked_dates": [day.isoformat()]}).status_code == 200
    r = c.post("/api/bookings", headers=env["cust"], json={"vendor_id": env["vendor"].id,
                                                          "event_date": datetime(day.year, day.month, day.day, 14, tzinfo=timezone.utc).isoformat()})
    assert r.status_code == 400 and "isn't available" in r.json()["detail"]
    ids = [v["id"] for v in c.get(f"/api/vendors?available_on={day.isoformat()}").json()["vendors"]]
    assert env["vendor"].id not in ids
    other = (day + timedelta(days=1)).isoformat()
    assert env["vendor"].id in [v["id"] for v in c.get(f"/api/vendors?available_on={other}").json()["vendors"]]
    pub = c.get(f"/api/vendors/{env['vendor'].id}/availability?start={day}&end={day + timedelta(days=5)}").json()
    assert pub["unavailable"] == [day.isoformat()]


def test_daily_capacity(env):
    c = env["client"]
    c.put("/api/vendors/me/availability", headers=env["ven"], json={"blocked_dates": [], "daily_capacity": 1})
    bid = _paid_booking(env)
    day = env["db"].get(Booking, bid).event_date.date()
    pub = c.get(f"/api/vendors/{env['vendor'].id}/availability?start={day}&end={day}").json()
    assert pub["unavailable"] == [day.isoformat()]                  # one live booking fills a capacity of 1


def test_favorites(env):
    c = env["client"]
    vid = env["vendor"].id
    assert c.put(f"/api/account/favorites/{vid}", headers=env["cust"]).status_code == 204
    assert c.put(f"/api/account/favorites/{vid}", headers=env["cust"]).status_code == 204   # idempotent
    assert [v["id"] for v in c.get("/api/account/favorites", headers=env["cust"]).json()] == [vid]
    c.delete(f"/api/account/favorites/{vid}", headers=env["cust"])
    assert c.get("/api/account/favorites", headers=env["cust"]).json() == []


def test_quality_ranking_and_response_time(env):
    from app.services.ranking import recompute
    for _ in range(2):
        bid = _paid_booking(env)
        b = env["db"].get(Booking, bid)
        b.accepted_at = b.paid_at + timedelta(hours=3); b.status = BookingStatus.COMPLETED
        env["db"].commit()
    recompute(env["db"])
    env["db"].refresh(env["vendor"])
    assert env["vendor"].response_hours == 3.0 and env["vendor"].quality_score > 0


def test_sitemap_lists_public_pages(env):
    env["vendor"].base_state = "Lagos"; env["db"].commit()
    x = env["client"].get("/sitemap.xml").text
    assert "/plan/wedding" in x and f"/vendors/{env['vendor'].id}" in x and "/find/catering/lagos" in x


def test_abandoned_checkout_nudge(env):
    from app.entities.booking.service import BookingService
    co = env["client"].post("/api/bookings", headers=env["cust"], json={"vendor_id": env["vendor"].id,
                                                                       "event_date": (NOW() + timedelta(days=30)).isoformat()}).json()
    b = env["db"].get(Booking, co["booking_id"]); b.created_at = NOW() - timedelta(hours=3); env["db"].commit()
    before = len(env["calls"])
    BookingService.expire_unpaid_checkouts(env["db"])
    assert any(c[0] == "send_notice_email" and "isn't finished" in c[1][2] for c in env["calls"][before:])
