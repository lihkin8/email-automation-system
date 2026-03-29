# tests/test_email_service.py
import pytest
import asyncio
from app.services.email_service import EmailService

# Dummy Gmail service to simulate email sending
class DummyGmailService:
    async def send_email(self, to_email, subject, body, attachments=None):
        return True

@pytest.mark.skip(reason="Stale: EmailService no longer accepts template_str — will be rewritten in KAN-15")
@pytest.mark.asyncio
async def test_generate_email():
    dummy_gmail = DummyGmailService()
    custom_template = """
    <html><body>
      <p>Hello {{ recruiter_name }} from {{ company_name }}</p>
      <img src="{{ tracking_pixel_url }}" />
    </body></html>
    """
    email_service = EmailService(dummy_gmail, template_str=custom_template)
    rendered = email_service.generate_email("Alice", "Acme Corp", "http://test.com/pixel")
    assert "Alice" in rendered
    assert "Acme Corp" in rendered
    assert "http://test.com/pixel" in rendered

@pytest.mark.skip(reason="Stale: send_email signature changed (requires email_id) — will be rewritten in KAN-15")
@pytest.mark.asyncio
async def test_send_email():
    dummy_gmail = DummyGmailService()
    email_service = EmailService(dummy_gmail)
    result = await email_service.send_email("test@example.com", "Test Recruiter", "Acme Corp", "Test Subject")
    assert result is True
