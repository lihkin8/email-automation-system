"""Tests for tracking pixel endpoints — KAN-27."""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.database import get_session


def _override_session():
    async def _dep():
        yield AsyncMock()

    return _dep


def _make_email(id=1, user_id=1, tracking_id="t-123"):
    e = MagicMock()
    e.id = id
    e.user_id = user_id
    e.tracking_id = tracking_id
    return e


def test_track_gif_returns_gif_bytes_and_200():
    mock_email = _make_email(id=10, user_id=7, tracking_id="abc")

    with patch("app.routers.tracking.EmailRepository") as MockEmailRepo, patch(
        "app.routers.tracking.EmailTrackingRepository"
    ) as MockTrackingRepo:
        email_repo = AsyncMock()
        tracking_repo = AsyncMock()
        MockEmailRepo.return_value = email_repo
        MockTrackingRepo.return_value = tracking_repo
        email_repo.get_by_tracking_id.return_value = mock_email

        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.get("/track/7/abc.gif")

        app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/gif")
    assert resp.content.startswith(b"GIF89a")


def test_track_gif_returns_404_when_not_found():
    with patch("app.routers.tracking.EmailRepository") as MockEmailRepo:
        email_repo = AsyncMock()
        MockEmailRepo.return_value = email_repo
        email_repo.get_by_tracking_id.return_value = None

        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/track/1/nope.gif")

        app.dependency_overrides.clear()

    assert resp.status_code == 404


def test_track_gif_returns_404_when_user_mismatch():
    mock_email = _make_email(id=10, user_id=2, tracking_id="abc")

    with patch("app.routers.tracking.EmailRepository") as MockEmailRepo:
        email_repo = AsyncMock()
        MockEmailRepo.return_value = email_repo
        email_repo.get_by_tracking_id.return_value = mock_email

        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/track/1/abc.gif")

        app.dependency_overrides.clear()

    assert resp.status_code == 404


def test_compat_pixel_returns_404_when_email_missing():
    with patch("app.routers.tracking.EmailRepository") as MockEmailRepo:
        email_repo = AsyncMock()
        MockEmailRepo.return_value = email_repo
        email_repo.get_by_id.return_value = None

        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/track/pixel?email_id=999")

        app.dependency_overrides.clear()

    assert resp.status_code == 404

