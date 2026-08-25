import logging
import re
from typing import Any, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from rank_bm25 import BM25Okapi

from app.core.config import get_settings
from app.services.llm_client import LLMGenerationError
from app.services.prompts import build_tutor_system_prompt, build_tutor_user_prompt

settings = get_settings()
logger = logging.getLogger("app.agent.tutor")

TOP_K = 4
HISTORY_TURNS = 6

_model: ChatGroq | None = None


def _get_model() -> ChatGroq:
    global _model
    if _model is None:
        _model = ChatGroq(model=settings.groq_model, api_key=settings.groq_api_key, temperature=0.4)
    return _model


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


def _material_to_text(material: Any) -> str:
    content = material.content or {}
    if material.material_type == "text":
        return str(content.get("explanation", ""))
    if material.material_type == "code_example":
        return f"{content.get('explanation', '')}\n{content.get('code', '')}"
    if material.material_type == "exercise":
        hints = "\n".join(content.get("hints", []))
        return f"{content.get('instructions', '')}\n{hints}"
    if material.material_type == "quiz":
        parts = [
            f"{q.get('question', '')} {q.get('explanation', '')}" for q in content.get("questions", [])
        ]
        return "\n".join(parts)
    return ""


def build_corpus(path: Any) -> list[dict[str, Any]]:
    """Extracts retrievable chunks from every material across the whole path —
    pure Python, no LLM call. Feeds the agent's retrieve step."""
    corpus = []
    for module in path.modules:
        for material in module.materials:
            text = _material_to_text(material)
            if text.strip():
                corpus.append(
                    {
                        "module_id": module.id,
                        "module_title": module.title,
                        "material_type": material.material_type,
                        "text": text.strip(),
                    }
                )
    return corpus


class TutorState(TypedDict):
    corpus: list[dict[str, Any]]
    question: str
    history: list[BaseMessage]
    retrieved: list[dict[str, Any]]
    answer: str | None


def _retrieve_node(state: TutorState) -> dict[str, Any]:
    corpus = state["corpus"]
    if not corpus:
        return {"retrieved": []}

    tokenized_corpus = [_tokenize(chunk["text"]) for chunk in corpus]
    bm25 = BM25Okapi(tokenized_corpus)
    scores = bm25.get_scores(_tokenize(state["question"]))

    ranked = sorted(zip(corpus, scores), key=lambda pair: pair[1], reverse=True)
    top = [chunk for chunk, score in ranked[:TOP_K] if score > 0]
    if not top:
        top = corpus[:TOP_K]
    return {"retrieved": top}


def _generate_node(state: TutorState) -> dict[str, Any]:
    if state["retrieved"]:
        context_block = "\n\n".join(
            f"[Moduł: {chunk['module_title']} | {chunk['material_type']}]\n{chunk['text'][:800]}"
            for chunk in state["retrieved"]
        )
    else:
        context_block = "(brak materiałów w tej ścieżce — odpowiadaj ogólnie w oparciu o wiedzę o technologii)"

    messages: list[BaseMessage] = [
        SystemMessage(content=build_tutor_system_prompt()),
        *state["history"],
        HumanMessage(content=build_tutor_user_prompt(question=state["question"], context_block=context_block)),
    ]

    try:
        response = _get_model().invoke(messages)
    except Exception as exc:
        logger.error("Groq API call failed (tutor agent): %s", exc)
        raise LLMGenerationError("Model AI jest obecnie niedostępny. Spróbuj ponownie za chwilę.") from exc

    return {"answer": response.content}


def _build_graph():
    graph = StateGraph(TutorState)
    graph.add_node("retrieve", _retrieve_node)
    graph.add_node("generate", _generate_node)
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


_graph = _build_graph()


def answer_question(path: Any, question: str, history: list[Any]) -> str:
    """Runs the tutor agent: a retrieve-then-generate RAG pipeline grounded in
    the whole path's materials (via BM25), not just the current module."""
    history_messages: list[BaseMessage] = []
    for entry in history[-HISTORY_TURNS:]:
        cls = HumanMessage if entry.role == "user" else AIMessage
        history_messages.append(cls(content=entry.content))

    initial_state: TutorState = {
        "corpus": build_corpus(path),
        "question": question,
        "history": history_messages,
        "retrieved": [],
        "answer": None,
    }

    final_state = _graph.invoke(initial_state)

    answer = final_state.get("answer")
    if not answer:
        raise LLMGenerationError("Model AI zwrócił pustą odpowiedź.")
    return str(answer)
