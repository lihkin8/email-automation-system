from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.models import User
from app.repositories import UserRepository
from app.services.auth_service import get_current_user, get_db
from app.services import storage

router = APIRouter(prefix="/users", tags=["users"])

_ALLOWED_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class SettingsResponse(BaseModel):
    email: str
    name: str
    avatar_url: Optional[str]
    resume_url: Optional[str]
    resume_filename: Optional[str]
    follow_up_days: int
    gmail_connected: bool


class UpdateSettingsRequest(BaseModel):
    follow_up_days: int = Field(..., ge=1, le=30)


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(current_user: User = Depends(get_current_user)):
    resume_url = None
    resume_filename = None
    if current_user.resume_url:
        key = current_user.resume_url
        resume_url = storage.get_presigned_url(key)
        resume_filename = key.split("/")[-1]
    return SettingsResponse(
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        resume_url=resume_url,
        resume_filename=resume_filename,
        follow_up_days=current_user.follow_up_days or 3,
        gmail_connected=current_user.gmail_refresh_token is not None,
    )


@router.patch("/settings")
async def update_settings(
    body: UpdateSettingsRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    repo = UserRepository(session)
    await repo.update_settings(current_user.id, follow_up_days=body.follow_up_days)
    return {"follow_up_days": body.follow_up_days}


@router.post("/resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF, DOC, and DOCX files are allowed")
    if current_user.resume_url:
        storage.delete_resume(current_user.resume_url)
    content = await file.read()
    key = storage.upload_resume(current_user.id, content, file.filename)
    repo = UserRepository(session)
    await repo.update_settings(current_user.id, resume_url=key)
    return {"resume_url": storage.get_presigned_url(key)}


@router.delete("/resume", status_code=204)
async def delete_resume(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if not current_user.resume_url:
        raise HTTPException(status_code=404, detail="No resume on file")
    storage.delete_resume(current_user.resume_url)
    repo = UserRepository(session)
    await repo.update_settings(current_user.id, resume_url=None)
