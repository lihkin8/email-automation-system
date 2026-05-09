# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    neon_db_url: str
    gmail_credentials_path: str
    tracking_pixel_base_url: str
    base_url: str
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket_name: str
    google_client_id: str
    google_client_secret: str
    jwt_secret: str
    fernet_key: str
    frontend_url: str = "http://localhost:3000"
    tracking_ignore_window_seconds: int = 10

    class Config:
        env_file = ".env"

settings = Settings()
