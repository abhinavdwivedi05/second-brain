from pydantic import BaseModel
from typing import Optional

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
    description: str
    icon: str
    color: str
    itemCount: int = 0
    createdAt: str

    class Config:
        from_attributes = True
