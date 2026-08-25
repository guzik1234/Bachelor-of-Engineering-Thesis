import json

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


PACE_LABELS = {
    "slower": "wolniej niż zakładano",
    "on_track": "zgodnie z założonym tempem",
    "faster": "szybciej niż zakładano",
}


def build_recommendation_system_prompt() -> str:
    return (
        "Jesteś mentorem-agentem analizującym postępy kursanta na ścieżce edukacyjnej "
        "programisty. Na podstawie dostarczonych statystyk oceniasz tempo nauki, "
        "rekomendujesz poziom trudności kolejnych materiałów oraz wskazujesz, na którym "
        "z niedokończonych modułów kursant powinien się skupić dalej. Zawsze odpowiadasz "
        "wyłącznie poprawnym obiektem JSON, bez żadnego dodatkowego tekstu przed ani po "
        "nim, zgodnym dokładnie z podanym schematem. Uzasadnienie musi być napisane w "
        "języku polskim, konkretne i odwoływać się do przekazanych statystyk."
    )


def build_recommendation_user_prompt(
    technology: str,
    experience_level: str,
    signals: dict,
    candidate_modules: list[dict],
) -> str:
    level_label = LEVEL_LABELS.get(experience_level, experience_level)
    modules_block = (
        "\n".join(f"{m['index']}: {m['title']} — {m['summary']}" for m in candidate_modules)
        or "(brak niedokończonych modułów)"
    )

    return f"""Przeanalizuj postępy kursanta na ścieżce edukacyjnej: {technology}.

Statystyki postępów:
- aktualny poziom zaawansowania ścieżki: {level_label}
- ukończone moduły: {signals['completed_modules']}/{signals['total_modules']} \
({signals['completion_ratio']:.0%})
- średnie tempo ukończenia modułu: {signals['avg_days_per_module']} dni \
(przy deklarowanym czasie {signals['available_hours_per_week']} godz./tydzień)
- średnia ocena materiałów przez kursanta (1-5): {signals['avg_feedback_rating']}
- zdawalność zadań praktycznych: {signals['exercise_pass_rate']:.0%} \
({signals['exercise_attempts']} podejść)

Niedokończone moduły (indeks: tytuł — opis):
{modules_block}

Zwróć WYŁĄCZNIE obiekt JSON o dokładnie takiej strukturze:
{{
  "pace_assessment": "slower" | "on_track" | "faster",
  "recommended_experience_level": "beginner" | "intermediate" | "advanced",
  "recommended_module_index": <liczba całkowita z listy modułów powyżej albo null, \
jeśli lista jest pusta>,
  "rationale": "2-4 zdania uzasadnienia odwołujące się do statystyk kursanta"
}}"""


def build_recommendation_correction_prompt(error: str) -> str:
    return (
        "Poprzednia odpowiedź nie spełniała wymagań: "
        f"{error}. Popraw ją i zwróć WYŁĄCZNIE poprawny obiekt JSON zgodny z podanym "
        "wcześniej schematem, bez żadnego dodatkowego tekstu."
    )


def build_code_check_system_prompt() -> str:
    return (
        "Jesteś doświadczonym programistą i mentorem oceniającym rozwiązania zadań "
        "praktycznych kursantów. Zawsze odpowiadasz wyłącznie poprawnym obiektem JSON, "
        "bez żadnego dodatkowego tekstu przed ani po nim, zgodnym dokładnie z podanym "
        "schematem. Informacja zwrotna musi być napisana w języku polskim, konkretna "
        "i konstruktywna — wskazuj realne błędy i braki, ale też doceniaj to, co kursant "
        "zrobił dobrze. Nie wykonujesz kodu — oceniasz go na podstawie analizy jego "
        "poprawności logicznej i składniowej."
    )


