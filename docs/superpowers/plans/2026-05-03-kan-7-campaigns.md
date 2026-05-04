# Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Campaigns feature — users can create a campaign from a contact list + templates, preview it, send it via Gmail, and trigger follow-ups for unopened emails.

**Architecture:** New `campaigns` table links a contact list + main/follow-up templates. A campaigns router handles CRUD, preview, send, and follow-up endpoints. Sending uses the user's stored OAuth refresh token via a new `gmail_service.py`. The frontend gets a `CampaignsPage` with a list table and create/send/preview/delete actions.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Jinja2, google-api-python-client, React 19, MUI v6

**Worktree:** `.worktrees/feature/kan-7-campaigns` (all file paths relative to this root)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models.py` | Modify | Add `CampaignStatus` enum + `Campaign` model + `campaign_id` on `Email` |
| `backend/alembic/versions/0005_add_campaigns.py` | Create | Migration: `campaignstatus` enum, `campaigns` table, `emails.campaign_id` |
| `backend/app/services/gmail_service.py` | Create | `render_template`, `build_gmail_service`, `send_email` |
| `backend/tests/test_gmail_service.py` | Create | Unit tests for gmail_service |
| `backend/app/repositories.py` | Modify | Add `ContactRepository.get_all_lists`, `get_recruiters_by_list`, and `CampaignRepository` |
| `backend/tests/test_repositories.py` | Modify | Add tests for new repository methods |
| `backend/app/routers/contacts.py` | Modify | Add `GET /contact-lists` endpoint |
| `backend/tests/test_contacts_router.py` | Modify | Add test for `GET /contact-lists` |
| `backend/app/routers/campaigns.py` | Create | All 7 campaign endpoints |
| `backend/tests/test_campaigns_router.py` | Create | Tests for all campaign endpoints |
| `backend/app/main.py` | Modify | Register `campaigns.router` |
| `frontend/src/services/api.js` | Modify | Add `fetchContactLists`, 6 campaign API functions |
| `frontend/src/components/CampaignsPage.jsx` | Create | Campaigns list + create/send/preview/delete UI |
| `frontend/src/App.jsx` | Modify | Add Campaigns nav link + route |

---

## Task 1: Data model + migration

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/alembic/versions/0005_add_campaigns.py`

- [ ] **Step 1: Add `CampaignStatus` enum and `Campaign` model to `backend/app/models.py`**

Add after the `EmailStatus` class (around line 40):

```python
class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENDING = "SENDING"
    SENT = "SENT"
    FAILED = "FAILED"
```

Add after the `Template` class (after line 94):

```python
class Campaign(Base):
    __tablename__ = 'campaigns'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String(255), nullable=False)
    contact_list_id = Column(Integer, ForeignKey('contact_lists.id'), nullable=False)
    main_template_id = Column(Integer, ForeignKey('templates.id'), nullable=False)
    follow_up_template_id = Column(Integer, ForeignKey('templates.id'), nullable=True)
    status = Column(ENUM('DRAFT', 'SENDING', 'SENT', 'FAILED', name='campaignstatus', create_type=False), nullable=False, default='DRAFT')
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=get_pst_time)
    sent_at = Column(DateTime, nullable=True)
```

- [ ] **Step 2: Add `campaign_id` column to the `Email` model**

In the `Email` class, add before `recruiter = relationship(...)` (around line 81):

```python
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=True)
```

- [ ] **Step 3: Create the migration file `backend/alembic/versions/0005_add_campaigns.py`**

```python
"""add campaigns table and campaign_id to emails

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE campaignstatus AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED')")
    op.create_table(
        'campaigns',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('contact_list_id', sa.Integer(), nullable=False),
        sa.Column('main_template_id', sa.Integer(), nullable=False),
        sa.Column('follow_up_template_id', sa.Integer(), nullable=True),
        sa.Column('status', postgresql.ENUM('DRAFT', 'SENDING', 'SENT', 'FAILED', name='campaignstatus', create_type=False), nullable=False, server_default='DRAFT'),
        sa.Column('sent_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('failed_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_campaigns_user_id'),
        sa.ForeignKeyConstraint(['contact_list_id'], ['contact_lists.id'], name='fk_campaigns_contact_list_id'),
        sa.ForeignKeyConstraint(['main_template_id'], ['templates.id'], name='fk_campaigns_main_template_id'),
        sa.ForeignKeyConstraint(['follow_up_template_id'], ['templates.id'], name='fk_campaigns_fup_template_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('emails', sa.Column('campaign_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_emails_campaign_id', 'emails', 'campaigns', ['campaign_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_emails_campaign_id', 'emails', type_='foreignkey')
    op.drop_column('emails', 'campaign_id')
    op.drop_table('campaigns')
    op.execute("DROP TYPE campaignstatus")
```

- [ ] **Step 4: Run the migration**

```bash
cd backend
alembic upgrade head
```

Expected: `Running upgrade 0004 -> 0005` with no errors.

- [ ] **Step 5: Verify the model can be imported**

```bash
cd backend
python -c "from app.models import Campaign, CampaignStatus; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/alembic/versions/0005_add_campaigns.py
git commit -m "feat: add Campaign model and migration (KAN-23)"
```

