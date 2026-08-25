from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.llm_client import generate_json
from app.services.material_generator import generate_material
from app.services.prompts import (
    build_material_critique_system_prompt,
    build_material_critique_user_prompt,
)

MAX_REVISIONS = 2


class MaterialReviewState(TypedDict):
    technology: str
    experience_level: str
    module_title: str
    module_summary: str
    material_type: str
    feedback_notes: list[str]
    attempt: int
    content: dict[str, Any] | None
    critique: dict[str, Any] | None


def _generate_node(state: MaterialReviewState) -> dict[str, Any]:
    content = generate_material(
        technology=state["technology"],
        experience_level=state["experience_level"],
        module_title=state["module_title"],
        module_summary=state["module_summary"],
        material_type=state["material_type"],
        feedback_notes=state["feedback_notes"],
    )
    return {"content": content}


def _critique_node(state: MaterialReviewState) -> dict[str, Any]:
    system_prompt = build_material_critique_system_prompt()
    user_prompt = build_material_critique_user_prompt(
        material_type=state["material_type"],
        technology=state["technology"],
        experience_level=state["experience_level"],
        module_title=state["module_title"],
        content=state["content"],
    )
    critique = generate_json(system_prompt, user_prompt)
    return {"critique": critique}


def _prepare_revision_node(state: MaterialReviewState) -> dict[str, Any]:
    issues = (state["critique"] or {}).get("issues", [])
    extra_notes = [f"[Uwaga recenzenta AI] {issue}" for issue in issues]
    return {
        "attempt": state["attempt"] + 1,
        "feedback_notes": [*state["feedback_notes"], *extra_notes],
    }


def _route_after_critique(state: MaterialReviewState) -> str:
    verdict = (state["critique"] or {}).get("verdict")
    if verdict == "revise" and state["attempt"] < MAX_REVISIONS - 1:
        return "revise"
    return END


def _build_graph():
    graph = StateGraph(MaterialReviewState)
    graph.add_node("generate", _generate_node)
    graph.add_node("critique", _critique_node)
    graph.add_node("prepare_revision", _prepare_revision_node)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "critique")
    graph.add_conditional_edges("critique", _route_after_critique, {"revise": "prepare_revision", END: END})
    graph.add_edge("prepare_revision", "generate")
    return graph.compile()


_graph = _build_graph()


def generate_material_with_review(
    technology: str,
    experience_level: str,
    module_title: str,
    module_summary: str,
    material_type: str,
    feedback_notes: list[str] | None = None,
) -> dict[str, Any]:
    """Runs the generator+critic agent: generates a material, has a second LLM
    pass critique it, and — unlike the single-shot generate_material — forces
    up to one regeneration when the critic rejects the result."""
    initial_state: MaterialReviewState = {
        "technology": technology,
        "experience_level": experience_level,
        "module_title": module_title,
        "module_summary": module_summary,
        "material_type": material_type,
        "feedback_notes": list(feedback_notes or []),
        "attempt": 0,
        "content": None,
        "critique": None,
    }

    final_state = _graph.invoke(initial_state)

    critique = final_state.get("critique") or {}
    notes = str(critique.get("notes", "")).strip() or None

    return {
        "content": final_state["content"],
        "critique_passed": critique.get("verdict") == "accept",
        "critique_notes": notes,
    }
