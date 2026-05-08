import datetime
from dataclasses import dataclass

from app.models import EmailType, EmailStatus
from app.services.email_service import GmailService
from app.services.campaign_send_service import inject_tracking_pixel
from app.config import settings


@dataclass(frozen=True)
class FollowUpResult:
    sent: int
    failed: int


class FollowUpService:
    def __init__(self, gmail_service: GmailService):
        self.gmail_service = gmail_service

    async def send_follow_ups(
        self,
        *,
        items: list[tuple[str, str, str]],
        delay_seconds: float,
        attachments: list | None = None,
    ) -> FollowUpResult:
        sent = 0
        failed = 0
        for to_email, subject, body_html in items:
            ok = await self.gmail_service.send_email(to_email, subject, body_html, attachments=attachments)
            if ok:
                sent += 1
            else:
                failed += 1
            if delay_seconds:
                import asyncio

                await asyncio.sleep(delay_seconds)
        return FollowUpResult(sent=sent, failed=failed)

