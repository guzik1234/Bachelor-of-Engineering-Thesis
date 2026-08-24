from app.models.learning_path import LearningPath
from app.models.material import Material
from app.models.module import Module
from app.models.user import User


def _register_and_login(client, email="coder@example.com"):
    client.post("/api/auth/register", json={"email": email, "password": "SecurePass123"})
    login = client.post("/api/auth/login", json={"email": email, "password": "SecurePass123"})
    token = login.json()["access_token"]
    return token, {"Authorization": f"Bearer {token}"}


def _make_exercise_material(db_session, email="coder@example.com") -> Material:
    user = db_session.query(User).filter(User.email == email).one()
    path = LearningPath(
        user_id=user.id,
        technology="Python",
        experience_level="beginner",
        title="Python od podstaw",
        description="Test path",
    )
    db_session.add(path)
    db_session.flush()

    module = Module(learning_path_id=path.id, order_index=0, title="Zmienne", summary="Podstawy zmiennych")
    db_session.add(module)
    db_session.flush()

    material = Material(
        module_id=module.id,
        material_type="exercise",
        content={"instructions": "Napisz funkcję sumującą dwie liczby.", "solution": "def add(a, b):\n    return a + b"},
        version=1,
    )
    db_session.add(material)
    db_session.commit()
    db_session.refresh(material)
    return material


def test_submit_solution_returns_ai_verdict(client, db_session, monkeypatch):
    _, headers = _register_and_login(client)
    material = _make_exercise_material(db_session)

    fake_verdict = {
        "passed": True,
        "feedback": "Rozwiązanie jest poprawne i czytelne.",
        "strengths": ["Poprawna logika", "Dobre nazewnictwo"],
        "improvements": ["Dodaj type hinty"],
    }
    monkeypatch.setattr("app.api.routes.materials.check_submission", lambda **kwargs: fake_verdict)

    response = client.post(
        f"/api/materials/{material.id}/submissions",
        json={"code": "def add(a, b):\n    return a + b"},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["passed"] is True
    assert body["feedback"] == fake_verdict["feedback"]
    assert body["strengths"] == fake_verdict["strengths"]


def test_submit_solution_rejects_non_exercise_material(client, db_session, monkeypatch):
    _, headers = _register_and_login(client)
    material = _make_exercise_material(db_session)
    material.material_type = "text"
    db_session.commit()

    response = client.post(
        f"/api/materials/{material.id}/submissions",
        json={"code": "print(1)"},
        headers=headers,
    )
    assert response.status_code == 400


def test_submit_solution_handles_llm_failure(client, db_session, monkeypatch):
    _, headers = _register_and_login(client)
    material = _make_exercise_material(db_session)

    def _raise(**kwargs):
        from app.services.llm_client import LLMGenerationError

        raise LLMGenerationError("model niedostępny")

    monkeypatch.setattr("app.api.routes.materials.check_submission", _raise)

    response = client.post(
        f"/api/materials/{material.id}/submissions",
        json={"code": "def add(a, b): return a + b"},
        headers=headers,
    )
    assert response.status_code == 503


def test_list_submissions_returns_history(client, db_session, monkeypatch):
    _, headers = _register_and_login(client)
    material = _make_exercise_material(db_session)

    monkeypatch.setattr(
        "app.api.routes.materials.check_submission",
        lambda **kwargs: {"passed": False, "feedback": "Brakuje obsługi błędów.", "strengths": [], "improvements": ["Dodaj walidację"]},
    )
    client.post(f"/api/materials/{material.id}/submissions", json={"code": "bad code"}, headers=headers)

    response = client.get(f"/api/materials/{material.id}/submissions", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["passed"] is False


def test_submissions_require_auth(client, db_session):
    client.post("/api/auth/register", json={"email": "coder@example.com", "password": "SecurePass123"})
    material = _make_exercise_material(db_session)
    response = client.get(f"/api/materials/{material.id}/submissions")
    assert response.status_code in (401, 403)
