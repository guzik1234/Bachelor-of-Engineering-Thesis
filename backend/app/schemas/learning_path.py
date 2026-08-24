from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.material import MaterialRead


class LearningPathGenerateRequest(BaseModel):
    technology: str = Field(..., examples=["React"])
    experience_level: str = Field(..., examples=["beginner"])
    learning_goal: str | None = None


class ModuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_index: int
    title: str
    summary: str
    completed: bool = False


class ModuleDetailRead(ModuleRead):
    materials: list[MaterialRead] = Field(default_factory=list)


class LearningPathRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technology: str
    experience_level: str
    learning_goal: str | None
    title: str
    description: str
    status: str
    created_at: datetime
    modules: list[ModuleRead] = Field(default_factory=list)


class LearningPathSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technology: str
    experience_level: str
    title: str
    description: str
    status: str
    created_at: datetime
    module_count: int = 0
    completed_module_count: int = 0
