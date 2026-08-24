from app.services.llm_client import generate_json
from app.services.prompts import build_code_check_system_prompt, build_code_check_user_prompt


def check_submission(
    technology: str,
    exercise_instructions: str,
    reference_solution: str | None,
    submitted_code: str,
) -> dict:
    system_prompt = build_code_check_system_prompt()
    user_prompt = build_code_check_user_prompt(
        technology=technology,
        exercise_instructions=exercise_instructions,
        reference_solution=reference_solution,
        submitted_code=submitted_code,
    )
    data = generate_json(system_prompt, user_prompt)

    if "passed" not in data or "feedback" not in data:
        raise ValueError("Model AI zwrócił dane w nieoczekiwanym formacie.")

    return {
        "passed": bool(data.get("passed")),
        "feedback": str(data.get("feedback", "")),
        "strengths": [str(s) for s in data.get("strengths", [])],
        "improvements": [str(s) for s in data.get("improvements", [])],
    }
