"""
Migration: enforce booking_id NOT NULL and unique constraint on reviews.

Run once:
    cd backend && python migrate_review_constraints.py
"""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

steps = [
    # Delete orphaned reviews that have no booking_id (they can never be valid now)
    ("Removing reviews without a booking_id",
     "DELETE FROM reviews WHERE booking_id IS NULL"),

    # Make booking_id NOT NULL
    ("Setting booking_id NOT NULL",
     "ALTER TABLE reviews ALTER COLUMN booking_id SET NOT NULL"),

    # Add unique constraint (idempotent — IF NOT EXISTS equivalent via try/ignore)
    ("Adding unique constraint on booking_id",
     """
     DO $$
     BEGIN
         IF NOT EXISTS (
             SELECT 1 FROM pg_constraint
             WHERE conname = 'uq_reviews_booking_id'
         ) THEN
             ALTER TABLE reviews
             ADD CONSTRAINT uq_reviews_booking_id UNIQUE (booking_id);
         END IF;
     END $$;
     """),
]

for description, sql in steps:
    print(f"  → {description}...", end=" ", flush=True)
    cur.execute(sql)
    print("done")

conn.commit()
cur.close()
conn.close()
print("\nMigration complete.")
