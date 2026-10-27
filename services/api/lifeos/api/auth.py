from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field
from typing import Optional
from lifeos.core.database import get_db
from lifeos.core.security import get_password_hash, verify_password, create_access_token
from lifeos.models.user import User
from lifeos.schemas.auth import UserCreate, UserLogin, Token, UserResponse
from lifeos.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class UserSettingsUpdate(BaseModel):
    full_name: Optional[str] = None
    autonomy_level: Optional[int] = Field(None, ge=0, le=5)
    voice_enabled: Optional[bool] = None
    preferred_voice: Optional[str] = None
    timezone_pref: Optional[str] = None


@router.post("/register", response_model=Token)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    email = str(user_in.email).lower()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    user = User(
        email=email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="User with this email already exists") from None
    await db.refresh(user)

    token = create_access_token(user.id)
    return Token(access_token=token, user_id=user.id, email=user.email, full_name=user.full_name)


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == str(credentials.email).lower()))
    user = result.scalars().first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(user.id)
    return Token(access_token=token, user_id=user.id, email=user.email, full_name=user.full_name)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user

