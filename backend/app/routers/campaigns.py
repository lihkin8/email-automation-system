"""Campaigns router — KAN-23.

CRUD endpoints for campaigns.
All endpoints require authentication and scope data to the authenticated user.

POST   /campaigns           — create a new campaign (201)
GET    /campaigns           — list all campaigns for the current user (200)
GET    /campaigns/{id}      — get a single campaign (200 / 404)
PUT    /campaigns/{id}      — update a campaign (200 / 404)
DELETE /campaigns/{id}      — delete a campaign (204 / 404)
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.dependencies import get_current_user_id
from app.repositories import CampaignRepository, RecruiterRepository, TemplateRepository, EmailRepository, UserRepository
from app.models import EmailType, EmailStatus
from app.services.email_service import GmailService
from app.services.campaign_send_service import CampaignSendService, SendItemResult, inject_tracking_pixel
from app.services.template_render import build_recruiter_context, render_template_string
from app.services import storage
from app.services.auth_service import decrypt_token

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    template_id: int
    contact_list_id: int
    follow_up_template_id: int | None = None
    follow_up_days: int = 5
    status: str = "DRAFT"  # 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED'


class CampaignUpdate(BaseModel):
    name: str | None = None
    template_id: int | None = None
    contact_list_id: int | None = None
    follow_up_template_id: int | None = None
    follow_up_days: int | None = None
    status: str | None = None


class CampaignOut(BaseModel):
    id: int
    name: str
    template_id: int
    contact_list_id: int
    follow_up_template_id: int | None
    follow_up_days: int
    status: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}

class SendResponse(BaseModel):
    campaign_id: int
    sent: int
    failed: int


class SendProgressOut(BaseModel):
    campaign_id: int
    status: str
    total: int
    pending: int
    sent: int
    failed: int


class FollowUpRunResponse(BaseModel):
    campaign_id: int
    queued: int
    sent: int
    failed: int

class CampaignMetricsOut(BaseModel):
    campaign_id: int
    sent_main_count: int
    opened_main_count: int
    open_rate_pct: float


class UnopenedContactOut(BaseModel):
    recruiter_id: int
    recruiter_name: str
    recruiter_email: str
    company: str
    email_id: int
    sent_date: datetime.datetime


class ContactOpenEventOut(BaseModel):
    opened_at: datetime.datetime
    user_agent: str | None
    ip_address: str | None


class ContactEmailOpenHistoryOut(BaseModel):
    email_id: int
    email_type: str
    status: str
    is_opened: bool
    sent_date: datetime.datetime
    opens: list[ContactOpenEventOut]


class CampaignPreviewOut(BaseModel):
    campaign_id: int
    sample_contact: dict
    subject_rendered: str
    body_html_rendered: str
    resolved_variables: dict


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201, response_model=CampaignOut)
async def create_campaign(
    body: CampaignCreate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = CampaignRepository(session)
    campaign = await repo.create(
        user_id=user_id,
        name=body.name,
        template_id=body.template_id,
        contact_list_id=body.contact_list_id,
        follow_up_template_id=body.follow_up_template_id,
        follow_up_days=body.follow_up_days,
        status=body.status,
    )
    return campaign


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = CampaignRepository(session)
    return await repo.get_all(user_id)


@router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(
    campaign_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = CampaignRepository(session)
    campaign = await repo.get_by_id(campaign_id, user_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.put("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: int,
    body: CampaignUpdate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = CampaignRepository(session)
    campaign = await repo.update(
        campaign_id,
        user_id,
        **body.model_dump(exclude_none=True),
    )
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = CampaignRepository(session)
    deleted = await repo.delete(campaign_id, user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")


@router.post("/{campaign_id}/send", response_model=SendResponse)
async def send_campaign(
    campaign_id: int,
    delay_seconds: float = 2.0,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Send a campaign's MAIN emails sequentially with a small delay (MVP)."""
    campaign_repo = CampaignRepository(session)
    template_repo = TemplateRepository(session)
    recruiter_repo = RecruiterRepository(session)
    email_repo = EmailRepository(session)
    user_repo = UserRepository(session)

    campaign = await campaign_repo.get_by_id(campaign_id, user_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    await campaign_repo.update(campaign_id, user_id, status="RUNNING")

    template = await template_repo.get_by_id(campaign.template_id, user_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    recruiters = await recruiter_repo.get_by_contact_list(campaign.contact_list_id, user_id)

    user = await user_repo.get_by_id(user_id)
    if user is None or not user.gmail_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail is not connected. Please connect Gmail in Settings before sending.",
        )

    attachments = None
    if user.resume_url:
        content, filename = storage.download_resume(user.resume_url)
        mime_type = "application/pdf"
        attachments = [(filename, content, mime_type)]

    refresh_token = decrypt_token(user.gmail_refresh_token)
    gmail = GmailService.from_refresh_token(refresh_token)
    sender = CampaignSendService(gmail)

    items: list[tuple[str, str, str]] = []
    email_ids: list[int] = []
    for r in recruiters:
        ctx = build_recruiter_context(r, user)
        subject_rendered = render_template_string(template.subject, ctx)
        body_rendered = render_template_string(template.body_html, ctx)
        email_obj = await email_repo.create_for_campaign(
            user_id=user_id,
            campaign_id=campaign_id,
            recruiter_id=r.id,
            subject=subject_rendered,
            email_type=EmailType.MAIN,
        )
        pixel_url = f"{settings.base_url}/track/{user_id}/{email_obj.tracking_id}.gif"
        body_html = inject_tracking_pixel(body_rendered, pixel_url=pixel_url)
        items.append((r.email, subject_rendered, body_html))
        email_ids.append(email_obj.id)

    updated_email_ids: set[int] = set()

    async def on_progress(index: int, item_result: SendItemResult) -> None:
        if index >= len(email_ids):
            return
        email_id = email_ids[index]
        status_to_set = EmailStatus.SENT if item_result.ok else EmailStatus.FAILED
        await email_repo.update_status(email_id, status_to_set)
        updated_email_ids.add(email_id)

    results = await sender.send_html_batch(
        items,
        delay_seconds=delay_seconds,
        attachments=attachments,
        on_progress=on_progress,
    )

    # Some tests and alternate sender implementations may not invoke the optional
    # callback. Fill any gaps from the returned per-item results.
    for index, item_result in enumerate(results):
        if index >= len(email_ids):
            continue
        email_id = email_ids[index]
        if email_id in updated_email_ids:
            continue
        status_to_set = EmailStatus.SENT if item_result.ok else EmailStatus.FAILED
        await email_repo.update_status(email_id, status_to_set)

    sent = sum(1 for item_result in results if item_result.ok)
    failed = len(results) - sent

    await campaign_repo.update(campaign_id, user_id, status="COMPLETED")
    return SendResponse(campaign_id=campaign_id, sent=sent, failed=failed)


@router.get("/{campaign_id}/send-progress", response_model=SendProgressOut)
async def send_progress(
    campaign_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    campaign_repo = CampaignRepository(session)
    email_repo = EmailRepository(session)

    campaign = await campaign_repo.get_by_id(campaign_id, user_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    counts = await email_repo.get_campaign_status_counts(
        user_id=user_id,
        campaign_id=campaign_id,
        email_type=EmailType.MAIN,
    )
    pending = int(counts.get(EmailStatus.PENDING, counts.get("PENDING", 0)) or 0)
    sent = int(counts.get(EmailStatus.SENT, counts.get("SENT", 0)) or 0)
    failed = int(counts.get(EmailStatus.FAILED, counts.get("FAILED", 0)) or 0)
    return SendProgressOut(
        campaign_id=campaign_id,
        status=str(campaign.status),
        total=pending + sent + failed,
        pending=pending,
        sent=sent,
        failed=failed,
    )


@router.post("/{campaign_id}/follow-ups/run", response_model=FollowUpRunResponse)
async def run_follow_ups(
    campaign_id: int,
    delay_seconds: float = 2.0,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Manual trigger for follow-ups (KAN-25 MVP)."""
    from app.services.follow_up_service import FollowUpService

    campaign_repo = CampaignRepository(session)
    template_repo = TemplateRepository(session)
    recruiter_repo = RecruiterRepository(session)
    email_repo = EmailRepository(session)
    user_repo = UserRepository(session)

    campaign = await campaign_repo.get_by_id(campaign_id, user_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if not campaign.follow_up_template_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Follow-up template not configured",
        )

    follow_up_template = await template_repo.get_by_id(campaign.follow_up_template_id, user_id)
    if follow_up_template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    cutoff = datetime.datetime.now() - datetime.timedelta(days=int(campaign.follow_up_days))
    candidates = await email_repo.get_unopened_main_emails_for_campaign(
        campaign_id=campaign_id,
        user_id=user_id,
        cutoff_date=cutoff,
    )

    user = await user_repo.get_by_id(user_id)
    if user is None or not user.gmail_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail is not connected. Please connect Gmail in Settings before sending follow-ups.",
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

    for index, item_result in enumerate(results):
        if index >= len(follow_up_email_ids):
            continue
        email_id = follow_up_email_ids[index]
        if email_id in updated_email_ids:
            continue
        status_to_set = EmailStatus.SENT if item_result.ok else EmailStatus.FAILED
        await email_repo.update_status(email_id, status_to_set)

    sent = sum(1 for item_result in results if item_result.ok)
    failed = len(results) - sent

    return FollowUpRunResponse(
        campaign_id=campaign_id,
        queued=len(follow_up_email_ids),
        sent=sent,
        failed=failed,
    )


@router.get("/{campaign_id}/metrics", response_model=CampaignMetricsOut)
async def campaign_metrics(
    campaign_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    campaign_repo = CampaignRepository(session)
    email_repo = EmailRepository(session)

    campaign = await campaign_repo.get_by_id(campaign_id, user_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    sent, opened = await email_repo.get_campaign_main_sent_opened_counts(user_id=user_id, campaign_id=campaign_id)
    open_rate_pct = (opened / sent * 100.0) if sent else 0.0
    return CampaignMetricsOut(
        campaign_id=campaign_id,
        sent_main_count=sent,
        opened_main_count=opened,
        open_rate_pct=open_rate_pct,
    )


@router.get("/{campaign_id}/unopened", response_model=list[UnopenedContactOut])
async def campaign_unopened(
    campaign_id: int,
    cutoff_days: int | None = None,
    exclude_followed_up: bool = False,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    campaign_repo = CampaignRepository(session)
    email_repo = EmailRepository(session)

    campaign = await campaign_repo.get_by_id(campaign_id, user_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    cutoff_date = None
    if cutoff_days is not None:
        cutoff_date = datetime.datetime.now() - datetime.timedelta(days=int(cutoff_days))

    rows = await email_repo.list_campaign_unopened(
        user_id=user_id,
        campaign_id=campaign_id,
        cutoff_date=cutoff_date,
        exclude_followed_up=exclude_followed_up,
    )
    return [
        UnopenedContactOut(
            recruiter_id=r.id,
            recruiter_name=r.name,
            recruiter_email=r.email,
            company=r.company,
            email_id=e.id,
            sent_date=e.created_at,
        )
        for (r, e) in rows
    ]


@router.get("/{campaign_id}/contacts/{recruiter_id}/opens", response_model=list[ContactEmailOpenHistoryOut])
async def campaign_contact_opens(
    campaign_id: int,
    recruiter_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    campaign_repo = CampaignRepository(session)
    recruiter_repo = RecruiterRepository(session)
    email_repo = EmailRepository(session)

    campaign = await campaign_repo.get_by_id(campaign_id, user_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    recruiter = await recruiter_repo.get_by_id(recruiter_id, user_id)
    if recruiter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recruiter not found")

    # simplest MVP: reuse existing per-recruiter query (not campaign-filtered),
    # then filter in python (keeps changes minimal).
    emails = await email_repo.get_by_recruiter(recruiter_id, user_id)
    campaign_emails = [e for e in emails if int(getattr(e, "campaign_id", 0) or 0) == int(campaign_id)]
    out: list[ContactEmailOpenHistoryOut] = []
    for e in campaign_emails:
        opens = []
        for t in getattr(e, "tracking_events", []) or []:
            opens.append(
                ContactOpenEventOut(opened_at=t.opened_at, user_agent=t.user_agent, ip_address=t.ip_address)
            )
        out.append(
            ContactEmailOpenHistoryOut(
                email_id=e.id,
                email_type=str(e.email_type),
                status=str(e.status),
                is_opened=bool(e.is_opened),
                sent_date=e.created_at,
                opens=opens,
            )
        )
    return out


@router.get("/{campaign_id}/preview", response_model=CampaignPreviewOut)
async def campaign_preview(
    campaign_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    campaign_repo = CampaignRepository(session)
    template_repo = TemplateRepository(session)
    recruiter_repo = RecruiterRepository(session)
    user_repo = UserRepository(session)

    campaign = await campaign_repo.get_by_id(campaign_id, user_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    template = await template_repo.get_by_id(campaign.template_id, user_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    recruiters = await recruiter_repo.get_by_contact_list(campaign.contact_list_id, user_id)
    if not recruiters:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contact list is empty")
    sample = recruiters[0]

    user = await user_repo.get_by_id(user_id)
    resolved = build_recruiter_context(sample, user)
    subject_rendered = render_template_string(template.subject, resolved)
    body_html_rendered = render_template_string(template.body_html, resolved)
    return CampaignPreviewOut(
        campaign_id=campaign_id,
        sample_contact={"id": sample.id, "name": sample.name, "email": sample.email, "company": sample.company},
        subject_rendered=subject_rendered,
        body_html_rendered=body_html_rendered,
        resolved_variables=resolved,
    )