---

## Task 2: Gmail service

**Files:**
- Create: `backend/app/services/gmail_service.py`
- Create: `backend/tests/test_gmail_service.py`

- [ ] **Step 1: Write the failing tests in `backend/tests/test_gmail_service.py`**

```python
"""Tests for gmail_service helpers."""
from unittest.mock import MagicMock
from googleapiclient.errors import HttpError


def test_render_template_substitutes_all_variables():
    from app.services.gmail_service import render_template
    html = "<p>Hi {{ recruiter_name }} from {{ company_name }}</p><img src='{{ tracking_pixel_url }}'>"
    result = render_template(html, "Alice", "Acme Corp", "https://track.example.com/px?id=1")
    assert "Alice" in result
    assert "Acme Corp" in result
    assert "https://track.example.com/px?id=1" in result
    assert "{{" not in result


def test_render_template_escapes_html_in_values():
    from app.services.gmail_service import render_template
    html = "Hello {{ recruiter_name }}"
    result = render_template(html, "<script>alert(1)</script>", "Co", "http://t.io")
    assert "<script>" not in result


def test_send_email_returns_true_on_success():
    from app.services.gmail_service import send_email
    service = MagicMock()
    service.users().messages().send().execute.return_value = {"id": "abc"}
    assert send_email(service, "to@example.com", "Subject", "<p>Body</p>") is True


def test_send_email_returns_false_on_http_error():
    from app.services.gmail_service import send_email
    service = MagicMock()
    resp = MagicMock()
    resp.status = 403
    resp.reason = "Forbidden"
    service.users().messages().send().execute.side_effect = HttpError(resp=resp, content=b"error")
    assert send_email(service, "to@example.com", "Subject", "<p>Body</p>") is False
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
python -m pytest tests/test_gmail_service.py -v
```

Expected: `ImportError: cannot import name 'render_template'` or similar — all 4 tests fail.

- [ ] **Step 3: Implement `backend/app/services/gmail_service.py`**

```python
import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from jinja2 import Environment, select_autoescape

from app.config import settings

logger = logging.getLogger(__name__)
_jinja_env = Environment(autoescape=select_autoescape(["html"]))


def render_template(body_html: str, recruiter_name: str, company_name: str, tracking_pixel_url: str) -> str:
    tpl = _jinja_env.from_string(body_html)
    return tpl.render(
        recruiter_name=recruiter_name,
        company_name=company_name,
        tracking_pixel_url=tracking_pixel_url,
    )


def build_gmail_service(refresh_token: str):
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    return build("gmail", "v1", credentials=creds)


def send_email(service, to: str, subject: str, body_html: str) -> bool:
    try:
        message = MIMEMultipart()
        message["to"] = to
        message["subject"] = subject
        message.attach(MIMEText(body_html, "html"))
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
        return True
    except HttpError as exc:
        logger.error("Gmail send error: %s", exc)
        return False
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend
python -m pytest tests/test_gmail_service.py -v
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/gmail_service.py backend/tests/test_gmail_service.py
git commit -m "feat: add gmail_service with render_template and send_email (KAN-24)"
```

---

## Task 3: Repository additions

**Files:**
- Modify: `backend/app/repositories.py`
- Modify: `backend/tests/test_repositories.py`

- [ ] **Step 1: Write the failing tests — append to `backend/tests/test_repositories.py`**

```python
# ── ContactRepository additions ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_contact_repository_get_recruiters_by_list():
    from app.repositories import ContactRepository

    mock_recruiter = MagicMock()
    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = [mock_recruiter]

    mock_session = AsyncMock()
    mock_session.execute.return_value = result_mock

    repo = ContactRepository(mock_session)
    recruiters = await repo.get_recruiters_by_list(contact_list_id=1, user_id=1)
    assert len(recruiters) == 1
    assert recruiters[0] is mock_recruiter


@pytest.mark.asyncio
async def test_contact_repository_get_all_lists_returns_dicts():
    from app.repositories import ContactRepository

    row = MagicMock()
    row.id = 1
    row.name = "My List"
    row.source = "TEXT_FILE"
    row.recruiter_count = 5

    result_mock = MagicMock()
    result_mock.all.return_value = [row]

    mock_session = AsyncMock()
    mock_session.execute.return_value = result_mock

    repo = ContactRepository(mock_session)
    lists = await repo.get_all_lists(user_id=1)
    assert len(lists) == 1
    assert lists[0] == {"id": 1, "name": "My List", "source": "TEXT_FILE", "recruiter_count": 5}


# ── CampaignRepository ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_campaign_repository_create():
    from app.repositories import CampaignRepository

    mock_session = AsyncMock()

    repo = CampaignRepository(mock_session)
    await repo.create(
        user_id=1,
        name="Test Campaign",
        contact_list_id=1,
        main_template_id=1,
        follow_up_template_id=None,
    )
    mock_session.add.assert_called_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_campaign_repository_delete_returns_false_if_not_found():
    from app.repositories import CampaignRepository

    result_mock = MagicMock()
    result_mock.scalars.return_value.first.return_value = None

    mock_session = AsyncMock()
    mock_session.execute.return_value = result_mock

    repo = CampaignRepository(mock_session)
    deleted = await repo.delete(999, user_id=1)
    assert deleted is False


@pytest.mark.asyncio
async def test_campaign_repository_update_returns_none_if_not_found():
    from app.repositories import CampaignRepository

    result_mock = MagicMock()
    result_mock.scalars.return_value.first.return_value = None

    mock_session = AsyncMock()
    mock_session.execute.return_value = result_mock

    repo = CampaignRepository(mock_session)
    result = await repo.update(999, user_id=1, status="SENT")
    assert result is None
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
python -m pytest tests/test_repositories.py -v -k "campaign or get_all_lists or get_recruiters"
```

