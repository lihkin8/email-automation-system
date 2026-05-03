"""Tests for /users endpoints."""
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import get_current_user, get_db


def _make_user(
    user_id=1,
    email="test@example.com",
    name="Test User",
    avatar_url="https://example.com/avatar.jpg",
    resume_url=None,
    follow_up_days=3,
    gmail_refresh_token=None,
):
    user = MagicMock()
    user.id = user_id
    user.email = email
    user.name = name
    user.avatar_url = avatar_url
    user.resume_url = resume_url
    user.follow_up_days = follow_up_days
    user.gmail_refresh_token = gmail_refresh_token
    return user


def _override_auth(user=None):
    if user is None:
        user = _make_user()
    async def _dep():
        return user
    return _dep


def _override_session():
    mock_session = AsyncMock()
    async def _dep():
        yield mock_session
    return _dep


def _override_session_with_user(user):
    mock_session = AsyncMock()
    mock_session.execute.return_value.scalars.return_value.first.return_value = user
    async def _dep():
        yield mock_session
    return _dep


# ── GET /users/settings ────────────────────────────────────────────────────────

def test_get_settings_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/users/settings").status_code == 401


def test_get_settings_no_resume_not_connected():
    user = _make_user(gmail_refresh_token=None)
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session()
    response = TestClient(app).get("/users/settings")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert data["gmail_connected"] is False
    assert data["resume_url"] is None
    assert data["resume_filename"] is None
    assert data["follow_up_days"] == 3


def test_get_settings_gmail_connected():
    user = _make_user(gmail_refresh_token="encrypted_token")
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session()
    response = TestClient(app).get("/users/settings")
    app.dependency_overrides.clear()

    assert response.json()["gmail_connected"] is True


def test_get_settings_with_resume_returns_presigned_url():
    user = _make_user(resume_url="resumes/1/cv.pdf")
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session()

    with patch("app.routers.users.storage.get_presigned_url", return_value="https://r2.example.com/signed"):
        response = TestClient(app).get("/users/settings")
    app.dependency_overrides.clear()

    data = response.json()
    assert data["resume_url"] == "https://r2.example.com/signed"
    assert data["resume_filename"] == "cv.pdf"


# ── PATCH /users/settings ─────────────────────────────────────────────────────

def test_patch_settings_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.patch("/users/settings", json={"follow_up_days": 5}).status_code == 401


def test_patch_settings_updates_follow_up_days():
    user = _make_user()
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session_with_user(user)
    response = TestClient(app).patch("/users/settings", json={"follow_up_days": 7})
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"follow_up_days": 7}


def test_patch_settings_mutates_user_object():
    user = _make_user()
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session()
    TestClient(app).patch("/users/settings", json={"follow_up_days": 7})
    app.dependency_overrides.clear()

    assert user.follow_up_days == 7


def test_patch_settings_rejects_zero():
    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _override_session()
    response = TestClient(app).patch("/users/settings", json={"follow_up_days": 0})
    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_patch_settings_rejects_above_30():
    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _override_session()
    response = TestClient(app).patch("/users/settings", json={"follow_up_days": 31})
    app.dependency_overrides.clear()
    assert response.status_code == 422


# ── POST /users/resume ────────────────────────────────────────────────────────

def test_upload_resume_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.post("/users/resume").status_code == 401


def test_upload_resume_rejects_invalid_content_type():
    user = _make_user()
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session_with_user(user)
    response = TestClient(app, raise_server_exceptions=False).post(
        "/users/resume",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    app.dependency_overrides.clear()
    assert response.status_code == 400


def test_upload_resume_success():
    user = _make_user(resume_url=None)
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session_with_user(user)

    with patch("app.routers.users.storage.upload_resume", return_value="resumes/1/cv.pdf"), \
         patch("app.routers.users.storage.get_presigned_url", return_value="https://r2.example.com/signed"):
        response = TestClient(app).post(
            "/users/resume",
            files={"file": ("cv.pdf", b"%PDF fake", "application/pdf")},
        )
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"resume_url": "https://r2.example.com/signed"}


def test_upload_resume_deletes_existing_before_uploading():
    user = _make_user(resume_url="resumes/1/old.pdf")
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session_with_user(user)

    with patch("app.routers.users.storage.delete_resume") as mock_delete, \
         patch("app.routers.users.storage.upload_resume", return_value="resumes/1/new.pdf"), \
         patch("app.routers.users.storage.get_presigned_url", return_value="https://r2.example.com/signed"):
        TestClient(app).post(
            "/users/resume",
            files={"file": ("new.pdf", b"%PDF fake", "application/pdf")},
        )
    app.dependency_overrides.clear()

    mock_delete.assert_called_once_with("resumes/1/old.pdf")


# ── DELETE /users/resume ──────────────────────────────────────────────────────

def test_delete_resume_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.delete("/users/resume").status_code == 401


def test_delete_resume_404_when_no_resume():
    user = _make_user(resume_url=None)
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session()
    response = TestClient(app, raise_server_exceptions=False).delete("/users/resume")
    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_delete_resume_success():
    user = _make_user(resume_url="resumes/1/cv.pdf")
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_session_with_user(user)

    with patch("app.routers.users.storage.delete_resume") as mock_delete:
        response = TestClient(app).delete("/users/resume")
    app.dependency_overrides.clear()

    assert response.status_code == 204
    mock_delete.assert_called_once_with("resumes/1/cv.pdf")
