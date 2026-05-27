import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import auth, vendor, booking, event, review, stats
from app.core.database import engine, Base
from app.core.config import CORS_ORIGINS
# Import models to ensure they're registered
from app.entities.user.model import User
from app.entities.vendor.model import Vendor
from app.entities.booking.model import Booking
from app.entities.event.model import Event
from app.entities.review.model import Review

# Create database tables
Base.metadata.create_all(bind=engine)

# Ensure local upload directory exists and serve it as static files
os.makedirs("uploads/vendor-images", exist_ok=True)

app = FastAPI(
    title="Plagohive API",
    description="Backend API for Plagohive platform",
    version="1.0.0"
)

# CORS middleware to allow frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(vendor.router, prefix="/api/vendors", tags=["vendors"])
app.include_router(booking.router, prefix="/api/bookings", tags=["bookings"])
app.include_router(event.router, prefix="/api/events", tags=["events"])
app.include_router(review.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(stats.router, prefix="/api/stats", tags=["statistics"])

@app.websocket("/ws/{path:path}")
async def websocket_catch_all(websocket: WebSocket, path: str):
    """Silently close stale WebSocket connections from old clients."""
    await websocket.close(code=1008)

@app.get("/")
async def root():
    return {"message": "Plagohive API is running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