Expected: `ImportError` or `AttributeError` — new tests fail.

- [ ] **Step 3: Add `get_all_lists` and `get_recruiters_by_list` to `ContactRepository` in `backend/app/repositories.py`**

Add these two methods inside the `ContactRepository` class, after `bulk_create_recruiters`:

```python
    async def get_all_lists(self, user_id: int) -> list[dict]:
        from sqlalchemy import func
        recruiter_count_sq = (
            select(Recruiter.contact_list_id, func.count(Recruiter.id).label("recruiter_count"))
            .where(Recruiter.user_id == user_id)
            .group_by(Recruiter.contact_list_id)
            .subquery()
        )
        result = await self.session.execute(
            select(
                ContactList.id,
                ContactList.name,
                ContactList.source,
                func.coalesce(recruiter_count_sq.c.recruiter_count, 0).label("recruiter_count"),
            )
            .outerjoin(recruiter_count_sq, ContactList.id == recruiter_count_sq.c.contact_list_id)
            .where(ContactList.user_id == user_id)
            .order_by(ContactList.created_at.desc())
        )
        return [
            {"id": row.id, "name": row.name, "source": row.source, "recruiter_count": int(row.recruiter_count)}
            for row in result.all()
        ]

    async def get_recruiters_by_list(self, contact_list_id: int, user_id: int) -> list:
        result = await self.session.execute(
            select(Recruiter)
            .where(Recruiter.contact_list_id == contact_list_id, Recruiter.user_id == user_id)
            .order_by(Recruiter.id)
        )
        return result.scalars().all()
```

- [ ] **Step 4: Add `CampaignRepository` to `backend/app/repositories.py`**

Add to the top import line — include `Campaign, CampaignStatus` in the models import:

```python
from app.models import Recruiter, Email, EmailTracking, EmailStatus, EmailType, User, ContactList, Template, Campaign, CampaignStatus
```

Add at the end of the file:

```python
class CampaignRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: int,
        name: str,
        contact_list_id: int,
        main_template_id: int,
        follow_up_template_id: Optional[int],
    ) -> Campaign:
        campaign = Campaign(
            user_id=user_id,
            name=name,
            contact_list_id=contact_list_id,
            main_template_id=main_template_id,
            follow_up_template_id=follow_up_template_id,
            status=CampaignStatus.DRAFT,
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
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend
python -m pytest tests/test_repositories.py -v
```

Expected: all repository tests pass (6 total now).

- [ ] **Step 6: Commit**

```bash
git add backend/app/repositories.py backend/tests/test_repositories.py
git commit -m "feat: add CampaignRepository and ContactRepository list methods (KAN-23)"
```

---

## Task 4: GET /contact-lists endpoint

**Files:**
- Modify: `backend/app/routers/contacts.py`
- Modify: `backend/tests/test_contacts_router.py`

- [ ] **Step 1: Write the failing test — append to `backend/tests/test_contacts_router.py`**

```python
# ── GET /contact-lists ────────────────────────────────────────────────────────

from app.services.auth_service import get_current_user, get_db as get_db_auth


def test_list_contact_lists_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/contact-lists").status_code == 401


def test_list_contact_lists_returns_list():
    with patch("app.routers.contacts.ContactRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_all_lists.return_value = [
            {"id": 1, "name": "My List", "source": "TEXT_FILE", "recruiter_count": 5}
        ]

        async def _user():
            u = MagicMock()
            u.id = 1
            return u

        async def _db():
            yield AsyncMock()

        app.dependency_overrides[get_current_user] = _user
        app.dependency_overrides[get_db_auth] = _db
        response = TestClient(app).get("/contact-lists")
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "My List"
    assert data[0]["recruiter_count"] == 5
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
python -m pytest tests/test_contacts_router.py::test_list_contact_lists_returns_list -v
```

Expected: FAIL — endpoint does not exist yet (404).

- [ ] **Step 3: Add the endpoint to `backend/app/routers/contacts.py`**

Add to the imports at the top of `contacts.py`:

```python
from app.services.auth_service import get_current_user, get_db as get_db_auth
from app.models import User
```

Add `ContactListOut` Pydantic model and the new endpoint at the end of `contacts.py`:

```python
class ContactListOut(BaseModel):
    id: int
    name: str
    source: str
    recruiter_count: int


@router.get("/contact-lists", response_model=list[ContactListOut])
async def list_contact_lists(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_auth),
):
    repo = ContactRepository(session)
    return await repo.get_all_lists(current_user.id)
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend
python -m pytest tests/test_contacts_router.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/contacts.py backend/tests/test_contacts_router.py
git commit -m "feat: add GET /contact-lists endpoint (KAN-37)"
```

