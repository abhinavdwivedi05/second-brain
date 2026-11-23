from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

def _to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])

class FileResponse(BaseModel):
    id: str = Field(..., description="File UUID")
    user_id: str = Field(..., description="Owner User UUID")
    knowledge_id: Optional[str] = Field(None, description="Associated Knowledge UUID")
    original_filename: str = Field(..., description="Original name uploaded by user")
    stored_filename: str = Field(..., description="Internal unique filename on disk")
    mime_type: str = Field(..., description="MIME type of the file")
    size_bytes: int = Field(..., description="File size in bytes")
    file_path: Optional[str] = Field(None, description="Relative storage path")
    extracted_text: Optional[str] = Field(None, description="Extracted document text")
    processing_status: str = Field("uploaded", description="Status: uploaded, processing, completed, failed")
    processing_error: Optional[str] = Field(None, description="Error message if processing failed")
    created_at: datetime = Field(..., description="Upload timestamp")
    updated_at: datetime = Field(..., description="Last updated timestamp")
    download_url: Optional[str] = Field(None, description="Endpoint to download the file")
    file_size_formatted: Optional[str] = Field(None, description="Human readable size")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class FileListResponse(BaseModel):
    items: List[FileResponse]
    total: int
    limit: int
    offset: int

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )
