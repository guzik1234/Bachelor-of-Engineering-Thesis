from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    material_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


class FeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    rating: int
    comment: str | None
    created_at: datetime