---

## Task 5: Campaigns CRUD router

**Files:**
- Create: `backend/app/routers/campaigns.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_campaigns_router.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_campaigns_router.py`**

```python
"""Tests for campaigns router."""
import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.models import CampaignStatus
from app.services.auth_service import get_current_user, get_db


def _make_user(gmail_token=None):
    u = MagicMock()
    u.id = 1
    u.gmail_refresh_token = gmail_token
    u.follow_up_days = 3
    return u


def _make_campaign(status=CampaignStatus.DRAFT, follow_up_template_id=None):
    c = MagicMock()
    c.id = 1
    c.name = "Test Campaign"
    c.status = status
    c.contact_list_id = 1
    c.main_template_id = 1
    c.follow_up_template_id = follow_up_template_id
    c.sent_count = 0
    c.failed_count = 0
    c.created_at = datetime.datetime(2026, 5, 3, 10, 0, 0)
    c.sent_at = None
    return c


def _override_auth(user=None):
    if user is None:
        user = _make_user()
    async def _dep():
        return user
    return _dep


def _override_db():
    async def _dep():
        yield AsyncMock()
    return _dep


# ── Auth guard ────────────────────────────────────────────────────────────────

def test_list_campaigns_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/campaigns").status_code == 401


def test_create_campaign_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.post("/campaigns", json={}).status_code == 401


def test_delete_campaign_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    assert client.delete("/campaigns/1").status_code == 401


# ── List ──────────────────────────────────────────────────────────────────────

def test_list_campaigns_returns_list():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.mappings.return_value.all.return_value = []
    mock_session.execute.return_value = mock_result

    async def _db():
        yield mock_session

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _db
    response = TestClient(app).get("/campaigns")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == []


# ── Create ────────────────────────────────────────────────────────────────────

def test_create_campaign_returns_201():
    campaign = _make_campaign()

    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.create.return_value = campaign

        app.dependency_overrides[get_current_user] = _override_auth()
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app).post(
            "/campaigns",
            json={
                "name": "Test Campaign",
                "contact_list_id": 1,
                "main_template_id": 1,
                "follow_up_template_id": None,
            },
        )
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["status"] == "DRAFT"


# ── Delete ────────────────────────────────────────────────────────────────────

def test_delete_campaign_404_if_not_found():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = None

        app.dependency_overrides[get_current_user] = _override_auth()
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app, raise_server_exceptions=False).delete("/campaigns/999")
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_delete_campaign_409_if_not_draft():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = _make_campaign(status=CampaignStatus.SENT)

        app.dependency_overrides[get_current_user] = _override_auth()
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app, raise_server_exceptions=False).delete("/campaigns/1")
        app.dependency_overrides.clear()

    assert response.status_code == 409


def test_delete_campaign_204_on_success():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = _make_campaign(status=CampaignStatus.DRAFT)
        instance.delete.return_value = True

        app.dependency_overrides[get_current_user] = _override_auth()
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app).delete("/campaigns/1")
        app.dependency_overrides.clear()

    assert response.status_code == 204
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
python -m pytest tests/test_campaigns_router.py -v
```

Expected: all fail — router doesn't exist yet.

- [ ] **Step 3: Create `backend/app/routers/campaigns.py` with CRUD endpoints**

```python
"""Campaigns router — KAN-23/24/25/26/37."""
import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Campaign, CampaignStatus, ContactList, Email, EmailStatus, EmailType, Recruiter, User
)
from app.repositories import CampaignRepository, ContactRepository, EmailRepository, TemplateRepository
from app.services import gmail_service as gs
from app.services.auth_service import decrypt_token, get_current_user, get_db
from app.config import settings

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    contact_list_id: int
    main_template_id: int
    follow_up_template_id: Optional[int] = None


class CampaignOut(BaseModel):
    id: int
    name: str
    contact_list_id: int
    contact_list_name: str
    main_template_id: int
    follow_up_template_id: Optional[int]
    status: str
    sent_count: int
    failed_count: int
    created_at: datetime.datetime
    sent_at: Optional[datetime.datetime]

    model_config = {"from_attributes": True}


class CampaignSimple(BaseModel):
    id: int
    name: str
    status: str
    sent_count: int
    failed_count: int
    created_at: datetime.datetime
    sent_at: Optional[datetime.datetime]

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CampaignOut])
async def list_campaigns(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(
            Campaign.id,
            Campaign.name,
            Campaign.contact_list_id,
            ContactList.name.label("contact_list_name"),
            Campaign.main_template_id,
            Campaign.follow_up_template_id,
            Campaign.status,
            Campaign.sent_count,
            Campaign.failed_count,
            Campaign.created_at,
            Campaign.sent_at,
        )
        .join(ContactList, Campaign.contact_list_id == ContactList.id)
        .where(Campaign.user_id == current_user.id)
        .order_by(Campaign.created_at.desc())
    )
    return [CampaignOut(**dict(row._mapping)) for row in result.all()]


@router.post("", status_code=201, response_model=CampaignSimple)
async def create_campaign(
    body: CampaignCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    repo = CampaignRepository(session)
    campaign = await repo.create(
        user_id=current_user.id,
        name=body.name,
        contact_list_id=body.contact_list_id,
        main_template_id=body.main_template_id,
        follow_up_template_id=body.follow_up_template_id,
    )
    return campaign


@router.get("/{campaign_id}", response_model=CampaignSimple)
async def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    repo = CampaignRepository(session)
    campaign = await repo.get_by_id(campaign_id, current_user.id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    repo = CampaignRepository(session)
    campaign = await repo.get_by_id(campaign_id, current_user.id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Only DRAFT campaigns can be deleted")
    await repo.delete(campaign_id, current_user.id)
```

