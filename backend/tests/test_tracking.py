# tests/test_tracking.py
from fastapi.testclient import TestClient
from app.services.tracking_service import app

client = TestClient(app)

def test_tracking_pixel_missing_email_id():
    response = client.get("/track/pixel")
    assert response.status_code == 400

def test_tracking_pixel_with_email_id(monkeypatch):
    # Monkeypatch the DB dependency to bypass the actual DB connection
    async def fake_get_db():
        from contextlib import asynccontextmanager
        @asynccontextmanager
        async def generator():
            yield None
        return generator()
    monkeypatch.setattr("app.services.tracking_service.get_db", fake_get_db)
    response = client.get("/track/pixel?email_id=1")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/gif"
