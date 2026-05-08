import asyncio
from dataclasses import dataclass

from app.config import settings
from app.models import EmailType
from app.services.email_service import GmailService


@dataclass(frozen=True)
class SendResult:
    sent: int
    failed: int


class CampaignSendService:
    """Minimal MVP sender for KAN-24.

    Uses GmailService to send already-rendered HTML.
    Throttles with an async sleep between sends.
    """

    def __init__(self, gmail_service: GmailService):
        self.gmail_service = gmail_service

    async def send_html_batch(
        self,
        items: list[tuple[str, str, str]],
        *,
        delay_seconds: float,
        attachments: list | None = None,
    ) -> SendResult:
        sent = 0
        failed = 0
        for to_email, subject, body_html in items:
            ok = await self.gmail_service.send_email(to_email, subject, body_html, attachments=attachments)
            if ok:
                sent += 1
            else:
                failed += 1
            if delay_seconds:
                await asyncio.sleep(delay_seconds)
        return SendResult(sent=sent, failed=failed)


def inject_tracking_pixel(body_html: str, *, pixel_url: str) -> str:
    # Keep it simple and robust: append at end of HTML.
    return f"{body_html}\n<div style=\"background-image:url('{pixel_url}')\"></div>"

