# app/repositories.py
from typing import Optional, List
import datetime
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Recruiter, Email, EmailTracking, EmailStatus, EmailType, User, ContactList
from app.importers.base import RecruiterData

class RecruiterRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str, user_id: int) -> Optional[Recruiter]:
        result = await self.session.execute(
            select(Recruiter).where(Recruiter.email == email, Recruiter.user_id == user_id)
        )
        return result.scalars().first()

    async def get_all(self, user_id: int) -> List[Recruiter]:
        result = await self.session.execute(
            select(Recruiter).where(Recruiter.user_id == user_id).order_by(Recruiter.created_at.desc())
        )
        return result.scalars().all()

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

    async def get_unopened_emails(self, cutoff_date: datetime.datetime, user_id: int) -> List[Email]:
        result = await self.session.execute(
            select(Email)
            .join(Email.recruiter)
            .where(
                Email.user_id == user_id,
                Email.is_opened == False,
                Email.status == EmailStatus.SENT,
                Email.created_at < cutoff_date,
                ~Email.recruiter_id.in_(
                    select(Email.recruiter_id)
                    .where(Email.email_type == EmailType.FOLLOW_UP, Email.user_id == user_id)
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

    async def get_by_recruiter(self, recruiter_id: int, user_id: int) -> List[Email]:
        result = await self.session.execute(
            select(Email)
            .where(Email.recruiter_id == recruiter_id, Email.user_id == user_id)
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

    async def get_tracking_events(self, email_id: int, user_id: int) -> List[EmailTracking]:
        result = await self.session.execute(
            select(EmailTracking)
            .where(EmailTracking.email_id == email_id, EmailTracking.user_id == user_id)
            .order_by(EmailTracking.opened_at.desc())
        )
        return result.scalars().all()


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Fetch a user by their integer primary key."""
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalars().first()

    async def get_by_google_id(self, google_id: str) -> Optional[User]:
        """Fetch a user by their Google OAuth subject ID."""
        result = await self.session.execute(
            select(User).where(User.google_id == google_id)
        )
        return result.scalars().first()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Fetch a user by email address."""
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalars().first()

    async def upsert(self, google_id: str, email: str, name: str,
                     avatar_url: Optional[str],
                     encrypted_refresh_token: Optional[str]) -> User:
        """Insert or update a user record after OAuth callback."""
        user = await self.get_by_google_id(google_id)
        if user is None:
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                avatar_url=avatar_url,
                gmail_refresh_token=encrypted_refresh_token,
            )
            self.session.add(user)
        else:
            user.email = email
            user.name = name
            user.avatar_url = avatar_url
            if encrypted_refresh_token is not None:
                user.gmail_refresh_token = encrypted_refresh_token
        await self.session.commit()
        await self.session.refresh(user)
        return user


class ContactRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_contact_list(
        self, user_id: int, name: str, source: str
    ) -> ContactList:
        contact_list = ContactList(user_id=user_id, name=name, source=source)
        self.session.add(contact_list)
        await self.session.flush()  # obtain PK without committing the transaction
        return contact_list

    async def bulk_create_recruiters(
        self, contact_list_id: int, user_id: int, contacts: list[RecruiterData]
    ) -> int:
        recruiters = [
            Recruiter(
                name=c.name,
                email=c.email,
                company=c.company,
                user_id=user_id,
                contact_list_id=contact_list_id,
            )
            for c in contacts
        ]
        self.session.add_all(recruiters)
        await self.session.commit()
        return len(recruiters)