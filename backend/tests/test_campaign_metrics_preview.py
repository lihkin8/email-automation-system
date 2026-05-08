"""Tests for campaign preview + metrics endpoints — KAN-26/KAN-28."""

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


def _make_campaign(id=1, user_id=1, template_id=10, contact_list_id=20):
    c = MagicMock()
    c.id = id
    c.user_id = user_id
    c.template_id = template_id
    c.contact_list_id = contact_list_id
    return c


def _make_template(subject="Hi {{first_name}}", body_html="<p>Hello {{company}}</p>"):
    t = MagicMock()
    t.subject = subject
    t.body_html = body_html
    return t


def _make_recruiter(id=1, name="Jane Smith", email="jane@example.com", company="Acme"):
    r = MagicMock()
    r.id = id
    r.name = name
    r.email = email
    r.company = company
    return r


def test_campaign_metrics_returns_counts_and_rate():
    with patch("app.routers.campaigns.CampaignRepository") as MockCampaignRepo, patch(
        "app.routers.campaigns.EmailRepository"
    ) as MockEmailRepo:
        campaign_repo = AsyncMock()
        email_repo = AsyncMock()
        MockCampaignRepo.return_value = campaign_repo
        MockEmailRepo.return_value = email_repo

        campaign_repo.get_by_id.return_value = _make_campaign()
        email_repo.get_campaign_main_sent_opened_counts.return_value = (10, 4)

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.get("/campaigns/1/metrics")

        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert data["campaign_id"] == 1
    assert data["sent_main_count"] == 10
    assert data["opened_main_count"] == 4
    assert data["open_rate_pct"] == 40.0


def test_campaign_preview_renders_template_with_first_contact():
    with patch("app.routers.campaigns.CampaignRepository") as MockCampaignRepo, patch(
        "app.routers.campaigns.TemplateRepository"
    ) as MockTemplateRepo, patch(
        "app.routers.campaigns.RecruiterRepository"
    ) as MockRecruiterRepo, patch(
        "app.routers.campaigns.UserRepository"
    ) as MockUserRepo:
        campaign_repo = AsyncMock()
        template_repo = AsyncMock()
        recruiter_repo = AsyncMock()
        user_repo = AsyncMock()
        MockCampaignRepo.return_value = campaign_repo
        MockTemplateRepo.return_value = template_repo
        MockRecruiterRepo.return_value = recruiter_repo
        MockUserRepo.return_value = user_repo

        campaign_repo.get_by_id.return_value = _make_campaign()
        template_repo.get_by_id.return_value = _make_template()
        recruiter_repo.get_by_contact_list.return_value = [_make_recruiter(name="Jane Smith", company="Acme")]
        sender = MagicMock()
        sender.name = "Nikhil"
        user_repo.get_by_id.return_value = sender

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.get("/campaigns/1/preview")

        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert data["campaign_id"] == 1
    assert data["subject_rendered"] == "Hi Jane"
    assert "Acme" in data["body_html_rendered"]
    assert data["resolved_variables"]["first_name"] == "Jane"

