from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.routers import auth, contacts, templates

app = FastAPI(title="Email Automation API")

# SessionMiddleware is required by Authlib to store OAuth state between
# the /auth/login redirect and the /auth/callback response.
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to Vercel URL after KAN-45
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(templates.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
