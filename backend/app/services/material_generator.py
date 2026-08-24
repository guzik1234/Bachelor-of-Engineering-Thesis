from app.services.llm_client import generate_json
from app.services.prompts import build_material_system_prompt, build_material_user_prompt


def generate_material(
    technology: str,
    experience_level: str,
    module_title: str,
    module_summary: str,
    material_type: str,
    feedback_notes: list[str] | None = None,
) -> dict:
    system_prompt = build_material_system_prompt()
    user_prompt = build_material_user_prompt(
        technology=technology,
        experience_level=experience_level,
        module_title=module_title,
        module_summary=module_summary,
        material_type=material_type,
        feedback_notes=feedback_notes,
    )
    return generate_json(system_prompt, user_prompt)
