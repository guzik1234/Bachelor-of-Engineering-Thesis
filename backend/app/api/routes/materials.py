from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.material import Material
from app.models.module import Module
from app.models.user import User
from app.schemas.material import MaterialRead
from app.services.llm_client import LLMGenerationError
from app.services.material_generator import generate_material

router = APIRouter()

VALID_MATERIAL_TYPES = {"text", "quiz", "exercise", "code_example"}


def _get_owned_module(module_id: int, current_user: User, db: Session) -> Module:
    module = db.get(Module, module_id)
    if module is None or module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono modułu.")
    return module


def _recent_feedback_notes(module: Module, material_type: str) -> list[str]:
    notes = [
        fb.comment
        for material in module.materials
        if material.material_type == material_type
        for fb in material.feedback_entries
        if fb.comment and fb.rating <= 3
    ]
    return notes[-5:]


def _generate_and_store(module: Module, material_type: str, db: Session) -> Material:
    feedback_notes = _recent_feedback_notes(module, material_type)
    try:
        content = generate_material(
            technology=module.learning_path.technology,
            experience_level=module.learning_path.experience_level,
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
