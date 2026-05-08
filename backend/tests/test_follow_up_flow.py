"""Tests for follow-up automation endpoint — KAN-25."""

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


def _make_campaign(id=1, user_id=1, follow_up_template_id=99, follow_up_days=5):
    c = MagicMock()
    c.id = id
    c.user_id = user_id
    c.follow_up_template_id = follow_up_template_id
    c.follow_up_days = follow_up_days
    return c


def _make_template(id=99, subject="FU", body_html="<p>FU</p>"):
    t = MagicMock()
    t.id = id
    t.subject = subject
    t.body_html = body_html
    return t


def _make_email(id=1, recruiter_id=5):
    e = MagicMock()
    e.id = id
    e.recruiter_id = recruiter_id
    return e


def _make_recruiter(id=5, email="r@example.com"):
    r = MagicMock()
    r.id = id
    r.email = email
    return r


def _make_follow_email(id=200, tracking_id="ft"):
    e = MagicMock()
    e.id = id
    e.tracking_id = tracking_id
    return e


def test_manual_follow_up_run_happy_path_returns_counts():
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
    ), patch(
        "app.routers.campaigns.decrypt_token", return_value="plaintext-refresh-token"
    ), patch(
        "app.services.follow_up_service.FollowUpService"
    ) as MockFollowSvc:
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
        email_repo.get_unopened_main_emails_for_campaign.return_value = [_make_email()]
        email_repo.has_follow_up_for_recruiter_campaign.return_value = False
        recruiter_repo.get_by_id.return_value = _make_recruiter()
        email_repo.create_for_campaign.return_value = _make_follow_email()
        user = MagicMock()
        user.resume_url = "resumes/1/resume.pdf"
        user.gmail_refresh_token = "encrypted-token"
        user_repo.get_by_id.return_value = user
        MockDownload.return_value = (b"%PDF-1.4...", "resume.pdf")

        follow_svc = AsyncMock()
        MockFollowSvc.return_value = follow_svc
        follow_svc.send_follow_ups.return_value = MagicMock(sent=1, failed=0)

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app)
        resp = client.post("/campaigns/1/follow-ups/run")

        app.dependency_overrides.clear()

    assert resp.status_code == 200
    data = resp.json()
    assert data["campaign_id"] == 1
    assert data["queued"] == 1
    assert data["sent"] == 1
    assert data["failed"] == 0
    assert follow_svc.send_follow_ups.await_args.kwargs["attachments"][0][0] == "resume.pdf"


def test_manual_follow_up_run_returns_400_when_missing_template():
    with patch("app.routers.campaigns.CampaignRepository") as MockCampaignRepo:
        campaign_repo = AsyncMock()
        MockCampaignRepo.return_value = campaign_repo
        campaign_repo.get_by_id.return_value = _make_campaign(follow_up_template_id=None)

        app.dependency_overrides[get_current_user_id] = _override_auth()
        app.dependency_overrides[get_session] = _override_session()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/campaigns/1/follow-ups/run")

        app.dependency_overrides.clear()

    assert resp.status_code == 400

