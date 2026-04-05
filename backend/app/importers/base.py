from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class RecruiterData:
    name: str
    email: str
    company: str


@dataclass
class ImportResult:
    contacts: list[RecruiterData]
    errors: list[str]  # e.g. ["Line 4: missing '-' separator"]


class ContactImporter(ABC):
    """Pluggable interface for importing recruiter contacts.

    V1: TextFileImporter (source=bytes from uploaded .txt file)
    V2: ApolloImporter  (source=str Apollo API key)

    Importers parse only — they never write to the DB.
    Persistence is handled by the endpoint layer (KAN-16).
    """

    @abstractmethod
    async def import_contacts(self, source: Any) -> ImportResult:
        ...
