from app.models.learning_path import LearningPath
from app.models.module import Module
from app.models.user import User


def _register_and_login(client, email="learner2@example.com"):
    client.post("/api/auth/register", json={"email": email, "password": "SecurePass123"})
    login = client.post("/api/auth/login", json={"email": email, "password": "SecurePass123"})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make_path(db_session, email="learner2@example.com") -> LearningPath:
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

    db_session.add(Module(learning_path_id=path.id, order_index=0, title="JSX", summary="Podstawy JSX"))
    db_session.add(Module(learning_path_id=path.id, order_index=1, title="Komponenty", summary="Budowa komponentów"))
    db_session.commit()
    db_session.refresh(path)
    return path


def test_generate_recommendation(client, db_session, monkeypatch):
    headers = _register_and_login(client)
    path = _make_path(db_session)
    module_id = path.modules[0].id

    fake_result = {
        "pace_assessment": "on_track",
        "recommended_experience_level": "beginner",
        "recommended_module_id": module_id,
        "rationale": "Kursant ukończył moduły w oczekiwanym tempie.",
    }
    monkeypatch.setattr(
        "app.api.routes.learning_paths.generate_recommendation",
        lambda **kwargs: fake_result,
    )

    response = client.post(f"/api/learning-paths/{path.id}/recommendation", headers=headers)
    assert response.status_code == 201
    body = response.json()
    assert body["pace_assessment"] == "on_track"
    assert body["recommended_module_id"] == module_id
    assert body["recommended_module_title"] == "JSX"


def test_get_recommendation_missing_returns_404(client, db_session):
    headers = _register_and_login(client)
    path = _make_path(db_session)

    response = client.get(f"/api/learning-paths/{path.id}/recommendation", headers=headers)
    assert response.status_code == 404


def test_get_recommendation_returns_latest(client, db_session, monkeypatch):
    headers = _register_and_login(client)
    path = _make_path(db_session)

    results = iter(
        [
            {
                "pace_assessment": "slower",
                "recommended_experience_level": "beginner",
                "recommended_module_id": None,
                "rationale": "Pierwsza ocena.",
            },
            {
                "pace_assessment": "faster",
                "recommended_experience_level": "intermediate",
                "recommended_module_id": None,
                "rationale": "Druga, nowsza ocena.",
            },
        ]
    )
    monkeypatch.setattr(
        "app.api.routes.learning_paths.generate_recommendation",
        lambda **kwargs: next(results),
    )

    client.post(f"/api/learning-paths/{path.id}/recommendation", headers=headers)
    client.post(f"/api/learning-paths/{path.id}/recommendation", headers=headers)

    response = client.get(f"/api/learning-paths/{path.id}/recommendation", headers=headers)
    assert response.status_code == 200
    assert response.json()["pace_assessment"] == "faster"


def test_generate_recommendation_handles_llm_failure(client, db_session, monkeypatch):
    headers = _register_and_login(client)
    path = _make_path(db_session)

    def _raise(**kwargs):
        from app.services.llm_client import LLMGenerationError

        raise LLMGenerationError("model niedostępny")

    monkeypatch.setattr("app.api.routes.learning_paths.generate_recommendation", _raise)

    response = client.post(f"/api/learning-paths/{path.id}/recommendation", headers=headers)
    assert response.status_code == 503


def test_recommendation_requires_auth(client, db_session):
    client.post("/api/auth/register", json={"email": "learner2@example.com", "password": "SecurePass123"})
    path = _make_path(db_session)
    response = client.get(f"/api/learning-paths/{path.id}/recommendation")
    assert response.status_code in (401, 403)


def test_recommendation_rejects_other_users_path(client, db_session, monkeypatch):
    headers = _register_and_login(client)
    path = _make_path(db_session)

    client.post("/api/auth/register", json={"email": "intruder@example.com", "password": "SecurePass123"})
    intruder_login = client.post(
        "/api/auth/login", json={"email": "intruder@example.com", "password": "SecurePass123"}
    )
    intruder_headers = {"Authorization": f"Bearer {intruder_login.json()['access_token']}"}

    response = client.get(f"/api/learning-paths/{path.id}/recommendation", headers=intruder_headers)
    assert response.status_code == 404
