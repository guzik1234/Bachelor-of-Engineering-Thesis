from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.chat_message import ChatMessage
from app.models.module import Module
from app.models.user import User
from app.schemas.chat import ChatMessageRead, ChatQuestionCreate
from app.services.llm_client import LLMGenerationError
from app.services.tutor_agent import answer_question

router = APIRouter()


def _get_owned_module(module_id: int, current_user: User, db: Session) -> Module:
    module = db.get(Module, module_id)
    if module is None or module.learning_path.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono modułu.")
    return module


def _module_history(module_id: int, current_user: User, db: Session) -> list[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id, ChatMessage.module_id == module_id)
        .order_by(ChatMessage.id)
        .all()
    )


@router.post("/module/{module_id}/messages", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
def ask_tutor(
    module_id: int,
    payload: ChatQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = _get_owned_module(module_id, current_user, db)
    history = _module_history(module_id, current_user, db)

    user_message = ChatMessage(
        user_id=current_user.id, module_id=module_id, role="user", content=payload.question
    )
    db.add(user_message)
    db.flush()

    try:
        answer = answer_question(module.learning_path, payload.question, history)
    except LLMGenerationError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    assistant_message = ChatMessage(
        user_id=current_user.id, module_id=module_id, role="assistant", content=answer
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    return assistant_message


@router.get("/module/{module_id}/messages", response_model=list[ChatMessageRead])
def list_tutor_messages(
    module_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_module(module_id, current_user, db)
    return _module_history(module_id, current_user, db)
