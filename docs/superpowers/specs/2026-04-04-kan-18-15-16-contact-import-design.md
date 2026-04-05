# Contact Import — Design Spec
**Tickets:** KAN-18, KAN-15, KAN-16
**Date:** 2026-04-04
**Status:** Approved

---

## Context

Phase 2 Backend track. These three tickets form a complete vertical slice of contact import functionality and must be executed in order:

1. **KAN-18** — DB migration: `contact_lists` table + `user_id`/`contact_list_id` columns on `recruiters`
2. **KAN-15** — `ContactImporter` ABC + `TextFileImporter` implementation
3. **KAN-16** — `POST /contacts/upload` endpoint + `POST /contacts` confirm endpoint

The corresponding frontend ticket is **KAN-17** (contact list preview + confirm UI), owned by Dev 2.

---

## 1. Data Model (KAN-18)

### New migration: `0002_add_contact_lists.py`

**New table: `contact_lists`**
```sql
id          SERIAL PRIMARY KEY
user_id     INTEGER NOT NULL REFERENCES users(id)
name        VARCHAR(255) NOT NULL
source      VARCHAR(50) NOT NULL   -- 'TEXT_FILE' | 'APOLLO'
created_at  TIMESTAMPTZ DEFAULT NOW()
```

**Alter table: `recruiters`**
```sql
-- Add columns
user_id          INTEGER NOT NULL REFERENCES users(id)
contact_list_id  INTEGER NOT NULL REFERENCES contact_lists(id)

-- Drop unique constraint on email
-- Rationale: the same recruiter email can appear in multiple contact lists
-- across different users. The old single-user model had a global unique
-- constraint which no longer applies in a multi-user, multi-list design.
```

### SQLAlchemy models (additions to `models.py`)

- New `ContactList` model
- `Recruiter` updated: add `user_id`, `contact_list_id`, remove `unique=True` on `email`

---

## 2. ContactImporter Interface (KAN-15)

### File layout
```
backend/app/importers/
    __init__.py
    base.py        # ABC + data types
    text_file.py   # V1 implementation
```

### `base.py`
```python
@dataclass
class RecruiterData:
    name: str
    email: str
    company: str

@dataclass
class ImportResult:
    contacts: list[RecruiterData]
    errors: list[str]   # e.g. ["Line 4: missing '-' separator"]

class ContactImporter(ABC):
    @abstractmethod
    async def import_contacts(self, source: Any) -> ImportResult:
        ...
```

`RecruiterData` is a plain dataclass — intentionally separate from the `Recruiter` SQLAlchemy model. Importers parse only; they never touch the DB. Persistence is the responsibility of the endpoint layer.

### `text_file.py`
```python
class TextFileImporter(ContactImporter):
    async def import_contacts(self, source: bytes) -> ImportResult:
        ...
```

- `source` is raw file bytes from the HTTP upload (not a file path)
- Reuses the parsing logic from `backend/scripts/recruiter_parser.py`, fixed up:
  - Returns proper `RecruiterData` dataclasses instead of anonymous `type()` objects
  - Collects per-line errors instead of swallowing them
  - Handles blank lines and company header lines
- Partial success: malformed lines produce an error entry; valid lines are still returned

### V2 extension point
`ApolloImporter` will implement the same ABC with `source: str` (Apollo API key). No changes to the endpoint or any other layer.

---

## 3. Upload Endpoint (KAN-16)

### Design decision: single upload endpoint + separate confirm endpoint

The upload endpoint **parses only** — it does not write to the DB. The frontend holds the parsed result in state for the user to review (preview table). When the user confirms, a separate confirm endpoint saves to DB.

**This is intentional.** An earlier alternative (two upload endpoints: parse + save in one) was rejected in favour of keeping the frontend responsible for state between steps. This matches the existing app architecture where the frontend drives multi-step flows.

Any future AI working on this: do not collapse `POST /contacts/upload` and `POST /contacts` into a single endpoint.

### Routes (new `backend/app/routers/contacts.py`)

**`POST /contacts/upload`**
```
Request:  multipart/form-data
  - file:  UploadFile (.txt)

Response 200:
{
  "contacts": [{"name": "...", "email": "...", "company": "..."}],
  "errors":   ["Line 4: missing '-' separator"]
}
```

- Reads file bytes, passes to `TextFileImporter`
- Returns parsed contacts + errors
- Does NOT write to DB
- Requires authenticated user (JWT)

**`POST /contacts`**
```
Request:  JSON
{
  "list_name": "...",
  "source": "TEXT_FILE",
  "contacts": [{"name": "...", "email": "...", "company": "..."}]
}

Response 201:
{
  "contact_list_id": 42,
  "imported_count": 15
}
```

- Creates `contact_lists` row + bulk-inserts `recruiters` in a single transaction
- `user_id` comes from JWT, never from request body
- Requires authenticated user (JWT)

### Repository

`ContactRepository` added to `repositories.py`:
- `create_contact_list(user_id, name, source) -> ContactList`
- `bulk_create_recruiters(contact_list_id, user_id, contacts: list[RecruiterData]) -> int`

---

## 4. File Structure Summary

```
backend/
  alembic/versions/
    0002_add_contact_lists.py       # KAN-18
  app/
    importers/
      __init__.py                   # KAN-15
      base.py                       # KAN-15
      text_file.py                  # KAN-15
    routers/
      contacts.py                   # KAN-16
    models.py                       # KAN-18: ContactList + Recruiter updates
    repositories.py                 # KAN-16: ContactRepository
    main.py                         # KAN-16: register contacts router
```

---

## 5. Out of Scope

- Apollo importer (V2, KAN not yet created)
- Duplicate detection across contact lists
- Frontend preview UI (KAN-17, Dev 2)
- Email sending from imported contacts (KAN-24)
