from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nie udało się zweryfikować danych uwierzytelniających.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise credentials_exception

    user = db.get(User, int(subject))
    if user is None:
        raise credentials_exception
    return user
