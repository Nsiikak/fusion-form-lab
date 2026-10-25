from datetime import datetime, timezone
import logging

from sqlalchemy.orm import Session

from app.entities.booking.model import Booking, BookingStatus
from app.entities.user.model import User
from app.entities.vendor.model import Vendor
from app.services.email import (
    _fire_and_forget,
    send_booking_accepted_to_customer,
    send_booking_confirmation_to_customer,
    send_booking_declined_to_customer,
    send_booking_request_to_vendor,
    send_completion_pending_to_customer,
    send_review_request,
)

logger = logging.getLogger(__name__)


def _fmt(amount) -> str:
    return f"{float(amount or 0):,.0f}"


def _dates(booking: Booking) -> tuple[str, str]:
    event_date = booking.event_date.strftime("%d %B %Y")
    event_time = booking.event_time.strftime("%I:%M %p") if booking.event_time else "TBD"
    return event_date, event_time


def _receipt_attachment(booking: Booking):
    try:
        from app.services.documents import payment_receipt_pdf
        return [(f"Plagohive-receipt-{booking.receipt_number or booking.id}.pdf", payment_receipt_pdf(booking))]
    except Exception as exc:  # a PDF problem must never stop the confirmation email
        logger.error("Couldn't build receipt for booking %s: %s", booking.id, exc)
        return None


def notify_booking_paid(db: Session, booking: Booking) -> None:
    try:
        sms_new_request(db, booking)
    except Exception as exc:
        logger.error("SMS alert failed for %s: %s", booking.id, exc)
    _notify_booking_paid_email(db, booking)


def _notify_booking_paid_email(db: Session, booking: Booking) -> None:
    """Customer receipt (shows what they paid) + vendor request (shows the vendor's price)."""
    try:
        customer = db.query(User).filter(User.id == booking.customer_id).first()
        vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
        vendor_user = db.query(User).filter(User.id == vendor.user_id).first() if vendor else None
        event_date, event_time = _dates(booking)

        if customer:
            _fire_and_forget(
                send_booking_confirmation_to_customer,
                customer.email,
                customer.full_name or customer.email,
                booking.id,
                vendor.business_name if vendor else "Vendor",
                vendor.category.value if vendor else "",
                event_date, event_time, _fmt(booking.customer_total),
                attachments=_receipt_attachment(booking),
            )
        if vendor and vendor_user and customer:
            _fire_and_forget(
                send_booking_request_to_vendor,
                vendor_user.email,
                vendor.business_name,
                vendor_user.full_name or vendor_user.email,
                booking.id,
                customer.full_name or customer.email,
                customer.phone_number or "",
                event_date, event_time, _fmt(booking.price),
                booking.notes or "",
                vendor.business_name,
            )
    except Exception as exc:  # emails must never break the payment path
        logger.error("Failed to send booking-paid emails for %s: %s", booking.id, exc)


def notify_status_change(db: Session, booking: Booking, new_status: BookingStatus) -> None:
    try:
        customer = db.query(User).filter(User.id == booking.customer_id).first()
        vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
        if not customer or not vendor:
            return
        name = customer.full_name or customer.email
        event_date, _ = _dates(booking)
        amount = _fmt(booking.customer_total)

        if new_status == BookingStatus.CONFIRMED:
            _fire_and_forget(send_booking_accepted_to_customer, customer.email, name, booking.id,
                             vendor.business_name, vendor.category.value, event_date, amount)
        elif new_status == BookingStatus.AWAITING_CONFIRMATION:
            _fire_and_forget(send_completion_pending_to_customer, customer.email, name, booking.id,
                             vendor.business_name, event_date, amount)
        elif new_status == BookingStatus.COMPLETED:
            _fire_and_forget(send_review_request, customer.email, name, booking.id,
                             vendor.business_name, event_date)
        elif new_status in (BookingStatus.DECLINED, BookingStatus.CANCELLED) and booking.paid_at:
            _fire_and_forget(send_booking_declined_to_customer, customer.email, name, booking.id,
                             vendor.business_name, event_date)
    except Exception as exc:
        logger.error("Failed to send status email for booking %s: %s", booking.id, exc)


def _ref(booking: Booking) -> str:
    return f"#{booking.id}"


