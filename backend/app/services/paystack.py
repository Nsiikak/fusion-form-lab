import hashlib
import hmac
import logging
import os
from decimal import Decimal
from typing import Optional

import requests
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 15


class PaystackError(Exception):
    """Raised when Paystack rejects a request or cannot be reached."""


def _mask(value: str, keep: int = 4) -> str:
    value = str(value or "")
    return "*" * max(len(value) - keep, 0) + value[-keep:]


class PaystackService:
    BASE_URL = "https://api.paystack.co"

    @property
    def secret_key(self) -> str:
        key = os.getenv("PAYSTACK_SECRET_KEY", "")
        if not key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment provider is not configured",
            )
        return key

    @property
    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        try:
            return requests.request(
                method, f"{self.BASE_URL}{path}", headers=self.headers, timeout=TIMEOUT_SECONDS, **kwargs
            )
        except requests.RequestException as exc:
            logger.error("Paystack %s %s unreachable: %s", method, path.split("?")[0], exc)
            raise PaystackError("Payment provider unreachable") from exc

    @staticmethod
    def _message(response: requests.Response) -> str:
        try:
            return response.json().get("message", "Unknown error")
        except ValueError:
            return "Unknown error"

    # ── Webhooks ─────────────────────────────────────────────────────────────
    def verify_webhook_signature(self, raw_body: bytes, signature: Optional[str]) -> bool:
        if not signature:
            return False
        expected = hmac.new(self.secret_key.encode(), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, signature)

    # ── Collections ──────────────────────────────────────────────────────────
    def verify_transaction(self, reference: str) -> dict:
        """Return the transaction `data` object. Raises PaystackError if Paystack can't confirm it."""
        response = self._request("GET", f"/transaction/verify/{reference}")
        if response.status_code != 200:
            logger.warning("Paystack verify failed for %s: %s", reference, self._message(response))
            raise PaystackError(self._message(response))
        return response.json().get("data") or {}

    def refund(self, reference: str, reason: str = "", amount=None) -> dict:
        """Refund a transaction — in full, or `amount` naira for a partial refund."""
        from app.services.pricing import to_kobo
        payload = {"transaction": reference, "merchant_note": reason[:200]}
        if amount is not None:
            payload["amount"] = to_kobo(amount)
        response = self._request("POST", "/refund", json=payload)
        if response.status_code not in (200, 201):
            logger.error("Paystack refund failed for %s: %s", reference, self._message(response))
            raise PaystackError(self._message(response))
        return response.json().get("data") or {}

    def retry_refund_with_details(self, refund_id: str, account_number: str, bank_code: str) -> dict:
        """Complete a "needs-attention" refund by giving Paystack the customer's bank account.
        Paystack wants its own bank *id* here, not the bank code, so we look it up."""
        bank_id = self.bank_id_for_code(bank_code)
        if bank_id is None:
            raise PaystackError(f"Unknown bank code {bank_code}")
        response = self._request(
            "POST",
            f"/refund/retry_with_customer_details/{refund_id}",
            json={"refund_account_details": {
                "currency": "NGN", "account_number": account_number, "bank_id": str(bank_id),
            }},
        )
        if response.status_code not in (200, 201):
            logger.error("Paystack refund retry failed for %s: %s", refund_id, self._message(response))
            raise PaystackError(self._message(response))
        return response.json().get("data") or {}

    _bank_ids: dict = {}

    def bank_id_for_code(self, bank_code: str):
        if not PaystackService._bank_ids:
            banks = self.get_banks() or {}
            PaystackService._bank_ids = {str(b.get("code")): b.get("id") for b in banks.get("data") or []}
        return PaystackService._bank_ids.get(str(bank_code))

    # ── Payouts ──────────────────────────────────────────────────────────────
    def create_transfer_recipient(self, name: str, account_number: str, bank_code: str) -> str:
        data = {
            "type": "nuban",
            "name": name,
            "account_number": account_number,
            "bank_code": bank_code,
            "currency": "NGN",
        }
        try:
            response = self._request("POST", "/transferrecipient", json=data)
        except PaystackError:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Payment provider unreachable")

        if response.status_code in (200, 201):
            result = response.json()
            if result.get("status"):
                return result["data"]["recipient_code"]

        logger.warning(
            "Paystack recipient creation failed (account %s): %s", _mask(account_number), self._message(response)
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not verify bank account details: {self._message(response)}",
        )

    def initiate_transfer(self, amount: Decimal, recipient_code: str, reference: str, reason: str) -> dict:
        """Transfer `amount` naira. Paystack treats `reference` as idempotent, so retries are safe."""
        from app.services.pricing import to_kobo

        data = {
            "source": "balance",
            "amount": to_kobo(amount),
            "recipient": recipient_code,
            "reference": reference,
            "reason": reason,
        }
        response = self._request("POST", "/transfer", json=data)
        if response.status_code in (200, 201):
            return response.json().get("data") or {}
        logger.error("Paystack transfer %s failed: %s", reference, self._message(response))
        raise PaystackError(self._message(response))

    def verify_transfer(self, reference: str) -> dict:
        """Current state of a transfer, straight from Paystack (fallback when no webhook arrives)."""
        response = self._request("GET", f"/transfer/verify/{reference}")
        if response.status_code != 200:
            raise PaystackError(self._message(response))
        return response.json().get("data") or {}

    def resolve_account_number(self, account_number: str, bank_code: str) -> dict:
        try:
            response = self._request(
                "GET", "/bank/resolve", params={"account_number": account_number, "bank_code": bank_code}
            )
        except PaystackError:
            return {"status": False, "paystack_message": "Payment provider unreachable"}
        logger.info("Paystack resolve account %s: HTTP %s", _mask(account_number), response.status_code)
        if response.status_code == 200:
            return response.json()
        return {"status": False, "paystack_message": self._message(response)}

    def get_banks(self) -> Optional[dict]:
        try:
            response = self._request("GET", "/bank", params={"currency": "NGN"})
        except PaystackError:
            return None
        return response.json() if response.status_code == 200 else None


paystack_service = PaystackService()
