from pydantic import BaseModel
from typing import Optional

class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None

class TagOut(BaseModel):
    id: str
    name: str
    color: str
    itemCount: int = 0

    class Config:
        from_attributes = True
