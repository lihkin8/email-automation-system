"""Tests for scheduler_service.run_follow_ups_for_campaign — KAN-25."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.campaign_send_service import SendItemResult


# ---------------------------------------------------------------------------
# Helpers (mirrors style in test_follow_up_flow.py)
# ---------------------------------------------------------------------------

def _make_campaign(id=1, user_id=1, follow_up_template_id=99, follow_up_days=5):
    c = MagicMock()
    c.id = id
    c.user_id = user_id
    c.follow_up_template_id = follow_up_template_id
    c.follow_up_days = follow_up_days
    return c


def _make_template(id=99, subject="FU Subject", body_html="<p>Follow up</p>"):
    t = MagicMock()
    t.id = id
    t.subject = subject
    t.body_html = body_html
    return t


def _make_user(gmail_refresh_token="encrypted-token", resume_url=None):
    u = MagicMock()
    u.gmail_refresh_token = gmail_refresh_token
    u.resume_url = resume_url
    return u


def _make_main_email(id=10, recruiter_id=5):
    e = MagicMock()
    e.id = id
    e.recruiter_id = recruiter_id
    return e


def _make_recruiter(id=5, email="recruiter@example.com"):
    r = MagicMock()
    r.id = id
    r.email = email
    r.name = "Jane Recruiter"
    r.company = "Acme Corp"
    return r


def _make_follow_email(id=200, tracking_id="track-abc"):
    e = MagicMock()
    e.id = id
    e.tracking_id = tracking_id
    return e


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_follow_ups_for_campaign_skips_when_no_follow_up_template():
    """Campaign with follow_up_template_id=None should return skipped immediately."""
    from app.services.scheduler_service import run_follow_ups_for_campaign

    mock_session = AsyncMock()
    campaign = _make_campaign(follow_up_template_id=None)

    with patch("app.services.scheduler_service.CampaignRepository") as MockCampaignRepo:
        campaign_repo = AsyncMock()
        campaign_repo.get_by_id_system.return_value = campaign
        MockCampaignRepo.return_value = campaign_repo

        result = await run_follow_ups_for_campaign(campaign_id=1, session=mock_session)

    assert result["skipped"] == "no follow-up template"
    assert result["campaign_id"] == 1
    assert result["queued"] == 0
    assert result["sent"] == 0
    assert result["failed"] == 0


@pytest.mark.asyncio
async def test_run_follow_ups_for_campaign_skips_when_no_gmail_token():
    """Campaign whose owner has no gmail_refresh_token should return skipped."""
    from app.services.scheduler_service import run_follow_ups_for_campaign

    mock_session = AsyncMock()
    campaign = _make_campaign(follow_up_template_id=99)
    template = _make_template()
    user = _make_user(gmail_refresh_token=None)

    with patch("app.services.scheduler_service.CampaignRepository") as MockCampaignRepo, \
         patch("app.services.scheduler_service.TemplateRepository") as MockTemplateRepo, \
         patch("app.services.scheduler_service.UserRepository") as MockUserRepo:

        campaign_repo = AsyncMock()
        campaign_repo.get_by_id_system.return_value = campaign
        MockCampaignRepo.return_value = campaign_repo

        template_repo = AsyncMock()
        template_repo.get_by_id.return_value = template
        MockTemplateRepo.return_value = template_repo

        user_repo = AsyncMock()
        user_repo.get_by_id.return_value = user
        MockUserRepo.return_value = user_repo

        result = await run_follow_ups_for_campaign(campaign_id=1, session=mock_session)

    assert result["skipped"] == "no Gmail token"
    assert result["campaign_id"] == 1
    assert result["queued"] == 0
    assert result["sent"] == 0
    assert result["failed"] == 0


@pytest.mark.asyncio
async def test_run_follow_ups_for_campaign_returns_sent_and_failed_counts():
    """Happy path: one queued follow-up that sends successfully."""
    from app.services.scheduler_service import run_follow_ups_for_campaign

    mock_session = AsyncMock()
    campaign = _make_campaign(follow_up_template_id=99, follow_up_days=5)
    template = _make_template()
    user = _make_user(gmail_refresh_token="encrypted-token", resume_url=None)
    main_email = _make_main_email()
    recruiter = _make_recruiter()
    follow_email = _make_follow_email()

    with patch("app.services.scheduler_service.CampaignRepository") as MockCampaignRepo, \
         patch("app.services.scheduler_service.TemplateRepository") as MockTemplateRepo, \
         patch("app.services.scheduler_service.UserRepository") as MockUserRepo, \
         patch("app.services.scheduler_service.EmailRepository") as MockEmailRepo, \
         patch("app.services.scheduler_service.RecruiterRepository") as MockRecruiterRepo, \
         patch("app.services.scheduler_service.decrypt_token", return_value="plain-token"), \
         patch("app.services.scheduler_service.GmailService") as MockGmailSvc, \
         patch("app.services.scheduler_service.FollowUpService") as MockFollowSvc, \
         patch("app.services.scheduler_service.build_recruiter_context", return_value={}), \
         patch("app.services.scheduler_service.render_template_string", return_value="rendered"), \
         patch("app.services.scheduler_service.inject_tracking_pixel", return_value="<html>"):

        campaign_repo = AsyncMock()
        campaign_repo.get_by_id_system.return_value = campaign
        MockCampaignRepo.return_value = campaign_repo

        template_repo = AsyncMock()
        template_repo.get_by_id.return_value = template
        MockTemplateRepo.return_value = template_repo

        user_repo = AsyncMock()
        user_repo.get_by_id.return_value = user
        MockUserRepo.return_value = user_repo

        email_repo = AsyncMock()
        email_repo.get_unopened_main_emails_for_campaign.return_value = [main_email]
        email_repo.has_follow_up_for_recruiter_campaign.return_value = False
        email_repo.create_for_campaign.return_value = follow_email
        email_repo.update_status.return_value = None
        MockEmailRepo.return_value = email_repo

        recruiter_repo = AsyncMock()
        recruiter_repo.get_by_id.return_value = recruiter
        MockRecruiterRepo.return_value = recruiter_repo

        MockGmailSvc.from_refresh_token.return_value = MagicMock()

        follow_svc = AsyncMock()
        follow_svc.send_follow_ups.return_value = [
            SendItemResult(to_email="recruiter@example.com", ok=True)
        ]
        MockFollowSvc.return_value = follow_svc

        result = await run_follow_ups_for_campaign(campaign_id=1, session=mock_session)

    assert result["skipped"] is None
    assert result["campaign_id"] == 1
    assert result["queued"] == 1
    assert result["sent"] == 1
    assert result["failed"] == 0
    assert "error" not in result
