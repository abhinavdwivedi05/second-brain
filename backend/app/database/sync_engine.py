from sqlalchemy import create_engine
from app.core.config import settings

# Synchronous engine for Alembic (and any sync code)
engine_sync = create_engine(
    settings.DATABASE_URL_SYNC,
    echo=False,
    future=True,
    pool_pre_ping=True,
)
