from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.feedback import Feedback
from app.models.material import Material
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackRead

router = APIRouter()


@router.post("", response_model=FeedbackRead, status_code=status.HTTP_201_CREATED)
def create_feedback(
    payload: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    material = db.get(Material, payload.material_id)
    if material is None or material.module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono materiału.")

    feedback = Feedback(
        user_id=current_user.id,
        material_id=payload.material_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
