"""Set required env vars before any app module is imported.

All Settings fields are required at instantiation time, so we set
dummy values here for fields that aren't exercised in tests.
"""
import os

os.environ.setdefault("NEON_DB_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("GMAIL_CREDENTIALS_PATH", "/tmp/creds.json")
os.environ.setdefault("TRACKING_PIXEL_BASE_URL", "http://localhost")
os.environ.setdefault("BASE_URL", "http://localhost")
os.environ.setdefault("R2_ACCOUNT_ID", "test")
os.environ.setdefault("R2_ACCESS_KEY_ID", "test")
os.environ.setdefault("R2_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("R2_BUCKET_NAME", "test")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("FERNET_KEY", "dGVzdC10ZXN0LXRlc3QtdGVzdC10ZXN0LXRlc3Q=")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
