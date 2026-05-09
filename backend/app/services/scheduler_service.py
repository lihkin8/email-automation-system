"""Scheduler service — KAN-25.

Contains the reusable follow-up logic that is shared between the manual
endpoint (POST /campaigns/{id}/follow-ups/run) and the automated daily
scheduler started in main.py.
"""

import datetime
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories import (
    CampaignRepository,
    EmailRepository,
    RecruiterRepository,
    TemplateRepository,
    UserRepository,
)
from app.models import EmailType, EmailStatus
from app.services.auth_service import decrypt_token
from app.services.campaign_send_service import SendItemResult, inject_tracking_pixel
from app.services.email_service import GmailService
from app.services.follow_up_service import FollowUpService
from app.services.template_render import build_recruiter_context, render_template_string
from app.services import storage

logger = logging.getLogger(__name__)


async def run_follow_ups_for_campaign(
    campaign_id: int,
    session: AsyncSession,
    delay_seconds: float = 2.0,
) -> dict:
    """Run follow-ups for one campaign.

    Returns a summary dict with keys:
        campaign_id  — the campaign ID passed in
        skipped      — reason string if the campaign was skipped, else None
        queued       — number of follow-up emails queued for sending
        sent         — number successfully sent
        failed       — number that failed to send

    Never raises — all exceptions are caught and returned in the dict under
    the key ``error``.
    """
    base: dict = {"campaign_id": campaign_id, "skipped": None, "queued": 0, "sent": 0, "failed": 0}

    try:
        campaign_repo = CampaignRepository(session)
        template_repo = TemplateRepository(session)
        recruiter_repo = RecruiterRepository(session)
        email_repo = EmailRepository(session)
        user_repo = UserRepository(session)

        # Use a system-level fetch (no user_id filter) because the scheduler
        # has no authenticated user context.
        campaign = await campaign_repo.get_by_id_system(campaign_id)

        if campaign is None:
            base["skipped"] = "campaign not found"
            return base

        if not campaign.follow_up_template_id:
            base["skipped"] = "no follow-up template"
            return base

        user_id = campaign.user_id

        follow_up_template = await template_repo.get_by_id(campaign.follow_up_template_id, user_id)
        if follow_up_template is None:
            base["skipped"] = "follow-up template not found"
            return base

        user = await user_repo.get_by_id(user_id)
        if user is None or not user.gmail_refresh_token:
            base["skipped"] = "no Gmail token"
            return base

        cutoff = datetime.datetime.now() - datetime.timedelta(days=int(campaign.follow_up_days))
        candidates = await email_repo.get_unopened_main_emails_for_campaign(
            campaign_id=campaign_id,
            user_id=user_id,
            cutoff_date=cutoff,
        )

        attachments = None
        if user.resume_url:
            content, filename = storage.download_resume(user.resume_url)
            mime_type = "application/pdf"
            attachments = [(filename, content, mime_type)]

        refresh_token = decrypt_token(user.gmail_refresh_token)
        gmail = GmailService.from_refresh_token(refresh_token)
        svc = FollowUpService(gmail)

        items: list[tuple[str, str, str]] = []
        follow_up_email_ids: list[int] = []

        for main_email in candidates:
            already = await email_repo.has_follow_up_for_recruiter_campaign(
                user_id=user_id,
                campaign_id=campaign_id,
                recruiter_id=main_email.recruiter_id,
            )
            if already:
                continue

            recruiter = await recruiter_repo.get_by_id(main_email.recruiter_id, user_id)
            if recruiter is None:
                continue

            ctx = build_recruiter_context(recruiter, user)
            subject_rendered = render_template_string(follow_up_template.subject, ctx)
            body_rendered = render_template_string(follow_up_template.body_html, ctx)
            follow_email = await email_repo.create_for_campaign(
                user_id=user_id,
                campaign_id=campaign_id,
                recruiter_id=main_email.recruiter_id,
                subject=subject_rendered,
                email_type=EmailType.FOLLOW_UP,
            )
            pixel_url = f"{settings.base_url}/track/{user_id}/{follow_email.tracking_id}.gif"
            body_html = inject_tracking_pixel(body_rendered, pixel_url=pixel_url)
            items.append((recruiter.email, subject_rendered, body_html))
            follow_up_email_ids.append(follow_email.id)

        base["queued"] = len(follow_up_email_ids)

        updated_email_ids: set[int] = set()

        async def on_progress(index: int, item_result: SendItemResult) -> None:
            if index >= len(follow_up_email_ids):
                return
            email_id = follow_up_email_ids[index]
            status_to_set = EmailStatus.SENT if item_result.ok else EmailStatus.FAILED
            await email_repo.update_status(email_id, status_to_set)
            updated_email_ids.add(email_id)

        results = await svc.send_follow_ups(
            items=items,
            delay_seconds=delay_seconds,
            attachments=attachments,
            on_progress=on_progress,
        )

        # Fill any gaps where the callback was not invoked.
        for index, item_result in enumerate(results):
            if index >= len(follow_up_email_ids):
                continue
            email_id = follow_up_email_ids[index]
            if email_id in updated_email_ids:
                continue
            status_to_set = EmailStatus.SENT if item_result.ok else EmailStatus.FAILED
            await email_repo.update_status(email_id, status_to_set)

        base["sent"] = sum(1 for r in results if r.ok)
        base["failed"] = len(results) - base["sent"]

    except Exception as exc:  # noqa: BLE001
        logger.error("run_follow_ups_for_campaign(%d) error: %s", campaign_id, exc)
        base["error"] = str(exc)

    return base
