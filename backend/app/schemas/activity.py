from datetime import datetime
from pydantic import BaseModel, ConfigDict

def _to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])

class ActivityOut(BaseModel):
    id: str
    action: str
    knowledge_id: str
    knowledge_title: str
    timestamp: datetime
    type: str

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )
