# tests/test_storage.py
import os
import pytest
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
        # Re-import to pick up patched env
        import importlib
        import app.config as config_module
        importlib.reload(config_module)
        s = config_module.Settings()
        assert s.r2_account_id == "abc123"
        assert s.r2_access_key_id == "key123"
        assert s.r2_secret_access_key == "secret123"
        assert s.r2_bucket_name == "email-automation-resumes"
