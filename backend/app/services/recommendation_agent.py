import json
import logging
from typing import Any, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph

from app.core.config import get_settings
from app.services.llm_client import LLMGenerationError
from app.services.prompts import (
    build_recommendation_correction_prompt,
    build_recommendation_system_prompt,
    build_recommendation_user_prompt,
)

settings = get_settings()
logger = logging.getLogger("app.agent.recommendation")

MAX_ATTEMPTS = 3
VALID_PACE = {"slower", "on_track", "faster"}
VALID_LEVELS = {"beginner", "intermediate", "advanced"}

# Thresholds for the monitoring agent's weak-topic detection: a module counts
# as a struggle once there's enough signal to trust it (not after one unlucky
# attempt), on either exercise performance or how the learner rated it.
WEAK_PASS_RATE_THRESHOLD = 0.5
WEAK_RATING_THRESHOLD = 2.5
MIN_ATTEMPTS_FOR_WEAKNESS = 2

_model: ChatGroq | None = None


def _get_model() -> ChatGroq:
    global _model
    if _model is None:
        _model = ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key,
            temperature=0.4,
            model_kwargs={"response_format": {"type": "json_object"}},
        )
    return _model


class RecommendationState(TypedDict):
    candidate_modules: list[dict[str, Any]]
    weak_candidates: list[dict[str, Any]]
    messages: list[BaseMessage]
    attempt: int
    result: dict[str, Any] | None
    error: str | None


def _call_model(state: RecommendationState) -> dict[str, Any]:
    try:
        response = _get_model().invoke(state["messages"])
    except Exception as exc:
        logger.error("Groq API call failed (recommendation agent): %s", exc)
        raise LLMGenerationError(
            "Model AI jest obecnie niedostępny. Spróbuj ponownie za chwilę."
        ) from exc

    return {"messages": [*state["messages"], response]}


def _validate(state: RecommendationState) -> dict[str, Any]:
    raw_content = state["messages"][-1].content
    valid_indices = {m["index"] for m in state["candidate_modules"]}
    valid_weak_indices = {m["index"] for m in state["weak_candidates"]}

    error: str | None = None
    data: dict[str, Any] = {}
    try:
        data = json.loads(raw_content)
        if data.get("pace_assessment") not in VALID_PACE:
            error = "pace_assessment musi być jedną z wartości: slower, on_track, faster"
        elif data.get("recommended_experience_level") not in VALID_LEVELS:
            error = (
                "recommended_experience_level musi być jedną z wartości: "
                "beginner, intermediate, advanced"
            )
        elif not str(data.get("rationale", "")).strip():
            error = "rationale nie może być puste"
        elif data.get("recommended_module_index") is not None and (
            data.get("recommended_module_index") not in valid_indices
        ):
            error = "recommended_module_index musi wskazywać jeden z podanych modułów albo być null"
        elif not isinstance(data.get("needs_remediation"), bool):
            error = "needs_remediation musi być wartością true/false"
        elif data.get("remediation_module_index") is not None and (
            data.get("remediation_module_index") not in valid_weak_indices
        ):
            error = (
                "remediation_module_index musi wskazywać jeden z podanych modułów sprawiających "
                "trudność albo być null"
            )
        elif data.get("needs_remediation") and data.get("remediation_module_index") is None:
            error = "needs_remediation=true wymaga podania remediation_module_index"
    except (json.JSONDecodeError, TypeError):
        error = "odpowiedź musi być poprawnym obiektem JSON"

    if error is None:
        return {"result": data, "error": None}

    if state["attempt"] + 1 >= MAX_ATTEMPTS:
        return {"error": error}

    return {
        "attempt": state["attempt"] + 1,
        "error": error,
        "messages": [*state["messages"], HumanMessage(content=build_recommendation_correction_prompt(error))],
    }


def _route_after_validate(state: RecommendationState) -> str:
    if state.get("result") is not None:
        return END
    if state["error"] is not None and state["attempt"] >= MAX_ATTEMPTS - 1:
        return END
    return "call_model"


