import pytest
import pytest_asyncio
from app.database.session import engine


@pytest_asyncio.fixture(autouse=True)
async def cleanup_connections():
    yield
    await engine.dispose()
