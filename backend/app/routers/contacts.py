"""Contacts router — KAN-16.

Two-endpoint design (intentional):
  POST /contacts/upload  — parse only, returns preview data, does NOT write to DB
  POST /contacts         — saves the confirmed list to DB

The frontend holds parsed contacts in state between upload and confirm.
Do NOT collapse these into a single endpoint.
See design spec: docs/superpowers/specs/2026-04-04-kan-18-15-16-contact-import-design.md
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user_id
from app.importers.text_file import TextFileImporter
from app.repositories import ContactRepository, RecruiterRepository

router = APIRouter(prefix="/contacts", tags=["contacts"])


# ── Upload (parse only) ───────────────────────────────────────────────────────

class RecruiterOut(BaseModel):
    name: str
    email: str
    company: str


class UploadResponse(BaseModel):
    contacts: list[RecruiterOut]
    errors: list[str]


@router.post("/upload", response_model=UploadResponse)
async def upload_contacts(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """Parse an uploaded .txt contact file and return results for preview.

    Does NOT write to the database. The frontend shows the parsed contacts
    to the user; on confirm the client calls POST /contacts to save.
    """
    content = await file.read()
    importer = TextFileImporter()
    result = await importer.import_contacts(content)
    return UploadResponse(
        contacts=[
            RecruiterOut(name=c.name, email=c.email, company=c.company)
            for c in result.contacts
        ],
        errors=result.errors,
    )


# ── Confirm (save to DB) ──────────────────────────────────────────────────────

class RecruiterIn(BaseModel):
    name: str
    email: str
    company: str


class ConfirmImportRequest(BaseModel):
    list_name: str
    source: str  # 'TEXT_FILE' | 'APOLLO'
    contacts: list[RecruiterIn]


class ConfirmImportResponse(BaseModel):
    contact_list_id: int
    imported_count: int


class ContactListOut(BaseModel):
    id: int
    name: str
    source: str
    created_at: str | None = None


class RecruiterDetail(BaseModel):
    id: int
    name: str
    email: str
    company: str


class ContactListDetailOut(BaseModel):
    id: int
    name: str
    source: str
    created_at: str | None = None
    contacts: list[RecruiterDetail]


class RecruiterUpdate(BaseModel):
    id: int | None = None
    name: str
    email: str
    company: str


class UpdateListRequest(BaseModel):
    name: str
    contacts: list[RecruiterUpdate]


@router.post("", status_code=201, response_model=ConfirmImportResponse)
async def confirm_import(
    body: ConfirmImportRequest,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Save the confirmed contact list and recruiters to the database."""
    from app.importers.base import RecruiterData

    repo = ContactRepository(session)
    contact_list = await repo.create_contact_list(user_id, body.list_name, body.source)
    recruiter_data = [
        RecruiterData(name=c.name, email=c.email, company=c.company)
        for c in body.contacts
    ]
    count = await repo.bulk_create_recruiters(contact_list.id, user_id, recruiter_data)
    return ConfirmImportResponse(contact_list_id=contact_list.id, imported_count=count)


@router.get("/lists", response_model=list[ContactListOut])
async def list_contact_lists(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ContactRepository(session)
    lists = await repo.list_contact_lists(user_id)
    return [
        ContactListOut(
            id=l.id,
            name=l.name,
            source=l.source,
            created_at=(l.created_at.isoformat() if getattr(l, "created_at", None) else None),
        )
        for l in lists
    ]


@router.get("/lists/{list_id}", response_model=ContactListDetailOut)
async def get_contact_list(
    list_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ContactRepository(session)
    contact_list = await repo.get_by_id(list_id, user_id)
    if contact_list is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact list not found")
    recruiter_repo = RecruiterRepository(session)
    recruiters = await recruiter_repo.get_by_contact_list(list_id, user_id)
    return ContactListDetailOut(
        id=contact_list.id,
        name=contact_list.name,
        source=contact_list.source,
        created_at=(contact_list.created_at.isoformat() if getattr(contact_list, "created_at", None) else None),
        contacts=[
            RecruiterDetail(id=r.id, name=r.name, email=r.email, company=r.company)
            for r in recruiters
        ],
    )


@router.put("/lists/{list_id}", response_model=ContactListDetailOut)
async def update_contact_list(
    list_id: int,
    body: UpdateListRequest,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ContactRepository(session)
    updated = await repo.update_list(
        list_id,
        user_id,
        name=body.name,
        contacts=[c.model_dump() for c in body.contacts],
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact list not found")
    recruiter_repo = RecruiterRepository(session)
    recruiters = await recruiter_repo.get_by_contact_list(list_id, user_id)
    return ContactListDetailOut(
        id=updated.id,
        name=updated.name,
        source=updated.source,
        created_at=(updated.created_at.isoformat() if getattr(updated, "created_at", None) else None),
        contacts=[
            RecruiterDetail(id=r.id, name=r.name, email=r.email, company=r.company)
            for r in recruiters
        ],
    )


@router.delete("/lists/{list_id}", status_code=204)
async def delete_contact_list(
    list_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    repo = ContactRepository(session)
    contact_list = await repo.get_by_id(list_id, user_id)
    if contact_list is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact list not found")

    in_use = await repo.count_campaigns_using_list(list_id, user_id)
    if in_use > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete: list is in use by {in_use} campaign(s). Delete or reassign them first.",
        )

    await repo.delete_list(list_id, user_id)