- [ ] **Step 4: Register the router in `backend/app/main.py`**

Change:
```python
from app.routers import auth, contacts, templates, analytics, users
```
To:
```python
from app.routers import auth, contacts, templates, analytics, users, campaigns
```

Add after `app.include_router(users.router)`:
```python
app.include_router(campaigns.router)
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend
python -m pytest tests/test_campaigns_router.py -v
```

Expected: all 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/campaigns.py backend/app/main.py backend/tests/test_campaigns_router.py
git commit -m "feat: add campaigns CRUD endpoints (KAN-23)"
```

---

## Task 6: Campaign preview, send, and send-followups endpoints

**Files:**
- Modify: `backend/app/routers/campaigns.py`
- Modify: `backend/tests/test_campaigns_router.py`

- [ ] **Step 1: Write failing tests — append to `backend/tests/test_campaigns_router.py`**

```python
# ── Preview ───────────────────────────────────────────────────────────────────

def test_preview_campaign_404_if_not_found():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = None

        app.dependency_overrides[get_current_user] = _override_auth()
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app, raise_server_exceptions=False).get("/campaigns/1/preview")
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_preview_campaign_returns_html():
    mock_template = MagicMock()
    mock_template.body_html = "<p>Hi {{ recruiter_name }} from {{ company_name }}</p>"

    mock_recruiter = MagicMock()
    mock_recruiter.name = "Jane Smith"
    mock_recruiter.company = "Google"

    with patch("app.routers.campaigns.CampaignRepository") as MockCampaign, \
         patch("app.routers.campaigns.TemplateRepository") as MockTemplate, \
         patch("app.routers.campaigns.ContactRepository") as MockContact:

        MockCampaign.return_value.get_by_id = AsyncMock(return_value=_make_campaign())
        MockTemplate.return_value.get_by_id = AsyncMock(return_value=mock_template)
        MockContact.return_value.get_recruiters_by_list = AsyncMock(return_value=[mock_recruiter])

        app.dependency_overrides[get_current_user] = _override_auth()
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app).get("/campaigns/1/preview")
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert "html" in data
    assert "Jane Smith" in data["html"]
    assert "Google" in data["html"]


# ── Send ──────────────────────────────────────────────────────────────────────

def test_send_campaign_409_if_not_draft():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = _make_campaign(status=CampaignStatus.SENT)

        app.dependency_overrides[get_current_user] = _override_auth(_make_user(gmail_token="tok"))
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app, raise_server_exceptions=False).post("/campaigns/1/send")
        app.dependency_overrides.clear()

    assert response.status_code == 409


def test_send_campaign_400_if_no_gmail():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = _make_campaign(status=CampaignStatus.DRAFT)

        app.dependency_overrides[get_current_user] = _override_auth(_make_user(gmail_token=None))
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app, raise_server_exceptions=False).post("/campaigns/1/send")
        app.dependency_overrides.clear()

    assert response.status_code == 400


# ── Send follow-ups ───────────────────────────────────────────────────────────

def test_send_followups_400_if_no_follow_up_template():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = _make_campaign(
            status=CampaignStatus.SENT, follow_up_template_id=None
        )

        app.dependency_overrides[get_current_user] = _override_auth(_make_user(gmail_token="tok"))
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app, raise_server_exceptions=False).post("/campaigns/1/send-followups")
        app.dependency_overrides.clear()

    assert response.status_code == 400


def test_send_followups_400_if_not_sent():
    with patch("app.routers.campaigns.CampaignRepository") as MockRepo:
        instance = AsyncMock()
        MockRepo.return_value = instance
        instance.get_by_id.return_value = _make_campaign(
            status=CampaignStatus.DRAFT, follow_up_template_id=2
        )

        app.dependency_overrides[get_current_user] = _override_auth(_make_user(gmail_token="tok"))
        app.dependency_overrides[get_db] = _override_db()
        response = TestClient(app, raise_server_exceptions=False).post("/campaigns/1/send-followups")
        app.dependency_overrides.clear()

    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
