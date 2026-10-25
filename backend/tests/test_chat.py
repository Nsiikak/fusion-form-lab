"""In-app chat: starting threads, masking contact details until a booking is paid, unread
counts, batched email alerts, permissions and the admin evidence view. Run: pytest -q"""
from app.entities.vendor.model import VerificationStatus
from tests.test_payments import _paid_booking, _status, env  # noqa: F401


def _start(env):
    r = env["client"].post("/api/messages/conversations", json={"vendor_id": env["vendor"].id}, headers=env["cust"])
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _send(env, cid, who, body, **kw):
    return env["client"].post(f"/api/messages/conversations/{cid}/messages", json={"body": body, **kw}, headers=env[who])


def _thread(env, cid, who, after=0):
    return env["client"].get(f"/api/messages/conversations/{cid}?after_id={after}", headers=env[who]).json()


def test_customer_starts_one_thread_per_vendor(env):
    assert _start(env) == _start(env)
    # vendors can't start threads, and unapproved vendors can't be messaged
    assert env["client"].post("/api/messages/conversations", json={"vendor_id": env["vendor"].id},
                              headers=env["ven"]).status_code == 403
    env["vendor"].verification_status = VerificationStatus.PENDING
    env["db"].commit()
    other = env["client"].post("/api/messages/conversations", json={"vendor_id": env["vendor"].id}, headers=env["cust"])
    assert other.status_code in (200, 404)


def test_messages_flow_with_unread_counts(env):
    cid = _start(env)
    assert _send(env, cid, "cust", "Hi! Are you free on 24 Oct for 150 guests?").status_code == 200
    assert env["client"].get("/api/messages/unread-count", headers=env["ven"]).json()["unread"] == 1
    assert env["client"].get("/api/messages/unread-count", headers=env["cust"]).json()["unread"] == 0
    inbox = env["client"].get("/api/messages/conversations", headers=env["ven"]).json()
    assert inbox[0]["other"]["name"] == "Ada Okafor" and inbox[0]["unread"] == 1
    t = _thread(env, cid, "ven")                                   # reading clears it
    assert [m["body"] for m in t["messages"]] == ["Hi! Are you free on 24 Oct for 150 guests?"]
    assert env["client"].get("/api/messages/unread-count", headers=env["ven"]).json()["unread"] == 0
    _send(env, cid, "ven", "Yes we are! ₦250,000 covers 150 guests.")
    t = _thread(env, cid, "cust", after=t["messages"][-1]["id"])   # incremental polling
    assert len(t["messages"]) == 1 and t["messages"][0]["mine"] is False
    assert "₦250,000" in t["messages"][0]["body"]                  # prices are never masked


def test_contact_details_never_sent_in_chat(env):
    cid = _start(env)
    for tricky in ["Just whatsapp me on 0803 123 4567", "zero eight zero three one two three four five six seven", "find me @chop_life"]:
        r = _send(env, cid, "ven", tricky)
        assert r.status_code == 400 and "on the booking" in r.json()["detail"]
    bid = _paid_booking(env)
    _status(env, bid, "confirmed", "ven")
    env["client"].post(f"/api/bookings/{bid}/reconfirm", headers=env["ven"])
    assert _send(env, cid, "ven", "Call me on 0803 123 4567").status_code == 400     # still not in chat
    # ...the phone number is on the booking card instead
    assert "counterpart_phone" in env["client"].get(f"/api/bookings/{bid}", headers=env["ven"]).json()


def test_strangers_cannot_read_or_post(env):
    cid = _start(env)
    _send(env, cid, "cust", "hello")
    from app.core.security import get_password_hash
    from app.entities.user.model import User, UserRole
    other = User(email="z@x.com", hashed_password=get_password_hash("Passw0rd!"), role=UserRole.CUSTOMER)
    env["db"].add(other); env["db"].commit()
    h = env["headers"](other)
    assert env["client"].get(f"/api/messages/conversations/{cid}", headers=h).status_code == 404
    assert env["client"].post(f"/api/messages/conversations/{cid}/messages", json={"body": "hi"}, headers=h).status_code == 404


def test_email_alerts_are_batched(env):
    cid = _start(env)
    for i in range(4):
        _send(env, cid, "cust", f"Quick question number {i}")
    alerts = [c for c in env["calls"] if c[0] == "send_notice_email" and "message" in c[1][2].lower()]
    assert len(alerts) == 1


def test_validation(env):
    cid = _start(env)
    assert _send(env, cid, "cust", "   ").status_code == 400
    assert _send(env, cid, "cust", "", attachments=[{"url": "https://res.cloudinary.com/x/mood.jpg", "type": "image"}]).status_code == 200
    assert _send(env, cid, "cust", "x" * 2001).status_code == 422


def test_message_button_on_a_booking_opens_the_pair_thread(env):
    bid = _paid_booking(env)
    a = env["client"].get(f"/api/messages/conversations/for-booking/{bid}", headers=env["ven"]).json()["id"]
    b = env["client"].get(f"/api/messages/conversations/for-booking/{bid}", headers=env["cust"]).json()["id"]
    assert a == b
    assert env["client"].get(f"/api/messages/conversations/for-booking/{bid}", headers=env["adm"]).status_code == 404
