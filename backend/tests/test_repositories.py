"""Tests for repository methods."""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_update_settings_sets_fields():
    from app.repositories import UserRepository

    mock_user = MagicMock()
    mock_user.id = 1
    mock_user.follow_up_days = 3
    mock_user.resume_url = None

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_user

    mock_session = AsyncMock()
    mock_session.execute.return_value = mock_result

    repo = UserRepository(mock_session)
    result = await repo.update_settings(1, follow_up_days=7)

    assert mock_user.follow_up_days == 7
    mock_session.commit.assert_awaited_once()
    mock_session.refresh.assert_awaited_once_with(mock_user)
    assert result is mock_user


@pytest.mark.asyncio
async def test_update_settings_allows_none_values():
    """None values must be applied (e.g., clearing resume_url)."""
    from app.repositories import UserRepository

    mock_user = MagicMock()
    mock_user.resume_url = "resumes/1/cv.pdf"

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_user

    mock_session = AsyncMock()
    mock_session.execute.return_value = mock_result

    repo = UserRepository(mock_session)
    await repo.update_settings(1, resume_url=None)

    assert mock_user.resume_url is None


@pytest.mark.asyncio
async def test_update_settings_returns_none_for_missing_user():
    from app.repositories import UserRepository

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None

    mock_session = AsyncMock()
    mock_session.execute.return_value = mock_result

    repo = UserRepository(mock_session)
    result = await repo.update_settings(999, follow_up_days=5)

    assert result is None


@pytest.mark.asyncio
async def test_campaign_delete_cascades_tracking_then_emails_then_campaign():
    """Regression for the 500 on DELETE /campaigns/{id}.

    The schema lacks ON DELETE CASCADE on emails.campaign_id and
    email_tracking.email_id, so the repository must remove dependents in
    order: tracking events, then emails, then the campaign itself.
    """
    from app.repositories import CampaignRepository
    from app.models import Email, EmailTracking, Campaign

    mock_campaign = MagicMock(spec=Campaign)
    mock_campaign.id = 2
    mock_campaign.user_id = 1

    get_result = MagicMock()
    get_result.scalars.return_value.first.return_value = mock_campaign

    email_ids_result = MagicMock()
    email_ids_result.all.return_value = [(100,), (101,)]

    delete_result = MagicMock()

    mock_session = AsyncMock()
    mock_session.execute.side_effect = [
        get_result,          # get_by_id select
        email_ids_result,    # select Email.id ...
        delete_result,       # delete EmailTracking
        delete_result,       # delete Email
    ]

    repo = CampaignRepository(mock_session)
    ok = await repo.delete(2, 1)

    assert ok is True

    executed = [call.args[0] for call in mock_session.execute.await_args_list]
    assert len(executed) == 4

    second = executed[1].compile(compile_kwargs={"literal_binds": True}).string.lower()
    assert "select" in second and "emails" in second

    third = executed[2].compile(compile_kwargs={"literal_binds": True}).string.lower()
    assert third.startswith("delete from email_tracking")

    fourth = executed[3].compile(compile_kwargs={"literal_binds": True}).string.lower()
    assert fourth.startswith("delete from emails")

    mock_session.delete.assert_awaited_once_with(mock_campaign)
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_campaign_delete_skips_dependent_deletes_when_no_emails():
    from app.repositories import CampaignRepository
    from app.models import Campaign

    mock_campaign = MagicMock(spec=Campaign)
    mock_campaign.id = 5
    mock_campaign.user_id = 1

    get_result = MagicMock()
    get_result.scalars.return_value.first.return_value = mock_campaign

    email_ids_result = MagicMock()
    email_ids_result.all.return_value = []

    mock_session = AsyncMock()
    mock_session.execute.side_effect = [get_result, email_ids_result]

    repo = CampaignRepository(mock_session)
    ok = await repo.delete(5, 1)

    assert ok is True
    assert mock_session.execute.await_count == 2  # no tracking/email deletes
    mock_session.delete.assert_awaited_once_with(mock_campaign)
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_campaign_delete_returns_false_for_missing_campaign():
    from app.repositories import CampaignRepository

    get_result = MagicMock()
    get_result.scalars.return_value.first.return_value = None

    mock_session = AsyncMock()
    mock_session.execute.return_value = get_result

    repo = CampaignRepository(mock_session)
    ok = await repo.delete(999, 1)

    assert ok is False
    mock_session.delete.assert_not_awaited()
    mock_session.commit.assert_not_awaited()


def test_email_and_tracking_fks_declare_cascade():
    """Schema-side guard for the long-term cascade fix (migration 0007).

    These ``ondelete='CASCADE'`` clauses keep ``Base.metadata.create_all``
    (used by tests/dev) consistent with the production migration so the DB
    handles ``DELETE FROM campaigns`` on its own.
    """
    from app.models import Email, EmailTracking

    email_campaign_fk = next(iter(Email.__table__.c.campaign_id.foreign_keys))
    assert email_campaign_fk.ondelete == "CASCADE"

    tracking_email_fk = next(iter(EmailTracking.__table__.c.email_id.foreign_keys))
    assert tracking_email_fk.ondelete == "CASCADE"
