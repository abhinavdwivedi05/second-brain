from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.database.session import get_db
from app.models.user import User

http_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Allow fallback demo user if no token passed (only when DEV_AUTH_BYPASS is enabled)
    if not auth_credentials or not auth_credentials.credentials:
        if settings.DEV_AUTH_BYPASS:
            result = await db.execute(select(User).where(User.email == "abhinav@secondbrain.ai"))
            demo_user = result.scalars().first()
            if demo_user:
                return demo_user
        # If demo bypass disabled or demo user not found, raise 401
        raise credentials_exception

    if auth_credentials.scheme.lower() != "bearer":
        raise credentials_exception

    token = auth_credentials.credentials

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception

    return user
