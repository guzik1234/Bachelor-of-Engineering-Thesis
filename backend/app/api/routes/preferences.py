from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.preference import UserPreference
from app.models.user import User
from app.schemas.preference import PreferenceRead, PreferenceUpdate

router = APIRouter()


@router.get("", response_model=PreferenceRead | None)
def read_preferences(current_user: User = Depends(get_current_user)):
    return current_user.preference


@router.put("", response_model=PreferenceRead)
def upsert_preferences(
    payload: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    preference = current_user.preference
    if preference is None:
        preference = UserPreference(user_id=current_user.id)
        db.add(preference)

    preference.preferred_material_types = payload.preferred_material_types
    preference.available_hours_per_week = payload.available_hours_per_week
    preference.learning_style = payload.learning_style

    db.commit()
    db.refresh(preference)
    return preference
