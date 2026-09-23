from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from lifeos.core.database import get_db
from lifeos.core.security import decode_access_token
from lifeos.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Returns current user from token, or auto-provisions a default continuity user if none provided."""
    if token:
        user_id = decode_access_token(token)
        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalars().first()
            if user:
                return user

    # Default / demo user auto-provisioning for seamless exploration
    default_email = "alex@convia.app"
    result = await db.execute(select(User).where(User.email == default_email))
    user = result.scalars().first()
    if not user:
        user = User(
            email=default_email,
            hashed_password="demo_hashed_secret",
            full_name="Alex Mercer",
            autonomy_level=3
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user

