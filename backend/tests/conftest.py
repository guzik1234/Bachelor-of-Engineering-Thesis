import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401  ensures all ORM models are registered on Base.metadata
from app.api.routes import auth as auth_routes
from app.core.database import Base, get_db
from app.main import app


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def sent_emails(monkeypatch):
    """Captures (to_email, token) pairs instead of hitting a real SMTP server
    during tests. Auto-applied to every test via the `client` fixture below."""
    sent: list[tuple[str, str]] = []

    def fake_send(to_email: str, token: str) -> None:
        sent.append((to_email, token))

    monkeypatch.setattr(auth_routes, "send_verification_email", fake_send)
    return sent


@pytest.fixture()
def client(db_session, sent_emails):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # Not using `with TestClient(...)` on purpose: it would trigger the app's
    # lifespan, which calls create_all against the real (non-test) database URL.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def register_and_login(client, sent_emails):
    """Registers a user, verifies them using the token captured via
    `sent_emails` (login is blocked for unverified accounts), logs in, and
    returns Authorization headers. Shared by every test module instead of
    each one defining its own register+login helper."""

    def _do(email: str = "user@example.com", password: str = "SecurePass123") -> dict[str, str]:
        client.post("/api/auth/register", json={"email": email, "password": password})
        token = next(t for addr, t in sent_emails if addr == email)
        client.post("/api/auth/verify-email", json={"token": token})
        login = client.post("/api/auth/login", json={"email": email, "password": password})
        return {"Authorization": f"Bearer {login.json()['access_token']}"}

    return _do
