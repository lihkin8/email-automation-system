from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from app.main import app
from app.database import get_session
from app.dependencies import get_current_user_id


def _override_auth(user_id: int = 1):
    async def _dep():
        return user_id

    return _dep


def _override_session():
    async def _dep():
        session = AsyncMock()
        # Make `await session.execute(...).scalars().first()` work.
        exec_result = MagicMock()
        scalars = MagicMock()
        scalars.first.return_value = MagicMock(gmail_refresh_token=None, resume_url=None)
        exec_result.scalars.return_value = scalars
        session.execute.return_value = exec_result
        yield session

    return _dep


def test_onboarding_status_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/onboarding/status")
    assert resp.status_code == 401


def test_onboarding_status_returns_shape():
    # We don't deeply verify counts here (repository-style); we verify the router returns the expected shape.
    app.dependency_overrides[get_current_user_id] = _override_auth()
    app.dependency_overrides[get_session] = _override_session()

    client = TestClient(app)
    resp = client.get("/onboarding/status")

    app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert set(data.keys()) == {
        "gmail_connected",
        "has_resume",
        "has_template",
        "has_contacts",
        "has_campaign",
    }

