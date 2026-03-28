# Email Automation SaaS — Design Spec
**Date:** 2026-03-28
**Status:** Approved

---

## Context

The system was originally a single-user CLI tool for job application outreach — scraping recruiter emails via Apollo.io, parsing a text file of contacts, sending batched personalized emails via Gmail, and tracking opens via a tracking pixel served from a personal Oracle free-tier instance. Everything was hardcoded to one person's profile (name, resume, email subjects, credentials).

The goal is to revamp this into a hosted multi-user SaaS where anyone (technical or not) can sign up, connect their Gmail, import contacts, customize their email template, launch campaigns, and track opens — without touching a terminal or config file.

**Immediate driver:** A friend needs to use this for job hunting soon. MVP must be fully functional end-to-end.

---

## Architecture Overview

**Single FastAPI backend** handles auth, email sending, tracking, and file uploads.
**React SPA frontend** with React Router for multi-page navigation.
**Neon DB (PostgreSQL)** for all data including tracking events.
**Cloudflare R2** for resume file storage.

```
User Browser
    ↕ (HTTPS)
React SPA (Vercel)
    ↕ (REST API)
FastAPI Backend (Render)
    ↕
Neon DB (PostgreSQL)    Cloudflare R2 (resumes)
    ↕
Gmail API (per-user OAuth tokens)
```

**Deployment:**
| Layer | Service |
|---|---|
| Backend | Render (free tier → paid) |
| Frontend | Vercel (free) |
| Database | Neon (existing) |
| File storage | Cloudflare R2 (free up to 10GB) |

---

## 1. Auth & User Model

### Flow
1. User clicks "Sign in with Google"
2. Google OAuth grants `openid`, `email`, `profile`, `gmail.send` in one flow
3. Backend exchanges code → stores encrypted Gmail refresh token in `users` table
4. Issues JWT session cookie for all subsequent API calls

### `users` table
```sql
id                    SERIAL PRIMARY KEY
google_id             VARCHAR UNIQUE NOT NULL
email                 VARCHAR UNIQUE NOT NULL
name                  VARCHAR NOT NULL
avatar_url            VARCHAR
gmail_refresh_token   TEXT (encrypted at rest)
resume_url            VARCHAR (Cloudflare R2 URL)
follow_up_days        INTEGER DEFAULT 5
created_at            TIMESTAMPTZ DEFAULT NOW()
```

### Library
`Authlib` for the OAuth dance (FastAPI-recommended, minimal boilerplate).
Gmail refresh tokens encrypted with `cryptography` (Fernet) before DB storage.

### Per-user isolation
Every table gets a `user_id FK → users.id`. All queries are scoped to the authenticated user. No cross-user data leakage possible at the query layer.

---

## 2. Contact Import

### Pluggable importer interface
```python
class ContactImporter:
    async def import_contacts(self, user_id: int, source: Any) -> list[Recruiter]:
        ...
```
V1 ships `TextFileImporter`. V2 drops in `ApolloImporter` without changes elsewhere.

### `contact_lists` table
```sql
id          SERIAL PRIMARY KEY
user_id     INTEGER FK → users.id
name        VARCHAR NOT NULL
source      ENUM('TEXT_FILE', 'APOLLO')
created_at  TIMESTAMPTZ DEFAULT NOW()
```

`recruiters` table gains `contact_list_id FK → contact_lists.id` and `user_id`.

### Text file upload (V1)
1. Format instructions + downloadable sample file shown on upload screen
2. User uploads `.txt` — existing `recruiter_parser.py` logic reused
3. Preview table shown before confirming (user spots mistakes)
4. Parser returns friendly per-line errors if format is wrong
5. On confirm → saved to DB

### Text file format (unchanged)
```
Google:
recruiter1@google.com - John Doe
recruiter2@google.com - Jane Smith

Meta:
recruiter3@meta.com - Bob Johnson
```

### Apollo BYOK (V2)
User stores encrypted Apollo API key in settings. `ApolloImporter` calls Apollo People Search API and maps response to same `Recruiter` shape.

---

## 3. Email Templates

