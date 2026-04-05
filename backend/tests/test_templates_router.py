"""Tests for the /templates CRUD endpoints — KAN-19."""
import datetime
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


def _make_template(
    id=1, name="My Template", type="MAIN",
    subject="Hello {{first_name}}", body_html="<p>Hi</p>",
    variables=None, user_id=1,
):
    """Build a MagicMock that looks like a Template ORM row."""
    t = MagicMock()
    t.id = id
    t.name = name
    t.type = type
    t.subject = subject
    t.body_html = body_html
    t.variables = variables
    t.user_id = user_id
    t.created_at = datetime.datetime(2026, 4, 4, 12, 0, 0)
    return t


# ── POST /templates ───────────────────────────────────────────────────────────

def test_create_template_returns_201():
    mock_template = _make_template()

    with patch("app.routers.templates.TemplateRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.create.return_value = mock_template

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.post(
            "/templates",
            json={
                "name": "My Template",
                "type": "MAIN",
                "subject": "Hello {{first_name}}",
                "body_html": "<p>Hi</p>",
                "variables": None,
            },
        )

        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Template"
    assert data["type"] == "MAIN"
    assert data["subject"] == "Hello {{first_name}}"


def test_create_template_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/templates",
        json={"name": "x", "type": "MAIN", "subject": "s", "body_html": "<p/>"},
    )
    assert response.status_code == 401


# ── GET /templates ────────────────────────────────────────────────────────────

def test_list_templates_returns_200():
    templates = [_make_template(id=1, name="T1"), _make_template(id=2, name="T2")]

    with patch("app.routers.templates.TemplateRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_all.return_value = templates

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.get("/templates")

        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "T1"
    assert data[1]["name"] == "T2"


def test_list_templates_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/templates")
    assert response.status_code == 401


# ── GET /templates/{id} ───────────────────────────────────────────────────────

def test_get_template_returns_200():
    mock_template = _make_template(id=5)

    with patch("app.routers.templates.TemplateRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = mock_template

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.get("/templates/5")

        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id"] == 5


def test_get_template_returns_404_when_not_found():
    with patch("app.routers.templates.TemplateRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/templates/999")

        app.dependency_overrides.clear()

    assert response.status_code == 404


# ── PUT /templates/{id} ───────────────────────────────────────────────────────

def test_update_template_returns_200():
    updated = _make_template(id=3, name="Updated Name")

    with patch("app.routers.templates.TemplateRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.update.return_value = updated

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.put("/templates/3", json={"name": "Updated Name"})

        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"


def test_update_template_returns_404_when_not_found():
    with patch("app.routers.templates.TemplateRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.update.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.put("/templates/999", json={"name": "x"})

        app.dependency_overrides.clear()

    assert response.status_code == 404


# ── DELETE /templates/{id} ────────────────────────────────────────────────────

def test_delete_template_returns_204():
    with patch("app.routers.templates.TemplateRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.delete.return_value = True

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.delete("/templates/1")

        app.dependency_overrides.clear()

    assert response.status_code == 204


def test_delete_template_returns_404_when_not_found():
    with patch("app.routers.templates.TemplateRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.delete.return_value = False

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.delete("/templates/999")

        app.dependency_overrides.clear()

    assert response.status_code == 404
