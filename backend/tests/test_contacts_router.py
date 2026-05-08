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


def test_list_contact_lists_returns_rows():
    mock_list = MagicMock()
    mock_list.id = 7
    mock_list.name = "List A"
    mock_list.source = "TEXT_FILE"
    mock_list.created_at = None

    with patch("app.routers.contacts.ContactRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.list_contact_lists.return_value = [mock_list]

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.get("/contacts/lists")

        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data[0]["id"] == 7
    assert data[0]["name"] == "List A"


# ── Detail / update / delete endpoints ────────────────────────────────────────

def _make_list(id=7, name="List A", source="TEXT_FILE"):
    cl = MagicMock()
    cl.id = id
    cl.name = name
    cl.source = source
    cl.created_at = None
    return cl


def _make_recruiter(id, name, email, company):
    r = MagicMock()
    r.id = id
    r.name = name
    r.email = email
    r.company = company
    return r


def test_get_contact_list_returns_detail_with_recruiters():
    with patch("app.routers.contacts.ContactRepository") as MockRepo, patch(
        "app.routers.contacts.RecruiterRepository"
    ) as MockRecruiterRepo:
        contact_repo = AsyncMock()
        recruiter_repo = AsyncMock()
        MockRepo.return_value = contact_repo
        MockRecruiterRepo.return_value = recruiter_repo

        contact_repo.get_by_id.return_value = _make_list(id=7, name="List A")
        recruiter_repo.get_by_contact_list.return_value = [
            _make_recruiter(1, "Jane Smith", "jane@google.com", "Google"),
            _make_recruiter(2, "Bob Jones", "bob@meta.com", "Meta"),
        ]

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.get("/contacts/lists/7")

        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 7
    assert data["name"] == "List A"
    assert len(data["contacts"]) == 2
    assert data["contacts"][0]["name"] == "Jane Smith"
    assert data["contacts"][1]["company"] == "Meta"


def test_get_contact_list_returns_404_when_missing():
    with patch("app.routers.contacts.ContactRepository") as MockRepo:
        contact_repo = AsyncMock()
        MockRepo.return_value = contact_repo
        contact_repo.get_by_id.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.get("/contacts/lists/999")

        app.dependency_overrides.clear()

    assert resp.status_code == 404


def test_update_contact_list_passes_payload_to_repo():
    """Rename + add new + edit existing + remove existing — repo receives the full payload."""
    with patch("app.routers.contacts.ContactRepository") as MockRepo, patch(
        "app.routers.contacts.RecruiterRepository"
    ) as MockRecruiterRepo:
        contact_repo = AsyncMock()
        recruiter_repo = AsyncMock()
        MockRepo.return_value = contact_repo
        MockRecruiterRepo.return_value = recruiter_repo

        updated_list = _make_list(id=7, name="Renamed List")
        contact_repo.update_list.return_value = updated_list
        recruiter_repo.get_by_contact_list.return_value = [
            _make_recruiter(1, "Jane Smith", "jane@google.com", "Google"),
            _make_recruiter(99, "New Person", "new@stripe.com", "Stripe"),
        ]

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.put(
            "/contacts/lists/7",
            json={
                "name": "Renamed List",
                "contacts": [
                    {"id": 1, "name": "Jane Smith", "email": "jane@google.com", "company": "Google"},
                    {"id": None, "name": "New Person", "email": "new@stripe.com", "company": "Stripe"},
                ],
            },
        )

        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Renamed List"
    assert len(data["contacts"]) == 2

    contact_repo.update_list.assert_awaited_once()
    call = contact_repo.update_list.await_args
    assert call.args[0] == 7
    assert call.kwargs["name"] == "Renamed List"
    payload = call.kwargs["contacts"]
    assert payload == [
        {"id": 1, "name": "Jane Smith", "email": "jane@google.com", "company": "Google"},
        {"id": None, "name": "New Person", "email": "new@stripe.com", "company": "Stripe"},
    ]


def test_update_contact_list_returns_404_when_missing():
    with patch("app.routers.contacts.ContactRepository") as MockRepo:
        contact_repo = AsyncMock()
        MockRepo.return_value = contact_repo
        contact_repo.update_list.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.put(
            "/contacts/lists/999",
            json={"name": "x", "contacts": []},
        )

        app.dependency_overrides.clear()

    assert resp.status_code == 404


def test_delete_contact_list_succeeds_when_unused():
    with patch("app.routers.contacts.ContactRepository") as MockRepo:
        contact_repo = AsyncMock()
        MockRepo.return_value = contact_repo
        contact_repo.get_by_id.return_value = _make_list(id=7)
        contact_repo.count_campaigns_using_list.return_value = 0
        contact_repo.delete_list.return_value = True

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.delete("/contacts/lists/7")

        app.dependency_overrides.clear()

    assert resp.status_code == 204
    contact_repo.delete_list.assert_awaited_once_with(7, 1)


def test_delete_contact_list_returns_400_when_used_by_campaign():
    with patch("app.routers.contacts.ContactRepository") as MockRepo:
        contact_repo = AsyncMock()
        MockRepo.return_value = contact_repo
        contact_repo.get_by_id.return_value = _make_list(id=7)
        contact_repo.count_campaigns_using_list.return_value = 2

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.delete("/contacts/lists/7")

        app.dependency_overrides.clear()

    assert resp.status_code == 400
    assert "2 campaign" in resp.json()["detail"]
    contact_repo.delete_list.assert_not_awaited()


def test_delete_contact_list_returns_404_when_missing():
    with patch("app.routers.contacts.ContactRepository") as MockRepo:
        contact_repo = AsyncMock()
        MockRepo.return_value = contact_repo
        contact_repo.get_by_id.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.delete("/contacts/lists/999")

        app.dependency_overrides.clear()

    assert resp.status_code == 404
