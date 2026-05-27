"""
Run once to add image columns to the vendors table.
Usage: python migrate_vendor_images.py
"""
from app.core.database import engine
from sqlalchemy import text

migrations = [
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR;",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS gallery_images JSON;",
]

with engine.connect() as conn:
    for sql in migrations:
        conn.execute(text(sql))
        print(f"✓ {sql}")
    conn.commit()

print("Migration complete.")