### `templates` table
```sql
id          SERIAL PRIMARY KEY
user_id     INTEGER FK → users.id
name        VARCHAR NOT NULL
type        ENUM('MAIN', 'FOLLOW_UP')
subject     VARCHAR NOT NULL
body_html   TEXT NOT NULL
variables   JSONB
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### Two creation modes

**Guided builder** — structured form (name, role, school, graduation year, 2-3 achievements, skills, CTA preference) auto-generates professional HTML email. Live preview updates as user types.

**Free-form editor** — rich text editor (TipTap) with variables sidebar. Supported placeholders:
```
{{company}}, {{first_name}}, {{your_name}},
{{role}}, {{your_skills}}, {{custom_1}}, {{custom_2}}
```

User can start from guided output and edit freely, or write from scratch.

### Template persistence
Templates are saved per user. On login, all saved templates are immediately available — no re-entering. Users can maintain multiple templates (e.g. SWE roles, ML roles) and select per campaign.

---

## 4. Campaigns

### `campaigns` table
```sql
id               SERIAL PRIMARY KEY
user_id          INTEGER FK → users.id
name             VARCHAR NOT NULL
template_id      INTEGER FK → templates.id
contact_list_id  INTEGER FK → contact_lists.id
follow_up_template_id INTEGER FK → templates.id (nullable)
follow_up_days   INTEGER DEFAULT 5
status           ENUM('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED')
created_at       TIMESTAMPTZ DEFAULT NOW()
```

### Send flow
1. User creates campaign: picks contact list + template + follow-up template (optional)
2. Preview screen renders sample email with first contact substituted in
3. User hits Send → backend queues, sends in batches with 2s delay (configurable)
4. Dashboard updates as emails go out

### Follow-ups
- Configurable threshold per campaign (default from user settings, overridable)
- Daily background check for unopened emails past threshold
- Manual trigger available from dashboard
- Follow-up template selected at campaign creation

---

## 5. Tracking

### Pixel URL pattern
```
GET /track/{user_id}/{tracking_id}.gif
```

### On request
1. Look up `tracking_id` in `emails`, verify it belongs to `user_id`
2. Write row to `email_tracking` (timestamp, user agent, IP)
3. Set `email.is_opened = True`
4. Return 1×1 transparent GIF

Tracking pixel must be on a publicly deployed URL (Render) — not localhost.

### Dashboard metrics (per campaign)
- Open rate %
- Which contacts opened, when, how many times
- Unopened list for follow-up targeting

---

## 6. Frontend

### Pages (React Router)
| Route | Purpose |
|---|---|
| `/` | Login — Google Sign-in button |
| `/onboarding` | First-login wizard: Gmail → Resume → Template → Contacts → Campaign |
| `/dashboard` | Campaign overview, open rates, recent activity |
| `/contacts` | Upload contacts, manage lists |
| `/templates` | Create/edit templates (guided + free-form) |
| `/campaigns` | Create, launch, monitor campaigns |
| `/settings` | Resume upload, Gmail status, follow-up defaults, Apollo API key (v2) |

### Design principles
- **Onboarding wizard** for first-time users — no blank screens
- **Empty states** with clear CTAs throughout
- **Plain language** — "3 companies opened your email" not raw DB status enums
- **Mobile-friendly** responsive layout
- **MUI design system** used intentionally (typography scale, spacing, color tokens) not just defaults
- Existing components (EmailTable, CompanyAnalytics) adapted not rewritten

---

## 7. Data Model Summary

```
users
  ↳ contact_lists (user_id)
      ↳ recruiters (contact_list_id, user_id)
  ↳ templates (user_id)
  ↳ campaigns (user_id, template_id, contact_list_id)
      ↳ emails (campaign_id, recruiter_id, user_id)
          ↳ email_tracking (email_id)
```

---

## 8. Security Notes

- Gmail refresh tokens encrypted with Fernet before storage
- Apollo API keys encrypted at rest (v2)
- All API endpoints require valid JWT — no unauthenticated access except `/track/`
- Tracking endpoint validates `user_id` + `tracking_id` ownership before writing

---

## 9. Out of Scope (V1)

- Apollo BYOK contact import (V2)
- Non-Gmail senders (Outlook etc.)
- Team/org accounts (multi-seat)
- Billing / usage limits
- Email unsubscribe handling

---

## 10. Verification

End-to-end test for V1:
1. Sign in with Google → verify JWT cookie set, user row created in DB
2. Upload resume → verify R2 URL stored on user row
3. Create template (guided mode) → verify saved, rendered preview looks correct
4. Upload contacts text file → verify parse preview, confirm import, check DB rows
5. Create campaign → select template + contact list → preview rendered email
6. Launch campaign → verify emails appear in Gmail sent folder, tracking pixel URL embedded
7. Open email in another client → verify `email_tracking` row created, `is_opened = true`
8. Check dashboard → verify open rate reflects tracked open
9. Log out + log back in → verify templates and campaigns still present
