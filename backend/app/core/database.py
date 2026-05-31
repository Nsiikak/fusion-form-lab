from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,       # Reconnect if connection dropped
    pool_recycle=300,         # Recycle connections every 5 min (avoid stale connections behind NAT/load balancer)
    connect_args={"connect_timeout": 10} if DATABASE_URL.startswith("postgresql") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

