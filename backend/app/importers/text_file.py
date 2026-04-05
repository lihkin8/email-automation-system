from app.importers.base import ContactImporter, ImportResult, RecruiterData


class TextFileImporter(ContactImporter):
    """Parses a .txt file of recruiters in the format:

        Company Name:
        email@company.com - Full Name
        email2@company.com - Full Name 2

    Partial success: malformed lines produce an error entry;
    valid lines are still returned.
    """

    async def import_contacts(self, source: bytes) -> ImportResult:
        contacts: list[RecruiterData] = []
        errors: list[str] = []
        current_company: str | None = None

        text = source.decode("utf-8")
        for line_num, raw_line in enumerate(text.splitlines(), start=1):
            line = raw_line.strip()
            if not line:
                continue

            # Lines without '@' are company headers (e.g. "Google:" or "Google")
            if "@" not in line:
                current_company = line.rstrip(":").strip()
                continue

            # Lines with '@' should be "email - Name"
            try:
                email_part, name = line.rsplit("-", 1)
            except ValueError:
                errors.append(f"Line {line_num}: missing '-' separator")
                continue

            email = email_part.strip()
            name = name.strip()

            if not email or not name:
                errors.append(f"Line {line_num}: email or name is empty after parsing")
                continue

            contacts.append(
                RecruiterData(
                    name=name,
                    email=email,
                    company=current_company or "",
                )
            )

        return ImportResult(contacts=contacts, errors=errors)
