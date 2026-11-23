from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


def _to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class KnowledgeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    type: str = Field("NOTE", description="NOTE, LINK, PDF, IMAGE, AUDIO, DOCUMENT")
    summary: Optional[str] = ""
    content: Optional[str] = ""
    original_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[str] = None
    file_type: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    collection_id: Optional[str] = None
    is_favorite: bool = False
    is_archived: bool = False
    key_concepts: List[str] = Field(default_factory=list)
    related_knowledge_ids: List[str] = Field(default_factory=list)
    ai_insights: List[str] = Field(default_factory=list)
    audio_duration: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )


class KnowledgeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    type: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    original_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[str] = None
    file_type: Optional[str] = None
    tags: Optional[List[str]] = None
    collection_id: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    processing_status: Optional[str] = None
    processing_progress: Optional[int] = None
    processing_step: Optional[str] = None
    key_concepts: Optional[List[str]] = None
    related_knowledge_ids: Optional[List[str]] = None
    ai_insights: Optional[List[str]] = None
    audio_duration: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )


class KnowledgeOut(BaseModel):
    id: str
    title: str
    type: str
    summary: str = ""
    content: str = ""
    original_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[str] = None
    file_type: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    collection_id: Optional[str] = None
    collection_name: Optional[str] = None
    is_favorite: bool = False
    is_archived: bool = False
    created_at: datetime | str
    updated_at: datetime | str
    last_accessed_at: Optional[datetime | str] = None
    processing_status: str = "COMPLETED"
    processing_progress: Optional[int] = 100
    processing_step: Optional[str] = None
    key_concepts: List[str] = Field(default_factory=list)
    related_knowledge_ids: List[str] = Field(default_factory=list)
    ai_insights: Optional[List[str]] = Field(default_factory=list)
    audio_duration: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )


# Alias for compatibility
KnowledgeResponse = KnowledgeOut


class KnowledgeListResponse(BaseModel):
    items: List[KnowledgeOut]
    total: int
    limit: int
    offset: int

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )
