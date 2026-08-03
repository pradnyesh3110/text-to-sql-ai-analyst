# backend/database.py
import os
import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Use SQLite for demo, or PostgreSQL/Supabase for production
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./demo.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Storage quotas per plan, in MB
PLAN_QUOTAS_MB = {
    "free": 2048,   # 2 GB
    "pro" : 4096,   # 4 GB
}

# ─── User Table ───────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    query_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # ── Subscription ──
    plan                     = Column(String, default="free")     # "free" | "pro"
    subscription_status      = Column(String, default="active")   # "active" | "expired"
    subscription_started_at  = Column(DateTime, nullable=True)
    subscription_expires_at  = Column(DateTime, nullable=True)     # null = never expires (free plan)
    is_admin                 = Column(Boolean, default=False)

    # ── Storage ──
    storage_quota_mb = Column(Float, default=float(PLAN_QUOTAS_MB["free"]))
    storage_used_mb  = Column(Float, default=0.0)

# ─── Uploaded Files (one row per persisted CSV/table) ─
class UserFile(Base):
    __tablename__ = "user_files"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, index=True)
    original_filename = Column(String)
    table_name        = Column(String, unique=True, index=True)
    size_mb           = Column(Float, default=0.0)
    rows              = Column(Integer, default=0)
    columns_json      = Column(String, default="[]")
    uploaded_at       = Column(DateTime, default=datetime.datetime.utcnow)

# ─── Query Log Table ──────────────────────────────────
class QueryLog(Base):
    __tablename__ = "query_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    question = Column(String)
    sql_generated = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_query(sql: str, db: Session = None):
    """Execute a raw SQL query and return results."""
    if db is None:
        db = SessionLocal()
    try:
        result = db.execute(text(sql))
        db.commit()
        rows = result.fetchall()
        columns = result.keys()
        return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
