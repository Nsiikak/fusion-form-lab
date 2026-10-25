from typing import Optional
from pydantic import BaseModel, Field
import secrets
import re
from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token, get_current_active_user, get_password_hash, issue_tokens
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.entities.user import schema
from app.entities.user.service import UserService
from app.entities.user.model import User
from app.services.email import send_welcome_email, send_login_notification, _fire_and_forget

router = APIRouter()

# ─── In-memory reset token store {token: {email, expires_at}} ───────────────
_reset_tokens: dict[str, dict] = {}
_RESET_EXPIRES_MINUTES = 60

# ─── Login rate-limit store {email: {count, locked_until}} ──────────────────
_login_attempts: dict[str, dict] = {}
_MAX_ATTEMPTS = 5
_LOCKOUT_MINUTES = 10

# ─── Register rate-limit store {ip: {count, window_start}} ──────────────────
_register_attempts: dict[str, dict] = {}
_MAX_REGISTER_PER_HOUR = 10
_REGISTER_WINDOW_SECONDS = 3600


def _check_rate_limit(email: str):
    entry = _login_attempts.get(email)
    now = datetime.now(timezone.utc)
    if entry and entry.get("locked_until") and now < entry["locked_until"]:
        remaining = int((entry["locked_until"] - now).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Try again in {remaining} minute(s).",
        )


def _record_failed_attempt(email: str):
    now = datetime.now(timezone.utc)
    entry = _login_attempts.setdefault(email, {"count": 0, "locked_until": None})
    entry["count"] += 1
    if entry["count"] >= _MAX_ATTEMPTS:
        entry["locked_until"] = now + timedelta(minutes=_LOCKOUT_MINUTES)


def _clear_attempts(email: str):
    _login_attempts.pop(email, None)


def _check_register_rate_limit(ip: str):
    now = datetime.now(timezone.utc)
    entry = _register_attempts.get(ip)
    if entry:
        elapsed = (now - entry["window_start"]).total_seconds()
        if elapsed > _REGISTER_WINDOW_SECONDS:
            del _register_attempts[ip]
        elif entry["count"] >= _MAX_REGISTER_PER_HOUR:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many registration attempts. Please try again later.",
            )


def _record_register_attempt(ip: str):
    now = datetime.now(timezone.utc)
    entry = _register_attempts.get(ip)
    if entry and (now - entry["window_start"]).total_seconds() <= _REGISTER_WINDOW_SECONDS:
        entry["count"] += 1
    else:
        _register_attempts[ip] = {"count": 1, "window_start": now}


def _validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter.")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character.")


# ─── Request schemas ─────────────────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/register", response_model=schema.UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_data: schema.RegisterRequest,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    client_ip = request.client.host if request.client else "unknown"
    _check_register_rate_limit(client_ip)
    _record_register_attempt(client_ip)
    user = UserService.create_user(db, user_data)
    _fire_and_forget(send_welcome_email, user.email, user.full_name or user.email)
    return user


@router.post("/login", response_model=schema.Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and get access token (OAuth2 form)"""
    _check_rate_limit(form_data.username)
    user = UserService.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        _record_failed_attempt(form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    _clear_attempts(form_data.username)
    tokens = issue_tokens(user)
    _fire_and_forget(send_login_notification, user.email, user.full_name or user.email, user.role.value)
    return tokens


@router.post("/login-json", response_model=schema.Token)
async def login_json(
    login_data: schema.LoginRequest,
    db: Session = Depends(get_db)
):
    """Login endpoint that accepts JSON"""
    _check_rate_limit(login_data.email)
    user = UserService.authenticate_user(db, login_data.email, login_data.password)
    if not user:
        _record_failed_attempt(login_data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    _clear_attempts(login_data.email)
    tokens = issue_tokens(user)
    _fire_and_forget(send_login_notification, user.email, user.full_name or user.email, user.role.value)
    return tokens


@router.get("/me", response_model=schema.UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current authenticated user information"""
    return current_user


@router.post("/forgot-password", status_code=200)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Request a password reset link. Always returns 200 to prevent email enumeration."""
    user = db.query(User).filter(User.email == request.email).first()
    if user:
        import hashlib
        from app.entities.user.reset_token import PasswordResetToken
        token = secrets.token_urlsafe(32)
        # one live link per user: older unused links stop working
        db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)).delete()
        db.add(PasswordResetToken(user_id=user.id, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                                  expires_at=datetime.now(timezone.utc) + timedelta(minutes=_RESET_EXPIRES_MINUTES)))
        db.commit()
        from app.services.email import send_password_reset_email
        _fire_and_forget(send_password_reset_email, user.email, user.full_name or user.email, token)
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", status_code=200)
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset password using a valid token."""
    import hashlib
    from app.entities.user.reset_token import PasswordResetToken
    now = datetime.now(timezone.utc)
    entry = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == hashlib.sha256(request.token.encode()).hexdigest()).first()
    expires = entry.expires_at if entry and entry.expires_at.tzinfo else (entry.expires_at.replace(tzinfo=timezone.utc) if entry else None)
    if not entry or entry.used_at is not None or now > expires:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired.")

    _validate_password_strength(request.new_password)

    user = db.query(User).filter(User.id == entry.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired.")

    user.hashed_password = get_password_hash(request.new_password)
    user.token_version = int(user.token_version or 0) + 1     # sign out every existing session
    entry.used_at = now
    db.commit()
    _clear_attempts(user.email)
    return {"message": "Password updated successfully."}


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone_number: Optional[str] = Field(None, max_length=20)


@router.patch("/me")
def update_me(body: ProfileUpdate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Update your own name or phone number. Phone numbers must be Nigerian mobile numbers."""
    import re
    user = db.query(User).filter(User.id == current_user.id).first()
    if body.full_name:
        user.full_name = body.full_name.strip()
    if body.phone_number is not None:
        digits = re.sub(r"[^\d+]", "", body.phone_number)
        if digits.startswith("+234"):
            digits = "0" + digits[4:]
        elif digits.startswith("234"):
            digits = "0" + digits[3:]
        if not re.fullmatch(r"0[789][01]\d{8}", digits):
            raise HTTPException(status_code=400, detail="Enter a Nigerian mobile number, e.g. 0803 123 4567")
        user.phone_number = digits
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "phone_number": user.phone_number,
            "role": user.role.value}


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
def refresh_tokens(body: RefreshRequest, db: Session = Depends(get_db)):
    """Swap a valid refresh token for fresh tokens (rotation), so people stay signed in for 30 days."""
    from jose import JWTError, jwt
    from app.core.config import ALGORITHM, SECRET_KEY
    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    if payload.get("typ") != "refresh":
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user or not user.is_active or int(payload.get("tv", 0)) != int(user.token_version or 0):
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    return issue_tokens(user)


@router.post("/logout-all", status_code=204)
def logout_everywhere(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """End every session on every device."""
    user = db.query(User).filter(User.id == current_user.id).first()
    user.token_version = int(user.token_version or 0) + 1
    db.commit()
    return None
