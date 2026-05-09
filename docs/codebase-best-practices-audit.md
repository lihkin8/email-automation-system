# Codebase Best-Practices Audit (Tech Debt Backlog)

**Purpose**: A principal-engineer-style backlog of **highest leverage** fixes across backend + frontend. This is intentionally actionable (files + what to change), but not a full design doc. Keep it ruthlessly prioritized and tied to user-visible reliability/security.

**Last updated**: 2026-05-08

---

## Top 10 issues (ranked by impact vs effort)

### 1) Gmail sending auth is not SaaS-correct (interactive OAuth; not per-user tokens)
- **Where**:
  - `backend/app/services/email_service.py`
  - `backend/app/routers/campaigns.py`
  - `backend/app/routers/auth.py`
  - `backend/app/repositories.py`
- **Why it matters**: `GmailService` uses `InstalledAppFlow.run_local_server()` (developer-machine interactive flow). This won’t work on Render and doesn’t send as the authenticated user using `users.gmail_refresh_token`.
- **Fix later (medium)**: Build Google `Credentials` from the authenticated user’s stored, encrypted refresh token and refresh access tokens automatically; remove “credentials file on disk” assumption.

### 2) Background automation isn’t durable or multi-instance safe
- **Where**:
  - `backend/app/main.py` (startup `asyncio.create_task` loop)
  - `backend/app/services/follow_up_service.py`
  - `backend/app/routers/campaigns.py` (`/follow-ups/run`)
- **Why it matters**: In-process loops die on deploy/restart, don’t coordinate across instances, and can duplicate/miss runs.
- **Fix later (medium)**: Move to a durable job runner (Celery/RQ/Arq) or DB-backed scheduler + external cron. Add idempotency + locking (claim jobs with DB locks) to prevent double-sends.

### 3) Tracking compat endpoint is spoofable (email_id enumeration → false opens)
- **Where**:
  - `backend/app/routers/tracking.py` (`GET /track/pixel?email_id=...`)
  - `backend/app/services/email_service.py` (still embeds compat URL in legacy template path)
- **Why it matters**: Sequential IDs can be guessed; an attacker can mark emails as opened.
- **Status**: Addressed in `backend/app/routers/tracking.py`: compat `GET /track/pixel` now returns `410 Gone` with a deprecation header, and active campaign pixels use `tracking_id` URLs from `backend/app/routers/campaigns.py`.
- **Fix later (quick)**: Remove any remaining legacy compat callers in `backend/app/services/email_service.py`.

### 4) Cookie/JWT hardening gaps (logout deletion, local-dev posture, CSRF)
- **Where**:
  - `backend/app/routers/auth.py` (cookie set + logout)
  - `backend/app/services/auth_service.py`
  - `backend/app/main.py` (SessionMiddleware uses `jwt_secret`)
- **Why it matters**:
  - `logout` deletes cookie without matching attributes (`secure`, `samesite`, `path`) → can fail to clear in browsers.
  - `secure=True` + `samesite="none"` can complicate local dev unless you run HTTPS.
  - Cookie-based auth needs a deliberate CSRF posture for state-changing requests.
- **Fix later (medium)**: Separate secrets (JWT signing vs session middleware), ensure `delete_cookie()` matches flags, define CSRF strategy (double-submit or same-site + CSRF header), and document local-dev HTTPS approach.

### 5) Send flow status updates are not per-email accurate
- **Where**:
  - `backend/app/routers/campaigns.py`
  - `backend/app/services/campaign_send_service.py`
- **Why it matters**: Current approach can mislabel which email failed if failures are intermittent.
- **Status**: Partially addressed in `backend/app/services/campaign_send_service.py`, `backend/app/services/follow_up_service.py`, `backend/app/routers/campaigns.py`, and `backend/app/repositories.py`: sender methods now return per-item results, routers update the exact `Email` row, and `/campaigns/{id}/send-progress` reports status counts.
- **Fix later (medium)**: Add retries/backoff and idempotency to prevent duplicate sends on retry.

