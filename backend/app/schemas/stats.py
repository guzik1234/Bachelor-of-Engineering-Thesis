from pydantic import BaseModel


class PathStats(BaseModel):
    id: int
    technology: str
    title: str
    completion_ratio: float
    avg_feedback_rating: float
    feedback_count: int
    exercise_pass_rate: float
    exercise_attempts: int
    pace_assessment: str | None


class OverviewStats(BaseModel):
    total_paths: int
    total_modules: int
    completed_modules: int
    completion_ratio: float
    avg_feedback_rating: float
    feedback_count: int
    exercise_pass_rate: float
    exercise_attempts: int


class StatsRead(BaseModel):
    overview: OverviewStats
    paths: list[PathStats]
