from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PreferenceBase(BaseModel):
    preferred_material_types: list[str] = Field(default_factory=list)
    available_hours_per_week: float = 5.0
    learning_style: str = "mixed"


class PreferenceUpdate(PreferenceBase):
    pass


class PreferenceRead(PreferenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime
