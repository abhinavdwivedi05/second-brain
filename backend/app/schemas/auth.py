from pydantic import BaseModel, EmailStr
from typing import Optional

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    username: str # Email
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserProfileOut(BaseModel):
    id: str
    name: str
    email: str
    avatarUrl: str
    role: str
    storageUsedBytes: int
    storageLimitBytes: int
    aiCreditsRemaining: int
    aiCreditsTotal: int

    class Config:
        from_attributes = True
