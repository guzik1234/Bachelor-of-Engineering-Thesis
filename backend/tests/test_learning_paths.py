def test_generate_learning_path(client, register_and_login, monkeypatch):
    headers = register_and_login()

    fake_result = {
        "title": "React od podstaw",
        "description": "Ścieżka wprowadzająca do biblioteki React.",
        "modules": [
            {"title": "Podstawy JSX", "summary": "Wprowadzenie do składni JSX."},
            {"title": "Komponenty i propsy", "summary": "Budowa komponentów wielokrotnego użytku."},
        ],
    }
    monkeypatch.setattr(
        "app.api.routes.learning_paths.generate_learning_path",
        lambda **kwargs: fake_result,
    )

    response = client.post(
        "/api/learning-paths/generate",
        json={"technology": "React", "experience_level": "beginner"},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "React od podstaw"
    assert len(body["modules"]) == 2
    assert body["modules"][0]["completed"] is False


def test_generate_learning_path_handles_llm_failure(client, register_and_login, monkeypatch):
    headers = register_and_login()

    def _raise(**kwargs):
        from app.services.llm_client import LLMGenerationError

        raise LLMGenerationError("model niedostępny")

    monkeypatch.setattr("app.api.routes.learning_paths.generate_learning_path", _raise)

    response = client.post(
        "/api/learning-paths/generate",
        json={"technology": "React", "experience_level": "beginner"},
        headers=headers,
    )
    assert response.status_code == 503


def test_list_learning_paths_requires_auth(client):
    response = client.get("/api/learning-paths")
    assert response.status_code in (401, 403)
