from app.models.preference import UserPreference
from app.services.llm_client import generate_json
from app.services.prompts import build_path_system_prompt, build_path_user_prompt


def generate_learning_path(
    technology: str,
    experience_level: str,
    learning_goal: str | None,
    preference: UserPreference | None,
) -> dict:
    preferred_types = preference.preferred_material_types if preference else ["text", "exercise"]
    hours = preference.available_hours_per_week if preference else 5.0
    style = preference.learning_style if preference else "mixed"

    system_prompt = build_path_system_prompt()
    user_prompt = build_path_user_prompt(
        technology=technology,
        experience_level=experience_level,
        learning_goal=learning_goal,
        preferred_material_types=preferred_types,
        available_hours_per_week=hours,
        learning_style=style,
    )

    data = generate_json(system_prompt, user_prompt)

    if not isinstance(data.get("modules"), list) or "title" not in data:
        raise ValueError("Model AI zwrócił dane w nieoczekiwanym formacie.")

    return data
