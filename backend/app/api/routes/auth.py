import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    ResendVerificationRequest,
    Token,
    VerifyEmailRequest,
)
from app.schemas.user import UserCreate, UserRead
from app.services.email_client import EmailSendError, send_verification_email

router = APIRouter()
logger = logging.getLogger("app.auth")

VERIFICATION_TOKEN_TTL_HOURS = 24

# Generic response for resend-verification regardless of outcome, so the
# endpoint can't be used to check whether a given e-mail is registered.
_RESEND_GENERIC_MESSAGE = (
    "Jeśli konto o tym adresie e-mail istnieje i nie zostało jeszcze potwierdzone, "
    "wysłaliśmy na nie nowy link weryfikacyjny."
)


def _issue_verification_token(user: User) -> str:
    token = secrets.token_urlsafe(32)
    user.verification_token = token
    user.verification_token_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=VERIFICATION_TOKEN_TTL_HOURS
    )
    return token


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Konto z tym adresem e-mail już istnieje.",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    token = _issue_verification_token(user)
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        send_verification_email(user.email, token)
    except EmailSendError:
        # Account is already created — the learner can still get a link via
        # POST /auth/resend-verification once the mail issue is resolved, so
        # a transient SMTP failure shouldn't fail the whole registration.
        logger.warning("Verification e-mail not sent for new user %s", user.id)

    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy e-mail lub hasło.",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Adres e-mail nie został jeszcze potwierdzony. Sprawdź swoją skrzynkę pocztową.",
        )
    token = create_access_token(subject=str(user.id))
    return Token(access_token=token)


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == payload.token).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy lub już wykorzystany token weryfikacyjny.",
        )

    expires_at = user.verification_token_expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at is None or expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token weryfikacyjny wygasł. Poproś o nowy link.",
        )

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    db.commit()
    return MessageResponse(detail="Adres e-mail został potwierdzony. Możesz się teraz zalogować.")


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None and not user.is_verified:
        token = _issue_verification_token(user)
        db.commit()
        try:
            send_verification_email(user.email, token)
        except EmailSendError:
            logger.warning("Resent verification e-mail failed for user %s", user.id)

    return MessageResponse(detail=_RESEND_GENERIC_MESSAGE)
