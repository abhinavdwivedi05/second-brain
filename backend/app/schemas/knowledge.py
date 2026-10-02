from pydantic import BaseModel, Field
from typing import Optional, List

class KnowledgeCreate(BaseModel):
    title: str
    type: str = "NOTE"
    summary: str = ""
    content: str = ""
    originalUrl: Optional[str] = None
    fileName: Optional[str] = None
    fileSize: Optional[str] = None
    fileType: Optional[str] = None
    tags: List[str] = []
    collectionId: Optional[str] = None
    isFavorite: bool = False
    isArchived: bool = False
    keyConcepts: List[str] = []
    relatedKnowledgeIds: List[str] = []
    aiInsights: List[str] = []

class KnowledgeUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    originalUrl: Optional[str] = None
    fileName: Optional[str] = None
    fileSize: Optional[str] = None
    fileType: Optional[str] = None
    tags: Optional[List[str]] = None
    collectionId: Optional[str] = None
    collectionName: Optional[str] = None
    isFavorite: Optional[bool] = None
    isArchived: Optional[bool] = None
    processingStatus: Optional[str] = None
    processingProgress: Optional[int] = None
    processingStep: Optional[str] = None
    keyConcepts: Optional[List[str]] = None
    relatedKnowledgeIds: Optional[List[str]] = None
    aiInsights: Optional[List[str]] = None

class KnowledgeOut(BaseModel):
    id: str
    title: str
    type: str
    summary: str
    content: str
    originalUrl: Optional[str] = None
    fileName: Optional[str] = None
    fileSize: Optional[str] = None
    fileType: Optional[str] = None
    tags: List[str] = []
    collectionId: Optional[str] = None
    collectionName: Optional[str] = None
    isFavorite: bool
    isArchived: bool
    createdAt: str
    updatedAt: str
    lastAccessedAt: Optional[str] = None
    processingStatus: str
    processingProgress: Optional[int] = 100
    processingStep: Optional[str] = None
    keyConcepts: List[str] = []
    relatedKnowledgeIds: List[str] = []
    aiInsights: Optional[List[str]] = []
    audioDuration: Optional[str] = None

    class Config:
        from_attributes = True
