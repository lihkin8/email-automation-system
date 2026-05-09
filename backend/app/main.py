from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
import logging
import os
import asyncio
from app.routers import auth, contacts, templates, campaigns, tracking, analytics, users, onboarding

logger = logging.getLogger(__name__)

app = FastAPI(title="Email Automation API")

# SessionMiddleware is required by Authlib to store OAuth state between
# the /auth/login redirect and the /auth/callback response.
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)

_extra_origins = [
    origin.strip()
    for origin in os.getenv("CORS_EXTRA_ORIGINS", "").split(",")
    if origin.strip()
]
_allowed_origins = [settings.frontend_url, *_extra_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
            # Sleep first so the scheduler never fires immediately on startup.
            await asyncio.sleep(24 * 60 * 60)
            try:
                from app.database import async_session
                from app.repositories import CampaignRepository
                from app.services.scheduler_service import run_follow_ups_for_campaign

                async with async_session() as session:
                    campaign_repo = CampaignRepository(session)
                    campaign_ids = await campaign_repo.get_ids_with_follow_up_template()

                logger.info("Scheduler: found %d campaign(s) with follow-up templates", len(campaign_ids))

                for campaign_id in campaign_ids:
                    async with async_session() as session:
                        summary = await run_follow_ups_for_campaign(campaign_id, session)
                    if summary.get("skipped"):
                        logger.info(
                            "Scheduler: campaign %d skipped — %s",
                            campaign_id,
                            summary["skipped"],
                        )
                    elif summary.get("error"):
                        logger.error(
                            "Scheduler: campaign %d error — %s",
                            campaign_id,
                            summary["error"],
                        )
                    else:
                        logger.info(
                            "Scheduler: campaign %d — queued=%d sent=%d failed=%d",
                            campaign_id,
                            summary["queued"],
                            summary["sent"],
                            summary["failed"],
                        )
            except Exception as e:
                logger.error("Scheduler error: %s", e)

    asyncio.create_task(_loop())


@app.get("/health")
async def health():
    return {"status": "ok"}
