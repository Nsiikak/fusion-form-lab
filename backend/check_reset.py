"""Diagnose password-reset links on THIS machine.

    python check_reset.py                 → checks your settings and database
    python check_reset.py ada@example.com → also shows that person's recent reset links, and
                                            prints a fresh working link without needing email

Run it from the backend folder, the same way you start the server."""
import hashlib
import secrets
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import inspect, text

ok = lambda m: print(f"  OK    {m}")      # noqa: E731
bad = lambda m: print(f"  FIX   {m}")     # noqa: E731
info = lambda m: print(f"        {m}")    # noqa: E731

print("\n1. Settings (backend/.env)")
from app.core import config  # noqa: E402
print(f"        FRONTEND_URL  = {config.FRONTEND_URL}")
print(f"        CORS_ORIGINS  = {', '.join(config.CORS_ORIGINS)}")
if config.FRONTEND_URL.rstrip('/') in [o.rstrip('/') for o in config.CORS_ORIGINS]:
    ok("Email links open a website that's allowed to call this server")
else:
    bad("FRONTEND_URL isn't in CORS_ORIGINS: the reset page won't be allowed to call this server. "
        "Set both to the address you open the website on (for example http://localhost:8080).")
if "netlify" in config.FRONTEND_URL and "localhost" in ",".join(config.CORS_ORIGINS):
    bad("Email links go to the LIVE Netlify site, but you're running locally. Set FRONTEND_URL=http://localhost:8080")

print("\n2. Database")
from app.core.database import SessionLocal, engine  # noqa: E402
try:
    with engine.connect() as c:
        head = c.execute(text("SELECT version_num FROM alembic_version")).scalar()
    info(f"Database: {engine.url.render_as_string(hide_password=True)}")
    info(f"Migration version: {head}")
    if "password_reset_tokens" in inspect(engine).get_table_names():
        ok("password_reset_tokens table exists")
    else:
        bad("password_reset_tokens table is missing: run  python init_db.py")
except Exception as exc:
    bad(f"Couldn't use the database: {exc}")
    sys.exit(1)

print("\n3. The website's settings (.env in the project root)")
import os  # noqa: E402
api_url = None
for name in (".env.local", ".env"):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", name)
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            if line.strip().startswith("VITE_API_URL="):
                api_url = line.split("=", 1)[1].strip().strip('"').strip("'")
        if api_url:
            info(f"{name}: VITE_API_URL = {api_url}")
            break
if not api_url:
    bad("VITE_API_URL isn't set in the project root .env: the website doesn't know where this server is")
elif "localhost" in config.FRONTEND_URL or "127.0.0.1" in config.FRONTEND_URL:
    if "localhost" in api_url or "127.0.0.1" in api_url:
        ok("The local website talks to a local server (restart  npm run dev  after changing .env)")
    else:
        bad(f"The website talks to {api_url}, not this local server. Reset tokens live in THIS database, so the "
            "reset page can't find them. Set VITE_API_URL=http://localhost:8000 and restart  npm run dev")

if len(sys.argv) > 1:
    email = sys.argv[1].strip()
    print(f"\n4. Reset links for {email}")
    from app.entities.user.model import User
    from app.entities.user.reset_token import PasswordResetToken
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            bad("No account with that email in THIS database")
            sys.exit(1)
        now = datetime.now(timezone.utc)
        rows = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == u.id).order_by(PasswordResetToken.created_at.desc()).limit(5).all()
        if not rows:
            info("No reset links on record (requesting a new link replaces older unused ones)")
        for r in rows:
            exp = r.expires_at if r.expires_at.tzinfo else r.expires_at.replace(tzinfo=timezone.utc)
            state = "USED" if r.used_at else ("EXPIRED" if exp < now else "valid")
            info(f"created {r.created_at:%d %b %H:%M} · expires {exp:%d %b %H:%M} UTC · {state}")
        try:
            from app.entities.audit import NotificationLog
            n = (db.query(NotificationLog).filter(NotificationLog.recipient == email, NotificationLog.subject.ilike("%password%"))
                 .order_by(NotificationLog.created_at.desc()).first())
            if n:
                info(f"Latest reset email: {n.status} at {n.created_at:%d %b %H:%M}" + (f" — {n.error}" if n.error else ""))
                if n.body and "reset-password?token=" in n.body:
                    link = n.body.split('href="', 1)[-1].split("reset-password?token=")[0]
                    info(f"That email's link opens: {link}reset-password…")
        except Exception:
            pass
        if input("\n  Create a fresh reset link now and print it here? [y/N] ").strip().lower() == "y":
            db.query(PasswordResetToken).filter(PasswordResetToken.user_id == u.id, PasswordResetToken.used_at.is_(None)).delete()
            token = secrets.token_urlsafe(32)
            db.add(PasswordResetToken(user_id=u.id, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=now + timedelta(hours=1)))
            db.commit()
            print(f"\n  Open this in the browser (valid 1 hour, works once):\n  {config.FRONTEND_URL}/reset-password?token={token}\n")
    finally:
        db.close()
print()
