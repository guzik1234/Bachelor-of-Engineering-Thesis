import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("app.email")


class EmailSendError(Exception):
    """Raised when the verification e-mail could not be sent."""


def send_verification_email(to_email: str, token: str) -> None:
    verify_url = f"{settings.frontend_origin}/verify-email?token={token}"

    message = EmailMessage()
    message["Subject"] = "Potwierdź swój adres e-mail — AI Learning Path"
    message["From"] = settings.smtp_from_email or settings.smtp_username
    message["To"] = to_email
    message.set_content(
        "Cześć!\n\n"
        "Dziękujemy za rejestrację w AI Learning Path. Aby aktywować konto, potwierdź swój "
        f"adres e-mail, otwierając poniższy link:\n\n{verify_url}\n\n"
        "Link jest ważny przez 24 godziny. Jeśli to nie Ty zakładałeś/aś to konto, "
        "po prostu zignoruj tę wiadomość."
    )

    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        logger.error("Failed to send verification e-mail to %s: %s", to_email, exc)
        raise EmailSendError("Nie udało się wysłać maila weryfikacyjnego.") from exc