def _build_graph():
    graph = StateGraph(RecommendationState)
    graph.add_node("call_model", _call_model)
    graph.add_node("validate", _validate)
    graph.add_edge(START, "call_model")
    graph.add_edge("call_model", "validate")
    graph.add_conditional_edges("validate", _route_after_validate, ["call_model", END])
    return graph.compile()


_graph = _build_graph()


def collect_signals(path: Any, preference: Any) -> dict[str, Any]:
    """Pure-Python aggregation of a learning path's progress/feedback data —
    no LLM call. Feeds the agent's decision step."""
    modules = path.modules
    total_modules = len(modules)

    completed_entries = [p for m in modules for p in m.progress_entries if p.completed and p.completed_at]
    completed_modules = len(completed_entries)
    completion_ratio = completed_modules / total_modules if total_modules else 0.0

    if completed_entries:
        completed_dates = sorted(p.completed_at for p in completed_entries)
        span_days = (completed_dates[-1] - path.created_at).total_seconds() / 86400
        avg_days_per_module = round(span_days / len(completed_dates), 1)
    else:
        avg_days_per_module = 0.0

    ratings = [fb.rating for m in modules for material in m.materials for fb in material.feedback_entries]
    avg_feedback_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    latest_submission_by_material: dict[int, Any] = {}
    for m in modules:
        for material in m.materials:
            for sub in material.submissions:
                current = latest_submission_by_material.get(material.id)
                if current is None or sub.created_at > current.created_at:
                    latest_submission_by_material[material.id] = sub
    attempts = list(latest_submission_by_material.values())
    exercise_attempts = len(attempts)
    exercise_pass_rate = sum(1 for s in attempts if s.passed) / exercise_attempts if exercise_attempts else 0.0

    return {
        "total_modules": total_modules,
        "completed_modules": completed_modules,
        "completion_ratio": completion_ratio,
        "avg_days_per_module": avg_days_per_module,
        "available_hours_per_week": preference.available_hours_per_week if preference else 5.0,
        "avg_feedback_rating": avg_feedback_rating,
        "feedback_count": len(ratings),
        "exercise_pass_rate": exercise_pass_rate,
        "exercise_attempts": exercise_attempts,
        "weak_module_count": len(weak_modules(path)),
    }


def incomplete_modules(path: Any) -> list[dict[str, Any]]:
    """Ordered list of not-yet-completed modules, indexed for the agent's prompt
    so the LLM can pick one by a small integer rather than by id."""
    modules = sorted(path.modules, key=lambda m: m.order_index)
    candidates = [m for m in modules if not any(p.completed for p in m.progress_entries)]
    return [
        {"index": i, "id": m.id, "title": m.title, "summary": m.summary}
        for i, m in enumerate(candidates)
    ]


def _module_performance(module: Any) -> dict[str, Any]:
    """Pure-Python mastery signal for a single module: exercise pass rate
    (latest attempt per material) and average feedback rating."""
    latest_by_material: dict[int, Any] = {}
    for material in module.materials:
        for sub in material.submissions:
            current = latest_by_material.get(material.id)
            if current is None or sub.created_at > current.created_at:
                latest_by_material[material.id] = sub
    attempts = list(latest_by_material.values())
    pass_rate = sum(1 for s in attempts if s.passed) / len(attempts) if attempts else None

    ratings = [fb.rating for material in module.materials for fb in material.feedback_entries]
    avg_rating = sum(ratings) / len(ratings) if ratings else None

    improvement_notes = [
        note
        for material in module.materials
        for sub in material.submissions
        if not sub.passed
        for note in sub.improvements
    ]

    return {
        "attempts": len(attempts),
        "pass_rate": pass_rate,
        "ratings_count": len(ratings),
        "avg_rating": avg_rating,
        "improvement_notes": improvement_notes,
    }


