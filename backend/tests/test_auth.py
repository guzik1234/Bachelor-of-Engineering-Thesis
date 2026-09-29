def test_register_sends_verification_email_and_blocks_login_until_verified(client, sent_emails):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "student@example.com", "password": "SecurePass123", "full_name": "Jan Kowalski"},
    )
    assert register_response.status_code == 201
    body = register_response.json()
    assert body["email"] == "student@example.com"
    assert body["is_verified"] is False
    assert "hashed_password" not in body

    assert len(sent_emails) == 1
    to_email, token = sent_emails[0]
    assert to_email == "student@example.com"

    blocked_login = client.post(
        "/api/auth/login",
        json={"email": "student@example.com", "password": "SecurePass123"},
    )
    assert blocked_login.status_code == 403

    verify_response = client.post("/api/auth/verify-email", json={"token": token})
    assert verify_response.status_code == 200

    login_response = client.post(
        "/api/auth/login",
        json={"email": "student@example.com", "password": "SecurePass123"},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]
    assert access_token

    me_response = client.get("/api/users/me", headers={"Authorization": f"Bearer {access_token}"})
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


def test_verify_email_with_invalid_token_fails(client):
    response = client.post("/api/auth/verify-email", json={"token": "not-a-real-token"})
    assert response.status_code == 400


def test_verify_email_token_is_single_use(client, sent_emails):
    client.post("/api/auth/register", json={"email": "once@example.com", "password": "SecurePass123"})
    _, token = sent_emails[0]

    first = client.post("/api/auth/verify-email", json={"token": token})
    assert first.status_code == 200

    second = client.post("/api/auth/verify-email", json={"token": token})
    assert second.status_code == 400


def test_resend_verification_issues_a_new_working_token(client, sent_emails):
    client.post("/api/auth/register", json={"email": "resend@example.com", "password": "SecurePass123"})
    first_token = sent_emails[0][1]

    resend_response = client.post("/api/auth/resend-verification", json={"email": "resend@example.com"})
    assert resend_response.status_code == 200
    assert len(sent_emails) == 2
    second_token = sent_emails[1][1]
    assert second_token != first_token

    assert client.post("/api/auth/verify-email", json={"token": first_token}).status_code == 400
    assert client.post("/api/auth/verify-email", json={"token": second_token}).status_code == 200


def test_resend_verification_for_unknown_email_gives_generic_response(client, sent_emails):
    response = client.post("/api/auth/resend-verification", json={"email": "nobody@example.com"})
    assert response.status_code == 200
    assert sent_emails == []
