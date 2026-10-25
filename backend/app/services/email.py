import logging
import smtplib
import os
import re
import ssl
import threading
import time
from datetime import datetime
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid, parseaddr
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "email"

# Settings are read when an email is sent (not at import), so .env changes and import order
# can never leave the service silently unconfigured.
def _settings() -> dict:
    user = os.getenv("SMTP_USER", "").strip()
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com").strip(),
        "port": int(os.getenv("SMTP_PORT", "587") or 587),
        "user": user,
        # Gmail shows app passwords as "abcd efgh ijkl mnop" — the spaces aren't part of it
        "password": re.sub(r"\s+", "", os.getenv("SMTP_PASSWORD", "")),
        "from_name": os.getenv("EMAIL_FROM_NAME", "Plagohive").strip() or "Plagohive",
        "from_email": (os.getenv("EMAIL_FROM_ADDRESS", "") or user).strip(),
        "reply_to": os.getenv("EMAIL_REPLY_TO", "").strip(),
    }


FRONTEND_URL = os.getenv("FRONTEND_URL", "https://plagohive.netlify.app")


def smtp_problems() -> list[str]:
    """Configuration mistakes we can spot without connecting. Empty list = looks fine."""
    s = _settings()
    problems = []
    if not s["user"] or not s["password"]:
        problems.append("SMTP_USER and/or SMTP_PASSWORD are empty in backend/.env — no emails will be sent.")
    if s["user"] and "@" not in s["user"]:
        problems.append(f"SMTP_USER ({s['user']}) doesn't look like an email address.")
    if "gmail" in s["host"] and s["user"] and s["from_email"].lower() != s["user"].lower():
        problems.append(
            f"EMAIL_FROM_ADDRESS ({s['from_email']}) differs from SMTP_USER ({s['user']}). Gmail will rewrite "
            "the sender or mark mail as spam unless that address is a verified 'Send mail as' alias."
        )
    if "gmail" in s["host"] and s["password"] and len(s["password"]) != 16:
        problems.append(
            "SMTP_PASSWORD isn't 16 characters. Gmail needs an App Password (Google Account → Security → "
            "2-Step Verification → App passwords), not your normal Gmail password."
        )
    if s["port"] not in (465, 587, 25, 2525):
        problems.append(f"SMTP_PORT {s['port']} is unusual — Gmail uses 587 (STARTTLS) or 465 (SSL).")
    return problems


def _explain(exc: Exception) -> str:
    """Turn SMTP errors into something actionable."""
    text = str(exc)
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return (
            "Login rejected. For Gmail, SMTP_PASSWORD must be an App Password (needs 2-Step Verification). "
            "App passwords are revoked whenever the Google account password changes — create a new one. "
            f"[{text[:160]}]"
        )
    if "5.4.5" in text or "Daily user sending limit" in text or "quota" in text.lower():
        return f"Gmail's daily sending limit has been reached (about 500/day); it resets within 24 hours. [{text[:160]}]"
    if isinstance(exc, smtplib.SMTPSenderRefused):
        return f"Sender address refused — EMAIL_FROM_ADDRESS must be the SMTP account or a verified alias. [{text[:160]}]"
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return f"Recipient address refused. [{text[:160]}]"
    if isinstance(exc, (TimeoutError, OSError)) and not isinstance(exc, smtplib.SMTPException):
        return f"Couldn't reach the SMTP server — check SMTP_HOST/SMTP_PORT and that outbound SMTP isn't blocked by your network or host. [{text[:160]}]"
    return text[:300]