def notify_dispute_opened(db: Session, booking: Booking) -> None:
    from app.core.config import ADMIN_ALERT_EMAILS
    from app.services.email import send_notice_email
    try:
        vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
        vendor_user = db.query(User).filter(User.id == vendor.user_id).first() if vendor else None
        if vendor_user:
            _fire_and_forget(
                send_notice_email, vendor_user.email, vendor_user.full_name or vendor_user.email,
                f"A customer reported a problem with booking {_ref(booking)}",
                "Booking under review", "A customer has reported a problem",
                [
                    f"The customer for booking {_ref(booking)} has reported an issue, so the payment is on hold "
                    "while our team reviews it. Here is what they told us:",
                    booking.dispute_reason or "",
                    "Our team may contact you for your side. Please reply to this email with any details or "
                    "evidence (photos, messages, delivery confirmation) that will help us resolve it quickly.",
                ],
                "View booking", "/vendor-dashboard",
            )
        for admin_email in ADMIN_ALERT_EMAILS:
            _fire_and_forget(
                send_notice_email, admin_email, "Admin",
                f"[Plagohive] New dispute on booking {_ref(booking)}",
                "Action needed", f"New dispute on booking {_ref(booking)}",
                [f"Vendor: {vendor.business_name if vendor else 'unknown'}", booking.dispute_reason or ""],
                "Open admin dashboard", "/admin",
            )
    except Exception as exc:
        logger.error("Failed to send dispute emails for %s: %s", booking.id, exc)


def notify_resolution(db: Session, booking: Booking) -> None:
    from app.services.email import send_notice_email
    try:
        customer = db.query(User).filter(User.id == booking.customer_id).first()
        vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
        vendor_user = db.query(User).filter(User.id == vendor.user_id).first() if vendor else None
        note = booking.resolution_note or ""
        refunded = booking.resolution == "refund"

        if customer:
            _fire_and_forget(
                send_notice_email, customer.email, customer.full_name or customer.email,
                f"Update on booking {_ref(booking)}", "Decision", "We've reviewed your booking",
                [
                    ("We've issued a full refund to your original payment method. Refunds usually arrive "
                     "within 5–10 working days, depending on your bank.")
                    if refunded else
                    "After reviewing the booking, we've released the payment to the vendor.",
                    f"Note from our team: {note}",
                ],
                "View booking", "/customer-dashboard",
            )
        if vendor_user:
            _fire_and_forget(
                send_notice_email, vendor_user.email, vendor_user.full_name or vendor_user.email,
                f"Update on booking {_ref(booking)}", "Decision", "We've reviewed this booking",
                [
                    "After reviewing the booking, the customer has been refunded and no payout will be made."
                    if refunded else
                    "After reviewing the booking, we've released your payout. It's on its way to your bank account.",
                    f"Note from our team: {note}",
                ],
                "View booking", "/vendor-dashboard",
            )
    except Exception as exc:
        logger.error("Failed to send resolution emails for %s: %s", booking.id, exc)


def notify_payout_sent(db: Session, booking: Booking) -> None:
    """Vendor: your money has landed — with the payout statement attached."""
    from app.services.email import send_notice_email
    try:
        vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
        vendor_user = db.query(User).filter(User.id == vendor.user_id).first() if vendor else None
        if not vendor_user:
            return
        attachments = None
        try:
            from app.services.documents import payout_statement_pdf
            attachments = [(f"Plagohive-payout-{booking.payout_statement_number or booking.id}.pdf",
                            payout_statement_pdf(booking))]
        except Exception as exc:
            logger.error("Couldn't build payout statement for booking %s: %s", booking.id, exc)
        _fire_and_forget(
            send_notice_email, vendor_user.email, vendor_user.full_name or vendor_user.email,
            f"You've been paid ₦{_fmt(booking.payout_amount)} for booking {_ref(booking)}",
            "Payout sent", f"₦{_fmt(booking.payout_amount)} is on its way to your bank",
            [
                f"Your payout for booking {_ref(booking)} has been sent to your bank account. "
                "Depending on your bank, it can take a few minutes to show.",
                f"Booking amount ₦{_fmt(booking.price)} − Plagohive commission ₦{_fmt(booking.commission_amount)} "
                f"= ₦{_fmt(booking.payout_amount)} paid to you.",
                "Your payout statement is attached for your records.",
            ],
            "View my bookings", "/vendor-dashboard",
            attachments=attachments,
        )
    except Exception as exc:
        logger.error("Failed to send payout email for %s: %s", booking.id, exc)


