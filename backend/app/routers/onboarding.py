from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user_id
from app.models import User, Template, ContactList, Campaign

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingStatusOut(BaseModel):
    gmail_connected: bool
    has_resume: bool
    has_template: bool
    has_contacts: bool
    has_campaign: bool


@router.get("/status", response_model=OnboardingStatusOut)
async def onboarding_status(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    user = (await session.execute(select(User).where(User.id == user_id))).scalars().first()

    gmail_connected = bool(getattr(user, "gmail_refresh_token", None))
    has_resume = bool(getattr(user, "resume_url", None))

    template_count = int(
        (await session.execute(select(func.count(Template.id)).where(Template.user_id == user_id))).scalar() or 0
    )
    contact_list_count = int(
        (await session.execute(select(func.count(ContactList.id)).where(ContactList.user_id == user_id))).scalar() or 0
    )
    campaign_count = int(
        (await session.execute(select(func.count(Campaign.id)).where(Campaign.user_id == user_id))).scalar() or 0
    )

    return OnboardingStatusOut(
        gmail_connected=gmail_connected,
        has_resume=has_resume,
        has_template=template_count > 0,
        has_contacts=contact_list_count > 0,
        has_campaign=campaign_count > 0,
    )

