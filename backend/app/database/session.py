import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Determine DB URL
database_url = settings.DATABASE_URL
if getattr(settings, "USE_SQLITE_FALLBACK", False):
    database_url = settings.SQLITE_FALLBACK_URL

connect_args = {}
if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Create Async Engine
engine = create_async_engine(
    database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
