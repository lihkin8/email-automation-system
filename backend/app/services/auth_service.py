from typing import Optional

from cryptography.fernet import Fernet
from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models import User


def encrypt_token(token: str) -> str:
    """Encrypt a plaintext token using Fernet symmetric encryption."""
    f = Fernet(settings.fernet_key.encode())
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    """Decrypt a Fernet-encrypted token."""
    f = Fernet(settings.fernet_key.encode())
    return f.decrypt(encrypted.encode()).decode()


def create_jwt(user_id: int) -> str:
    """Create a signed HS256 JWT for the given user, valid for 7 days."""
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    """Decode and verify a JWT. Raises 401 on invalid or expired token."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )


async def get_db() -> AsyncSession:
    """FastAPI dependency: yield an async DB session."""
    async with async_session() as session:
        yield session


async def get_current_user(
    session: AsyncSession = Depends(get_db),
    session_token: Optional[str] = Cookie(default=None),
) -> User:
    """FastAPI dependency: resolve the current user from the session cookie."""
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_jwt(session_token)
    user_id = int(payload["sub"])

    from app.repositories import UserRepository
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
