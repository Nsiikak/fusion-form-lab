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
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://plagohive.netlify.app")

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
