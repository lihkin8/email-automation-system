# tests/test_storage.py
import os
from unittest.mock import patch, MagicMock


def test_settings_has_r2_fields():
    """The Settings class can be instantiated with R2 config from environment variables."""
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


def test_upload_resume_calls_put_object():
    mock_client = MagicMock()
    with patch("app.services.storage.r2_client", mock_client), \
         patch("app.services.storage.settings") as mock_settings:
        mock_settings.r2_bucket_name = "test-bucket"
        from app.services.storage import upload_resume
        key = upload_resume(42, b"pdf bytes", "cv.pdf")

    assert key == "resumes/42/cv.pdf"
    mock_client.put_object.assert_called_once_with(
        Bucket="test-bucket", Key="resumes/42/cv.pdf", Body=b"pdf bytes"
    )


def test_delete_resume_calls_delete_object():
    mock_client = MagicMock()
    with patch("app.services.storage.r2_client", mock_client), \
         patch("app.services.storage.settings") as mock_settings:
        mock_settings.r2_bucket_name = "test-bucket"
        from app.services.storage import delete_resume
        delete_resume("resumes/42/cv.pdf")

    mock_client.delete_object.assert_called_once_with(
        Bucket="test-bucket", Key="resumes/42/cv.pdf"
    )


def test_get_presigned_url_calls_generate_presigned_url():
    mock_client = MagicMock()
    mock_client.generate_presigned_url.return_value = "https://r2.example.com/presigned"
    with patch("app.services.storage.r2_client", mock_client), \
         patch("app.services.storage.settings") as mock_settings:
        mock_settings.r2_bucket_name = "test-bucket"
        from app.services.storage import get_presigned_url
        url = get_presigned_url("resumes/42/cv.pdf")

    assert url == "https://r2.example.com/presigned"
    mock_client.generate_presigned_url.assert_called_once_with(
        "get_object",
        Params={"Bucket": "test-bucket", "Key": "resumes/42/cv.pdf"},
        ExpiresIn=3600,
    )
