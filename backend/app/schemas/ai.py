from pydantic import BaseModel
from typing import Optional, List

class SummarizeRequest(BaseModel):
    content: str
    title: Optional[str] = None

class SummarizeResponse(BaseModel):
    summary: str

class KeyConceptsRequest(BaseModel):
    content: str

class KeyConceptsResponse(BaseModel):
    keyConcepts: List[str]

class SuggestTagsRequest(BaseModel):
    content: str
    title: str

class SuggestTagsResponse(BaseModel):
    tags: List[str]

class ChatRequest(BaseModel):
    query: str
    knowledgeId: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
