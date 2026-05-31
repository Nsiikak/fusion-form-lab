import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import auth, vendor, booking, event, review, stats, service_items
from app.core.database import engine
from app.core.config import CORS_ORIGINS
# Import models so SQLAlchemy's mapper is aware of them (relationships, backrefs)
from app.entities.user.model import User      # noqa: F401
from app.entities.vendor.model import Vendor  # noqa: F401
from app.entities.booking.model import Booking  # noqa: F401
from app.entities.event.model import Event    # noqa: F401
from app.entities.review.model import Review  # noqa: F401
from app.entities.service_item.model import ServiceItem  # noqa: F401
# Schema changes are managed by Alembic — run: alembic upgrade head

logger = logging.getLogger(__name__)

# Ensure local upload directory exists and serve it as static files
os.makedirs("uploads/vendor-images", exist_ok=True)


async def _auto_release_loop() -> None:
    """Background task: auto-release escrow for bookings where customer didn't confirm within 24h."""
    from app.core.database import SessionLocal
    from app.entities.booking.service import BookingService
    while True:
        await asyncio.sleep(900)  # run every 15 minutes
        try:
            db = SessionLocal()
            try:
                BookingService.auto_release_expired_bookings(db)
            finally:
                db.close()
        except Exception as exc:
            logger.error("Auto-release loop error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_auto_release_loop())
    yield
    task.cancel()


app = FastAPI(
    title="Plagohive API",
    description="Backend API for Plagohive platform",
    version="1.0.0",
    lifespan=lifespan,
)

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
