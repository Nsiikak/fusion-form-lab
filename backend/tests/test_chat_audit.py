"""Stronger contact filter, blocked-attempt log, case-based admin chat access, notification log."""
import pytest

from app.entities.audit import ChatAccessLog, ContactAttempt
from app.entities.chat.contact_filter import classify
from tests.test_payments import _paid_booking, env  # noqa: F401

EVASIONS = ["ikenna,gmail.com", "ikenna gmail com", "ikenna gmail", "ikenna at yahoo", "ikenna@ gmail . com",
            "O8O3 123 4567", "08O31234567", "zero8zero3 1234567", "eight zero three one two three four five six seven",
            "0 8 0 3 1 2 3 4 5 6 7", "+44 7700 900123", "whatsapp me", "my IG is djslay", "on facebook",
            "www.mamangozi.com", "mamangozi.com.ng", "find me @chop_life", "reach me via telegram"]
ORDINARY = ["Budget is ₦250,000 for 300 guests", "Event on 24/10/2026 at 4pm", "Address: 12 Admiralty Way, Lekki",
            "Call me when you arrive", "Quote me for 1,200,000 naira", "Price is N3,360.50 per plate",
            "Table for 10, chairs for 200 at 3.5k each", "Please confirm by 10/24 at 6:30 pm", "My big day is on the 24th",
            "Order 1200 small chops for 2026 wedding", "One or two trays of jollof please", "Version 2.0 of the menu attached"]


@pytest.mark.parametrize("text", EVASIONS)
def test_evasions_are_caught(text):
    assert classify(text) is not None, text


@pytest.mark.parametrize("text", ORDINARY)
def test_ordinary_messages_pass(text):
    assert classify(text) is None, text


def test_blocked_attempts_are_logged_and_flagged(env):
    c = env["client"]
    cid = c.post("/api/messages/conversations", json={"vendor_id": env["vendor"].id}, headers=env["cust"]).json()["id"]
    for t in ["ikenna,gmail.com", "08O3 123 4567"]:
        assert c.post(f"/api/messages/conversations/{cid}/messages", json={"body": t}, headers=env["cust"]).status_code == 400
    rows = env["db"].query(ContactAttempt).all()
    assert [r.kind for r in rows] == ["email", "phone"]
    flagged = c.get("/api/admin/audit/flagged", headers=env["adm"]).json()
    assert flagged[0]["attempts"] == 2 and flagged[0]["recent"][0]["body"]


def test_admin_chat_access_needs_reason_and_is_logged(env):
    c = env["client"]
    bid = _paid_booking(env)
    assert c.get(f"/api/admin/conversations/between?booking_id={bid}", headers=env["adm"]).status_code == 422
    r = c.get(f"/api/admin/conversations/between?booking_id={bid}&reason=Dispute%20case%20review", headers=env["adm"])
    assert r.status_code == 200
    log = env["db"].query(ChatAccessLog).one()
    assert log.booking_id == bid and log.reason == "Dispute case review"
    assert c.get("/api/admin/audit/chat-access", headers=env["adm"]).json()[0]["reason"] == "Dispute case review"
    assert c.get("/api/admin/audit/chat-access", headers=env["cust"]).status_code == 403


def test_emails_are_stamped_and_logged(monkeypatch):
    import app.services.email as e
    from app.entities import audit
    sent, logged = {}, []
    monkeypatch.setattr(e, "send_email", lambda to, subj, html, att=None: (sent.update(html=html) or (True, "ok")))
    monkeypatch.setattr(audit, "log_notification", lambda *a, **k: logged.append(a))
    e.send_vendor_approved_email("v@x.com", "Ngozi Eze", "Mama Ngozi Kitchen")
    assert "WAT \u00b7 Ref N-" in sent["html"] and "{sent_stamp}" not in sent["html"]
    assert logged and logged[0][0] == "email" and logged[0][3] is True
