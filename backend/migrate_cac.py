"""
Run once to add CAC verification columns to the vendors table.
Usage: python migrate_cac.py
"""
from app.core.database import engine
from sqlalchemy import text

migrations = [
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cac_id VARCHAR;",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cac_verified_name VARCHAR;",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cac_verification_attempted BOOLEAN DEFAULT FALSE;",
]

with engine.connect() as conn:
    for sql in migrations:
        conn.execute(text(sql))
        print(f"✓ {sql}")
    conn.commit()

print("Migration complete.")
