from app.models.learning_path import LearningPath
from app.models.module import Module
from app.models.user import User


def _register_and_login(client, email="tutor@example.com"):
    client.post("/api/auth/register", json={"email": email, "password": "SecurePass123"})
    login = client.post("/api/auth/login", json={"email": email, "password": "SecurePass123"})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make_module(db_session, email="tutor@example.com") -> Module:
    user = db_session.query(User).filter(User.email == email).one()
    path = LearningPath(
        user_id=user.id,
        technology="React",
        experience_level="beginner",
        title="React od podstaw",
        description="Test path",
    )
    db_session.add(path)
    db_session.flush()

    module = Module(learning_path_id=path.id, order_index=0, title="JSX", summary="Podstawy JSX")
    db_session.add(module)
    db_session.commit()
    db_session.refresh(module)
    return module


def test_ask_tutor_stores_question_and_answer(client, db_session, monkeypatch):
    headers = _register_and_login(client)
    module = _make_module(db_session)

    monkeypatch.setattr(
        "app.api.routes.tutor.answer_question",
        lambda path, question, history: f"Odpowiedź na: {question}",
    )

    response = client.post(
        f"/api/tutor/module/{module.id}/messages",
        json={"question": "Czym jest JSX?"},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "assistant"
    assert body["content"] == "Odpowiedź na: Czym jest JSX?"

    history = client.get(f"/api/tutor/module/{module.id}/messages", headers=headers)
    assert history.status_code == 200
    messages = history.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"


def test_ask_tutor_handles_llm_failure_without_orphan_message(client, db_session, monkeypatch):
    headers = _register_and_login(client)
    module = _make_module(db_session)

    def _raise(path, question, history):
        from app.services.llm_client import LLMGenerationError

        raise LLMGenerationError("model niedostępny")

    monkeypatch.setattr("app.api.routes.tutor.answer_question", _raise)

    response = client.post(
        f"/api/tutor/module/{module.id}/messages",
        json={"question": "Czym jest JSX?"},
        headers=headers,
    )
    assert response.status_code == 503

    history = client.get(f"/api/tutor/module/{module.id}/messages", headers=headers)
    assert history.json() == []


def test_tutor_requires_auth(client, db_session):
    client.post("/api/auth/register", json={"email": "tutor@example.com", "password": "SecurePass123"})
    module = _make_module(db_session)
    response = client.get(f"/api/tutor/module/{module.id}/messages")
    assert response.status_code in (401, 403)


def test_tutor_rejects_other_users_module(client, db_session):
    _register_and_login(client)
    module = _make_module(db_session)

    client.post("/api/auth/register", json={"email": "intruder2@example.com", "password": "SecurePass123"})
    intruder_login = client.post(
        "/api/auth/login", json={"email": "intruder2@example.com", "password": "SecurePass123"}
    )
    intruder_headers = {"Authorization": f"Bearer {intruder_login.json()['access_token']}"}

    response = client.get(f"/api/tutor/module/{module.id}/messages", headers=intruder_headers)
    assert response.status_code == 404