def notify_refund_needs_account(db: Session, booking: Booking, customer: User) -> None:
    """Customer: Paystack can't return the money automatically — add a refund account."""
    from app.services.email import send_notice_email
    try:
        _fire_and_forget(
            send_notice_email, customer.email, customer.full_name or customer.email,
            f"Action needed: where should we send your refund for booking {_ref(booking)}?",
            "Refund", "We need an account for your refund",
            [
                f"We're refunding ₦{_fmt(booking.customer_total)} for booking {_ref(booking)}, but your bank "
                "didn't share the account you paid from, so we can't send it back automatically.",
                "Add a bank account in your Plagohive dashboard (Refund account) and we'll send the refund "
                "straight away. It must be an account in your name.",
            ],
            "Add refund account", "/customer-dashboard",
        )
    except Exception as exc:
        logger.error("Failed to send refund-account email for %s: %s", booking.id, exc)


# ── Phase 2: countdown check-ins, vendor accountability ─────────────────────

def _send(user, subject, eyebrow, heading, paragraphs, cta_text, cta_path):
    from app.services.email import send_notice_email
    if user:
        _fire_and_forget(send_notice_email, user.email, user.full_name or user.email, subject, eyebrow, heading,
                         [p for p in paragraphs if p], cta_text, cta_path)


def _parties(db: Session, booking: Booking):
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == booking.vendor_id).first()
    vendor_user = db.query(User).filter(User.id == vendor.user_id).first() if vendor else None
    return customer, vendor, vendor_user


def _when(booking: Booking) -> str:
    return booking.event_date.strftime("%A %d %B") + (f" at {booking.event_time.strftime('%I:%M %p')}" if booking.event_time else "")


def _venue(booking: Booking) -> str:
    a = booking.event_address or {}
    return ", ".join(x for x in [a.get("venue_name"), a.get("city"), a.get("state")] if x) or "venue not added yet"


def notify_countdown_customer(db: Session, booking: Booking, stage: str) -> None:
    try:
        customer, vendor, vendor_user = _parties(db, booking)
        name = vendor.business_name if vendor else "your vendor"
        if stage == "t7":
            days = max(1, round((booking.event_date - datetime.now(booking.event_date.tzinfo or timezone.utc)).total_seconds() / 86400))
            _send(customer, f"{days} days to go — {name} on {_when(booking)}", "Event check-in", f"Your event is {days} days away",
                  [f"{name} is booked for {_when(booking)} at {_venue(booking)}.",
                   "Quick check: are the venue, start time, guest count and access details right? If anything has "
                   "changed, message the vendor on Plagohive now so they can plan.",
                   "We've asked the vendor to reconfirm. You'll see their phone number once they do."],
                  "Check my booking", "/customer-dashboard")
        elif stage == "t2":
            phone = vendor_user.phone_number if (vendor_user and booking.reconfirmed_at) else None
            _send(customer, f"Two days to go — final details for {name}", "Event check-in", "Almost there",
                  [f"{name} · {_when(booking)} · {_venue(booking)}.",
                   f"Vendor's phone: {phone}" if phone else "We're still waiting for the vendor to reconfirm — our team is following up.",
                   "If something doesn't look right, tap Report a problem on your booking and we'll step in."],
                  "View booking", "/customer-dashboard")
        elif stage == "day":
            _send(customer, f"Today's the day! {name} is booked for {_when(booking)}", "Event day", "Enjoy your event",
                  ["Your vendor will check in on Plagohive when they arrive.",
                   "If they don't turn up, tap \u201cVendor didn't show up?\u201d on your booking — we'll act fast and you'll be refunded in full if they can't explain."],
                  "Open my booking", "/customer-dashboard")
    except Exception as exc:
        logger.error("Countdown email (customer, %s) failed for %s: %s", stage, booking.id, exc)


def notify_countdown_vendor(db: Session, booking: Booking, stage: str) -> None:
    try:
        customer, vendor, vendor_user = _parties(db, booking)
        cname = (customer.full_name if customer else None) or "your customer"
        if stage == "t7":
            _send(vendor_user, f"Please reconfirm booking #{booking.id} — {_when(booking)}", "Action needed",
                  "Reconfirm your booking",
                  [f"{cname} · {_when(booking)} · {_venue(booking)}.",
                   "Tap Reconfirm on your dashboard to let them know you're all set. Once you do, you'll both see each other's phone numbers.",
                   "If you can't do it any more, cancel as early as possible — late cancellations carry a fee and a strike."],
                  "Reconfirm now", "/vendor-dashboard")
        elif stage == "t2":
            phone = customer.phone_number if (customer and booking.reconfirmed_at) else None
            _send(vendor_user, f"Two days to go — booking #{booking.id}", "Event check-in", "Final details",
                  [f"{cname} · {_when(booking)} · {_venue(booking)}.",
                   f"Customer's phone: {phone}" if phone else "Please reconfirm the booking on your dashboard today.",
                   (booking.notes and f"Their notes: {booking.notes}") or ""],
                  "View booking", "/vendor-dashboard")
        elif stage == "day":
            _send(vendor_user, f"Event day — check in when you arrive (booking #{booking.id})", "Event day",
                  "Check in when you arrive",
                  [f"{cname} · {_when(booking)} · {_venue(booking)}.",
                   "Tap \u201cI've arrived\u201d on your dashboard when you get there. It protects you if there's ever a question about attendance."],
                  "Open my dashboard", "/vendor-dashboard")
    except Exception as exc:
        logger.error("Countdown email (vendor, %s) failed for %s: %s", stage, booking.id, exc)


