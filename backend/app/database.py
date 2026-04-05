# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings
from urllib.parse import urlparse
from dotenv import load_dotenv
import os

load_dotenv()

# Parse the database URL
db_url = urlparse(settings.neon_db_url)

# Create an async engine with proper SSL configuration
engine = create_async_engine(
    f"postgresql+asyncpg://{db_url.username}:{db_url.password}@{db_url.hostname}{db_url.path}?ssl=require&prepared_statement_cache_size=0",
    echo=True,
    future=True
)

async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session