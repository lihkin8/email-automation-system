import asyncio
from dataclasses import dataclass
from collections.abc import Awaitable, Callable

from app.services.email_service import GmailService


@dataclass(frozen=True)
class SendItemResult:
    to_email: str
    ok: bool
    error_message: str | None = None


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
        on_progress: Callable[[int, SendItemResult], Awaitable[None]] | None = None,
    ) -> list[SendItemResult]:
        results: list[SendItemResult] = []
        for index, (to_email, subject, body_html) in enumerate(items):
            error_message = None
            try:
                ok = await self.gmail_service.send_email(to_email, subject, body_html, attachments=attachments)
            except Exception as exc:
                ok = False
                error_message = str(exc)

            item_result = SendItemResult(to_email=to_email, ok=bool(ok), error_message=error_message)
            results.append(item_result)
            if on_progress is not None:
                await on_progress(index, item_result)
            if delay_seconds:
                await asyncio.sleep(delay_seconds)
        return results


def inject_tracking_pixel(body_html: str, *, pixel_url: str) -> str:
    # Keep it simple and robust: append at end of HTML.
    return f'{body_html}\n<img src="{pixel_url}" width="1" height="1" alt="" style="display:none" />'

