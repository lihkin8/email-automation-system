"""Contacts router — KAN-16.

Two-endpoint design (intentional):
  POST /contacts/upload  — parse only, returns preview data, does NOT write to DB
  POST /contacts         — saves the confirmed list to DB

The frontend holds parsed contacts in state between upload and confirm.
Do NOT collapse these into a single endpoint.
See design spec: docs/superpowers/specs/2026-04-04-kan-18-15-16-contact-import-design.md
"""
from fastapi import APIRouter, Depends, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user_id
from app.importers.text_file import TextFileImporter
from app.repositories import ContactRepository

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
