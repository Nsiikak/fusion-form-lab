"""
Run once to create the events table and add event_id FK to bookings.
Safe to run multiple times — uses IF NOT EXISTS / IF EXISTS guards.
Usage: python migrate_events.py
"""
from app.core.database import engine
from sqlalchemy import text

migrations = [
    # Events table
    """
    CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES users(id),
        name VARCHAR NOT NULL,
        date DATE NOT NULL,
        location VARCHAR NOT NULL,
        description TEXT,
        total_budget NUMERIC(10, 2),
        status VARCHAR NOT NULL DEFAULT 'planning',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ
    );
    """,
    # Indexes on events
    "CREATE INDEX IF NOT EXISTS ix_events_customer_id ON events (customer_id);",
    "CREATE INDEX IF NOT EXISTS ix_events_date ON events (date);",
    "CREATE INDEX IF NOT EXISTS ix_events_status ON events (status);",
    # Add event_id FK to bookings
    "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id);",
    "CREATE INDEX IF NOT EXISTS ix_bookings_event_id ON bookings (event_id);",
]

with engine.connect() as conn:
    for sql in migrations:
        conn.execute(text(sql))
        print(f"✓ {sql.strip().splitlines()[0]}")
    conn.commit()

print("\nMigration complete.")
