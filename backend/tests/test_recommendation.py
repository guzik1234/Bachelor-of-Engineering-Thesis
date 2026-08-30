from app.models.feedback import Feedback
from app.models.learning_path import LearningPath
from app.models.material import Material
from app.models.module import Module
from app.models.submission import ExerciseSubmission
from app.models.user import User
from app.services.recommendation_agent import weak_modules


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


def _add_failed_submissions(db_session, user_id: int, module: Module, count: int = 2):
    """Simulates repeated failed attempts across `count` distinct exercises in a
    module — enough signal for the monitoring agent to call it a weak module."""
    for _ in range(count):
        material = Material(module_id=module.id, material_type="exercise", content={}, version=1)
        db_session.add(material)
        db_session.flush()
        db_session.add(
            ExerciseSubmission(
                user_id=user_id,
                material_id=material.id,
                submitted_code="x",
                passed=False,
                feedback="niepoprawne rozwiązanie",
                improvements=["popraw obsługę pętli"],
            )
        )
    db_session.commit()


def test_weak_modules_detects_low_exercise_pass_rate(client, db_session):
    _register_and_login(client)
    path = _make_path(db_session)
    user = db_session.query(User).filter(User.email == "learner2@example.com").one()
    module = path.modules[0]

    _add_failed_submissions(db_session, user.id, module)
    db_session.refresh(path)

    weak = weak_modules(path)
    assert len(weak) == 1
    assert weak[0]["id"] == module.id
    assert weak[0]["pass_rate"] == 0.0
    assert "popraw obsługę pętli" in weak[0]["improvement_notes"]


def test_weak_modules_detects_low_feedback_rating(client, db_session):
    _register_and_login(client)
    path = _make_path(db_session)
    user = db_session.query(User).filter(User.email == "learner2@example.com").one()
    module = path.modules[0]

    material = Material(module_id=module.id, material_type="text", content={}, version=1)
    db_session.add(material)
    db_session.flush()
    db_session.add(Feedback(user_id=user.id, material_id=material.id, rating=1))
    db_session.commit()
    db_session.refresh(path)

    weak = weak_modules(path)
    assert len(weak) == 1
    assert weak[0]["id"] == module.id
    assert weak[0]["avg_rating"] == 1.0


def test_weak_modules_ignores_healthy_module(client, db_session):
    _register_and_login(client)
    path = _make_path(db_session)

    assert weak_modules(path) == []


def test_create_remediation_module_inserts_practice_module(client, db_session):
    headers = _register_and_login(client)
    path = _make_path(db_session)
    user = db_session.query(User).filter(User.email == "learner2@example.com").one()
    module = path.modules[0]
    other_module_id = path.modules[1].id

    _add_failed_submissions(db_session, user.id, module)

    response = client.post(
        f"/api/learning-paths/{path.id}/modules/{module.id}/remediation", headers=headers
    )
    assert response.status_code == 201
    body = response.json()

    practice = next(m for m in body["modules"] if m["title"] == f"Powtórka: {module.title}")
    assert practice["is_remediation"] is True
    assert practice["order_index"] == module.order_index + 1
    # the following module got pushed back to make room
    reindexed = next(m for m in body["modules"] if m["id"] == other_module_id)
    assert reindexed["order_index"] == module.order_index + 2

    # idempotent: calling again does not insert a second practice module
    response2 = client.post(
        f"/api/learning-paths/{path.id}/modules/{module.id}/remediation", headers=headers
    )
    assert response2.status_code == 201
    titles2 = [m["title"] for m in response2.json()["modules"]]
    assert titles2.count(f"Powtórka: {module.title}") == 1


def test_create_remediation_module_rejects_module_without_detected_weakness(client, db_session):
    headers = _register_and_login(client)
    path = _make_path(db_session)
    module = path.modules[0]

    response = client.post(
        f"/api/learning-paths/{path.id}/modules/{module.id}/remediation", headers=headers
    )
    assert response.status_code == 400


def test_create_remediation_module_rejects_other_users_path(client, db_session):
    headers = _register_and_login(client)
    path = _make_path(db_session)
    user = db_session.query(User).filter(User.email == "learner2@example.com").one()
    module = path.modules[0]
    _add_failed_submissions(db_session, user.id, module)

    client.post("/api/auth/register", json={"email": "intruder3@example.com", "password": "SecurePass123"})
    intruder_login = client.post(
        "/api/auth/login", json={"email": "intruder3@example.com", "password": "SecurePass123"}
    )
    intruder_headers = {"Authorization": f"Bearer {intruder_login.json()['access_token']}"}

    response = client.post(
        f"/api/learning-paths/{path.id}/modules/{module.id}/remediation", headers=intruder_headers
    )
    assert response.status_code == 404
