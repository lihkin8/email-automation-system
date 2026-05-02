# Analytics Router + Auth Gate Design

**Date:** 2026-05-02

## Problem

The dashboard home page shows "Failed to load initial data" because:
1. The backend analytics endpoints the Dashboard calls do not exist.
2. There is no login page — unauthenticated users hit the dashboard directly.

## Scope

Two independent pieces delivered together:

1. **Backend: analytics router** — five endpoints the Dashboard already calls
2. **Frontend: login page + auth gate** — protect all app routes behind Google OAuth

---

## Backend: Analytics Router

**File:** `backend/app/routers/analytics.py`
**Registration:** add `app.include_router(analytics.router)` to `backend/app/main.py`

All endpoints use `get_current_user` (JWT cookie) and `get_db` from `auth_service.py`. All queries are scoped to `current_user.id`.

### Endpoints

| Method | Path | Response shape |
|--------|------|----------------|
| GET | `/companies` | `{ companies: string[] }` |
| GET | `/analytics?page&page_size` | `{ analytics: EmailRow[], pagination: Pagination }` |
| GET | `/company-analytics` | `{ company_analytics: CompanyRow[] }` |
| GET | `/company/{company_name}` | `{ company_details: CompanyDetails }` |
| GET | `/company/{company_name}/emails` | `{ company_emails: EmailRow[] }` |

**EmailRow:** `email_id, recruiter_name, company, email_type, status, is_opened, open_count, sent_date`
**Pagination:** `total, page, page_size, total_pages`
**CompanyRow:** `company, total_emails, opened_emails, follow_ups, total_opens, last_interaction, email_statuses`
**CompanyDetails:** `total_emails, opened_emails, follow_ups, total_opens, last_interaction`

`open_count` comes from a subquery counting `EmailTracking` rows per email.
`email_statuses` is a comma-separated string of distinct statuses for the company (e.g. `"SENT, FAILED"`).

---

## Frontend: Login Page + Auth Gate

### New files
- `frontend/src/components/LoginPage.jsx`
- `frontend/src/components/RequireAuth.jsx`

### LoginPage

Centered MUI Card with the app name and a single "Sign in with Google" button.
Clicking the button navigates the browser to `{REACT_APP_API_URL}/auth/login` (full redirect, not axios — the backend handles the OAuth flow and sets the cookie).

### RequireAuth

A wrapper component that:
1. On mount, calls `GET /auth/me` via axios.
2. While pending: renders a centered `<CircularProgress />`.
3. On 200: renders `<Outlet />` (the protected page).
4. On 401/error: redirects to `/login` via `<Navigate replace to="/login" />`.

### Router changes (App.jsx)

```
/login          → <LoginPage />   (public)
/               → <RequireAuth><Dashboard /></RequireAuth>
/contacts       → <RequireAuth><ContactImport /></RequireAuth>
/templates      → <RequireAuth><TemplatesPage /></RequireAuth>
```

### Auth flow

1. User visits `/` → `RequireAuth` calls `/auth/me` → 401 → redirect to `/login`
2. User clicks "Sign in with Google" → full redirect to `{API_URL}/auth/login`
3. Google OAuth completes → backend sets `session_token` JWT cookie → redirects to `settings.frontend_url` (Netlify URL)
4. User lands on `/` → `RequireAuth` calls `/auth/me` → 200 → Dashboard renders

---

## Non-coding tasks (after deploy)

- Set `FRONTEND_URL` on Render to the Netlify URL
- Ensure `BASE_URL` on Render points to the Render backend URL (used for OAuth callback)
- Google Cloud Console: OAuth redirect URI must include `{BASE_URL}/auth/callback`
