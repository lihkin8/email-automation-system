import os
from dotenv import load_dotenv
from app.services.tracking_service import app
from app.database import engine
from app.models import Base

# Load environment variables
load_dotenv()

# Create database tables if they don't exist
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))