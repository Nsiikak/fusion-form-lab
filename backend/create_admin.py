"""Create an admin account, or promote an existing account to admin.

Usage (from backend/):
    python create_admin.py you@example.com

If the email already has an account it is promoted (vendor accounts are refused —
use a separate email for admin work). Otherwise you'll be asked for a password.
"""
import getpass
import sys

from app.core.database import SessionLocal
from app.core.security import get_password_hash
import main  # noqa: F401 — registers models
from app.entities.user.model import User, UserRole
from app.entities.vendor.model import Vendor


def run(email: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            if db.query(Vendor).filter(Vendor.user_id == user.id).first():
                sys.exit("That email belongs to a vendor. Use a separate email for the admin account.")
            user.role = UserRole.ADMIN
            user.is_active = True
            db.commit()
            print(f"{email} is now an admin.")
            return

        password = getpass.getpass("Password for the new admin (min 12 characters): ")
        if len(password) < 12:
            sys.exit("Password too short — use at least 12 characters.")
        if password != getpass.getpass("Confirm password: "):
            sys.exit("Passwords don't match.")
        name = input("Full name (optional): ").strip() or None
        db.add(User(email=email, hashed_password=get_password_hash(password), full_name=name,
                    role=UserRole.ADMIN, is_active=True, is_verified=True))
        db.commit()
        print(f"Admin account created for {email}. Log in at /login.")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        sys.exit("Usage: python create_admin.py you@example.com")
    run(sys.argv[1].strip().lower())