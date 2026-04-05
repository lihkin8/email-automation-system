"""Tests for POST /contacts/upload and POST /contacts endpoints."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user_id
from app.database import get_session


def _override_auth(user_id: int = 1):
    """Return a dependency override that injects a fixed user_id."""
    async def _dep():
        return user_id
    return _dep


def _override_session():
    """Return a dependency override with a no-op async session."""
    async def _dep():
        yield AsyncMock()
    return _dep


# ── Upload endpoint ───────────────────────────────────────────────────────────

def test_upload_returns_parsed_contacts():
    app.dependency_overrides[get_current_user_id] = _override_auth()

    client = TestClient(app)
    content = b"Google:\nrecruiter@google.com - Jane Smith\n"
    response = client.post(
        "/contacts/upload",
        files={"file": ("contacts.txt", content, "text/plain")},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data["contacts"]) == 1
    assert data["contacts"][0]["name"] == "Jane Smith"
    assert data["contacts"][0]["email"] == "recruiter@google.com"
    assert data["contacts"][0]["company"] == "Google"
    assert data["errors"] == []


def test_upload_returns_errors_for_malformed_lines():
    app.dependency_overrides[get_current_user_id] = _override_auth()

    client = TestClient(app)
    content = b"Google:\nbadline@google.com no separator\n"
    response = client.post(
        "/contacts/upload",
        files={"file": ("contacts.txt", content, "text/plain")},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["contacts"] == []
    assert len(data["errors"]) == 1
    assert "missing '-' separator" in data["errors"][0]


def test_upload_requires_auth():
    """No dependency override — stub raises 401."""
    client = TestClient(app, raise_server_exceptions=False)
    content = b"Google:\nrecruiter@google.com - Jane Smith\n"
    response = client.post(
        "/contacts/upload",
        files={"file": ("contacts.txt", content, "text/plain")},
    )
    assert response.status_code == 401


# ── Confirm endpoint ──────────────────────────────────────────────────────────

def test_confirm_saves_contact_list():
    mock_contact_list = MagicMock()
    mock_contact_list.id = 42

    with patch("app.routers.contacts.ContactRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.create_contact_list.return_value = mock_contact_list
        instance.bulk_create_recruiters.return_value = 2

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.post(
            "/contacts",
            json={
                "list_name": "My List",
                "source": "TEXT_FILE",
                "contacts": [
                    {"name": "Jane Smith", "email": "jane@google.com", "company": "Google"},
                    {"name": "Bob Jones", "email": "bob@meta.com", "company": "Meta"},
                ],
            },
        )

        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["contact_list_id"] == 42
    assert data["imported_count"] == 2


def test_confirm_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/contacts",
        json={"list_name": "x", "source": "TEXT_FILE", "contacts": []},
    )
    assert response.status_code == 401
