LEVEL_LABELS = {
    "beginner": "początkujący",
    "intermediate": "średniozaawansowany",
    "advanced": "zaawansowany",
}

MATERIAL_TYPE_LABELS = {
    "text": "wyjaśnienia teoretyczne",
    "quiz": "quizy sprawdzające wiedzę",
    "exercise": "zadania praktyczne",
    "code_example": "przykłady kodu",
}

MATERIAL_SCHEMAS = {
    "text": '{"explanation": "szczegółowe wyjaśnienie tematu w formacie Markdown"}',
    "code_example": (
        '{"explanation": "krótki opis przykładu", "language": "np. javascript", '
        '"code": "pełny kod źródłowy przykładu"}'
    ),
    "exercise": (
        '{"instructions": "treść zadania praktycznego do wykonania przez kursanta", '
        '"hints": ["podpowiedź 1", "podpowiedź 2"], "solution": "przykładowe rozwiązanie zadania"}'
    ),
    "quiz": (
        '{"questions": [{"question": "treść pytania", "options": ["a", "b", "c", "d"], '
        '"correct_index": 0, "explanation": "dlaczego to jest poprawna odpowiedź"}]}'
    ),
}


def build_path_system_prompt() -> str:
    return (
        "Jesteś ekspertem tworzącym spersonalizowane ścieżki edukacyjne dla programistów. "
        "Zawsze odpowiadasz wyłącznie poprawnym obiektem JSON, bez żadnego dodatkowego tekstu "
        "przed ani po nim, zgodnym dokładnie z podanym schematem. Cała wygenerowana treść "
        "(tytuły, opisy) musi być napisana w języku polskim, niezależnie od języka nazw "
        "technicznych (nazwy technologii, bibliotek, poleceń pozostają w oryginale)."
    )


def build_path_user_prompt(
    technology: str,
    experience_level: str,
    learning_goal: str | None,
    preferred_material_types: list[str],
    available_hours_per_week: float,
    learning_style: str,
) -> str:
    level_label = LEVEL_LABELS.get(experience_level, experience_level)
    materials_label = ", ".join(
        MATERIAL_TYPE_LABELS.get(t, t) for t in preferred_material_types
    ) or "zróżnicowane materiały"
    goal_line = f"Cel nauki kursanta: {learning_goal}." if learning_goal else ""

    return f"""Zbuduj spersonalizowaną ścieżkę edukacyjną do nauki technologii: {technology}.

Profil kursanta:
- poziom zaawansowania: {level_label}
- preferowane rodzaje materiałów: {materials_label}
- dostępny czas na naukę: {available_hours_per_week} godzin/tydzień
- preferowany styl nauki: {learning_style}
{goal_line}

Podziel ścieżkę na 5-8 modułów (lekcji) ułożonych od podstaw do bardziej zaawansowanych,
dopasowanych do dostępnego czasu i poziomu kursanta.

Zwróć WYŁĄCZNIE obiekt JSON o dokładnie takiej strukturze:
{{
  "title": "tytuł całej ścieżki edukacyjnej",
  "description": "2-3 zdania opisujące czego dotyczy ścieżka i dla kogo jest",
  "modules": [
    {{"title": "tytuł modułu", "summary": "2-4 zdania opisujące zakres modułu"}}
  ]
}}"""


def build_material_system_prompt() -> str:
    return (
        "Jesteś ekspertem tworzącym materiały edukacyjne dla programistów. "
        "Zawsze odpowiadasz wyłącznie poprawnym obiektem JSON, bez żadnego dodatkowego tekstu "
        "przed ani po nim, zgodnym dokładnie z podanym schematem. Cała wygenerowana treść musi "
        "być napisana w języku polskim — dotyczy to również pytań, odpowiedzi i wyjaśnień w "
        "quizach oraz komentarzy w przykładach kodu. Wyjątkiem są nazwy technologii, słowa "
        "kluczowe języka programowania oraz sam kod źródłowy, które pozostają w oryginalnej "
        "postaci."
    )


def build_material_user_prompt(
    technology: str,
    experience_level: str,
    module_title: str,
    module_summary: str,
    material_type: str,
    feedback_notes: list[str] | None = None,
) -> str:
    level_label = LEVEL_LABELS.get(experience_level, experience_level)
    schema = MATERIAL_SCHEMAS.get(material_type, MATERIAL_SCHEMAS["text"])

    feedback_block = ""
    if feedback_notes:
        joined = "\n".join(f"- {note}" for note in feedback_notes)
        feedback_block = (
            "\nWeź pod uwagę wcześniejsze opinie kursantów o podobnych materiałach "
            f"i popraw jakość odpowiedzi:\n{joined}\n"
        )

    return f"""Wygeneruj materiał edukacyjny typu "{material_type}" dla technologii {technology},
w ramach modułu: "{module_title}" ({module_summary}).
Poziom kursanta: {level_label}.
{feedback_block}
Zwróć WYŁĄCZNIE obiekt JSON zgodny dokładnie z tym schematem:
{schema}"""
