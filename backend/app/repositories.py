# app/repositories.py
from typing import Optional, List
import datetime
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Recruiter, Email, EmailTracking, EmailStatus, EmailType

class RecruiterRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> Optional[Recruiter]:
        result = await self.session.execute(select(Recruiter).where(Recruiter.email == email))
        return result.scalars().first()

    async def add(self, recruiter: Recruiter) -> Recruiter:
        self.session.add(recruiter)
        await self.session.commit()
        await self.session.refresh(recruiter)
        return recruiter

class EmailRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, email: Email) -> Email:
        self.session.add(email)
        await self.session.commit()
        await self.session.refresh(email)
        return email

    async def update_status(self, email_id: int, status: EmailStatus) -> Optional[Email]:
        result = await self.session.execute(select(Email).where(Email.id == email_id))
        email_obj = result.scalars().first()
        if email_obj:
            email_obj.status = status
            await self.session.commit()
            return email_obj
        return None

    async def get_unopened_emails(self, cutoff_date: datetime.datetime) -> List[Email]:
        result = await self.session.execute(
            select(Email)
            .join(Email.recruiter)
            .where(
                Email.is_opened == False,
                Email.status == EmailStatus.SENT,
                Email.created_at < cutoff_date,
                ~Email.recruiter_id.in_(
                    select(Email.recruiter_id)
                    .where(Email.email_type == EmailType.FOLLOW_UP)
                )
            )
        )
        return result.scalars().all()

    async def update_opened_status(self, email_id: int, is_opened: bool = True) -> Optional[Email]:
        result = await self.session.execute(select(Email).where(Email.id == email_id))
        email_obj = result.scalars().first()
        if email_obj:
            email_obj.is_opened = is_opened
            await self.session.commit()
            return email_obj
        return None

    async def get_by_recruiter(self, recruiter_id: int) -> List[Email]:
        result = await self.session.execute(
            select(Email)
            .where(Email.recruiter_id == recruiter_id)
            .order_by(Email.created_at.desc())
        )
        return result.scalars().all()

class EmailTrackingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, tracking: EmailTracking) -> EmailTracking:
        self.session.add(tracking)
        await self.session.commit()
        await self.session.refresh(tracking)
        return tracking

    async def get_tracking_events(self, email_id: int) -> List[EmailTracking]:
        result = await self.session.execute(
            select(EmailTracking)
            .where(EmailTracking.email_id == email_id)
            .order_by(EmailTracking.opened_at.desc())
        )
        return result.scalars().all()