def notify_reconfirm_overdue(db: Session, booking: Booking) -> None:
    from app.core.config import ADMIN_ALERT_EMAILS
    try:
        customer, vendor, vendor_user = _parties(db, booking)
        name = vendor.business_name if vendor else "The vendor"
        _send(customer, f"We're checking in with {name} for you", "Event check-in", "We're on it",
              [f"{name} hasn't reconfirmed your booking for {_when(booking)} yet, so our team is contacting them directly.",
               "You don't need to do anything. If they can't make it, you'll get a full refund and help finding someone else."],
              "View booking", "/customer-dashboard")
        _send(vendor_user, f"Reminder: reconfirm booking #{booking.id} today", "Action needed", "Please reconfirm today",
              [f"Your customer's event is on {_when(booking)}. Tap Reconfirm on your dashboard so they know you're coming."],
              "Reconfirm now", "/vendor-dashboard")
        from app.services.email import send_notice_email
        for email in ADMIN_ALERT_EMAILS:
            _fire_and_forget(send_notice_email, email, "Admin", f"[Plagohive] Booking #{booking.id} not reconfirmed",
                             "Follow up", f"{name} hasn't reconfirmed",
                             [f"Event: {_when(booking)} · {_venue(booking)}",
                              f"Vendor phone: {vendor_user.phone_number if vendor_user else '—'}"],
                             "Open upcoming events", "/admin")
    except Exception as exc:
        logger.error("Reconfirm chase failed for %s: %s", booking.id, exc)


def _alternatives(db: Session, booking: Booking, vendor: Vendor) -> list[str]:
    from app.entities.vendor.model import VerificationStatus
    city = ((booking.event_address or {}).get("city") or "").strip()
    q = db.query(Vendor).filter(Vendor.id != vendor.id, Vendor.category == vendor.category, Vendor.is_active == True,  # noqa: E712
                                Vendor.verification_status == VerificationStatus.APPROVED)
    local = q.filter(Vendor.location.ilike(f"%{city}%")).limit(3).all() if city else []
    picks = local + [v for v in q.limit(6).all() if v not in local]
    return [f"{v.business_name} ({v.location})" for v in picks[:3]]


def notify_vendor_fault(db: Session, booking: Booking, kind: str, fee, urgent: bool) -> None:
    from app.core.config import ADMIN_ALERT_EMAILS
    try:
        customer, vendor, vendor_user = _parties(db, booking)
        name = vendor.business_name if vendor else "Your vendor"
        alts = _alternatives(db, booking, vendor) if vendor else []
        what = "can no longer make it" if kind == "cancellation" else "didn't show up"
        _send(customer, f"{name} {what} — you're getting a full refund", "We're sorry", "You'll get every naira back",
              [f"{name} {what} for your event on {_when(booking)}. We've started a full refund of "
               f"₦{_fmt(booking.customer_total)}, including our fee. It usually lands within 5–10 working days.",
               ("Similar verified vendors who may be free: " + "; ".join(alts) + ".") if alts else "",
               "Reply to this email if you'd like our team to help you find a replacement."],
              f"Find another {vendor.category.value if vendor else 'vendor'}",
              f"/vendor-search?category={vendor.category.value}" if vendor else "/vendor-search")
        fee_line = (f"A late-cancellation fee of ₦{_fmt(fee)} will be deducted from your next payout, as set out in "
                    "the vendor agreement.") if fee and float(fee) > 0 else ""
        _send(vendor_user, f"Booking #{booking.id} cancelled", "Booking update",
              "This booking has been cancelled",
              [f"The customer has been refunded in full for {_when(booking)}.", fee_line,
               "Repeated cancellations or no-shows pause your listing. If something went wrong on our side, reply to this email."],
              "View my dashboard", "/vendor-dashboard")
        if urgent:
            from app.services.email import send_notice_email
            for email in ADMIN_ALERT_EMAILS:
                _fire_and_forget(send_notice_email, email, "Admin", f"[URGENT] Rescue needed — booking #{booking.id}",
                                 "Rescue", f"{name} {what}",
                                 [f"Event: {_when(booking)} · {_venue(booking)}",
                                  f"Customer: {customer.full_name if customer else ''} · {customer.phone_number if customer else ''}",
                                  ("Suggested replacements: " + "; ".join(alts)) if alts else "No replacements found automatically."],
                                 "Open admin", "/admin")
    except Exception as exc:
        logger.error("Vendor-fault emails failed for %s: %s", booking.id, exc)


