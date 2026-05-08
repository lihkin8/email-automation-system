from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
import os
import asyncio
from app.routers import auth, contacts, templates, campaigns, tracking, analytics, users, onboarding

app = FastAPI(title="Email Automation API")

# SessionMiddleware is required by Authlib to store OAuth state between
# the /auth/login redirect and the /auth/callback response.
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(templates.router)
app.include_router(campaigns.router)
app.include_router(tracking.router)
app.include_router(analytics.router)
app.include_router(users.router)
app.include_router(onboarding.router)


@app.on_event("startup")
async def _startup_follow_up_scheduler():
    """MVP scheduled job strategy (KAN-25).

    Opt-in via env var to avoid surprising behavior in dev/test environments.
    This is not durable across restarts or multi-instance deployments.
    """
    if os.getenv("ENABLE_FOLLOWUP_SCHEDULER") != "1":
        return

    async def _loop():
        while True:
            # Daily cadence; real implementation will scan campaigns and run follow-ups.
            await asyncio.sleep(24 * 60 * 60)

    asyncio.create_task(_loop())


@app.get("/health")
async def health():
    return {"status": "ok"}