def _html_to_text(html: str) -> str:
    """Plain-text alternative. Mail clients and spam filters expect one alongside HTML."""
    text = re.sub(r"(?is)<(style|script|head).*?</\1>", "", html)
    text = re.sub(r'(?is)<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"\2 (\1)", text)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</tr>|</h[1-6]>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def _render(template: str, **kwargs) -> str:
    """Safe template renderer. Replaces {key} placeholders without touching CSS { } blocks.
    Every value is HTML-escaped (names, notes and other user text can't inject markup), except
    keys ending in _html, which we build ourselves from already-escaped parts."""
    import html as _h
    for key, value in kwargs.items():
        text = str(value) if key.endswith("_html") else _h.escape(str(value), quote=True)
        template = template.replace("{" + key + "}", text)
    return template


def _load_template(name: str) -> str:
    path = TEMPLATES_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Email template not found: {path}")
    return path.read_text(encoding="utf-8")


def _unsubscribe_token(email: str) -> str:
    secret = os.getenv("SECRET_KEY", "plagohive-secret")
    return hashlib.sha256(f"{email}:{secret}".encode()).hexdigest()[:32]


def _deliver(s: dict, to_email: str, msg: MIMEMultipart) -> None:
    context = ssl.create_default_context()
    if s["port"] == 465:
        with smtplib.SMTP_SSL(s["host"], s["port"], timeout=20, context=context) as server:
            server.login(s["user"], s["password"])
            server.sendmail(s["from_email"], [to_email], msg.as_string())
    else:
        with smtplib.SMTP(s["host"], s["port"], timeout=20) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(s["user"], s["password"])
            server.sendmail(s["from_email"], [to_email], msg.as_string())


TRANSIENT = (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError, TimeoutError, ConnectionError)


def send_email(to_email: str, subject: str, html: str, attachments=None) -> tuple[bool, str]:
    """Send one email. Returns (ok, message) — message explains any failure.
    Retries once on connection problems; never retries a rejected login.
    attachments: optional list of (filename, bytes) — PDFs such as receipts."""
    html = html.replace("{sent_stamp}", "")   # stamped by _send; direct callers just drop the placeholder
    s = _settings()
    if not s["user"] or not s["password"]:
        msg = "SMTP not configured (SMTP_USER / SMTP_PASSWORD empty in backend/.env)"
        logger.warning("%s — skipped email to %s [%s]", msg, to_email, subject)
        return False, msg

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"{s['from_name']} <{s['from_email']}>"
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=(parseaddr(s["from_email"])[1].split("@")[-1] or "plagohive.com"))
    if s["reply_to"]:
        msg["Reply-To"] = s["reply_to"]
    body = MIMEMultipart("alternative")
    body.attach(MIMEText(_html_to_text(html), "plain", "utf-8"))
    body.attach(MIMEText(html, "html", "utf-8"))
    msg.attach(body)
    for filename, data in attachments or []:
        part = MIMEApplication(data, _subtype="pdf" if filename.lower().endswith(".pdf") else "octet-stream")
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)

    for attempt in (1, 2):
        try:
            _deliver(s, to_email, msg)
            logger.info("Email sent to %s: %s", to_email, subject)
            return True, "sent"
        except TRANSIENT as exc:
            if attempt == 1:
                time.sleep(2)
                continue
            reason = _explain(exc)
        except Exception as exc:
            reason = _explain(exc)
        logger.error("Email to %s failed (%s): %s", to_email, subject, reason)
        return False, reason
    return False, "unknown error"


def _send(to_email: str, subject: str, html: str, attachments=None) -> bool:
    """Every email carries its send time and a reference, and is recorded in the notification log."""
    import secrets
    from datetime import timedelta, timezone
    ref = f"N-{secrets.token_hex(5).upper()}"
    # WAT is UTC+1 all year (no daylight saving). A fixed offset needs no time-zone database,
    # which Windows Python doesn't ship with — looking up "Africa/Lagos" broke every email there.
    stamp = datetime.now(timezone(timedelta(hours=1))).strftime("%d %b %Y, %H:%M WAT")
    html = html.replace("{sent_stamp}", f"Sent {stamp} \u00b7 Ref {ref}")
    ok, msg = send_email(to_email, subject, html, attachments)
    try:
        from app.entities.audit import log_notification
        log_notification("email", to_email, subject, ok, "" if ok else msg, ref, body=html)
    except Exception as exc:   # the audit log must never stop an email
        logger.error("Notification log failed: %s", exc)
    return ok


def _fire_and_forget(fn, *args, **kwargs):
    """Run an email send in a background thread so it never blocks the request.
    Anything that goes wrong (missing template, SMTP error) is logged, never lost."""
    def runner():
        try:
            fn(*args, **kwargs)
        except Exception:
            logger.exception("Email task %s failed", getattr(fn, "__name__", fn))

    threading.Thread(target=runner, daemon=True, name=f"email-{getattr(fn, '__name__', 'send')}").start()


def check_smtp_login() -> tuple[bool, str]:
    """Connect and log in without sending anything. Used at startup and by check_email.py."""
    s = _settings()
    if not s["user"] or not s["password"]:
        return False, "SMTP_USER / SMTP_PASSWORD are empty"
    try:
        context = ssl.create_default_context()
        if s["port"] == 465:
            with smtplib.SMTP_SSL(s["host"], s["port"], timeout=15, context=context) as server:
                server.login(s["user"], s["password"])
        else:
            with smtplib.SMTP(s["host"], s["port"], timeout=15) as server:
                server.ehlo(); server.starttls(context=context); server.ehlo()
                server.login(s["user"], s["password"])
        return True, f"logged in to {s['host']}:{s['port']} as {s['user']}"
    except Exception as exc:
        return False, _explain(exc)


def _base_vars(email: str) -> dict:
    return {
        "frontend_url": FRONTEND_URL,
        "year": str(datetime.now().year),
        "unsubscribe_token": _unsubscribe_token(email),
        "email": email,
    }


# ─────────────────────────────────────────────
# Public functions — one per email type
# ─────────────────────────────────────────────

