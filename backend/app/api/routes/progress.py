from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.module import Module
from app.models.progress import Progress
from app.models.user import User
from app.schemas.progress import ProgressRead, ProgressUpdate

router = APIRouter()


@router.put("/module/{module_id}", response_model=ProgressRead)
def set_module_progress(
    module_id: int,
    payload: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = db.get(Module, module_id)
    if module is None or module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono modułu.")

    progress = (
        db.query(Progress)
        .filter(Progress.user_id == current_user.id, Progress.module_id == module_id)
        .first()
    )
    if progress is None:
        progress = Progress(user_id=current_user.id, module_id=module_id)
        db.add(progress)

    progress.completed = payload.completed
    progress.completed_at = datetime.now(timezone.utc) if payload.completed else None

    db.commit()
    db.refresh(progress)
    return ProgressRead(module_id=progress.module_id, completed=progress.completed)