def weak_modules(path: Any) -> list[dict[str, Any]]:
    """Monitoring-agent signal: modules the learner is struggling with, based
    on a low exercise pass rate and/or a low average feedback rating. Pure
    Python and deterministic (no LLM call), so it's cheap enough to recompute
    on every path fetch rather than only when a recommendation is requested.
    Worst-performing module first. Remediation modules are excluded so a
    practice module never gets flagged as its own weakness."""
    results = []
    for module in sorted(path.modules, key=lambda m: m.order_index):
        if module.is_remediation:
            continue
        perf = _module_performance(module)
        reasons = []
        if (
            perf["attempts"] >= MIN_ATTEMPTS_FOR_WEAKNESS
            and perf["pass_rate"] is not None
            and perf["pass_rate"] < WEAK_PASS_RATE_THRESHOLD
        ):
            reasons.append(f"zdawalność zadań {perf['pass_rate']:.0%}")
        if (
            perf["ratings_count"] >= 1
            and perf["avg_rating"] is not None
            and perf["avg_rating"] <= WEAK_RATING_THRESHOLD
        ):
            reasons.append(f"niska ocena materiałów ({perf['avg_rating']:.1f}/5)")
        if not reasons:
            continue
        results.append(
            {
                "id": module.id,
                "title": module.title,
                "summary": module.summary,
                "pass_rate": perf["pass_rate"],
                "avg_rating": perf["avg_rating"],
                "attempts": perf["attempts"],
                "reason": ", ".join(reasons),
                "improvement_notes": perf["improvement_notes"],
            }
        )

    results.sort(
        key=lambda d: (
            d["pass_rate"] if d["pass_rate"] is not None else 1.0,
            d["avg_rating"] if d["avg_rating"] is not None else 5.0,
        )
    )
    return results


def weak_module_candidates(path: Any) -> list[dict[str, Any]]:
    """Indexed view of weak_modules() for the agent's prompt, mirroring
    incomplete_modules() so the LLM can pick one by a small integer."""
    return [
        {"index": i, "id": w["id"], "title": w["title"], "reason": w["reason"]}
        for i, w in enumerate(weak_modules(path))
    ]


def generate_recommendation(
    technology: str,
    experience_level: str,
    signals: dict[str, Any],
    candidate_modules: list[dict[str, Any]],
    weak_candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Runs the recommendation agent: multi-step LangGraph state machine with a
    self-correction loop (invalid JSON triggers a corrective retry, up to
    MAX_ATTEMPTS), unlike the single-shot calls in llm_client.generate_json.

    weak_candidates (from weak_module_candidates()) lets the agent act as a
    progress monitor: besides pacing, it can flag that the learner should
    practice a specific struggling module instead of moving forward."""
    weak_candidates = weak_candidates or []
    initial_state: RecommendationState = {
        "candidate_modules": candidate_modules,
        "weak_candidates": weak_candidates,
        "messages": [
            SystemMessage(content=build_recommendation_system_prompt()),
            HumanMessage(
                content=build_recommendation_user_prompt(
                    technology=technology,
                    experience_level=experience_level,
                    signals=signals,
                    candidate_modules=candidate_modules,
                    weak_candidates=weak_candidates,
                )
            ),
        ],
        "attempt": 0,
        "result": None,
        "error": None,
    }

    final_state = _graph.invoke(initial_state)

    if final_state["result"] is None:
        raise LLMGenerationError(
            f"Model AI zwrócił dane w niepoprawnym formacie: {final_state['error']}"
        )

    result = final_state["result"]
    module_index = result.get("recommended_module_index")
    module_id = None
    if module_index is not None:
        module_id = next(
            (m["id"] for m in candidate_modules if m["index"] == module_index), None
        )

    remediation_index = result.get("remediation_module_index")
    remediation_module_id = None
    if remediation_index is not None:
        remediation_module_id = next(
            (m["id"] for m in weak_candidates if m["index"] == remediation_index), None
        )

    return {
        "pace_assessment": result["pace_assessment"],
        "recommended_experience_level": result["recommended_experience_level"],
        "recommended_module_id": module_id,
        "rationale": str(result["rationale"]),
        "needs_remediation": bool(result.get("needs_remediation", False)),
        "remediation_module_id": remediation_module_id,
    }
