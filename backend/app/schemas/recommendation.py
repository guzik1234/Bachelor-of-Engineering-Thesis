from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RecommendationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pace_assessment: str
    recommended_experience_level: str
    recommended_module_id: int | None
    recommended_module_title: str | None = None
    rationale: str
    created_at: datetime
