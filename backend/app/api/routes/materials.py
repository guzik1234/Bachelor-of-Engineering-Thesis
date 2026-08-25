from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.material import Material
from app.models.module import Module
from app.models.submission import ExerciseSubmission
from app.models.user import User
from app.schemas.material import MaterialRead
from app.schemas.submission import SubmissionCreate, SubmissionRead
from app.services.code_checker import check_submission
from app.services.llm_client import LLMGenerationError
from app.services.material_generator import generate_material

router = APIRouter()

VALID_MATERIAL_TYPES = {"text", "quiz", "exercise", "code_example"}


def _get_owned_module(module_id: int, current_user: User, db: Session) -> Module:
    module = db.get(Module, module_id)
    if module is None or module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono modułu.")
    return module


def _get_owned_material(material_id: int, current_user: User, db: Session) -> Material:
    material = db.get(Material, material_id)
    if material is None or material.module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono materiału.")
    return material


def _recent_feedback_notes(module: Module, material_type: str) -> list[str]:
    notes = [
        fb.comment
        for material in module.materials
        if material.material_type == material_type
        for fb in material.feedback_entries
        if fb.comment and fb.rating <= 3
    ]
    return notes[-5:]


def _current_experience_level(module: Module) -> str:
    latest_recommendation = (
        module.learning_path.recommendations[0] if module.learning_path.recommendations else None
    )
    if latest_recommendation:
        return latest_recommendation.recommended_experience_level
    return module.learning_path.experience_level


def _generate_and_store(module: Module, material_type: str, db: Session) -> Material:
    feedback_notes = _recent_feedback_notes(module, material_type)
    try:
        content = generate_material(
            technology=module.learning_path.technology,
            experience_level=_current_experience_level(module),
            module_title=module.title,
            module_summary=module.summary,
            material_type=material_type,
            feedback_notes=feedback_notes,
        )
    except LLMGenerationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    existing_versions = [m.version for m in module.materials if m.material_type == material_type]
    next_version = max(existing_versions, default=0) + 1

    material = Material(
        module_id=module.id,
        material_type=material_type,
        content=content,
        version=next_version,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.get("/module/{module_id}", response_model=list[MaterialRead])
def get_module_materials(
    module_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = _get_owned_module(module_id, current_user, db)

    preferred_types = list(VALID_MATERIAL_TYPES)
    if current_user.preference and current_user.preference.preferred_material_types:
        preferred_types = current_user.preference.preferred_material_types

    latest_by_type: dict[str, Material] = {}
    for material in module.materials:
        current = latest_by_type.get(material.material_type)
        if current is None or material.version > current.version:
            latest_by_type[material.material_type] = material

    for material_type in preferred_types:
        if material_type in VALID_MATERIAL_TYPES and material_type not in latest_by_type:
            latest_by_type[material_type] = _generate_and_store(module, material_type, db)

    return list(latest_by_type.values())


@router.post("/module/{module_id}/regenerate/{material_type}", response_model=MaterialRead)
def regenerate_material(
    module_id: int,
    material_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if material_type not in VALID_MATERIAL_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nieznany typ materiału.")

    module = _get_owned_module(module_id, current_user, db)
    return _generate_and_store(module, material_type, db)


@router.post("/{material_id}/submissions", response_model=SubmissionRead, status_code=status.HTTP_201_CREATED)
def submit_exercise_solution(
    material_id: int,
    payload: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    material = _get_owned_material(material_id, current_user, db)
    if material.material_type != "exercise":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprawdzanie kodu jest dostępne tylko dla zadań praktycznych.",
        )

    try:
        verdict = check_submission(
            technology=material.module.learning_path.technology,
            exercise_instructions=material.content.get("instructions", ""),
            reference_solution=material.content.get("solution"),
            submitted_code=payload.code,
        )
    except (LLMGenerationError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    submission = ExerciseSubmission(
        user_id=current_user.id,
        material_id=material_id,
        submitted_code=payload.code,
        **verdict,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{material_id}/submissions", response_model=list[SubmissionRead])
def list_submissions(
    material_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_material(material_id, current_user, db)

    return (
        db.query(ExerciseSubmission)
        .filter(ExerciseSubmission.material_id == material_id, ExerciseSubmission.user_id == current_user.id)
        .order_by(ExerciseSubmission.created_at.desc())
        .all()
    )
