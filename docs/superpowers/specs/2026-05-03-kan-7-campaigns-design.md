# KAN-7 Campaigns Design

**Date:** 2026-05-03

## Problem

Users have no way to send email campaigns through the web app. Templates, contacts, and settings are all in place, but there is no flow to combine them into a campaign and send. This spec covers the complete Campaigns feature: CRUD, send, preview, and follow-up automation.

## Scope

Five Jira stories in one spec (they are tightly coupled — no independent deployable slice exists):

- **KAN-23** — Campaigns table and CRUD API
- **KAN-24** — Campaign send flow
- **KAN-25** — Follow-up automation
- **KAN-26** — Campaign preview screen
- **KAN-37** — Campaigns page (frontend)

---

## Data Model

### New: `campaigns` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer PK | autoincrement |
| `user_id` | integer FK → users.id | owner |
| `name` | varchar(255) | user-supplied label |
| `contact_list_id` | integer FK → contact_lists.id | which list to send to |
| `main_template_id` | integer FK → templates.id | MAIN-type template |
| `follow_up_template_id` | integer FK → templates.id, nullable | FOLLOW_UP-type template |
| `status` | `campaignstatus` enum | DRAFT \| SENDING \| SENT \| FAILED |
| `sent_count` | integer, default 0 | emails successfully sent |
| `failed_count` | integer, default 0 | emails that failed |
| `created_at` | datetime | PST |
| `sent_at` | datetime, nullable | when the send job completed |

### New enum: `campaignstatus`

Values: `DRAFT`, `SENDING`, `SENT`, `FAILED`

- **DRAFT**: created, not yet sent
- **SENDING**: send in progress (prevents double-send)
- **SENT**: send job completed (some emails may have failed)
- **FAILED**: send job failed before sending any emails (e.g., no Gmail connection)

### Modified: `emails` table

Add nullable `campaign_id` FK → `campaigns.id`. Existing rows get NULL. New emails created by a campaign send get their campaign_id set.

### Migration: `0005_add_campaigns.py`

Creates `campaignstatus` enum, `campaigns` table, and adds `campaign_id` column to `emails`.

---

## Backend

### New file: `backend/app/services/gmail_service.py`

Contains functions for sending via Gmail using a stored OAuth refresh token. Kept separate from the legacy `email_service.py` (which uses file-based credentials for the old automation script).

```python
def build_gmail_service(refresh_token: str):
    """Build a Gmail API resource using a stored OAuth refresh token."""
    creds = google.oauth2.credentials.Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    return build("gmail", "v1", credentials=creds)

def send_email(service, to: str, subject: str, body_html: str) -> bool:
    """Send a single HTML email. Returns True on success, False on HttpError."""

def render_template(body_html: str, recruiter_name: str, company_name: str, tracking_pixel_url: str) -> str:
    """Render a Jinja2 template string with campaign variables."""
```

Template variables available during render: `recruiter_name`, `company_name`, `tracking_pixel_url`.

### Repository changes: `backend/app/repositories.py`

**`ContactRepository.get_all_lists(user_id) -> List[dict]`**
Returns all contact lists with recruiter count: `[{id, name, source, recruiter_count}]`. Uses a subquery to count recruiters per list.

**`ContactRepository.get_recruiters_by_list(contact_list_id, user_id) -> List[Recruiter]`**
Returns all recruiters for a contact list owned by the user.

**New `CampaignRepository`:**
```python
class CampaignRepository:
    async def create(self, user_id, name, contact_list_id, main_template_id, follow_up_template_id) -> Campaign
    async def get_all(self, user_id) -> List[Campaign]
    async def get_by_id(self, campaign_id, user_id) -> Optional[Campaign]
    async def update(self, campaign_id, user_id, **fields) -> Optional[Campaign]
    async def delete(self, campaign_id, user_id) -> bool
```

### New file: `backend/app/routers/campaigns.py`