# ── Every email uses the same branded layout (notice.html) ─────────────────────
# Booking emails add a details table; all user text is escaped in send_notice_email.

def send_welcome_email(email: str, full_name: str) -> bool:
    first = (full_name or email).split()[0].capitalize()
    return send_notice_email(email, full_name, f"Welcome to Plagohive, {first}! \U0001F389", "Welcome", "You're in.",
        ["Plagohive is the safe way to book event vendors in Nigeria: verified caterers, decorators, DJs and more.",
         "When you book, your payment is held until your event is done. If a vendor cancels or doesn't show, you get every naira back."],
        "Find vendors", "/vendor-search")


def send_vendor_welcome_email(email: str, full_name: str, business_name: str) -> bool:
    return send_notice_email(email, full_name, f"Your Plagohive vendor profile is under review — {business_name}", "Vendor sign-up",
        f"Thanks for joining, {business_name}",
        ["We're checking your details (including your CAC registration). Most reviews finish within 1–2 working days.",
         "Meanwhile, finish your profile: add photos, your services and prices, your logistics fee and your bank account for payouts.",
         "Once you're verified, customers can book you and pay safely. You're paid after each event."],
        "Complete my profile", "/profile")


def send_login_notification(email: str, full_name: str, role: str) -> bool:
    when = datetime.now().strftime("%d %b %Y, %H:%M")
    return send_notice_email(email, full_name, "New sign-in to your Plagohive account", "Security", "New sign-in",
        [f"Your account was signed in on {when}.",
         "If this was you, there's nothing to do. If not, reset your password straight away."],
        "Reset password", "/forgot-password")


def send_booking_confirmation_to_customer(customer_email, customer_name, booking_id, vendor_name, vendor_category,
                                          event_date, event_time, amount, attachments=None) -> bool:
    return send_notice_email(customer_email, customer_name, f"Booking request sent to {vendor_name}", "Booking received",
        "Your payment is held safely",
        [f"We've sent your request to {vendor_name}. You'll get an email when they accept.",
         "If they decline or don't respond within 48 hours, you're refunded in full automatically. Your receipt is attached."],
        "View my booking", "/customer-dashboard", attachments=attachments,
        details=[("Booking", f"#{booking_id}"), ("Vendor", f"{vendor_name} ({vendor_category})"),
                 ("Date", f"{event_date}{(' at ' + event_time) if event_time else ''}"), ("Paid", f"\u20a6{amount}")])


def send_booking_request_to_vendor(vendor_email, vendor_name, vendor_full_name, booking_id, customer_name, customer_phone,
                                   event_date, event_time, amount, notes, business_name) -> bool:
    return send_notice_email(vendor_email, vendor_full_name or vendor_name, f"New booking request — {customer_name}",
        "New booking", "A customer has booked and paid",
        ["The payment is held by Plagohive. Accept or decline within 48 hours, or the customer is refunded automatically.",
         "You're paid after the event, once the customer confirms (or 24 hours after you mark it complete)."],
        "Review request", "/vendor-dashboard",
        details=[("Booking", f"#{booking_id}"), ("Customer", customer_name),
                 ("Date", f"{event_date}{(' at ' + event_time) if event_time else ''}"), ("Your price", f"\u20a6{amount}"),
                 ("Notes", notes or "—")])


def send_booking_accepted_to_customer(customer_email, customer_name, booking_id, vendor_name, vendor_category,
                                      event_date, amount) -> bool:
    return send_notice_email(customer_email, customer_name, f"{vendor_name} accepted your booking!", "Booking confirmed",
        "You're all set",
        [f"{vendor_name} has accepted your booking. Your money stays held until you confirm the service.",
         "A week before the event we'll check in with you both, and you'll see each other's phone numbers once they reconfirm."],
        "View my booking", "/customer-dashboard",
        details=[("Booking", f"#{booking_id}"), ("Vendor", f"{vendor_name} ({vendor_category})"), ("Date", event_date),
                 ("Paid", f"\u20a6{amount}")])


def send_booking_declined_to_customer(customer_email, customer_name, booking_id, vendor_name, event_date) -> bool:
    return send_notice_email(customer_email, customer_name, f"Booking update from {vendor_name}", "Booking update",
        "Your full refund is on its way",
        [f"{vendor_name} couldn't take your booking for {event_date}. We've started a full refund, including our fee.",
         "Refunds usually reach your card or account within 5–10 working days. Plenty of other verified vendors are ready to help."],
        "Find another vendor", "/vendor-search", details=[("Booking", f"#{booking_id}")])


def send_vendor_approved_email(email: str, full_name: str, business_name: str) -> bool:
    return send_notice_email(email, full_name, f"{business_name} is now Plagohive Verified", "Verified",
        "You're verified and live",
        ["Customers can now find and book you. Your verified badge shows on your profile and in search.",
         "Tip: download your \"Verified · Now accepting bookings\" card from your dashboard and share it on Instagram and WhatsApp."],
        "Open my dashboard", "/vendor-dashboard")


