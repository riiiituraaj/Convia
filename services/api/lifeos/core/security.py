from datetime import datetime, timedelta, timezone
import secrets
from typing import Optional, Any
from jose import jwt
from passlib.context import CryptContext
from lifeos.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_LOCAL_DEVELOPMENT_SECRET = secrets.token_urlsafe(48)


def _signing_secret() -> str:
    # Local development remains easy to start without shipping a reusable secret.
    # Production configuration validation requires an explicit persistent secret.
    return settings.AUTH_SECRET or _LOCAL_DEVELOPMENT_SECRET


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, _signing_secret(), algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, _signing_secret(), algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except Exception:
        return None

