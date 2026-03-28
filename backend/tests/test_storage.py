# tests/test_storage.py
import os
from unittest.mock import patch


def test_settings_has_r2_fields():
    """Settings loads R2 config from environment variables."""
    env = {
        "NEON_DB_URL": "postgresql://test",
        "GMAIL_CREDENTIALS_PATH": "/tmp/creds.json",
        "TRACKING_PIXEL_BASE_URL": "http://localhost",
        "BASE_URL": "http://localhost",
        "R2_ACCOUNT_ID": "abc123",
        "R2_ACCESS_KEY_ID": "key123",
        "R2_SECRET_ACCESS_KEY": "secret123",
        "R2_BUCKET_NAME": "email-automation-resumes",
    }
    with patch.dict(os.environ, env, clear=True):
        from app.config import Settings
        s = Settings()
        assert s.r2_account_id == "abc123"
        assert s.r2_access_key_id == "key123"
        assert s.r2_secret_access_key == "secret123"
        assert s.r2_bucket_name == "email-automation-resumes"


def test_r2_client_is_configured():
    """storage.py exports a boto3 S3 client pointed at R2."""
    env = {
        "NEON_DB_URL": "postgresql://test",
        "GMAIL_CREDENTIALS_PATH": "/tmp/creds.json",
        "TRACKING_PIXEL_BASE_URL": "http://localhost",
        "BASE_URL": "http://localhost",
        "R2_ACCOUNT_ID": "abc123",
        "R2_ACCESS_KEY_ID": "key123",
        "R2_SECRET_ACCESS_KEY": "secret123",
        "R2_BUCKET_NAME": "email-automation-resumes",
    }
    with patch.dict(os.environ, env, clear=True):
        import importlib
        import app.config as config_module
        importlib.reload(config_module)

        import app.services.storage as storage_module
        importlib.reload(storage_module)

        client = storage_module.r2_client
        # boto3 S3 client stores endpoint in its meta
        endpoint = client.meta.endpoint_url
        assert endpoint == "https://abc123.r2.cloudflarestorage.com"
