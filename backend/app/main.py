from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Email Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to Vercel URL after KAN-45
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
