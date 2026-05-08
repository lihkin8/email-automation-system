# app/repositories.py
from typing import Optional, List
import datetime
import uuid
from sqlalchemy.future import select
from sqlalchemy import func, case, exists
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Recruiter, Email, EmailTracking, EmailStatus, EmailType, User, ContactList, Template, Campaign
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

    async def get_by_id(self, recruiter_id: int, user_id: int) -> Optional[Recruiter]:
        result = await self.session.execute(
            select(Recruiter).where(Recruiter.id == recruiter_id, Recruiter.user_id == user_id)
        )
        return result.scalars().first()

    async def add(self, recruiter: Recruiter) -> Recruiter:
        self.session.add(recruiter)
        await self.session.commit()
        await self.session.refresh(recruiter)
        return recruiter

    async def get_by_contact_list(self, contact_list_id: int, user_id: int) -> List[Recruiter]:
        result = await self.session.execute(
            select(Recruiter)
            .where(Recruiter.contact_list_id == contact_list_id, Recruiter.user_id == user_id)
            .order_by(Recruiter.created_at.desc())
        )
        return result.scalars().all()

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

    async def get_by_id(self, email_id: int) -> Optional[Email]:
        result = await self.session.execute(select(Email).where(Email.id == email_id))
        return result.scalars().first()

    async def get_by_tracking_id(self, tracking_id: str) -> Optional[Email]:
        result = await self.session.execute(select(Email).where(Email.tracking_id == tracking_id))
        return result.scalars().first()

    async def create_for_campaign(
        self,
        *,
        user_id: int,
        campaign_id: int,
        recruiter_id: int,
        subject: str,
        email_type: EmailType,
    ) -> Email:
        email = Email(
            user_id=user_id,
            campaign_id=campaign_id,
            recruiter_id=recruiter_id,
            subject=subject,
            email_type=email_type,
            status=EmailStatus.PENDING,
            tracking_id=str(uuid.uuid4()),
        )
        self.session.add(email)
        await self.session.commit()
        await self.session.refresh(email)
        return email

    async def get_unopened_main_emails_for_campaign(
        self,
        *,
        campaign_id: int,
        user_id: int,
        cutoff_date: datetime.datetime,
    ) -> List[Email]:
        result = await self.session.execute(
            select(Email)
            .where(
                Email.user_id == user_id,
                Email.campaign_id == campaign_id,
                Email.email_type == EmailType.MAIN,
                Email.status == EmailStatus.SENT,
                Email.is_opened == False,
                Email.created_at < cutoff_date,
            )
        )
        return result.scalars().all()

    async def has_follow_up_for_recruiter_campaign(
        self,
        *,
        user_id: int,
        campaign_id: int,
        recruiter_id: int,
    ) -> bool:
        result = await self.session.execute(
            select(Email.id).where(
                Email.user_id == user_id,
                Email.campaign_id == campaign_id,
                Email.recruiter_id == recruiter_id,
                Email.email_type == EmailType.FOLLOW_UP,
            )
        )
        return result.first() is not None

    async def get_campaign_main_sent_opened_counts(self, *, user_id: int, campaign_id: int) -> tuple[int, int]:
        stmt = select(
            func.count(Email.id).label("sent"),
            func.sum(case((Email.is_opened.is_(True), 1), else_=0)).label("opened"),
        ).where(
            Email.user_id == user_id,
            Email.campaign_id == campaign_id,
            Email.email_type == EmailType.MAIN,
            Email.status == EmailStatus.SENT,
        )
        row = (await self.session.execute(stmt)).one()
        sent = int(row.sent or 0)
        opened = int(row.opened or 0)
        return sent, opened

    async def list_campaign_unopened(
        self,
        *,
        user_id: int,
        campaign_id: int,
        cutoff_date: datetime.datetime | None,
        exclude_followed_up: bool,
    ) -> list[tuple[Recruiter, Email]]:
        from app.models import Recruiter

        stmt = (
            select(Recruiter, Email)
            .join(Email, Email.recruiter_id == Recruiter.id)
            .where(
                Recruiter.user_id == user_id,
                Email.user_id == user_id,
                Email.campaign_id == campaign_id,
                Email.email_type == EmailType.MAIN,
                Email.status == EmailStatus.SENT,
                Email.is_opened.is_(False),
            )
            .order_by(Email.created_at.asc())
        )
        if cutoff_date is not None:
            stmt = stmt.where(Email.created_at < cutoff_date)
        if exclude_followed_up:
            follow_up_exists = exists(
                select(Email.id).where(
                    Email.user_id == user_id,
                    Email.campaign_id == campaign_id,
                    Email.recruiter_id == Recruiter.id,
                    Email.email_type == EmailType.FOLLOW_UP,
                )
            )
            stmt = stmt.where(~follow_up_exists)
        rows = (await self.session.execute(stmt)).all()
        return [(r, e) for (r, e) in rows]

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

    async def add_open_event(
        self,
        user_id: int,
        email_id: int,
        user_agent: str | None,
        ip_address: str | None,
    ) -> EmailTracking:
        tracking = EmailTracking(
            user_id=user_id,
            email_id=email_id,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        self.session.add(tracking)
        await self.session.commit()
        await self.session.refresh(tracking)
        return tracking


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

    async def update_settings(self, user_id: int, **fields) -> Optional[User]:
        """Partial update: apply every key/value in fields to the user row, including None."""
        user = await self.get_by_id(user_id)
        if user is None:
            return None
        for key, value in fields.items():
            setattr(user, key, value)
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

    async def list_contact_lists(self, user_id: int) -> List[ContactList]:
        result = await self.session.execute(
            select(ContactList)
            .where(ContactList.user_id == user_id)
            .order_by(ContactList.created_at.desc())
        )
        return result.scalars().all()


class TemplateRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self, user_id: int, name: str, type: str,
        subject: str, body_html: str, variables: dict | None
    ) -> Template:
        template = Template(
            user_id=user_id,
            name=name,
            type=type,
            subject=subject,
            body_html=body_html,
            variables=variables,
        )
        self.session.add(template)
        await self.session.commit()
        await self.session.refresh(template)
        return template

    async def get_all(self, user_id: int) -> List[Template]:
        result = await self.session.execute(
            select(Template)
            .where(Template.user_id == user_id)
            .order_by(Template.created_at.desc())
        )
        return result.scalars().all()

    async def get_by_id(self, template_id: int, user_id: int) -> Optional[Template]:
        result = await self.session.execute(
            select(Template).where(Template.id == template_id, Template.user_id == user_id)
        )
        return result.scalars().first()

    async def update(self, template_id: int, user_id: int, **fields) -> Optional[Template]:
        template = await self.get_by_id(template_id, user_id)
        if template is None:
            return None
        for key, value in fields.items():
            if value is not None:
                setattr(template, key, value)
        await self.session.commit()
        await self.session.refresh(template)
        return template

    async def delete(self, template_id: int, user_id: int) -> bool:
        template = await self.get_by_id(template_id, user_id)
        if template is None:
            return False
        await self.session.delete(template)
        await self.session.commit()
        return True


class CampaignRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: int,
        name: str,
        template_id: int,
        contact_list_id: int,
        follow_up_template_id: int | None,
        follow_up_days: int,
        status: str,
    ) -> Campaign:
        campaign = Campaign(
            user_id=user_id,
            name=name,
            template_id=template_id,
            contact_list_id=contact_list_id,
            follow_up_template_id=follow_up_template_id,
            follow_up_days=follow_up_days,
            status=status,
        )
        self.session.add(campaign)
        await self.session.commit()
        await self.session.refresh(campaign)
        return campaign

    async def get_all(self, user_id: int) -> List[Campaign]:
        result = await self.session.execute(
            select(Campaign)
            .where(Campaign.user_id == user_id)
            .order_by(Campaign.created_at.desc())
        )
        return result.scalars().all()

    async def get_by_id(self, campaign_id: int, user_id: int) -> Optional[Campaign]:
        result = await self.session.execute(
            select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user_id)
        )
        return result.scalars().first()

    async def update(self, campaign_id: int, user_id: int, **fields) -> Optional[Campaign]:
        campaign = await self.get_by_id(campaign_id, user_id)
        if campaign is None:
            return None
        for key, value in fields.items():
            if value is not None:
                setattr(campaign, key, value)
        await self.session.commit()
        await self.session.refresh(campaign)
        return campaign

    async def delete(self, campaign_id: int, user_id: int) -> bool:
        campaign = await self.get_by_id(campaign_id, user_id)
        if campaign is None:
            return False
        await self.session.delete(campaign)
        await self.session.commit()
        return True