def send_password_reset_email(email: str, full_name: str, token: str) -> bool:
    return send_notice_email(email, full_name, "Reset your Plagohive password", "Security", "Reset your password",
        ["Tap the button below to choose a new password. The link works once and expires in 1 hour.",
         "If you didn't ask for this, you can ignore this email; your password won't change."],
        "Choose a new password", f"/reset-password?token={token}")


def send_completion_pending_to_customer(customer_email, customer_name, booking_id, vendor_name, event_date, amount) -> bool:
    """Vendor marked the event complete; payment auto-releases in 24 hours unless the customer reports a problem."""
    return send_notice_email(customer_email, customer_name, f"Action required: confirm your event with {vendor_name}",
        "Confirm the service", f"Did {vendor_name} deliver?",
        [f"{vendor_name} has marked your event on {event_date} as complete.",
         "If everything went well, confirm it so they're paid. If something went wrong, report a problem and we'll hold the payment while we look into it.",
         "If you do nothing, the payment is released automatically in 24 hours."],
        "Confirm or report a problem", "/customer-dashboard",
        details=[("Booking", f"#{booking_id}"), ("Vendor", vendor_name), ("Amount held", f"\u20a6{amount}")])


def send_cac_verification_email(email: str, full_name: str, business_name: str, verified: bool,
                                cac_verified_name: str | None = None) -> bool:
    """CAC verification outcome (automatic or manual)."""
    if verified:
        return send_notice_email(email, full_name, f"CAC verified — {business_name} is now Plagohive Verified",
            "CAC verification", "Your business is verified",
            [f"We matched {business_name} with the Corporate Affairs Commission (CAC) register.",
             "Your verified badge is now live and customers can book you."],
            "Open my dashboard", "/vendor-dashboard",
            details=[("Matched CAC record", cac_verified_name)] if cac_verified_name else None)
    if cac_verified_name:
        return send_notice_email(email, full_name, "CAC verification update — manual review", "CAC verification",
            "We're checking one detail",
            [f"We found your RC number, but the registered name is slightly different from {business_name}.",
             "Our team will review it, usually within 1–2 working days. You don't need to do anything unless we contact you."],
            "Open my dashboard", "/vendor-dashboard", details=[("Name on the CAC register", cac_verified_name)])
    return send_notice_email(email, full_name, "CAC verification update — action required", "CAC verification",
        "We couldn't verify your RC number",
        [f"We couldn't find the RC number for {business_name} on the CAC register.",
         "Check it for typos on your profile and tap Re-verify on your dashboard. If you're not CAC-registered yet, contact us and we'll help."],
        "Update my details", "/profile")


def send_review_request(customer_email, customer_name, booking_id, vendor_name, event_date) -> bool:
    return send_notice_email(customer_email, customer_name, f"How was your event with {vendor_name}?", "Review",
        "Tell others how it went",
        [f"Thanks for booking {vendor_name} for {event_date}. A quick review helps other customers choose, and helps good vendors grow.",
         "It takes less than a minute."],
        "Leave a review", f"/vendors/review?booking_id={booking_id}")



def send_notice_email(
    email: str,
    full_name: str,
    subject: str,
    eyebrow: str,
    heading: str,
    paragraphs: list[str],
    cta_text: str = "Open Plagohive",
    cta_path: str = "/",
    attachments=None,
    details=None,
) -> bool:
    """Generic branded notice. Every paragraph is HTML-escaped, so user-written text
    (dispute reasons, admin notes) is safe to pass in."""
    import html as _html

    first_name = (full_name or email).split()[0].capitalize()
    body_html = "".join(
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#52525B;">'
        + _html.escape(p).replace("\n", "<br />")
        + "</p>"
        for p in [f"Hi {first_name},", *paragraphs]
    )
    if details:
        rows = "".join(
            f'<tr><td style="padding:8px 0;font-size:13px;color:#71717A;width:38%;vertical-align:top;">{_html.escape(str(k))}</td>'
            f'<td style="padding:8px 0;font-size:14px;color:#13213C;font-weight:600;">{_html.escape(str(v))}</td></tr>'
            for k, v in details if v not in (None, "")
        )
        body_html += ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
                      'style="margin:4px 0 20px;border-top:1px solid #F3DDBF;border-bottom:1px solid #F3DDBF;">' + rows + '</table>')
    html_doc = _render(
        _load_template("notice.html"),
        eyebrow=eyebrow,
        heading=heading,
        body_html=body_html,
        cta_text=cta_text,
        cta_url=f"{FRONTEND_URL}{cta_path}",
        **_base_vars(email),
    )
    return _send(email, subject, html_doc, attachments)
