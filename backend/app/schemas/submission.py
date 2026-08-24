from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SubmissionCreate(BaseModel):
    code: str = Field(..., min_length=1)


class SubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    submitted_code: str
    passed: bool
    feedback: str
    strengths: list[str]
    improvements: list[str]
    created_at: datetime
