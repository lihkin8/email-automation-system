# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    neon_db_url: str
    gmail_credentials_path: str
    tracking_pixel_base_url: str
    base_url: str

    class Config:
        env_file = ".env"

settings = Settings()
