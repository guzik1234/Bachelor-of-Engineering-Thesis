import json
import logging
from typing import Any

from groq import Groq

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("app.llm")

_client: Groq | None = None


class LLMGenerationError(Exception):
    """Raised when the AI model is unreachable or returns an unusable response."""


def get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def generate_json(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    client = get_client()

    try:
        completion = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
    except Exception as exc:
        logger.error("Groq API call failed: %s", exc)
        raise LLMGenerationError(
            "Model AI jest obecnie niedostępny. Spróbuj ponownie za chwilę."
        ) from exc

    raw_content = completion.choices[0].message.content
    try:
        return json.loads(raw_content)
    except (json.JSONDecodeError, TypeError) as exc:
        raise LLMGenerationError("Model AI zwrócił dane w niepoprawnym formacie JSON.") from exc
