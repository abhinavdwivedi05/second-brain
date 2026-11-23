from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

def _to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])

class SummarizeRequest(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None
    knowledge_id: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class SummarizeResponse(BaseModel):
    summary: str
    knowledge_id: Optional[str] = None
    provider: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class ExtractConceptsRequest(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None
    knowledge_id: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class ExtractConceptsResponse(BaseModel):
    key_concepts: List[str] = Field(default_factory=list, description="Extracted key concepts")
    concepts: List[str] = Field(default_factory=list, description="Extracted key concepts (alias)")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class SuggestTagsRequest(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None
    knowledge_id: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class SuggestTagsResponse(BaseModel):
    tags: List[str] = Field(default_factory=list, description="Suggested tags")
    suggested_tags: List[str] = Field(default_factory=list, description="Suggested tags (alias)")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class ChatSource(BaseModel):
    id: str
    title: str
    type: str

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class ChatRequest(BaseModel):
    query: str
    knowledge_id: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )

class ChatResponse(BaseModel):
    answer: str
    sources: List[ChatSource] = Field(default_factory=list, description="Relevant reference sources from user knowledge")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )
