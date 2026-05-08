"""Tests for campaign send flow endpoint — KAN-24."""

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


def _make_template(id=10, user_id=1, subject="Subj", body_html="<p>Hi</p>"):
    t = MagicMock()
    t.id = id
    t.user_id = user_id
    t.subject = subject
    t.body_html = body_html
    return t


def _make_recruiter(id=1, email="a@example.com"):
    r = MagicMock()
    r.id = id
    r.email = email
    return r


def _make_email(id=100, tracking_id="trk"):
    e = MagicMock()
    e.id = id
    e.tracking_id = tracking_id
    return e


def test_send_campaign_happy_path_marks_completed_and_returns_counts():
    with patch("app.routers.campaigns.CampaignRepository") as MockCampaignRepo, patch(
        "app.routers.campaigns.TemplateRepository"
    ) as MockTemplateRepo, patch(
        "app.routers.campaigns.RecruiterRepository"
    ) as MockRecruiterRepo, patch(
        "app.routers.campaigns.EmailRepository"
    ) as MockEmailRepo, patch(
        "app.routers.campaigns.UserRepository"
    ) as MockUserRepo, patch(
        "app.routers.campaigns.storage.download_resume"
    ) as MockDownload, patch(
        "app.routers.campaigns.GmailService"
    ) as MockGmail, patch(
        "app.routers.campaigns.decrypt_token", return_value="plaintext-refresh-token"
    ), patch(
        "app.routers.campaigns.CampaignSendService"
    ) as MockSendService:
        campaign_repo = AsyncMock()
        template_repo = AsyncMock()
        recruiter_repo = AsyncMock()
        email_repo = AsyncMock()
        user_repo = AsyncMock()

        MockCampaignRepo.return_value = campaign_repo
        MockTemplateRepo.return_value = template_repo
        MockRecruiterRepo.return_value = recruiter_repo
        MockEmailRepo.return_value = email_repo
        MockUserRepo.return_value = user_repo

        campaign_repo.get_by_id.return_value = _make_campaign()
        template_repo.get_by_id.return_value = _make_template()
        recruiter_repo.get_by_contact_list.return_value = [_make_recruiter(1), _make_recruiter(2)]
        email_repo.create_for_campaign.side_effect = [_make_email(100, "t1"), _make_email(101, "t2")]
        user = MagicMock()
        user.resume_url = "resumes/1/resume.pdf"
        user.gmail_refresh_token = "encrypted-token"
        user_repo.get_by_id.return_value = user
        MockDownload.return_value = (b"%PDF-1.4...", "resume.pdf")

        send_service = AsyncMock()
        MockSendService.return_value = send_service
        send_service.send_html_batch.return_value = MagicMock(sent=2, failed=0)

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.post("/campaigns/1/send")

        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert data["campaign_id"] == 1
    assert data["sent"] == 2
    assert data["failed"] == 0
    # Status transitions called
    assert campaign_repo.update.await_count >= 2
    # Attachments passed into sender
    assert send_service.send_html_batch.await_args.kwargs["attachments"][0][0] == "resume.pdf"


def test_send_campaign_returns_404_when_campaign_missing():
    with patch("app.routers.campaigns.CampaignRepository") as MockCampaignRepo:
        campaign_repo = AsyncMock()
        MockCampaignRepo.return_value = campaign_repo
        campaign_repo.get_by_id.return_value = None

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/campaigns/999/send")

        app.dependency_overrides.clear()

    assert resp.status_code == 404


def test_send_campaign_returns_400_when_gmail_not_connected():
    """User must connect Gmail (refresh token in DB) before campaigns can send."""
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
        recruiter_repo.get_by_contact_list.return_value = [_make_recruiter(1)]

        user = MagicMock()
        user.resume_url = None
        user.gmail_refresh_token = None
        user_repo.get_by_id.return_value = user

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.post("/campaigns/1/send")

        app.dependency_overrides.clear()

    assert resp.status_code == 400
    assert "Gmail" in resp.json()["detail"]