def notify_request_expired(db: Session, booking: Booking) -> None:
    try:
        customer, vendor, vendor_user = _parties(db, booking)
        name = vendor.business_name if vendor else "The vendor"
        _send(customer, f"{name} didn't respond — you've been refunded", "Booking update", "Full refund on its way",
              [f"{name} didn't accept your request in time, so we've refunded ₦{_fmt(booking.customer_total)} in full.",
               "Plenty of other verified vendors are ready to help."],
              "Find another vendor", f"/vendor-search?category={vendor.category.value}" if vendor else "/vendor-search")
        _send(vendor_user, f"Request #{booking.id} expired", "Booking update", "A request expired",
              ["You didn't accept or decline this request within 48 hours, so the customer was refunded. "
               "Respond to new requests quickly — it's one of the things customers see."],
              "View my dashboard", "/vendor-dashboard")
    except Exception as exc:
        logger.error("Expired-request emails failed for %s: %s", booking.id, exc)


def notify_addon_proposed(db: Session, booking: Booking, addon) -> None:
    try:
        customer, vendor, _ = _parties(db, booking)
        items = "; ".join(f"{i['name']} \u00d7 {i['quantity']}" for i in addon.items)
        _send(customer, f"{vendor.business_name if vendor else 'Your vendor'} sent an add-on for your booking",
              "Add-on", "Approve your add-on",
              [f"{items}: \u20a6{_fmt(addon.customer_total)} (including Plagohive's fee).",
               addon.note or "",
               "Approve and pay from your booking. The money is held safely with the rest of your payment until the event is done."],
              "Review add-on", "/customer-dashboard")
    except Exception as exc:
        logger.error("Add-on email failed for %s: %s", booking.id, exc)


def notify_addon_paid(db: Session, booking: Booking, addon) -> None:
    try:
        _, vendor, vendor_user = _parties(db, booking)
        _send(vendor_user, f"Add-on approved for booking #{booking.id}", "Add-on", "Your add-on was paid",
              [f"The customer paid \u20a6{_fmt(addon.customer_total)} for the add-on. Your payout for this booking is now \u20a6{_fmt(booking.payout_amount)}."],
              "View booking", "/vendor-dashboard")
    except Exception as exc:
        logger.error("Add-on paid email failed for %s: %s", booking.id, exc)



# ── SMS/WhatsApp alerts for key moments (active once TERMII_API_KEY is set) ──

def sms_new_request(db: Session, booking: Booking) -> None:
    from app.services.sms import alert
    _, vendor, vu = _parties(db, booking)
    if vu:
        alert(vu.phone_number, f"Plagohive: new paid booking request #{booking.id} for {_when(booking)}. Accept or decline within 48h in your dashboard.")


def sms_accepted(db: Session, booking: Booking) -> None:
    from app.services.sms import alert
    c, vendor, _ = _parties(db, booking)
    if c and vendor:
        alert(c.phone_number, f"Plagohive: {vendor.business_name} accepted your booking #{booking.id}. Your payment stays held until you confirm the service.")


def sms_event_day(db: Session, booking: Booking) -> None:
    from app.services.sms import alert
    c, vendor, vu = _parties(db, booking)
    if vu:
        alert(vu.phone_number, f"Plagohive: event day for booking #{booking.id}. Tap 'I've arrived' in your dashboard when you get there.")
    if c and vendor:
        alert(c.phone_number, f"Plagohive: today's the day! {vendor.business_name} will check in when they arrive. Problem? Report it from your booking.")


def notify_checkout_abandoned(db: Session, booking: Booking) -> None:
    """One friendly nudge when an unpaid checkout expires."""
    customer, vendor, _ = _parties(db, booking)
    if not customer or not vendor:
        return
    _send(customer, f"Still planning? Your booking with {vendor.business_name} isn't finished", "Booking",
          "You didn't finish your booking",
          [f"Your booking with {vendor.business_name} for {_when(booking)} wasn't paid, so we didn't send it to them.",
           "If you'd still like them, it only takes a minute, and your money is held until your event is done."],
          "Finish booking", f"/vendors/{vendor.id}?book=1")