### 6) Tracking pixel injection is fragile across email clients
- **Where**:
  - `backend/app/services/campaign_send_service.py` (`inject_tracking_pixel`)
  - `backend/app/services/email_service.py` (legacy HTML embeds a background-image pixel)
- **Why it matters**: CSS background images are more likely to be stripped than `<img>` pixels.
- **Status**: Addressed for campaign sends in `backend/app/services/campaign_send_service.py` with a hidden 1×1 `<img>` pixel.
- **Fix later (quick)**: Audit/remove any remaining legacy background-image pixel generation in `backend/app/services/email_service.py`.

### 7) Frontend XSS surface area via `dangerouslySetInnerHTML`
- **Where**:
  - `frontend/src/pages/CampaignsPage.jsx` (renders rendered template HTML)
  - `frontend/src/components/GuidedTemplateBuilder.jsx` (template previews)
- **Why it matters**: User-authored HTML templates are rendered directly; if any untrusted content can enter templates/variables, this becomes an XSS vector.
- **Status**: Addressed in `frontend/src/lib/sanitizeHtml.js`, `frontend/src/pages/CampaignsPage.jsx`, and `frontend/src/components/GuidedTemplateBuilder.jsx` using DOMPurify before HTML preview rendering.
- **Fix later (medium)**: Consider constraining template HTML to a safe subset at creation time as a second layer.

### 8) DB indexing + timezone correctness gaps
- **Where**:
  - `backend/app/models.py` (timestamps are PST-naive `DateTime`)
  - `backend/alembic/versions/*` (no indexes for high-cardinality filters)
- **Why it matters**: Query performance will degrade and timezone handling becomes error-prone.
- **Fix later (medium)**: Add indexes for common access paths; move DB storage to UTC `TIMESTAMPTZ`, convert for display at the edges.

### 9) Repository/transaction boundaries are inconsistent
- **Where**:
  - `backend/app/repositories.py`
  - `backend/app/routers/campaigns.py`
- **Why it matters**: Many repo methods `commit()` internally, making multi-step flows harder to reason about and leaving partial state on errors.
- **Fix later (medium)**: Standardize to a unit-of-work style where the service/router controls commit boundaries; separate “persist intent” vs “send” vs “finalize statuses”.

### 10) Alembic migrations appear incomplete for core tables + Postgres ENUMs
- **Where**:
  - `backend/alembic/versions/*.py`
  - `backend/app/models.py` (native Postgres ENUMs / create_type behaviors)
- **Why it matters**: schema drift risk — new environments may be missing core tables (`recruiters/emails/email_tracking`) and/or ENUM types (`emailtype`, `emailstatus`) depending on how Alembic was generated/applied.
- **Fix later (medium)**: reconcile DB vs models; add/adjust migrations so Alembic explicitly creates any missing tables + ENUM types (or refactor to SQLAlchemy `Enum(..., native_enum=False)`); then lock down migration workflow (no “autogenerate” drift).

---

## Quick wins (< 1 day)

- **Tighten CORS for cookie auth**
  - **Files**: `backend/app/main.py`, `backend/app/config.py`
  - **Change**: remove any wildcard origin configuration for credentialed requests; keep an explicit allowlist matching frontend origins.

- **Disable or gate `/track/pixel?email_id=...`**
  - **Files**: `backend/app/routers/tracking.py`
  - **Change**: Remove endpoint or require a signed/unguessable token; migrate callers to `tracking_id` pixel.

- **Use `<img>` tracking pixel injection**
  - **Files**: `backend/app/services/campaign_send_service.py`
  - **Change**: Inject `<img src=\"...\" width=\"1\" height=\"1\" style=\"display:none\" alt=\"\" />`.

- **Make logout cookie deletion reliable**
  - **Files**: `backend/app/routers/auth.py`
  - **Change**: `delete_cookie()` should match cookie attrs used in `set_cookie` (e.g., `path`, `samesite`, `secure`).

