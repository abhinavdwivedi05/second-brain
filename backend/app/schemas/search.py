from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

def _to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])

class SearchResultItem(BaseModel):
    id: str
    title: str
    snippet: str
    type: str
    summary: str
    tags: List[str] = Field(default_factory=list)
    collection_id: Optional[str] = None
    collection_name: Optional[str] = None
    is_favorite: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    relevance_score: Optional[float] = None
    score: Optional[float] = None

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class SearchResponse(BaseModel):
    items: List[SearchResultItem]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )
