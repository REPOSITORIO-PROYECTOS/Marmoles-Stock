import base64
import secrets
from datetime import datetime, timedelta
from typing import List
from fastapi import Depends, HTTPException, status
from fastapi import Header
from sqlalchemy.orm import Session
from .db import get_db
from .models import User, Session as DbSession
import hashlib

def hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200000)
    return base64.b64encode(dk).decode()

def verify_password(password: str, salt: str, password_hash: str) -> bool:
    return hash_password(password, salt) == password_hash

def create_session(db: Session, user_id: str, hours: int = 8) -> str:
    # Remove expired sessions
    db.query(DbSession).filter(DbSession.expires_at < datetime.utcnow()).delete()
    
    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(hours=hours)
    s = DbSession(token=token, user_id=user_id, expires_at=expires_at)
    db.add(s)
    db.commit()
    return token

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    token = authorization.split(" ", 1)[1]
    s = db.query(DbSession).filter(DbSession.token == token).first()
    if not s or s.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    u = db.query(User).filter(User.id == s.user_id, User.active == True).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return u

def require_roles(roles: List[str]):
    def dep(u: User = Depends(get_current_user)) -> User:
        if u.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return u
    return dep

def logout_session(db: Session, authorization: str) -> None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return
    token = authorization.split(" ", 1)[1]
    s = db.query(DbSession).filter(DbSession.token == token).first()
    if s:
        db.delete(s)
        db.commit()
