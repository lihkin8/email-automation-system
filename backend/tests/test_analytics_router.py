"""Tests for analytics endpoints."""
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import get_current_user, get_db


def _override_auth(user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    async def _dep():
        return user
    return _dep


def _override_session(execute_return=None):
    mock_session = AsyncMock()
    if execute_return is not None:
        mock_session.execute.return_value = execute_return
    async def _dep():
        yield mock_session
    return _dep


# ── /companies ────────────────────────────────────────────────────────────────

def test_companies_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/companies").status_code == 401


def test_companies_returns_list():
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [("Google",), ("Meta",)]

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _override_session(mock_result)
    response = TestClient(app).get("/companies")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"companies": ["Google", "Meta"]}


# ── /analytics ────────────────────────────────────────────────────────────────

def test_analytics_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/analytics").status_code == 401


def test_analytics_returns_paginated_shape():
    count_result = MagicMock()
    count_result.scalar.return_value = 0
    rows_result = MagicMock()
    rows_result.mappings.return_value.all.return_value = []

    mock_session = AsyncMock()
    mock_session.execute.side_effect = [count_result, rows_result]

    async def _dep():
        yield mock_session

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _dep
    response = TestClient(app).get("/analytics?page=1&page_size=20")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert "analytics" in data
    assert data["pagination"] == {"total": 0, "page": 1, "page_size": 20, "total_pages": 1}


# ── /company-analytics ────────────────────────────────────────────────────────

def test_company_analytics_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/company-analytics").status_code == 401


def test_company_analytics_returns_list():
    agg_result = MagicMock()
    agg_result.mappings.return_value.all.return_value = []
    status_result = MagicMock()
    status_result.fetchall.return_value = []

    mock_session = AsyncMock()
    mock_session.execute.side_effect = [agg_result, status_result]

    async def _dep():
        yield mock_session

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _dep
    response = TestClient(app).get("/company-analytics")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"company_analytics": []}


# ── /company/{name} ───────────────────────────────────────────────────────────

def test_company_details_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/company/Google").status_code == 401


def test_company_details_404_when_not_found():
    mock_result = MagicMock()
    mock_result.mappings.return_value.first.return_value = {"total_emails": 0}

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _override_session(mock_result)
    response = TestClient(app, raise_server_exceptions=False).get("/company/NonExistent")
    app.dependency_overrides.clear()

    assert response.status_code == 404


# ── /company/{name}/emails ────────────────────────────────────────────────────

def test_company_emails_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/company/Google/emails").status_code == 401


def test_company_emails_returns_list():
    mock_result = MagicMock()
    mock_result.mappings.return_value.all.return_value = []

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _override_session(mock_result)
    response = TestClient(app).get("/company/Google/emails")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"company_emails": []}
