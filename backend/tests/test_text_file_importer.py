import pytest
from app.importers.text_file import TextFileImporter


@pytest.mark.asyncio
async def test_valid_file_parses_single_company():
    importer = TextFileImporter()
    content = b"Google:\nrecruiter@google.com - Jane Smith\n"
    result = await importer.import_contacts(content)

    assert len(result.contacts) == 1
    assert result.contacts[0].name == "Jane Smith"
    assert result.contacts[0].email == "recruiter@google.com"
    assert result.contacts[0].company == "Google"
    assert result.errors == []


@pytest.mark.asyncio
async def test_valid_file_parses_multiple_companies():
    importer = TextFileImporter()
    content = (
        b"Google:\n"
        b"jane@google.com - Jane Smith\n"
        b"bob@google.com - Bob Jones\n"
        b"\n"
        b"Meta:\n"
        b"alice@meta.com - Alice Brown\n"
    )
    result = await importer.import_contacts(content)

    assert len(result.contacts) == 3
    assert result.contacts[0].company == "Google"
    assert result.contacts[1].company == "Google"
    assert result.contacts[2].company == "Meta"
    assert result.errors == []


@pytest.mark.asyncio
async def test_malformed_line_without_separator_produces_error():
    importer = TextFileImporter()
    # "bad line no separator" has '@' but no '-'
    content = b"Google:\nbadline@google.com no separator\n"
    result = await importer.import_contacts(content)

    assert len(result.contacts) == 0
    assert len(result.errors) == 1
    assert "Line 2" in result.errors[0]
    assert "missing '-' separator" in result.errors[0]


@pytest.mark.asyncio
async def test_partial_success_valid_and_invalid_lines():
    importer = TextFileImporter()
    content = (
        b"Google:\n"
        b"good@google.com - Good Person\n"
        b"bad@google.com no separator\n"
        b"also@google.com - Also Good\n"
    )
    result = await importer.import_contacts(content)

    assert len(result.contacts) == 2
    assert len(result.errors) == 1
    assert result.contacts[0].email == "good@google.com"
    assert result.contacts[1].email == "also@google.com"


@pytest.mark.asyncio
async def test_email_with_hyphen_parses_correctly():
    """Email addresses containing hyphens should parse correctly via rsplit."""
    importer = TextFileImporter()
    content = b"Acme:\nfirst-last@acme-corp.com - First Last\n"
    result = await importer.import_contacts(content)

    assert len(result.contacts) == 1
    assert result.contacts[0].email == "first-last@acme-corp.com"
    assert result.contacts[0].name == "First Last"
    assert result.errors == []


@pytest.mark.asyncio
async def test_empty_file_returns_empty_result():
    importer = TextFileImporter()
    result = await importer.import_contacts(b"")

    assert result.contacts == []
    assert result.errors == []


@pytest.mark.asyncio
async def test_company_header_without_colon():
    """Company headers work with or without trailing colon."""
    importer = TextFileImporter()
    content = b"Stripe\nrecruiter@stripe.com - Pat Lee\n"
    result = await importer.import_contacts(content)

    assert result.contacts[0].company == "Stripe"
