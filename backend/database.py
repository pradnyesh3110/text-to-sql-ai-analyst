# backend/database.py
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

# Use SQLite for demo (easy), or PostgreSQL for production
DATABASE_URL = "sqlite:///./demo.db"
# For Render PostgreSQL: DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./demo.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ─── User Table ───────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    query_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

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