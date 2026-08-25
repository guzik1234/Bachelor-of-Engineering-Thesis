from datetime import datetime, timezone

from app.models.feedback import Feedback
from app.models.learning_path import LearningPath
from app.models.material import Material
from app.models.module import Module
from app.models.progress import Progress
from app.models.submission import ExerciseSubmission
from app.models.user import User


def _register_and_login(client, email="stats@example.com"):
    client.post("/api/auth/register", json={"email": email, "password": "SecurePass123"})
    login = client.post("/api/auth/login", json={"email": email, "password": "SecurePass123"})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_stats_empty_account(client):
    headers = _register_and_login(client)
    response = client.get("/api/stats", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["overview"]["total_paths"] == 0
    assert body["overview"]["completion_ratio"] == 0.0
    assert body["paths"] == []


def test_stats_aggregates_across_paths(client, db_session):
    headers = _register_and_login(client)
    user = db_session.query(User).filter(User.email == "stats@example.com").one()

    # Path A: 2 modules, 1 completed, one exercise passed, one rating of 4
    path_a = LearningPath(
        user_id=user.id, technology="Python", experience_level="beginner",
        title="Python A", description="d",
    )
    db_session.add(path_a)
    db_session.flush()
    mod_a1 = Module(learning_path_id=path_a.id, order_index=0, title="M1", summary="s")
    mod_a2 = Module(learning_path_id=path_a.id, order_index=1, title="M2", summary="s")
    db_session.add_all([mod_a1, mod_a2])
    db_session.flush()
    db_session.add(Progress(user_id=user.id, module_id=mod_a1.id, completed=True, completed_at=datetime.now(timezone.utc)))
    material_a = Material(module_id=mod_a1.id, material_type="exercise", content={}, version=1)
    db_session.add(material_a)
    db_session.flush()
    db_session.add(ExerciseSubmission(user_id=user.id, material_id=material_a.id, submitted_code="x", passed=True, feedback="ok"))
    db_session.add(Feedback(user_id=user.id, material_id=material_a.id, rating=4))

    # Path B: 1 module, 0 completed, no feedback/submissions
    path_b = LearningPath(
        user_id=user.id, technology="React", experience_level="beginner",
        title="React B", description="d",
    )
    db_session.add(path_b)
    db_session.flush()
    mod_b1 = Module(learning_path_id=path_b.id, order_index=0, title="M1", summary="s")
    db_session.add(mod_b1)
    db_session.commit()

    response = client.get("/api/stats", headers=headers)
    assert response.status_code == 200
    body = response.json()

    overview = body["overview"]
    assert overview["total_paths"] == 2
    assert overview["total_modules"] == 3
    assert overview["completed_modules"] == 1
    assert overview["exercise_attempts"] == 1
    assert overview["exercise_pass_rate"] == 1.0
    assert overview["avg_feedback_rating"] == 4.0
    assert overview["feedback_count"] == 1

    paths_by_title = {p["title"]: p for p in body["paths"]}
    assert paths_by_title["Python A"]["completion_ratio"] == 0.5
    assert paths_by_title["Python A"]["exercise_attempts"] == 1
    assert paths_by_title["Python A"]["feedback_count"] == 1
    assert paths_by_title["React B"]["completion_ratio"] == 0.0
    assert paths_by_title["React B"]["exercise_attempts"] == 0
    assert paths_by_title["React B"]["feedback_count"] == 0


def test_stats_requires_auth(client):
    response = client.get("/api/stats")
    assert response.status_code in (401, 403)
