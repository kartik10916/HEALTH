import os
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Vercel: use PostgreSQL (set DATABASE_URL in Vercel dashboard)
# Local dev / Serverless fallback: use SQLite
if not DATABASE_URL:
    if os.getenv("VERCEL"):
        # On Vercel, root filesystem is read-only. /tmp is writable.
        tmp_db_path = "/tmp/healthcare.db"
        local_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "healthcare.db")
        
        # If local pre-seeded db exists and /tmp db doesn't, copy it
        if os.path.exists(local_db_path) and not os.path.exists(tmp_db_path):
            try:
                import shutil
                shutil.copy2(local_db_path, tmp_db_path)
            except Exception as e:
                print(f"Failed to copy seeded DB to /tmp: {e}")
        
        DATABASE_URL = f"sqlite:///{tmp_db_path}"
    else:
        DATABASE_URL = "sqlite:///./healthcare.db"

# Normalize Neon/Heroku-style postgres:// → postgresql:// for SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False; PostgreSQL does not
is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # recover from stale connections (important for serverless)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
