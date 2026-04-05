"""Templates router — KAN-19.

CRUD endpoints for email templates.
All endpoints require authentication and scope data to the authenticated user.

POST   /templates           — create a new template (201)
GET    /templates           — list all templates for the current user (200)
GET    /templates/{id}      — get a single template (200 / 404)
PUT    /templates/{id}      — update a template (200 / 404)
DELETE /templates/{id}      — delete a template (204 / 404)
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user_id
from app.repositories import TemplateRepository

router = APIRouter(prefix="/templates", tags=["templates"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    type: str  # 'MAIN' | 'FOLLOW_UP'
    subject: str
    body_html: str
    variables: dict | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    subject: str | None = None
    body_html: str | None = None
    variables: dict | None = None


class TemplateOut(BaseModel):
    id: int
    name: str
    type: str
    subject: str
    body_html: str
    variables: dict | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201, response_model=TemplateOut)
async def create_template(
    body: TemplateCreate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Create a new email template for the current user."""
    repo = TemplateRepository(session)
    template = await repo.create(
        user_id=user_id,
        name=body.name,
        type=body.type,
        subject=body.subject,
        body_html=body.body_html,
        variables=body.variables,
    )
    return template


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """List all templates belonging to the current user."""
    repo = TemplateRepository(session)
    return await repo.get_all(user_id)


@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Get a single template by ID. Returns 404 if not found or not owned by user."""
    repo = TemplateRepository(session)
    template = await repo.get_by_id(template_id, user_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: int,
    body: TemplateUpdate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Update a template. Returns 404 if not found or not owned by user."""
    repo = TemplateRepository(session)
    template = await repo.update(
        template_id,
        user_id,
        **body.model_dump(exclude_none=True),
    )
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Delete a template. Returns 404 if not found or not owned by user."""
    repo = TemplateRepository(session)
    deleted = await repo.delete(template_id, user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
