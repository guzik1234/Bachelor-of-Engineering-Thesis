from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatQuestionCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    created_at: datetime
