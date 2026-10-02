from pydantic import BaseModel

class ActivityOut(BaseModel):
    id: str
    action: str
    knowledgeId: str
    knowledgeTitle: str
    timestamp: str
    type: str

    class Config:
        from_attributes = True
