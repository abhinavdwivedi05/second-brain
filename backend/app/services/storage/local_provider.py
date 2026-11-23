import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from app.core.config import settings

class LocalStorageProvider:
    """Local filesystem storage provider with path traversal protection and chunked writing."""

    def __init__(self, storage_dir: str = None) -> None:
        self.base_path = Path(storage_dir or settings.STORAGE_DIR).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _generate_unique_name(self, original_filename: str) -> str:
        """Preserve extension but generate a UUID to avoid collisions and path traversal."""
        ext = Path(original_filename).suffix.lower()
        # Clean extension of dangerous characters
        clean_ext = "".join(c for c in ext if c.isalnum() or c == ".")
        return f"{uuid.uuid4().hex}{clean_ext}"

    async def save(self, file: UploadFile) -> str:
        """Save an UploadFile in 1MB chunks and return the stored filename relative to STORAGE_DIR."""
        stored_name = self._generate_unique_name(file.filename or "upload.bin")
        destination = self.get_path(stored_name)
        
        with open(destination, "wb") as out_file:
            while content := await file.read(1024 * 1024):  # 1 MiB chunk
                out_file.write(content)
                
        await file.seek(0)
        return stored_name

    def get_path(self, stored_filename: str) -> Path:
        """Return safe absolute Path for a stored filename, preventing path traversal."""
        # Sanitize filename (take only basename)
        safe_name = Path(stored_filename).name
        target = (self.base_path / safe_name).resolve()
        
        # Verify target is inside base_path
        if not str(target).startswith(str(self.base_path)):
            raise ValueError(f"Path traversal attempt detected: {stored_filename}")
            
        return target

    def delete(self, stored_filename: str) -> bool:
        """Delete a stored file if it exists. Returns True if deleted, False otherwise."""
        try:
            target = self.get_path(stored_filename)
            if target.is_file():
                os.remove(target)
                return True
        except (FileNotFoundError, ValueError, OSError):
            pass
        return False

    @staticmethod
    def format_bytes(size_bytes: int) -> str:
        """Format raw byte count into human-readable string (KB, MB, etc.)."""
        if not size_bytes or size_bytes <= 0:
            return "0 B"
        units = ["B", "KB", "MB", "GB"]
        i = 0
        size = float(size_bytes)
        while size >= 1024.0 and i < len(units) - 1:
            size /= 1024.0
            i += 1
        return f"{size:.2f} {units[i]}"

storage_provider = LocalStorageProvider()
