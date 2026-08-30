from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.learning_path import LearningPath
from app.models.module import Module
from app.models.recommendation import PathRecommendation
from app.models.user import User
from app.schemas.learning_path import (
    LearningPathGenerateRequest,
    LearningPathRead,
    LearningPathSummary,
    ModuleRead,
)
from app.schemas.recommendation import RecommendationRead
from app.services.llm_client import LLMGenerationError
from app.services.path_generator import generate_learning_path
from app.services.recommendation_agent import (
    collect_signals,
    generate_recommendation,
    incomplete_modules,
    weak_module_candidates,
    weak_modules,
)

router = APIRouter()


def _to_path_read(path: LearningPath, completed_module_ids: set[int]) -> LearningPathRead:
    weak_by_id = {w["id"]: w for w in weak_modules(path)}
    modules = [
        ModuleRead(
            id=m.id,
            order_index=m.order_index,
            title=m.title,
            summary=m.summary,
            completed=m.id in completed_module_ids,
            is_weak=m.id in weak_by_id,
            weak_reason=weak_by_id.get(m.id, {}).get("reason"),
            is_remediation=m.is_remediation,
        )
        for m in path.modules
    ]
    return LearningPathRead(
        id=path.id,
        technology=path.technology,
        experience_level=path.experience_level,
        learning_goal=path.learning_goal,
        title=path.title,
        description=path.description,
        status=path.status,
        created_at=path.created_at,
        modules=modules,
    )


def _get_owned_path(path_id: int, current_user: User, db: Session) -> LearningPath:
    path = db.get(LearningPath, path_id)
    if path is None or path.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono ścieżki edukacyjnej.")
    return path


@router.post("/generate", response_model=LearningPathRead, status_code=status.HTTP_201_CREATED)
def generate_path(
    payload: LearningPathGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        generated = generate_learning_path(
            technology=payload.technology,
            experience_level=payload.experience_level,
            learning_goal=payload.learning_goal,
            preference=current_user.preference,
        )
    except (LLMGenerationError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    path = LearningPath(
        user_id=current_user.id,
        technology=payload.technology,
        experience_level=payload.experience_level,
        learning_goal=payload.learning_goal,
        title=generated["title"],
        description=generated.get("description", ""),
    )
    db.add(path)
    db.flush()

    for index, module_data in enumerate(generated["modules"]):
        db.add(
            Module(
                learning_path_id=path.id,
                order_index=index,
                title=module_data.get("title", f"Moduł {index + 1}"),
                summary=module_data.get("summary", ""),
            )
        )

    db.commit()
    db.refresh(path)
    return _to_path_read(path, completed_module_ids=set())


@router.get("", response_model=list[LearningPathSummary])
def list_paths(current_user: User = Depends(get_current_user)):
    summaries = []
    for path in current_user.learning_paths:
        completed = sum(
            1
            for m in path.modules
            for p in m.progress_entries
            if p.user_id == current_user.id and p.completed
        )
        summaries.append(
            LearningPathSummary(
                id=path.id,
                technology=path.technology,
                experience_level=path.experience_level,
                title=path.title,
                description=path.description,
                status=path.status,
                created_at=path.created_at,
                module_count=len(path.modules),
                completed_module_count=completed,
            )
        )
    return summaries


@router.get("/{path_id}", response_model=LearningPathRead)
def get_path(path_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    path = _get_owned_path(path_id, current_user, db)
    completed_ids = {
        p.module_id
        for p in current_user.progress_entries
        if p.completed and p.module.learning_path_id == path.id
    }
    return _to_path_read(path, completed_ids)


@router.delete("/{path_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_path(path_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    path = _get_owned_path(path_id, current_user, db)
    db.delete(path)
    db.commit()


def _to_recommendation_read(rec: PathRecommendation) -> RecommendationRead:
    return RecommendationRead(
        id=rec.id,
        pace_assessment=rec.pace_assessment,
        recommended_experience_level=rec.recommended_experience_level,
        recommended_module_id=rec.recommended_module_id,
        recommended_module_title=rec.recommended_module.title if rec.recommended_module else None,
        rationale=rec.rationale,
        needs_remediation=rec.needs_remediation,
        remediation_module_id=rec.remediation_module_id,
        remediation_module_title=rec.remediation_module.title if rec.remediation_module else None,
        created_at=rec.created_at,
    )


@router.post("/{path_id}/recommendation", response_model=RecommendationRead, status_code=status.HTTP_201_CREATED)
def generate_path_recommendation(
    path_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    path = _get_owned_path(path_id, current_user, db)

    signals = collect_signals(path, current_user.preference)
    candidates = incomplete_modules(path)
    weak_candidates = weak_module_candidates(path)

    try:
        result = generate_recommendation(
            technology=path.technology,
            experience_level=path.experience_level,
            signals=signals,
            candidate_modules=candidates,
            weak_candidates=weak_candidates,
        )
    except (LLMGenerationError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    recommendation = PathRecommendation(learning_path_id=path.id, **result)
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)
    return _to_recommendation_read(recommendation)


@router.get("/{path_id}/recommendation", response_model=RecommendationRead)
def get_path_recommendation(
    path_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    path = _get_owned_path(path_id, current_user, db)
    if not path.recommendations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak rekomendacji dla tej ścieżki.")
    return _to_recommendation_read(path.recommendations[0])


@router.post(
    "/{path_id}/modules/{module_id}/remediation",
    response_model=LearningPathRead,
    status_code=status.HTTP_201_CREATED,
)
def create_remediation_module(
    path_id: int,
    module_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Monitoring-agent action: inserts a practice module right after `module_id`,
    targeting the weaknesses detected there. Idempotent — calling it again for a
    module that already has a practice module just returns the path unchanged."""
    path = _get_owned_path(path_id, current_user, db)
    source = next((m for m in path.modules if m.id == module_id), None)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono modułu.")

    already_has_remediation = any(m.source_module_id == source.id for m in path.modules)
    if not already_has_remediation:
        weak_by_id = {w["id"]: w for w in weak_modules(path)}
        weak = weak_by_id.get(source.id)
        if weak is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ten moduł nie został oznaczony jako słabość kursanta — nie ma czego przećwiczyć.",
            )

        for m in path.modules:
            if m.order_index > source.order_index:
                m.order_index += 1

        unique_notes = list(dict.fromkeys(weak["improvement_notes"]))[:5]
        focus_line = (
            f"Skoncentruj się na: {'; '.join(unique_notes)}."
            if unique_notes
            else "Powtórz i przećwicz kluczowe zagadnienia tego modułu."
        )
        summary = (
            f"Moduł powtórkowy wygenerowany przez agenta AI monitorującego postępy — kursant "
            f"miał trudności w module „{source.title}” ({weak['reason']}). {focus_line}"
        )

        db.add(
            Module(
                learning_path_id=path.id,
                order_index=source.order_index + 1,
                title=f"Powtórka: {source.title}",
                summary=summary,
                is_remediation=True,
                source_module_id=source.id,
            )
        )
        db.commit()
        db.refresh(path)

    completed_ids = {
        p.module_id for p in current_user.progress_entries if p.completed and p.module.learning_path_id == path.id
    }
    return _to_path_read(path, completed_ids)
