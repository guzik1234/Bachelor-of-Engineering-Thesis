from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MaterialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_type: str
    content: dict
    version: int
    critique_passed: bool = True
    critique_notes: str | None = None
    created_at: datetime
