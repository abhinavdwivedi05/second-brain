from datetime import datetime
from pydantic import BaseModel, Field

class FileResponse(BaseModel):
    id: str = Field(..., description="File UUID")
    original_filename: str = Field(..., description="Original name uploaded by user")
    mime_type: str = Field(..., description="MIME type of the file")
    size_bytes: int = Field(..., description="Size in bytes")
    created_at: datetime = Field(..., description="Timestamp of upload")
    download_url: str = Field(..., description="Endpoint to download the file")

    class Config:
        orm_mode = True
