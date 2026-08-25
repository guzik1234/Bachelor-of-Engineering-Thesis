from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.stats import OverviewStats, PathStats, StatsRead
from app.services.recommendation_agent import collect_signals

router = APIRouter()


@router.get("", response_model=StatsRead)
def get_stats(current_user: User = Depends(get_current_user)):
    paths = current_user.learning_paths

    path_stats: list[PathStats] = []
    per_path_signals = []
    for path in paths:
        signals = collect_signals(path, current_user.preference)
        per_path_signals.append(signals)
        latest_recommendation = path.recommendations[0] if path.recommendations else None
        path_stats.append(
            PathStats(
                id=path.id,
                technology=path.technology,
                title=path.title,
                completion_ratio=signals["completion_ratio"],
                avg_feedback_rating=signals["avg_feedback_rating"],
                feedback_count=signals["feedback_count"],
                exercise_pass_rate=signals["exercise_pass_rate"],
                exercise_attempts=signals["exercise_attempts"],
                pace_assessment=latest_recommendation.pace_assessment if latest_recommendation else None,
            )
        )

    total_modules = sum(s["total_modules"] for s in per_path_signals)
    completed_modules = sum(s["completed_modules"] for s in per_path_signals)

    total_feedback_count = sum(s["feedback_count"] for s in per_path_signals)
    weighted_rating_sum = sum(s["avg_feedback_rating"] * s["feedback_count"] for s in per_path_signals)

    total_attempts = sum(s["exercise_attempts"] for s in per_path_signals)
    total_passed = sum(round(s["exercise_pass_rate"] * s["exercise_attempts"]) for s in per_path_signals)

    overview = OverviewStats(
        total_paths=len(paths),
        total_modules=total_modules,
        completed_modules=completed_modules,
        completion_ratio=completed_modules / total_modules if total_modules else 0.0,
        avg_feedback_rating=round(weighted_rating_sum / total_feedback_count, 2) if total_feedback_count else 0.0,
        feedback_count=total_feedback_count,
        exercise_pass_rate=total_passed / total_attempts if total_attempts else 0.0,
        exercise_attempts=total_attempts,
    )

    return StatsRead(overview=overview, paths=path_stats)