def build_code_check_user_prompt(
    technology: str,
    exercise_instructions: str,
    reference_solution: str | None,
    submitted_code: str,
) -> str:
    reference_block = (
        f"\nPrzykładowe poprawne rozwiązanie (punkt odniesienia, niekoniecznie jedyna "
        f"akceptowalna forma — kursant nie musi go odtworzyć):\n{reference_solution}\n"
        if reference_solution
        else ""
    )

    return f"""Oceń rozwiązanie zadania praktycznego z technologii {technology}.

Treść zadania:
{exercise_instructions}
{reference_block}
Rozwiązanie kursanta:
{submitted_code}

Oceń, czy rozwiązanie poprawnie realizuje polecenie (nie musi być identyczne z przykładowym
rozwiązaniem — liczy się poprawność i działanie, nie forma). Zwróć uwagę na błędy składniowe,
błędy logiczne oraz dobre praktyki.

Zwróć WYŁĄCZNIE obiekt JSON o dokładnie takiej strukturze:
{{
  "passed": true/false,
  "feedback": "2-4 zdania podsumowania oceny",
  "strengths": ["co kursant zrobił dobrze", "..."],
  "improvements": ["co warto poprawić lub czego brakuje", "..."]
}}"""


def build_material_critique_system_prompt() -> str:
    return (
        "Jesteś rygorystycznym recenzentem materiałów edukacyjnych dla programistów. "
        "Oceniasz wygenerowany materiał pod kątem poprawności merytorycznej, dopasowania "
        "do poziomu kursanta oraz zgodności z wcześniejszymi opiniami kursantów o "
        "podobnych materiałach. Akceptujesz materiał tylko wtedy, gdy jest rzeczywiście "
        "dobrej jakości — w przeciwnym razie każesz go poprawić, wskazując konkretne "
        "problemy. Zawsze odpowiadasz wyłącznie poprawnym obiektem JSON, bez żadnego "
        "dodatkowego tekstu przed ani po nim, zgodnym dokładnie z podanym schematem."
    )


def build_material_critique_user_prompt(
    material_type: str,
    technology: str,
    experience_level: str,
    module_title: str,
    content: dict,
) -> str:
    level_label = LEVEL_LABELS.get(experience_level, experience_level)
    materials_label = MATERIAL_TYPE_LABELS.get(material_type, material_type)

    return f"""Oceń wygenerowany materiał typu "{materials_label}" z technologii {technology}
(moduł: "{module_title}", poziom kursanta: {level_label}).

Treść materiału (JSON):
{json.dumps(content, ensure_ascii=False)}

Sprawdź: czy materiał jest poprawny merytorycznie, czy jest dopasowany do poziomu kursanta,
czy jest kompletny względem swojego typu oraz czy nie powiela wcześniej zgłaszanych przez
kursantów problemów.

Zwróć WYŁĄCZNIE obiekt JSON o dokładnie takiej strukturze:
{{
  "verdict": "accept" | "revise",
  "issues": ["konkretny problem 1", "..."],
  "notes": "1-2 zdania podsumowania oceny"
}}"""


def build_tutor_system_prompt() -> str:
    return (
        "Jesteś tutorem-agentem pomagającym kursantowi zrozumieć materiały jego ścieżki "
        "edukacyjnej. Odpowiadasz WYŁĄCZNIE w oparciu o dostarczone fragmenty materiałów "
        "kursu (kontekst) oraz historię rozmowy — jeśli kontekst nie zawiera odpowiedzi, "
        "jasno to powiedz, zamiast zmyślać. Odpowiadaj zwięźle, po polsku, i wskazuj z "
        "którego modułu pochodzi wykorzystana informacja, jeśli to możliwe. Nie zwracasz "
        "JSON-a — odpowiadasz zwykłym tekstem."
    )


def build_tutor_user_prompt(question: str, context_block: str) -> str:
    return f"""Fragmenty materiałów kursu, które mogą być pomocne (mogą być niepełne):
{context_block}

Pytanie kursanta: {question}"""