- **Standardize resume attachment MIME type**
  - **Files**: `backend/app/routers/campaigns.py`, `backend/app/services/email_service.py`
  - **Change**: Determine MIME from filename (PDF/DOC/DOCX) instead of hardcoding `application/pdf`.

- **Add upload size limits + basic resume content validation**
  - **Files**: `backend/app/routers/users.py`, `backend/app/services/storage.py`
  - **Change**: enforce max upload size, validate file signatures/content type, and avoid holding unbounded bytes in memory.

- **Avoid blocking I/O in async request paths (R2 download)**
  - **Files**: `backend/app/services/storage.py`, `backend/app/routers/campaigns.py`
  - **Change**: Offload `boto3` download to a threadpool (or switch to an async S3 client) so large resume downloads don’t block the event loop during sends.

- **Make SQLAlchemy `echo` configurable**
  - **Files**: `backend/app/database.py`
  - **Change**: Disable SQL echo by default in prod; enable only via env flag.

- **Align frontend base URL usage**
  - **Files**: `frontend/src/services/api.js`, `frontend/src/components/SettingsPage.jsx`, `frontend/src/pages/OnboardingPage.jsx`
  - **Change**: Keep `REACT_APP_API_URL` as the single source of truth and ensure it’s set in all environments.

---

## Medium wins (1–3 days)

- **Per-user Gmail sending using stored refresh tokens**
  - **Files**: `backend/app/services/email_service.py`, `backend/app/routers/auth.py`, `backend/app/services/auth_service.py`, `backend/app/repositories.py`
  - **Change**: Build Gmail client using decrypted refresh token per authenticated user; handle refresh/revocation.

- **Durable follow-up automation**
  - **Files**: `backend/app/main.py`, `backend/app/services/follow_up_service.py`, `backend/app/routers/campaigns.py`
  - **Change**: Replace in-process scheduler with job queue or DB-backed scheduler + cron; add locking/idempotency.

- **Add indexes for core query paths**
  - **Files**: new migration under `backend/alembic/versions/`
  - **Suggested indexes**:
    - `emails(tracking_id)` (ensure unique/index exists in DB)
    - `emails(user_id, campaign_id, created_at)`
    - `emails(user_id, recruiter_id, created_at)`
    - `email_tracking(email_id, opened_at)`
    - `recruiters(user_id, contact_list_id)`

- **Store timestamps as UTC `TIMESTAMPTZ`**
  - **Files**: `backend/app/models.py`, migrations under `backend/alembic/versions/`
  - **Change**: Replace PST-naive defaults with UTC `now()` in DB; convert to local at display time.

- **Send correctness: per-email results + retries + idempotency**
  - **Files**: `backend/app/routers/campaigns.py`, `backend/app/services/campaign_send_service.py`, `backend/app/repositories.py`
  - **Change**: Update statuses per email; add backoff on transient Gmail failures; prevent duplicates on retry.

- **Sanitize rendered HTML in frontend**
  - **Files**: `frontend/src/pages/CampaignsPage.jsx`, `frontend/src/components/GuidedTemplateBuilder.jsx`
  - **Change**: DOMPurify (or equivalent) or an explicit safe HTML subset.

- **Stabilize frontend toolchain (CRA warnings)**
  - **Files**: `frontend/package.json` / dependency graph
  - **Change**: Add the missing Babel plugin dependency and keep browserslist DB current; plan migration off CRA.

- **Centralize error handling + structured logs**
  - **Files**: `backend/app/main.py`, `backend/app/services/*`, `backend/app/routers/*`
  - **Change**: Global exception mapping + request IDs; avoid logging secrets.

---

## How to use this doc
- When taking on a ticket, scan this list for nearby quick wins.
- Add new findings as numbered items, keep “Quick/Medium wins” scoped to low-effort improvements.

