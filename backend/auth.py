# backend/auth.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.database import get_db, User
import os

SECRET_KEY = "your-secret-key-change-this"  # Change in production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain, hashed):
    if not hashed:
        return False
    return pwd_context.verify(plain, hashed)

def hash_password(password):
    return pwd_context.hash(password)

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_google_token(credential: str) -> dict:
    """Verify a Google Identity Services ID token and return its payload.
    Raises HTTPException(401) if the token is missing, malformed, or not
    issued for this app's GOOGLE_CLIENT_ID."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured on the server (missing GOOGLE_CLIENT_ID).")
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    try:
        payload = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Invalid issuer")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google sign-in token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# ─── Query Limit Check ────────────────────────────────
FREE_QUERY_LIMIT = 100

def check_query_limit(user: User, db: Session):
    if user.query_count >= FREE_QUERY_LIMIT:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Free limit reached",
                "queries_used": user.query_count,
                "limit": FREE_QUERY_LIMIT,
                "action": "download_local",
                "download_url": "/download-local-version"
            }
        )
    return True

def increment_query_count(user: User, db: Session):
    user.query_count += 1
    db.commit()
    return user.query_count
