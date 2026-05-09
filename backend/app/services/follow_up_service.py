from collections.abc import Awaitable, Callable

from app.services.email_service import GmailService
from app.services.campaign_send_service import SendItemResult


class FollowUpService:
    def __init__(self, gmail_service: GmailService):
        self.gmail_service = gmail_service

    async def send_follow_ups(
        self,
        *,
        items: list[tuple[str, str, str]],
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
                import asyncio

                await asyncio.sleep(delay_seconds)
        return results

