import os
import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import auth, vendor, booking, event, review, stats, service_items, payments, admin, account, messages
from app.core.database import engine
from app.core.config import CORS_ORIGINS
# Import models so SQLAlchemy's mapper is aware of them (relationships, backrefs)
from app.entities.user.model import User      # noqa: F401
from app.entities.vendor.model import Vendor  # noqa: F401
from app.entities.booking.model import Booking  # noqa: F401
from app.entities.event.model import Event    # noqa: F401
from app.entities.review.model import Review  # noqa: F401
from app.entities.service_item.model import ServiceItem  # noqa: F401
from app.entities.chat.model import Conversation, Message  # noqa: F401
from app.entities.vendor.incident import VendorIncident  # noqa: F401
from app.entities.booking.addon import BookingAddon  # noqa: F401
from app.entities.booking.reductions import BookingReduction  # noqa: F401
from app.entities.user.reset_token import PasswordResetToken  # noqa: F401
from app.entities.audit import ChatAccessLog, ContactAttempt, NotificationLog  # noqa: F401
from app.entities.support import Escalation, SupportNote  # noqa: F401
# Schema changes are managed by Alembic and applied on startup (init_db.run in lifespan)

# Show INFO logs from the app (e.g. "Email sent to …") alongside uvicorn's own output.
if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s — %(message)s")
logging.getLogger("app").setLevel(logging.INFO)

logger = logging.getLogger(__name__)

# Ensure local upload directory exists and serve it as static files
os.makedirs("uploads/vendor-images", exist_ok=True)


async def _auto_release_loop() -> None:
    """Background task: expire abandoned checkouts and auto-release escrow for bookings the
    customer didn't confirm within 24h. Safe with multiple workers — every state change is an
    atomic conditional UPDATE."""
    from sqlalchemy import text
    from app.core.database import SessionLocal, engine
    from app.entities.booking.service import BookingService
    last_cleanup = 0.0
    while True:
        await asyncio.sleep(300)  # run every 5 minutes
        # Only one API process runs the jobs: a PostgreSQL advisory lock held on its own connection.
        # If the process dies, the connection closes and the lock is released automatically.
        lock_conn = None
        try:
            lock_conn = engine.connect()
            if not lock_conn.execute(text("SELECT pg_try_advisory_lock(727001)")).scalar():
                lock_conn.close()
                continue
        except Exception as exc:
            logger.error("Couldn't take the job lock: %s", exc)
            if lock_conn is not None:
                lock_conn.close()
            continue
        try:
            db = SessionLocal()
            try:
                import time as _t
                if _t.time() - last_cleanup > 86400:
                    from app.services import retention
                    await asyncio.to_thread(retention.run, db)
                    last_cleanup = _t.time()
                await asyncio.to_thread(BookingService.reconcile_unpaid, db)
                from app.services.ranking import recompute as _rank
                await asyncio.to_thread(_rank, db)
                await asyncio.to_thread(BookingService.expire_unpaid_checkouts, db)
                await asyncio.to_thread(BookingService.auto_release_expired_bookings, db)
                await asyncio.to_thread(BookingService.sync_pending_payouts, db)
                from app.entities.booking.trust import TrustService
                await asyncio.to_thread(TrustService.expire_unaccepted, db)
                await asyncio.to_thread(TrustService.resolve_overdue_no_shows, db)
                await asyncio.to_thread(TrustService.run_countdown, db)
            finally:
                db.close()
        except Exception as exc:
            logger.error("Auto-release loop error: %s", exc)
        finally:
            try:
                lock_conn.execute(text("SELECT pg_advisory_unlock(727001)"))
            finally:
                lock_conn.close()


def _check_email_on_startup() -> None:
    """Say loudly at startup if email won't work, instead of failing silently per message."""
    from app.core.config import CORS_ORIGINS as _origins, FRONTEND_URL as _site
    logger.info("Email links will open %s", _site)
    if _origins and _site not in [o.rstrip("/") for o in _origins]:
        logger.warning("EMAIL LINKS: FRONTEND_URL (%s) isn't one of CORS_ORIGINS (%s). Password-reset and booking links "
                       "will open a site that can't use this API. Set FRONTEND_URL to your website's address.", _site, ", ".join(_origins))
    from app.services.email import check_smtp_login, smtp_problems
    for problem in smtp_problems():
        logger.warning("EMAIL: %s", problem)
    ok, detail = check_smtp_login()
    if ok:
        logger.info("EMAIL: ready — %s", detail)
    else:
        logger.error("EMAIL: NOT WORKING — %s. Run `python check_email.py you@example.com` to test.", detail)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on an empty database / apply pending migrations before serving requests
    from init_db import run as init_schema
    await asyncio.to_thread(init_schema)
    asyncio.get_running_loop().run_in_executor(None, _check_email_on_startup)
    task = asyncio.create_task(_auto_release_loop())
    yield
    task.cancel()


