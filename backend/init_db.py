"""Bring the database schema up to date. Safe to run on every start.

- Fresh, empty database -> create all tables from the models, then stamp Alembic at head.
- Existing database     -> run `alembic upgrade head` as normal.

Runs automatically when the API starts (see `lifespan` in main.py), so a new or wiped
database gets its tables on the next deploy whatever the start command is.

Usage by hand (from backend/):  python init_db.py
"""
import pathlib

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.core.database import Base, engine
import main  # noqa: F401  — registers every model on Base.metadata

_ALEMBIC_INI = pathlib.Path(__file__).parent / "alembic.ini"
_SCHEMA_LOCK = 727002  # pg advisory lock id; 727001 is the background job lock in main.py


def run() -> None:
    cfg = Config(str(_ALEMBIC_INI))
    cfg.attributes["configure_logger"] = False  # keep the app's/uvicorn's logging setup intact
    # Several API workers start at once: only one sets up the schema, the rest wait and then
    # find it already done.
    with engine.connect() as lock_conn:
        lock_conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": _SCHEMA_LOCK})
        try:
            if not inspect(engine).has_table("users"):
                print("Empty database detected - creating tables...")
                Base.metadata.create_all(bind=engine)
                command.stamp(cfg, "head")
                print("Done. Schema created and Alembic stamped at head.")
            else:
                print("Existing database - applying pending migrations...")
                command.upgrade(cfg, "head")
                print("Done.")
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _SCHEMA_LOCK})


if __name__ == "__main__":
    run()
