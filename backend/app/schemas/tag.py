from typing import Optional
from pydantic import BaseModel, ConfigDict


def _to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class TagCreate(BaseModel):
    name: str
    color: Optional[str] = "#3B82F6"


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TagOut(BaseModel):
    id: str
    name: str
    color: str
    item_count: int = 0

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )
