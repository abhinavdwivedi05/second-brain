from typing import List
from pydantic import BaseModel, ConfigDict
from app.schemas.knowledge import KnowledgeOut
from app.schemas.activity import ActivityOut

def _to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])

class DashboardStatsOut(BaseModel):
    total_knowledge: int
    total_notes: int
    total_links: int
    total_documents: int
    total_collections: int
    total_tags: int
    total_favorites: int
    recent_items: List[KnowledgeOut]
    recent_accessed: List[KnowledgeOut]
    recent_activities: List[ActivityOut]

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )

