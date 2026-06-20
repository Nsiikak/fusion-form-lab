import logging
import smtplib
import os
import re
import threading
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "email"

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Plagohive")
FROM_EMAIL = os.getenv("EMAIL_FROM_ADDRESS", SMTP_USER)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://plagohive.netlify.app")


def _render(template: str, **kwargs) -> str:
    """Safe template renderer. Replaces {key} placeholders without touching CSS { } blocks."""
    for key, value in kwargs.items():
        template = template.replace("{" + key + "}", str(value))
    return template


def _load_template(name: str) -> str:
    path = TEMPLATES_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Email template not found: {path}")
    return path.read_text(encoding="utf-8")


def _unsubscribe_token(email: str) -> str:
    secret = os.getenv("SECRET_KEY", "plagohive-secret")
    return hashlib.sha256(f"{email}:{secret}".encode()).hexdigest()[:32]


def _send(to_email: str, subject: str, html: str) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping email to %s [%s]", to_email, subject)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html", "utf-8"))

        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(FROM_EMAIL, [to_email], msg.as_string())

        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("Email delivery failed to %s (%s): %s", to_email, subject, exc)
        return False


def _fire_and_forget(fn, *args):
    """Run an email send in a daemon thread so it never blocks the request."""
    threading.Thread(target=fn, args=args, daemon=True).start()


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

def send_welcome_email(email: str, full_name: str) -> bool:
    first_name = (full_name or email).split()[0].capitalize()
    html = _render(
        _load_template("welcome.html"),
        first_name=first_name,
        **_base_vars(email),
    )
    return _send(email, f"Welcome to Plagohive, {first_name}! 🎉", html)


def send_vendor_welcome_email(email: str, full_name: str, business_name: str) -> bool:
    first_name = (full_name or email).split()[0].capitalize()
    html = _render(
        _load_template("vendor_welcome.html"),
        first_name=first_name,
        business_name=business_name,
        **_base_vars(email),
    )
    return _send(email, f"Your Plagohive vendor profile is under review — {business_name}", html)


def send_login_notification(email: str, full_name: str, role: str) -> bool:
    first_name = (full_name or email).split()[0].capitalize()
    login_time = datetime.now().strftime("%d %b %Y at %I:%M %p")
    html = _render(
        _load_template("login_notification.html"),
        first_name=first_name,
        login_time=login_time,
        role=role,
        **_base_vars(email),
    )
    return _send(email, "New sign-in to your Plagohive account", html)


def send_booking_confirmation_to_customer(
    customer_email: str,
    customer_name: str,
    booking_id: int,
    vendor_name: str,
    vendor_category: str,
    event_date: str,
    event_time: str,
    amount: str,
) -> bool:
    first_name = (customer_name or customer_email).split()[0].capitalize()
    html = _render(
        _load_template("booking_confirmation_customer.html"),
        first_name=first_name,
        booking_id=booking_id,
        vendor_name=vendor_name,
        vendor_category=vendor_category,
        event_date=event_date,
        event_time=event_time,
        amount=amount,
        **_base_vars(customer_email),
    )
    return _send(customer_email, f"Booking request sent to {vendor_name} ✅", html)


def send_booking_request_to_vendor(
    vendor_email: str,
    vendor_name: str,
    vendor_full_name: str,
    booking_id: int,
    customer_name: str,
    customer_phone: str,
    event_date: str,
    event_time: str,
    amount: str,
    notes: str,
    business_name: str,
) -> bool:
    vendor_first_name = (vendor_full_name or vendor_email).split()[0].capitalize()
    html = _render(
        _load_template("booking_request_vendor.html"),
        vendor_first_name=vendor_first_name,
        business_name=business_name,
        booking_id=booking_id,
        customer_name=customer_name,
        customer_phone=customer_phone or "Not provided",
        event_date=event_date,
        event_time=event_time or "To be confirmed",
        amount=amount,
        notes=notes or "No additional notes.",
        vendor_name=vendor_name,
        **_base_vars(vendor_email),
    )
    return _send(vendor_email, f"🔔 New booking request — {customer_name}", html)


def send_booking_accepted_to_customer(
    customer_email: str,
    customer_name: str,
    booking_id: int,
    vendor_name: str,
    vendor_category: str,
    event_date: str,
    amount: str,
) -> bool:
    first_name = (customer_name or customer_email).split()[0].capitalize()
    html = _render(
        _load_template("booking_accepted.html"),
        first_name=first_name,
        booking_id=booking_id,
        vendor_name=vendor_name,
        vendor_category=vendor_category,
        event_date=event_date,
        amount=amount,
        **_base_vars(customer_email),
    )
    return _send(customer_email, f"🎉 {vendor_name} accepted your booking!", html)


def send_booking_declined_to_customer(
    customer_email: str,
    customer_name: str,
    booking_id: int,
    vendor_name: str,
    event_date: str,
) -> bool:
    first_name = (customer_name or customer_email).split()[0].capitalize()
    html = _render(
        _load_template("booking_declined.html"),
        first_name=first_name,
        booking_id=booking_id,
        vendor_name=vendor_name,
        event_date=event_date,
        **_base_vars(customer_email),
    )
    return _send(customer_email, f"Booking update from {vendor_name}", html)


def send_vendor_approved_email(email: str, full_name: str, business_name: str) -> bool:
    first_name = (full_name or email).split()[0].capitalize()
    html = _render(
        _load_template("vendor_approved.html"),
        first_name=first_name,
        business_name=business_name,
        **_base_vars(email),
    )
    return _send(email, f"🏆 Congratulations! {business_name} is now Plagohive Verified", html)


