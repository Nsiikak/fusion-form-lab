"""
Run once to add vendor pricing fields and booking event_address column.
Usage: python migrate_pricing_and_address.py
"""
from app.core.database import engine
from sqlalchemy import text

migrations = [
    # Vendor pricing structure fields
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS service_fee_percentage NUMERIC(5,2);",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logistics_fee NUMERIC(10,2);",
    # Booking event address
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_address JSONB;",
]

with engine.connect() as conn:
    for sql in migrations:
        conn.execute(text(sql))
        print(f"✓ {sql}")
    conn.commit()

print("Migration complete.")
