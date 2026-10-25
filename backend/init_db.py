"""Bring the database schema up to date. Safe to run on every start.

- Fresh, empty database -> create all tables from the models, then stamp Alembic at head.
- Existing database     -> run `alembic upgrade head` as normal.

Usage (from backend/):  python init_db.py
"""
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.core.database import Base, engine
import main  # noqa: F401  — registers every model on Base.metadata


def run() -> None:
    cfg = Config("alembic.ini")
    if not inspect(engine).has_table("users"):
        print("Empty database detected - creating tables...")
        Base.metadata.create_all(bind=engine)
        command.stamp(cfg, "head")
        print("Done. Schema created and Alembic stamped at head.")
    else:
        print("Existing database - applying pending migrations...")
        command.upgrade(cfg, "head")
        print("Done.")


if __name__ == "__main__":
    run()