def send_password_reset_email(email: str, full_name: str, token: str) -> bool:
    first_name = (full_name or email).split()[0].capitalize()
    frontend_url = FRONTEND_URL
    reset_url = f"{frontend_url}/reset-password?token={token}"
    html = _render(
        _load_template("password_reset.html"),
        first_name=first_name,
        reset_url=reset_url,
        **_base_vars(email),
    )
    return _send(email, "Reset your Plagohive password", html)


def send_completion_pending_to_customer(
    customer_email: str,
    customer_name: str,
    booking_id: int,
    vendor_name: str,
    event_date: str,
    amount: str,
) -> bool:
    """Notify customer that vendor marked the event complete and payment will auto-release in 24h."""
    first_name = (customer_name or customer_email).split()[0].capitalize()
    dashboard_url = f"{FRONTEND_URL}/customer-dashboard"
    html = f"""<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#6c47ff">Your vendor has marked the event complete</h2>
<p>Hi {first_name},</p>
<p><strong>{vendor_name}</strong> has marked Booking <strong>#{booking_id}</strong> (event on {event_date}) as complete and your payment of <strong>₦{amount}</strong> is now held in escrow.</p>
<p><strong>What happens next:</strong></p>
<ul>
<li>If you confirm the event went well, payment is released to {vendor_name} immediately.</li>
<li>If you take no action within <strong>24 hours</strong>, payment is automatically released to the vendor.</li>
<li>If you have a dispute, please contact Plagohive support before confirming.</li>
</ul>
<p style="margin:24px 0"><a href="{dashboard_url}" style="background:#6c47ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Confirm or Review Booking</a></p>
<p style="color:#888;font-size:12px">Plagohive &copy; {datetime.now().year}</p>
</body></html>"""
    return _send(customer_email, f"Action required: Confirm your event with {vendor_name}", html)


def send_cac_verification_email(
    email: str,
    full_name: str,
    business_name: str,
    verified: bool,
    cac_verified_name: str | None = None,
) -> bool:
    """Notify vendor of their CAC verification outcome (both auto and manual)."""
    first_name = (full_name or email).split()[0].capitalize()
    dashboard_url = f"{FRONTEND_URL}/vendor-dashboard"

    if verified:
        subject = f"✅ CAC Verified — {business_name} is now Plagohive Verified"
        status_block = f"""
<p>Great news, {first_name}!</p>
<p>Your business <strong>{business_name}</strong> has been automatically verified against the
Corporate Affairs Commission (CAC) database.</p>
{"<p>Matched CAC record: <strong>" + cac_verified_name + "</strong></p>" if cac_verified_name else ""}
<h3>What this means:</h3>
<ul>
  <li>Your vendor profile is now <strong>Verified ✓</strong> and visible to customers.</li>
  <li>You can start receiving booking requests immediately.</li>
  <li>Add service items and bank details to complete your setup and receive payouts.</li>
</ul>"""
    elif cac_verified_name:
        subject = f"CAC Verification Update — Manual Review Required"
        status_block = f"""
<p>Hi {first_name},</p>
<p>We found your RC number in the CAC database, but there is a slight name mismatch between your
registered name (<strong>{business_name}</strong>) and the CAC record
(<strong>{cac_verified_name}</strong>).</p>
<h3>What happens next:</h3>
<ul>
  <li>Our team will review your application manually within <strong>48 hours</strong>.</li>
  <li>You will receive another email once your verification is updated.</li>
  <li>If you believe this is an error, please update your business name to match the CAC record exactly.</li>
</ul>"""
    else:
        subject = f"CAC Verification Update — Action Required"
        status_block = f"""
<p>Hi {first_name},</p>
<p>We were unable to automatically verify your RC number for <strong>{business_name}</strong> in the
CAC database.</p>
<h3>What to do next:</h3>
<ul>
  <li>Double-check your RC Number is correct (format: RC1234567).</li>
  <li>Update your profile if there is a typo, then click "Re-verify" on your dashboard.</li>
  <li>Our team will also review your application manually within <strong>48 hours</strong>.</li>
</ul>"""

    html = f"""<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;padding:20px">
<div style="border-left:4px solid #6c47ff;padding-left:16px;margin-bottom:20px">
  <h2 style="color:#6c47ff;margin:0">CAC Verification Update</h2>
</div>
{status_block}
<p style="margin:24px 0">
  <a href="{dashboard_url}" style="background:#6c47ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
    Go to Dashboard
  </a>
</p>
<p style="color:#888;font-size:12px">Plagohive &copy; {datetime.now().year} &middot; Questions? Reply to this email.</p>
</body></html>"""
    return _send(email, subject, html)


def send_review_request(
    customer_email: str,
    customer_name: str,
    booking_id: int,
    vendor_name: str,
    event_date: str,
) -> bool:
    first_name = (customer_name or customer_email).split()[0].capitalize()
    review_url = f"{FRONTEND_URL}/vendors/review?booking_id={booking_id}"
    html = _render(
        _load_template("review_request.html"),
        first_name=first_name,
        booking_id=booking_id,
        vendor_name=vendor_name,
        event_date=event_date,
        review_url=review_url,
        **_base_vars(customer_email),
    )
    return _send(customer_email, f"How was your event with {vendor_name}? Leave a review ⭐", html)
