import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.database.session import get_db, Base
import app.models  # noqa: F401 - Register all models onto Base.metadata
from app.main import app

TEST_DB_FILE = "./test_second_brain.db"
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    future=True,
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def override_get_db():
    async with TestAsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create all tables in isolated SQLite database for pytest session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()
    await test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest_asyncio.fixture(autouse=True)
async def cleanup_connections():
    yield

@pytest.fixture(autouse=True)
def configure_test_providers(monkeypatch):
    """Ensure automated tests run with deterministic offline mock providers by default."""
    monkeypatch.setattr("app.core.config.settings.AI_PROVIDER", "mock")
    monkeypatch.setattr("app.core.config.settings.EMBEDDING_PROVIDER", "mock")

