from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


def _to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "Folder"
    color: Optional[str] = "#3B82F6"


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CollectionOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    icon: str
    color: str
    item_count: int = 0
    created_at: datetime | str

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )
