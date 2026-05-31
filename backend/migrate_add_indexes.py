"""
One-time migration: add performance indexes.

Run from the backend/ directory:
    python migrate_add_indexes.py

Safe to run multiple times — all statements use IF NOT EXISTS.
Automatically loads .env from the backend/ directory or the project root.
"""
import os
import sys
from pathlib import Path

# Load backend/.env (same directory as this script)
def _load_dotenv():
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

_load_dotenv()

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment or .env file.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

INDEXES = [
    # bookings — most-queried table; cover every common filter/join column
    "CREATE INDEX IF NOT EXISTS ix_bookings_customer_id   ON bookings (customer_id)",
    "CREATE INDEX IF NOT EXISTS ix_bookings_vendor_id     ON bookings (vendor_id)",
    "CREATE INDEX IF NOT EXISTS ix_bookings_status        ON bookings (status)",
    "CREATE INDEX IF NOT EXISTS ix_bookings_event_id      ON bookings (event_id)",
    "CREATE INDEX IF NOT EXISTS ix_bookings_event_date    ON bookings (event_date)",
    "CREATE INDEX IF NOT EXISTS ix_bookings_created_at    ON bookings (created_at)",

    # vendors — category + location searches and approval queue
    "CREATE INDEX IF NOT EXISTS ix_vendors_user_id               ON vendors (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_vendors_category              ON vendors (category)",
    "CREATE INDEX IF NOT EXISTS ix_vendors_verification_status   ON vendors (verification_status)",
    "CREATE INDEX IF NOT EXISTS ix_vendors_is_active             ON vendors (is_active)",
    # GIN index for full-text search on business_name (used by ILIKE queries)
    "CREATE INDEX IF NOT EXISTS ix_vendors_business_name_gin ON vendors USING gin (to_tsvector('english', business_name))",

    # reviews
    "CREATE INDEX IF NOT EXISTS ix_reviews_vendor_id   ON reviews (vendor_id)",
    "CREATE INDEX IF NOT EXISTS ix_reviews_customer_id ON reviews (customer_id)",

    # events
    "CREATE INDEX IF NOT EXISTS ix_events_customer_id ON events (customer_id)",
    "CREATE INDEX IF NOT EXISTS ix_events_date        ON events (date)",
    "CREATE INDEX IF NOT EXISTS ix_events_status      ON events (status)",

    # users — email lookup (likely already has unique index, but be explicit)
    "CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)",
]

def run():
    with engine.connect() as conn:
        for stmt in INDEXES:
            table = stmt.split("ON ")[1].split(" ")[0]
            idx   = stmt.split("IF NOT EXISTS ")[1].split(" ")[0]
            try:
                conn.execute(text(stmt))
                conn.commit()
                print(f"  OK  {idx} on {table}")
            except Exception as exc:
                conn.rollback()
                print(f"  SKIP {idx}: {exc}")
    print("\nDone.")

if __name__ == "__main__":
    run()
