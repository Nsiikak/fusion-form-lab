import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL is not set. "
        "Add it to your .env file, e.g.: "
        "postgresql://user:password@localhost:5432/plagohive"
    )

# ── JWT ───────────────────────────────────────────────────────────────────────
_INSECURE_KEY_PLACEHOLDERS = {
    "",
    "your-secret-key-change-this-in-production",
    "dev-insecure-key-change-in-production",
    "secret",
    "changeme",
}

SECRET_KEY = os.getenv("SECRET_KEY", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if not SECRET_KEY or SECRET_KEY in _INSECURE_KEY_PLACEHOLDERS:
    if ENVIRONMENT == "production":
        raise ValueError(
            "SECRET_KEY must be set to a cryptographically random value in production. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    else:
        logger.warning(
            "SECRET_KEY is not set or uses a placeholder — running in development mode only. "
            "NEVER deploy to production without a secure SECRET_KEY."
        )
        SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# ── Mono CAC Lookup ───────────────────────────────────────────────────────────
MONO_SECRET_KEY = os.getenv("MONO_SECRET_KEY", "")

# ── Email / SMTP ──────────────────────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Plagohive")
EMAIL_FROM_ADDRESS = os.getenv("EMAIL_FROM_ADDRESS", SMTP_USER)

# ── Cloudinary (production image uploads) ────────────────────────────────────
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

# ── CORS ──────────────────────────────────────────────────────────────────────
_cors_env = os.getenv("CORS_ORIGINS", "")
if _cors_env:
    CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    CORS_ORIGINS = [
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        "https://plagohive.netlify.app",
    ]

# The website address used in every email link (password resets, bookings, receipts).
# Must be the site people actually use: a wrong value sends them to a different site and database.
# Blank or missing → the first origin you set in CORS_ORIGINS, then the live Netlify site.
FRONTEND_URL = (os.getenv("FRONTEND_URL", "").strip() or (CORS_ORIGINS[0] if _cors_env else "")
                or "https://plagohive.netlify.app").rstrip("/")

# ── Fees & payments ───────────────────────────────────────────────────────────
from decimal import Decimal as _Decimal

# Charged to the customer on top of the vendor's total at checkout.
PLATFORM_CUSTOMER_FEE_RATE = _Decimal(os.getenv("PLATFORM_CUSTOMER_FEE_RATE", "0.025"))
# Deducted from the vendor's total at payout. Shown to vendors only, never to customers.
VENDOR_COMMISSION_RATE = _Decimal(os.getenv("VENDOR_COMMISSION_RATE", "0.10"))
# Unpaid checkouts older than this are cancelled by the background task.
CHECKOUT_EXPIRY_MINUTES = int(os.getenv("CHECKOUT_EXPIRY_MINUTES", "60"))

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
if ENVIRONMENT == "production" and not PAYSTACK_SECRET_KEY:
    raise ValueError("PAYSTACK_SECRET_KEY must be set in production.")

# Optional: where to send "new dispute" alerts (comma-separated)
ADMIN_ALERT_EMAILS = [e.strip() for e in os.getenv("ADMIN_ALERT_EMAILS", "").split(",") if e.strip()]

# Payouts above this amount (naira) wait for an admin to approve them in the dashboard.
PAYOUT_APPROVAL_THRESHOLD = _Decimal(os.getenv("PAYOUT_APPROVAL_THRESHOLD", "100000"))
# Smallest wallet withdrawal a vendor can request (naira)
WITHDRAWAL_MINIMUM = _Decimal(os.getenv("WITHDRAWAL_MINIMUM", "100"))

# ── Business details printed on receipts and payout statements ───────────────
COMPANY_NAME = os.getenv("COMPANY_NAME", "Plagohive")
COMPANY_ADDRESS = os.getenv("COMPANY_ADDRESS", "Lagos, Nigeria")
COMPANY_EMAIL = os.getenv("COMPANY_EMAIL") or os.getenv("EMAIL_FROM_ADDRESS") or "hello@plagohive.com"
COMPANY_RC_NUMBER = os.getenv("COMPANY_RC_NUMBER", "")      # CAC registration number, if registered
COMPANY_TIN = os.getenv("COMPANY_TIN", "")                  # tax ID, if registered
