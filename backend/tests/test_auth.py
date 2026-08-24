def test_register_and_login(client):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "student@example.com", "password": "SecurePass123", "full_name": "Jan Kowalski"},
    )
    assert register_response.status_code == 201
    body = register_response.json()
    assert body["email"] == "student@example.com"
    assert "hashed_password" not in body

    login_response = client.post(
        "/api/auth/login",
        json={"email": "student@example.com", "password": "SecurePass123"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    assert token

    me_response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "student@example.com"


def test_login_with_wrong_password_fails(client):
    client.post("/api/auth/register", json={"email": "student2@example.com", "password": "SecurePass123"})

    response = client.post(
        "/api/auth/login",
        json={"email": "student2@example.com", "password": "WrongPassword"},
    )
    assert response.status_code == 401


def test_register_duplicate_email_fails(client):
    payload = {"email": "dup@example.com", "password": "SecurePass123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.post("/api/auth/register", json=payload).status_code == 400


def test_protected_route_requires_token(client):
    response = client.get("/api/users/me")
    assert response.status_code in (401, 403)
