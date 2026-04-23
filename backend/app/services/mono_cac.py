import os
import re
import logging
import requests
from difflib import SequenceMatcher
from typing import Optional

logger = logging.getLogger(__name__)


class MonoCACService:
    BASE_URL = "https://api.withmono.com/v3/lookup/cac"

    @property
    def headers(self):
        secret_key = os.getenv("MONO_SECRET_KEY")
        if not secret_key:
            raise ValueError("MONO_SECRET_KEY is not configured")
        return {
            "accept": "application/json",
            "content-type": "application/json",
            "mono-sec-key": secret_key,
        }

    def _normalize(self, name: str) -> str:
        """Lowercase, strip common suffixes and punctuation for comparison."""
        name = name.lower()
        # Remove common CAC suffixes so "Acme Ltd" ~ "Acme Limited" ~ "Acme"
        for suffix in [
            r"\blimited\b", r"\bltd\b", r"\bplc\b", r"\bllc\b",
            r"\bng\b", r"\bnigeria\b", r"\b& co\b", r"\band co\b",
        ]:
            name = re.sub(suffix, "", name)
        return re.sub(r"[^a-z0-9\s]", "", name).strip()

    def name_similarity(self, a: str, b: str) -> float:
        return SequenceMatcher(None, self._normalize(a), self._normalize(b)).ratio()

    def search(self, query: str, exact: bool = True) -> list[dict]:
        """
        Search CAC by RC number or company name.
        Returns a list of matching business objects or [] on failure.
        """
        try:
            response = requests.get(
                self.BASE_URL,
                headers=self.headers,
                params={"search": query, "exact": str(exact).lower()},
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                # API wraps results in {"status": "successful", "data": [...]}
                return data.get("data", []) if isinstance(data, dict) else data
            logger.warning("Mono CAC search non-200: %s %s", response.status_code, response.text[:200])
            return []
        except Exception as e:
            logger.error("Mono CAC search exception: %s", str(e))
            return []

    def get_profile(self, rc_number: str) -> Optional[dict]:
        """
        Fetch comprehensive company profile using RC number.
        Returns the profile dict or None on failure.
        """
        try:
            response = requests.get(
                f"{self.BASE_URL}/profile/{rc_number}",
                headers=self.headers,
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("data") if isinstance(data, dict) else data
            logger.warning("Mono CAC profile non-200: %s %s", response.status_code, response.text[:200])
            return None
        except Exception as e:
            logger.error("Mono CAC profile exception: %s", str(e))
            return None

    def get_directors(self, cac_id: str) -> list[dict]:
        """Fetch directors for a company by its CAC id."""
        try:
            response = requests.get(
                f"{self.BASE_URL}/company/{cac_id}/directors",
                headers=self.headers,
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("data", []) if isinstance(data, dict) else []
            return []
        except Exception:
            return []

    def verify_vendor(
        self, rc_number: str, business_name: str, similarity_threshold: float = 0.65
    ) -> dict:
        """
        Core verification logic.

        Returns a dict:
        {
            "verified": bool,         # True → auto-approve
            "found": bool,            # whether RC exists in CAC
            "cac_id": str | None,
            "cac_verified_name": str | None,
            "rc_number": str | None,
            "similarity": float,
            "reason": str,
        }
        """
        result = {
            "verified": False,
            "found": False,
            "cac_id": None,
            "cac_verified_name": None,
            "rc_number": None,
            "similarity": 0.0,
            "reason": "CAC lookup not attempted",
        }

        if not rc_number:
            result["reason"] = "No RC number provided"
            return result

        # 1. Search by RC number (exact)
        matches = self.search(rc_number, exact=True)

        # If no results with exact, try the profile endpoint directly
        if not matches:
            profile = self.get_profile(rc_number)
            if profile:
                matches = [profile]

        if not matches:
            result["reason"] = f"RC number '{rc_number}' not found in CAC database"
            return result

        # 2. Use the first (best) match
        best = matches[0]
        cac_name = best.get("approved_name") or best.get("name") or ""
        cac_id = str(best.get("id", "")) or None
        cac_rc = best.get("rc_number") or rc_number

        result["found"] = True
        result["cac_id"] = cac_id
        result["cac_verified_name"] = cac_name
        result["rc_number"] = cac_rc

        # 3. Compare names
        similarity = self.name_similarity(business_name, cac_name)
        result["similarity"] = round(similarity, 3)

        if similarity >= similarity_threshold:
            result["verified"] = True
            result["reason"] = (
                f"Business name matched CAC record '{cac_name}' "
                f"(similarity: {similarity:.0%})"
            )
        else:
            result["reason"] = (
                f"RC number found but name mismatch — "
                f"submitted: '{business_name}', CAC record: '{cac_name}' "
                f"(similarity: {similarity:.0%})"
            )

        return result


mono_cac_service = MonoCACService()
