from pydantic import BaseModel
from typing import Optional

class AIGenerateRequest(BaseModel):
    """Request payload for generic AI generation"""
    prompt: str
    system_prompt: Optional[str] = None

class AIGenerateResponse(BaseModel):
    """Response payload containing generated text"""
    generated_text: str
