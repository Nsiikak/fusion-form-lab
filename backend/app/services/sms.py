"""SMS / WhatsApp alerts through Termii (https://termii.com), for the moments people mustn't miss.

Switched off until TERMII_API_KEY is set. TERMII_CHANNEL: "dnd" (SMS that reaches DND numbers,
needs an approved sender ID), "generic" (SMS) or "whatsapp" (needs Termii WhatsApp set-up).
Verify the current endpoint and channel rules in Termii's documentation before going live."""
import logging
import os
import re
import threading

import requests

logger = logging.getLogger(__name__)
TERMII_URL = os.getenv("TERMII_URL", "https://api.ng.termii.com/api/sms/send")


def _normalise(phone: str):
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("0") and len(digits) == 11:
        digits = "234" + digits[1:]
    return digits if re.fullmatch(r"234[789][01]\d{8}", digits) else None


def send_sms(phone: str, text: str) -> bool:
    key = os.getenv("TERMII_API_KEY", "").strip()
    to = _normalise(phone)
    if not key or not to:
        return False
    try:
        r = requests.post(TERMII_URL, timeout=10, json={
            "to": to, "from": os.getenv("TERMII_SENDER_ID", "Plagohive"), "sms": text[:480], "type": "plain",
            "channel": os.getenv("TERMII_CHANNEL", "dnd"), "api_key": key,
        })
        from app.entities.audit import log_notification
        if r.status_code >= 300:
            logger.error("Termii send failed (%s): %s", r.status_code, r.text[:200])
            log_notification("sms", to, text[:120], False, r.text[:300])
            return False
        log_notification("sms", to, text[:120], True)
        return True
    except requests.RequestException as exc:
        logger.error("Termii unreachable: %s", exc)
        from app.entities.audit import log_notification
        log_notification("sms", to, text[:120], False, str(exc))
        return False


def alert(phone: str, text: str) -> None:
    """Fire-and-forget SMS/WhatsApp alert; never blocks or breaks the request."""
    if os.getenv("TERMII_API_KEY") and phone:
        threading.Thread(target=send_sms, args=(phone, text), daemon=True).start()
