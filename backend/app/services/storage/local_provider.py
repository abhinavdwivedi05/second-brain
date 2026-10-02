import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from app.core.config import settings

class LocalStorageProvider:
    """Simple local filesystem storage.
    All files are saved under the directory configured by settings.STORAGE_DIR.
    The directory is created if it does not exist.
    """

    def __init__(self) -> None:
        self.base_path = Path(settings.STORAGE_DIR)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _generate_unique_name(self, original_filename: str) -> str:
        # Preserve extension but generate a UUID to avoid collisions and path traversal.
        ext = Path(original_filename).suffix
        unique_name = f"{uuid.uuid4().hex}{ext}"
        return unique_name

    async def save(self, file: UploadFile) -> str:
        """Save an UploadFile and return the stored filename (relative to STORAGE_DIR)."""
        stored_name = self._generate_unique_name(file.filename)
        destination = self.base_path / stored_name
        # Write file in chunks to avoid loading whole file into memory.
        async with destination.open('wb') as out_file:
            while content := await file.read(1024 * 1024):  # 1 MiB chunks
                await out_file.write(content)
        await file.seek(0)  # Reset pointer for any further reading.
        return stored_name

    def get_path(self, stored_filename: str) -> Path:
        """Return absolute Path for a stored filename."""
        return self.base_path / stored_filename

    def delete(self, stored_filename: str) -> None:
        """Delete a stored file if it exists. Silently ignore missing files."""
        try:
            os.remove(self.get_path(stored_filename))
        except FileNotFoundError:
            pass
