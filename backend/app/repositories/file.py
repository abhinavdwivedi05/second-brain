from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.file import File

class FileRepository:
    """Repository for File model handling basic DB operations."""

    @staticmethod
    async def create(db: AsyncSession, *, user_id: str, original_filename: str, stored_filename: str, mime_type: str, size_bytes: int) -> File:
        new_file = File(
            user_id=user_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            mime_type=mime_type,
            size_bytes=size_bytes,
        )
        db.add(new_file)
        await db.flush()
        return new_file

    @staticmethod
    async def get_by_id(db: AsyncSession, *, file_id: str, user_id: str) -> File | None:
        stmt = select(File).where(File.id == file_id, File.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def delete(db: AsyncSession, *, file_id: str, user_id: str) -> int:
        stmt = delete(File).where(File.id == file_id, File.user_id == user_id)
        result = await db.execute(stmt)
        return result.rowcount