from app.core.config import ENVIRONMENT
_PROD = ENVIRONMENT == "production"

# Error tracking: active when SENTRY_DSN is set and sentry-sdk is installed
if os.getenv("SENTRY_DSN"):
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"), environment=ENVIRONMENT, traces_sample_rate=0.1, send_default_pii=False)
    except ImportError:
        logging.getLogger(__name__).warning("SENTRY_DSN set but sentry-sdk isn't installed")

app = FastAPI(
    title="Plagohive API",
    description="Backend API for Plagohive platform",
    version="1.0.0",
    lifespan=lifespan,
    # The interactive API docs list every endpoint; keep them off the public internet in production
    docs_url=None if _PROD else "/docs",
    redoc_url=None if _PROD else "/redoc",
    openapi_url=None if _PROD else "/openapi.json",
)


@app.middleware("http")
async def security_headers(request, call_next):
    """Standard protective headers on every API response."""
    response = await call_next(request)
    h = response.headers
    h.setdefault("X-Content-Type-Options", "nosniff")
    h.setdefault("X-Frame-Options", "DENY")
    h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    if _PROD:
        h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

# CORS middleware to allow frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["X-Total-Count"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(vendor.router, prefix="/api/vendors", tags=["vendors"])
app.include_router(booking.router, prefix="/api/bookings", tags=["bookings"])
app.include_router(event.router, prefix="/api/events", tags=["events"])
app.include_router(review.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(stats.router, prefix="/api/stats", tags=["statistics"])
app.include_router(service_items.router, prefix="/api/service-items", tags=["service-items"])
from app.routers import support as support_router
app.include_router(support_router.router, prefix="/api/support", tags=["support"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(account.router, prefix="/api/account", tags=["account"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])

@app.websocket("/ws/{path:path}")
async def websocket_catch_all(websocket: WebSocket, path: str):
    """Silently close stale WebSocket connections from old clients."""
    await websocket.close(code=1008)

@app.get("/")
async def root():
    return {"message": "Plagohive API is running"}

@app.get("/api/health")
async def health_check():
    """Returns healthy only when the database is reachable."""
    from sqlalchemy import text
    from app.core.database import SessionLocal
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "ok"
    except Exception as exc:
        db_status = f"error: {exc}"
    if db_status != "ok":
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": db_status},
        )
    return {"status": "healthy", "database": db_status}


OCCASION_SLUGS = ["wedding", "traditional-engagement", "birthday", "naming-ceremony", "corporate", "celebration-of-life"]


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap():
    """Every public page search engines should know about: guides, verified vendors, and category/city pages."""
    from fastapi import Response
    from xml.sax.saxutils import escape
    from app.core.database import SessionLocal
    from app.entities.vendor.model import Vendor, VerificationStatus
    base = os.getenv("FRONTEND_URL", "https://plagohive.com").rstrip("/")
    urls = [f"{base}/", f"{base}/vendor-search", f"{base}/plan"] + [f"{base}/plan/{s}" for s in OCCASION_SLUGS]
    db = SessionLocal()
    try:
        vendors = db.query(Vendor).filter(Vendor.is_active == True, Vendor.verification_status == VerificationStatus.APPROVED).all()  # noqa: E712
        urls += [f"{base}/vendors/{v.id}" for v in vendors]
        pairs = {(v.category.value, (v.base_state or "").strip()) for v in vendors if v.base_state}
        urls += [f"{base}/find/{c}/{s.lower().replace(' ', '-')}" for c, s in sorted(pairs)]
    finally:
        db.close()
    body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + \
        "".join(f"<url><loc>{escape(u)}</loc></url>" for u in urls) + "</urlset>"
    return Response(content=body, media_type="application/xml")
