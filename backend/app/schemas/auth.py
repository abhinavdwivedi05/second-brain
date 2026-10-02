from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional


def _to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    username: str  # Email
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserProfileOut(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    role: str
    storage_used_bytes: int
    storage_limit_bytes: int
    ai_credits_remaining: int
    ai_credits_total: int

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )
