from app.models.learning_path import LearningPath
from app.models.module import Module
from app.models.user import User


def _register_and_login(client, email="materials@example.com"):
    client.post("/api/auth/register", json={"email": email, "password": "SecurePass123"})
    login = client.post("/api/auth/login", json={"email": email, "password": "SecurePass123"})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make_module(db_session, email="materials@example.com") -> Module:
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
    db_session.commit()
    db_session.refresh(module)
    return module


def test_get_module_materials_stores_critique_result(client, db_session, monkeypatch):
    headers = _register_and_login(client)
    module = _make_module(db_session)

    fake_result = {
        "content": {"explanation": "Zmienne przechowują dane."},
        "critique_passed": True,
        "critique_notes": "Materiał jest poprawny i zwięzły.",
    }
    monkeypatch.setattr(
        "app.api.routes.materials.generate_material_with_review",
        lambda **kwargs: fake_result,
    )

    response = client.get(f"/api/materials/module/{module.id}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    text_material = next(m for m in body if m["material_type"] == "text")
    assert text_material["critique_passed"] is True
    assert text_material["critique_notes"] == "Materiał jest poprawny i zwięzły."


def test_regenerate_material_handles_llm_failure(client, db_session, monkeypatch):
    headers = _register_and_login(client)
    module = _make_module(db_session)

    def _raise(**kwargs):
        from app.services.llm_client import LLMGenerationError

        raise LLMGenerationError("model niedostępny")

    monkeypatch.setattr("app.api.routes.materials.generate_material_with_review", _raise)

    response = client.post(f"/api/materials/module/{module.id}/regenerate/text", headers=headers)
    assert response.status_code == 503
