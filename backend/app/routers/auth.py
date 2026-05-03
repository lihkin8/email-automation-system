from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError

from app.config import settings
from app.models import User
from app.repositories import UserRepository
from app.services.auth_service import (
    create_jwt,
    encrypt_token,
    get_current_user,
    get_db,
)

router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",
    },
)

CALLBACK_URL = f"{settings.base_url}/auth/callback"


@router.get("/login")
async def login(request: Request):
    """Redirect the user to Google's OAuth consent screen."""
    return await oauth.google.authorize_redirect(
        request,
        CALLBACK_URL,
        access_type="offline",
        prompt="consent",
    )


@router.get("/callback")
async def callback(
    request: Request,
    session: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth callback: upsert user, issue JWT cookie, redirect to frontend."""
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        return RedirectResponse(url=f"{settings.frontend_url}/login", status_code=302)
    userinfo = token.get("userinfo") or await oauth.google.userinfo(token=token)

    google_id = userinfo["sub"]
    email = userinfo["email"]
    name = userinfo.get("name", email)
    avatar_url = userinfo.get("picture")

    refresh_token = token.get("refresh_token")
    encrypted_refresh_token = encrypt_token(refresh_token) if refresh_token else None

    repo = UserRepository(session)
    user = await repo.upsert(
        google_id=google_id,
        email=email,
        name=name,
        avatar_url=avatar_url,
        encrypted_refresh_token=encrypted_refresh_token,
    )

    jwt_token = create_jwt(user.id)
    redirect = RedirectResponse(url=settings.frontend_url, status_code=302)
    redirect.set_cookie(
        key="session_token",
        value=jwt_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 3600,
    )
    return redirect


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatar_url": current_user.avatar_url,
    }


@router.post("/logout")
async def logout():
    """Clear the session cookie."""
    response = Response(
        content='{"detail": "Logged out"}',
        media_type="application/json",
    )
    response.delete_cookie(key="session_token")
    return response
