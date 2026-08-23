import os
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if os.getenv("VERCEL"):
    if not DATABASE_URL or DATABASE_URL.startswith("sqlite"):
        tmp_db_path = "/tmp/healthcare.db"
        local_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "healthcare.db")
        
        if os.path.exists(local_db_path) and not os.path.exists(tmp_db_path):
            try:
                import shutil
                shutil.copy2(local_db_path, tmp_db_path)
            except Exception as e:
                print(f"Failed to copy seeded DB to /tmp: {e}")
        
        DATABASE_URL = f"sqlite:///{tmp_db_path}"
else:
    if not DATABASE_URL:
        DATABASE_URL = "sqlite:///./healthcare.db"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def ensure_db_ready():
    try:
        Base.metadata.create_all(bind=engine)
        from seed_admin import seed_if_empty
        seed_if_empty()
    except Exception as e:
        print(f"ensure_db_ready notice: {e}")

ensure_db_ready()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