All endpoints use `get_current_user` from `auth_service.py` (same pattern as analytics, users).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/campaigns` | List all campaigns for the current user |
| POST | `/campaigns` | Create campaign (status=DRAFT) |
| GET | `/campaigns/{id}` | Get single campaign |
| DELETE | `/campaigns/{id}` | Delete campaign (DRAFT only; 409 if not DRAFT) |
| GET | `/campaigns/{id}/preview` | Render main template with first recruiter as sample data |
| POST | `/campaigns/{id}/send` | Send campaign (DRAFT → SENDING → SENT/FAILED) |
| POST | `/campaigns/{id}/send-followups` | Send follow-ups to unopened recipients |

**POST /campaigns body:**
```json
{
  "name": "May 2026 Batch",
  "contact_list_id": 1,
  "main_template_id": 2,
  "follow_up_template_id": 3
}
```
`follow_up_template_id` is optional (null means no follow-ups for this campaign).

**GET /campaigns response item:**
```json
{
  "id": 1,
  "name": "May 2026 Batch",
  "contact_list_id": 1,
  "contact_list_name": "LinkedIn Export",
  "main_template_id": 2,
  "follow_up_template_id": 3,
  "status": "SENT",
  "sent_count": 42,
  "failed_count": 1,
  "created_at": "2026-05-03T10:00:00",
  "sent_at": "2026-05-03T10:05:00"
}
```

`contact_list_name` is resolved by joining `contact_lists`. The router does a single query joining `campaigns` and `contact_lists`.

**GET /campaigns/{id}/preview response:**
```json
{ "html": "<html>...</html>" }
```
Uses the first recruiter in the contact list to fill template variables. If the list is empty, uses placeholder values ("Sample Recruiter", "Sample Company").

**POST /campaigns/{id}/send — send flow:**
1. Load campaign; 409 if status != DRAFT
2. Check `current_user.gmail_refresh_token`; 400 if not set
3. Set status = SENDING (prevents double-send)
4. Decrypt refresh token; build Gmail service
5. Load main template and recruiters from contact list
6. For each recruiter:
   - Generate `tracking_id = uuid4()`
   - Create `Email` record (PENDING, EmailType.MAIN, campaign_id set)
   - Render template body
   - Send via Gmail
   - Update Email status to SENT or FAILED
7. Update campaign: status = SENT (or FAILED if sent_count == 0), sent_count, failed_count, sent_at
8. Return `{"sent": N, "failed": M}`

On any exception after step 3, set campaign status back to DRAFT before re-raising.

**POST /campaigns/{id}/send-followups — follow-up flow:**
1. Load campaign; 400 if `follow_up_template_id` is null; 400 if status != SENT
2. Load follow-up template
3. Query: MAIN emails for this campaign that are SENT, not opened, created more than `user.follow_up_days` days ago, AND no existing FOLLOW_UP email for that recruiter in this campaign
4. For each eligible recruiter:
   - Create Email record (PENDING, EmailType.FOLLOW_UP, campaign_id set)
   - Render follow-up template
   - Send; update Email status
5. Return `{"sent": N, "failed": M}`

### Model changes: `backend/app/models.py`

Add `CampaignStatus` enum and `Campaign` model. Add `campaign_id` nullable column + relationship to `Email`.

### Router registration: `backend/app/main.py`

Add `from app.routers import ... campaigns` and `app.include_router(campaigns.router)`.

---

## Frontend

### New API functions in `frontend/src/services/api.js`

```js
export const listCampaigns = async () => { ... }
export const createCampaign = async (data) => { ... }
export const deleteCampaign = async (id) => { ... }
export const previewCampaign = async (id) => { ... }         // GET /campaigns/{id}/preview
export const sendCampaign = async (id) => { ... }             // POST /campaigns/{id}/send
export const sendFollowUps = async (id) => { ... }            // POST /campaigns/{id}/send-followups
```

### New file: `frontend/src/components/CampaignsPage.jsx`

Single page with:

**Campaign list table** (MUI `Table`):
- Columns: Name | Contact List | Status (Chip) | Sent | Failed | Created | Actions
- Status chips: DRAFT=default, SENDING=warning, SENT=success, FAILED=error

**Actions per row:**
- **Preview** (DRAFT only) — opens dialog showing rendered HTML in an `<iframe srcDoc={html}>`
- **Send** (DRAFT only) — confirmation dialog "Send to N contacts?" → calls `sendCampaign` → refreshes list
- **Send Follow-ups** (SENT only, follow_up_template_id set) — confirmation dialog → calls `sendFollowUps` → refreshes list
- **Delete** (DRAFT only) — confirmation dialog → calls `deleteCampaign` → removes from list

**"New Campaign" button** — opens a create dialog with:
- Name (required text)
- Contact List (required select: populated from `GET /contact-lists` — see below)
- Main Template (required select: MAIN-type templates from `GET /templates`)
- Follow-up Template (optional select: FOLLOW_UP-type templates from `GET /templates`, plus "None" option)

**New endpoint: `GET /contact-lists`** in `backend/app/routers/contacts.py`
Returns all contact lists for the user: `[{id, name, source, recruiter_count}]`.
Also add `ContactRepository.get_all_lists(user_id)` and `ContactRepository.get_recruiters_by_list(contact_list_id, user_id)` to `repositories.py`.

**Loading/error states**: spinner while fetching; error alert if fetch fails; "No campaigns yet" empty state.

**Snackbar** for send/delete success and error feedback.

### Router/nav changes: `frontend/src/App.jsx`

Add `{ label: "Campaigns", path: "/campaigns" }` to `NAV_LINKS` and a `/campaigns` route inside `RequireAuth`.

---

## Tests

**`backend/tests/test_campaigns_router.py`** — covers:
- Auth required for all endpoints (401 without cookie)
- POST /campaigns creates with DRAFT status
- GET /campaigns returns list
- GET /campaigns/{id}/preview returns html key
- POST /campaigns/{id}/send — 409 if not DRAFT, 400 if no Gmail
- POST /campaigns/{id}/send-followups — 400 if no follow_up_template
- DELETE /campaigns/{id} — 404 if not found, 409 if not DRAFT

**`backend/tests/test_gmail_service.py`** — covers:
- `render_template` substitutes all three variables
- `send_email` returns True on success, False on HttpError

---

## Non-coding tasks (after deploy)

- No new environment variables required — all credentials already in place on Render.
- Verify `TRACKING_PIXEL_BASE_URL` on Render points to the deployed tracking endpoint (needed for pixel URLs in sent emails).
