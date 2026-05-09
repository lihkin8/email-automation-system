"""Tests for the /campaigns CRUD endpoints — KAN-23."""
import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user_id
from app.database import get_session


def _override_auth(user_id: int = 1):
    async def _dep():
        return user_id

    return _dep


def _override_session():
    async def _dep():
        yield AsyncMock()

    return _dep


def _make_campaign(
    id=1,
    name="My Campaign",
    template_id=10,
    contact_list_id=20,
    follow_up_template_id=None,
    follow_up_days=5,
    status="DRAFT",
    user_id=1,
):
    c = MagicMock()
    c.id = id
    c.user_id = user_id
    c.name = name
    c.template_id = template_id
    c.contact_list_id = contact_list_id
    c.follow_up_template_id = follow_up_template_id
    c.follow_up_days = follow_up_days
    c.status = status
    c.created_at = datetime.datetime(2026, 5, 8, 12, 0, 0)
    return c


def test_create_campaign_returns_201():
    mock_campaign = _make_campaign()

    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.create.return_value = mock_campaign

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.post(
            "/campaigns",
            json={
                "name": "My Campaign",
                "template_id": 10,
                "contact_list_id": 20,
                "follow_up_template_id": None,
                "follow_up_days": 5,
                "status": "DRAFT",
            },
        )

        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Campaign"
    assert data["template_id"] == 10


def test_create_campaign_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/campaigns",
        json={"name": "x", "template_id": 1, "contact_list_id": 1},
    )
    assert response.status_code == 401


def test_list_campaigns_returns_200():
    campaigns = [_make_campaign(id=1, name="C1"), _make_campaign(id=2, name="C2")]

    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_all.return_value = campaigns

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.get("/campaigns")

        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "C1"


def test_list_campaigns_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/campaigns")
    assert response.status_code == 401


def test_get_campaign_returns_200():
    mock_campaign = _make_campaign(id=5)

    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = mock_campaign

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.get("/campaigns/5")

        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id"] == 5


def test_get_campaign_returns_404_when_not_found():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/campaigns/999")

        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_send_progress_endpoint_reports_status_counts():
    mock_campaign = _make_campaign(id=5, status="RUNNING")

    with patch("app.routers.campaigns.CampaignRepository") as MockCampaignRepo, patch(
        "app.routers.campaigns.EmailRepository"
    ) as MockEmailRepo:
        campaign_repo = AsyncMock()
        email_repo = AsyncMock()
        MockCampaignRepo.return_value = campaign_repo
        MockEmailRepo.return_value = email_repo
        campaign_repo.get_by_id.return_value = mock_campaign
        email_repo.get_campaign_status_counts.return_value = {
            "PENDING": 2,
            "SENT": 3,
            "FAILED": 1,
        }

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.get("/campaigns/5/send-progress")

        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "campaign_id": 5,
        "status": "RUNNING",
        "total": 6,
        "pending": 2,
        "sent": 3,
        "failed": 1,
    }
    email_repo.get_campaign_status_counts.assert_awaited_once()


def test_send_progress_endpoint_returns_404_when_campaign_missing():
    with patch("app.routers.campaigns.CampaignRepository") as MockCampaignRepo:
        campaign_repo = AsyncMock()
        MockCampaignRepo.return_value = campaign_repo
        campaign_repo.get_by_id.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/campaigns/999/send-progress")

        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_update_campaign_returns_200():
    updated = _make_campaign(id=3, name="Updated")

    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.update.return_value = updated

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.put("/campaigns/3", json={"name": "Updated"})

        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["name"] == "Updated"


def test_update_campaign_returns_404_when_not_found():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.update.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.put("/campaigns/999", json={"name": "x"})

        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_delete_campaign_returns_204():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.delete.return_value = True

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        response = client.delete("/campaigns/1")

        app.dependency_overrides.clear()

    assert response.status_code == 204


def test_delete_campaign_returns_404_when_not_found():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.delete.return_value = False

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        response = client.delete("/campaigns/999")

        app.dependency_overrides.clear()

    assert response.status_code == 404