python -m pytest tests/test_campaigns_router.py -v -k "preview or send"
```

Expected: all 6 new tests fail — endpoints don't exist yet.

- [ ] **Step 3: Add preview, send, and send-followups endpoints to `backend/app/routers/campaigns.py`**

Add these imports at the top of `campaigns.py` (update existing imports):

```python
from datetime import timedelta
```

Append these three endpoint functions to `campaigns.py`:

```python
@router.get("/{campaign_id}/preview")
async def preview_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    repo = CampaignRepository(session)
    campaign = await repo.get_by_id(campaign_id, current_user.id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    template_repo = TemplateRepository(session)
    template = await template_repo.get_by_id(campaign.main_template_id, current_user.id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    contact_repo = ContactRepository(session)
    recruiters = await contact_repo.get_recruiters_by_list(campaign.contact_list_id, current_user.id)

    if recruiters:
        recruiter_name = recruiters[0].name
        company_name = recruiters[0].company
    else:
        recruiter_name = "Sample Recruiter"
        company_name = "Sample Company"

    html = gs.render_template(template.body_html, recruiter_name, company_name, "#preview")
    return {"html": html}


@router.post("/{campaign_id}/send")
async def send_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    repo = CampaignRepository(session)
    campaign = await repo.get_by_id(campaign_id, current_user.id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Campaign already sent or in progress")
    if not current_user.gmail_refresh_token:
        raise HTTPException(status_code=400, detail="Gmail not connected. Go to Settings to reconnect.")

    await repo.update(campaign_id, current_user.id, status=CampaignStatus.SENDING)

    try:
        refresh_token = decrypt_token(current_user.gmail_refresh_token)
        service = gs.build_gmail_service(refresh_token)

        template_repo = TemplateRepository(session)
        template = await template_repo.get_by_id(campaign.main_template_id, current_user.id)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")

        contact_repo = ContactRepository(session)
        recruiters = await contact_repo.get_recruiters_by_list(campaign.contact_list_id, current_user.id)

        email_repo = EmailRepository(session)
        sent = 0
        failed = 0

        for recruiter in recruiters:
            email_record = Email(
                user_id=current_user.id,
                recruiter_id=recruiter.id,
                campaign_id=campaign_id,
                email_type=EmailType.MAIN,
                subject=template.subject,
                status=EmailStatus.PENDING,
                tracking_id=str(uuid4()),
            )
            email_record = await email_repo.add(email_record)

            tracking_url = f"{settings.tracking_pixel_base_url}?email_id={email_record.id}"
            body = gs.render_template(
                template.body_html, recruiter.name, recruiter.company, tracking_url
            )
            success = gs.send_email(service, recruiter.email, template.subject, body)
            await email_repo.update_status(
                email_record.id, EmailStatus.SENT if success else EmailStatus.FAILED
            )
            if success:
                sent += 1
            else:
                failed += 1

        final_status = CampaignStatus.SENT if (sent > 0 or len(recruiters) == 0) else CampaignStatus.FAILED
        await repo.update(
            campaign_id, current_user.id,
            status=final_status,
            sent_count=sent,
            failed_count=failed,
            sent_at=datetime.datetime.utcnow(),
        )
        return {"sent": sent, "failed": failed}

    except Exception:
        await repo.update(campaign_id, current_user.id, status=CampaignStatus.DRAFT)
        raise


@router.post("/{campaign_id}/send-followups")
async def send_follow_ups(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    repo = CampaignRepository(session)
    campaign = await repo.get_by_id(campaign_id, current_user.id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.SENT:
        raise HTTPException(status_code=400, detail="Campaign must be SENT to send follow-ups")
    if campaign.follow_up_template_id is None:
        raise HTTPException(status_code=400, detail="Campaign has no follow-up template configured")
    if not current_user.gmail_refresh_token:
        raise HTTPException(status_code=400, detail="Gmail not connected")

    template_repo = TemplateRepository(session)
    follow_up_template = await template_repo.get_by_id(campaign.follow_up_template_id, current_user.id)
    if follow_up_template is None:
        raise HTTPException(status_code=404, detail="Follow-up template not found")

    cutoff = datetime.datetime.utcnow() - timedelta(days=current_user.follow_up_days or 3)

    already_sent_sq = (
        select(Email.recruiter_id)
        .where(
            Email.campaign_id == campaign_id,
            Email.email_type == EmailType.FOLLOW_UP,
            Email.user_id == current_user.id,
        )
    )

    result = await session.execute(
        select(Email).where(
            Email.campaign_id == campaign_id,
            Email.email_type == EmailType.MAIN,
            Email.status == EmailStatus.SENT,
            Email.is_opened == False,
            Email.created_at < cutoff,
            ~Email.recruiter_id.in_(already_sent_sq),
            Email.user_id == current_user.id,
        )
    )
    eligible_emails = result.scalars().all()

    if not eligible_emails:
        return {"sent": 0, "failed": 0}

    refresh_token = decrypt_token(current_user.gmail_refresh_token)
    service = gs.build_gmail_service(refresh_token)

    recruiter_ids = [e.recruiter_id for e in eligible_emails]
    r_result = await session.execute(
        select(Recruiter).where(Recruiter.id.in_(recruiter_ids))
    )
    recruiters_by_id = {r.id: r for r in r_result.scalars().all()}

    email_repo = EmailRepository(session)
    sent = 0
    failed = 0

    for main_email in eligible_emails:
        recruiter = recruiters_by_id.get(main_email.recruiter_id)
        if recruiter is None:
            failed += 1
            continue

        follow_up_record = Email(
            user_id=current_user.id,
            recruiter_id=recruiter.id,
            campaign_id=campaign_id,
            email_type=EmailType.FOLLOW_UP,
            subject=follow_up_template.subject,
            status=EmailStatus.PENDING,
            tracking_id=str(uuid4()),
        )
        follow_up_record = await email_repo.add(follow_up_record)

        tracking_url = f"{settings.tracking_pixel_base_url}?email_id={follow_up_record.id}"
        body = gs.render_template(
            follow_up_template.body_html, recruiter.name, recruiter.company, tracking_url
        )
        success = gs.send_email(service, recruiter.email, follow_up_template.subject, body)
        await email_repo.update_status(
            follow_up_record.id, EmailStatus.SENT if success else EmailStatus.FAILED
        )
        if success:
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed}
```

- [ ] **Step 4: Run all campaign tests**

```bash
cd backend
python -m pytest tests/test_campaigns_router.py -v
```

Expected: all 14 tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd backend
python -m pytest tests/ -q
```

Expected: same 2 pre-existing failures (R2 env vars), all others pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/campaigns.py backend/tests/test_campaigns_router.py
git commit -m "feat: add campaign preview, send, and send-followups endpoints (KAN-24 KAN-25 KAN-26)"
```

---

## Task 7: Frontend — CampaignsPage

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/components/CampaignsPage.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add campaign API functions to `frontend/src/services/api.js`**

Append to the end of `frontend/src/services/api.js`:

```js
// ── Campaigns ──────────────────────────────────────────────────────────────

export const fetchContactLists = async () => {
  const response = await api.get("/contact-lists");
  return response.data;
};

export const listCampaigns = async () => {
  const response = await api.get("/campaigns");
  return response.data;
};

export const createCampaign = async (data) => {
  const response = await api.post("/campaigns", data);
  return response.data;
};

export const deleteCampaign = async (id) => {
  await api.delete(`/campaigns/${id}`);
};

export const previewCampaign = async (id) => {
  const response = await api.get(`/campaigns/${id}/preview`);
  return response.data;
};

export const sendCampaign = async (id) => {
  const response = await api.post(`/campaigns/${id}/send`);
  return response.data;
};

export const sendFollowUps = async (id) => {
  const response = await api.post(`/campaigns/${id}/send-followups`);
  return response.data;
};
```

- [ ] **Step 2: Create `frontend/src/components/CampaignsPage.jsx`**

```jsx
import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  listCampaigns,
  createCampaign,
  deleteCampaign,
  previewCampaign,
  sendCampaign,
  sendFollowUps,
  fetchContactLists,
} from "../services/api";
import { listTemplates } from "../services/api";

const STATUS_COLORS = {
  DRAFT: "default",
  SENDING: "warning",
  SENT: "success",
  FAILED: "error",
};

const EMPTY_FORM = {
  name: "",
  contact_list_id: "",
  main_template_id: "",
  follow_up_template_id: "",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [contactLists, setContactLists] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null); // { type, campaign }
  const [actionLoading, setActionLoading] = useState(false);

  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const showSnackbar = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });

  useEffect(() => {
    Promise.all([listCampaigns(), fetchContactLists(), listTemplates()])
      .then(([c, cl, t]) => {
        setCampaigns(c);
        setContactLists(cl);
        setTemplates(t);
      })
      .catch(() => setFetchError("Failed to load campaigns."))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.contact_list_id || !form.main_template_id) {
      showSnackbar("Name, contact list, and main template are required", "error");
      return;
    }
    setCreating(true);
    try {
      const campaign = await createCampaign({
        name: form.name,
        contact_list_id: Number(form.contact_list_id),
        main_template_id: Number(form.main_template_id),
        follow_up_template_id: form.follow_up_template_id ? Number(form.follow_up_template_id) : null,
      });
      setCampaigns((prev) => [campaign, ...prev]);
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      showSnackbar("Campaign created");
    } catch {
      showSnackbar("Failed to create campaign", "error");
    } finally {
      setCreating(false);
    }
  };

  const handlePreview = async (campaign) => {
    try {
      const data = await previewCampaign(campaign.id);
      setPreviewHtml(data.html);
      setPreviewOpen(true);
    } catch {
      showSnackbar("Failed to load preview", "error");
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, campaign } = confirmAction;
    setActionLoading(true);
    try {
      if (type === "send") {
        const result = await sendCampaign(campaign.id);
        showSnackbar(`Sent ${result.sent} emails (${result.failed} failed)`);
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === campaign.id
              ? { ...c, status: result.failed === 0 || result.sent > 0 ? "SENT" : "FAILED", sent_count: result.sent, failed_count: result.failed }
              : c
          )
        );
      } else if (type === "followup") {
        const result = await sendFollowUps(campaign.id);
        showSnackbar(`Sent ${result.sent} follow-ups (${result.failed} failed)`);
      } else if (type === "delete") {
        await deleteCampaign(campaign.id);
        setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
        showSnackbar("Campaign deleted");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Action failed";
      showSnackbar(msg, "error");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (fetchError) {
    return <Alert severity="error" sx={{ mt: 4 }}>{fetchError}</Alert>;
  }

  const mainTemplates = templates.filter((t) => t.type === "MAIN");
  const followUpTemplates = templates.filter((t) => t.type === "FOLLOW_UP");

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Campaigns</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>New Campaign</Button>
      </Box>

      {campaigns.length === 0 ? (
        <Alert severity="info">No campaigns yet. Create one to get started.</Alert>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Contact List</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Sent</TableCell>
              <TableCell>Failed</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.contact_list_name}</TableCell>
                <TableCell>
                  <Chip label={c.status} color={STATUS_COLORS[c.status] || "default"} size="small" />
                </TableCell>
                <TableCell>{c.sent_count}</TableCell>
                <TableCell>{c.failed_count}</TableCell>
                <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {c.status === "DRAFT" && (
                      <>
                        <Button size="small" variant="outlined" onClick={() => handlePreview(c)}>Preview</Button>
                        <Button size="small" variant="contained" onClick={() => setConfirmAction({ type: "send", campaign: c })}>Send</Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => setConfirmAction({ type: "delete", campaign: c })}>Delete</Button>
                      </>
                    )}
                    {c.status === "SENT" && c.follow_up_template_id && (
                      <Button size="small" variant="outlined" onClick={() => setConfirmAction({ type: "followup", campaign: c })}>
                        Send Follow-ups
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Campaign</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="Campaign Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Contact List</InputLabel>
            <Select
              value={form.contact_list_id}
              label="Contact List"
              onChange={(e) => setForm((f) => ({ ...f, contact_list_id: e.target.value }))}
            >
              {contactLists.map((cl) => (
                <MenuItem key={cl.id} value={cl.id}>{cl.name} ({cl.recruiter_count} contacts)</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Main Template</InputLabel>
            <Select
              value={form.main_template_id}
              label="Main Template"
              onChange={(e) => setForm((f) => ({ ...f, main_template_id: e.target.value }))}
            >
              {mainTemplates.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Follow-up Template (optional)</InputLabel>
            <Select
              value={form.follow_up_template_id}
              label="Follow-up Template (optional)"
              onChange={(e) => setForm((f) => ({ ...f, follow_up_template_id: e.target.value }))}
            >
              <MenuItem value="">None</MenuItem>
              {followUpTemplates.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm action dialog */}
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)}>
        <DialogTitle>
          {confirmAction?.type === "send" && "Send Campaign"}
          {confirmAction?.type === "followup" && "Send Follow-ups"}
          {confirmAction?.type === "delete" && "Delete Campaign"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction?.type === "send" &&
              `Send emails to all contacts in "${confirmAction.campaign.contact_list_name}"?`}
            {confirmAction?.type === "followup" &&
              "Send follow-up emails to contacts who haven't opened the initial email?"}
            {confirmAction?.type === "delete" &&
              `Delete campaign "${confirmAction?.campaign.name}"? This cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</Button>
          <Button
            variant="contained"
            color={confirmAction?.type === "delete" ? "error" : "primary"}
            onClick={handleConfirmAction}
            disabled={actionLoading}
          >
            {actionLoading ? "Working…" : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Email Preview</DialogTitle>
        <DialogContent>
          {previewHtml && (
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              style={{ width: "100%", height: 500, border: "none" }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
```

- [ ] **Step 3: Update `frontend/src/App.jsx`**

Add import at the top with the other component imports:
```js
import CampaignsPage from "./components/CampaignsPage";
```

In the `NAV_LINKS` array, add after the Templates entry:
```js
  { label: "Campaigns", path: "/campaigns" },
```

Inside the `RequireAuth` block, add the route:
```jsx
            <Route path="/campaigns" element={<CampaignsPage />} />
```

- [ ] **Step 4: Verify the frontend builds**

```bash
cd frontend
npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully` or `webpack compiled successfully` — no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.js frontend/src/components/CampaignsPage.jsx frontend/src/App.jsx
git commit -m "feat: add CampaignsPage with list, create, preview, send, and follow-ups (KAN-37)"
```

---

## Final: Push and open PR

- [ ] **Push the feature branch**

```bash
git push -u origin feature/kan-7-campaigns
```

- [ ] **Open PR**

```bash
gh pr create \
  --title "feat: Campaigns — create, send, preview, follow-ups (KAN-7)" \
  --body "$(cat <<'EOF'
## Summary
- Adds `campaigns` table and `campaign_id` on `emails` (migration 0005)
- New `gmail_service.py` using stored OAuth refresh token for sending
- `CampaignRepository` + `ContactRepository.get_all_lists/get_recruiters_by_list`
- 7 backend endpoints: CRUD, preview, send, send-followups
- `GET /contact-lists` endpoint for the create dialog
- `CampaignsPage` frontend with table, create dialog, preview iframe, send/delete/follow-up actions

## Test plan
- [ ] Run `pytest tests/` — expect 2 pre-existing R2 failures, all others pass
- [ ] Create a campaign in the UI — verify it appears as DRAFT
- [ ] Preview the campaign — verify email renders with first contact's name
- [ ] Send the campaign — verify emails are sent and status changes to SENT
- [ ] After N days, send follow-ups — verify only unopened emails receive them
- [ ] Delete a DRAFT campaign — verify it disappears

## Non-coding tasks
- Verify `TRACKING_PIXEL_BASE_URL` on Render is set to the deployed tracking endpoint URL

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
