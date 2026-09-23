from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = "CONVIA User"


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str


class UserResponse(UserBase):
    id: str
    autonomy_level: int
    voice_enabled: bool
    preferred_voice: str
    timezone_pref: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
