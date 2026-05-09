"""Tracking router — KAN-27.

Implements open-tracking pixel endpoints.

- Spec endpoint:    GET /track/{user_id}/{tracking_id}.gif
- Compatibility:    GET /track/pixel?email_id={email_id}

These endpoints are intentionally unauthenticated (email clients call them),
but they validate ownership via DB lookups before writing tracking events.
"""

import datetime
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.repositories import EmailRepository, EmailTrackingRepository

router = APIRouter(prefix="/track", tags=["tracking"])


# 1x1 transparent GIF
_GIF_1X1_TRANSPARENT = (
    b"GIF89a"
    b"\x01\x00\x01\x00"  # width=1, height=1
    b"\x80"  # GCT follows for 2 colors
    b"\x00"  # background color index
    b"\x00"  # pixel aspect ratio
    b"\x00\x00\x00"  # color #0: black
    b"\xff\xff\xff"  # color #1: white
    b"!\xf9\x04\x01\x00\x00\x00\x00"  # graphics control extension
    b","  # image descriptor
    b"\x00\x00\x00\x00\x01\x00\x01\x00"  # position + size
    b"\x00"  # no local color table, no interlace
    b"\x02\x02D\x01\x00"  # image data
    b";"  # trailer
)

_GMAIL_PROXY_UA_RE = re.compile(r"googleimageproxy|ggpht|googleusercontent", re.IGNORECASE)


def _gif_response() -> Response:
    return Response(
        content=_GIF_1X1_TRANSPARENT,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
        },
    )


def _seconds_since_sent(sent_at: datetime.datetime | None, now: datetime.datetime) -> float | None:
    if sent_at is None:
        return None
    return (now - sent_at).total_seconds()


def _should_ignore_open(sent_at: datetime.datetime | None, user_agent: str | None) -> bool:
    seconds_since_sent = _seconds_since_sent(sent_at, datetime.datetime.now())
    if seconds_since_sent is None:
        return False
    if seconds_since_sent < settings.tracking_ignore_window_seconds:
        return True
    if user_agent and _GMAIL_PROXY_UA_RE.search(user_agent) and seconds_since_sent < 30:
        return True
    return False


@router.get("/{user_id}/{tracking_id}.gif")
async def track_open_gif(
    user_id: int,
    tracking_id: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    email_repo = EmailRepository(session)
    tracking_repo = EmailTrackingRepository(session)

    email_obj = await email_repo.get_by_tracking_id(tracking_id)
    if email_obj is None or int(email_obj.user_id) != int(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    user_agent = request.headers.get("user-agent")
    if not _should_ignore_open(getattr(email_obj, "sent_at", None), user_agent):
        await tracking_repo.add_open_event(
            user_id=int(email_obj.user_id),
            email_id=int(email_obj.id),
            user_agent=user_agent,
            ip_address=request.client.host if request.client else None,
        )
        await email_repo.update_opened_status(int(email_obj.id), True)
    return _gif_response()


@router.get("/pixel")
async def track_open_compat(
    email_id: int,
):
    """Deprecated compatibility endpoint for old pixel URLs."""
    return Response(
        status_code=status.HTTP_410_GONE,
        headers={"X-Deprecated": "use /track/{user_id}/{tracking_id}.gif"},
    )

