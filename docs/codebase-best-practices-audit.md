# Codebase Best-Practices Audit (Tech Debt Backlog)

**Purpose**: Capture high-impact issues and low-effort improvements discovered by repo-wide review. This is intentionally actionable (files + what to change), but not a full design doc. Keep this updated as the codebase evolves.

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
- **Fix later (quick)**: Deprecate/disable compat endpoint or require a signed token. Standardize all pixels on `tracking_id` (unguessable UUID).

### 4) CORS config is unsafe/incompatible with cookie auth
- **Where**: `backend/app/main.py`
- **Why it matters**: `allow_origins=["*"]` with `allow_credentials=True` is not valid in browsers and is unsafe for cookie-based sessions.
- **Fix later (quick)**: Replace wildcard origins with an explicit allowlist (localhost + Vercel domains) while keeping `allow_credentials=True`.

### 5) Cookie/JWT hardening gaps (claims, secret separation, CSRF posture)
- **Where**:
  - `backend/app/routers/auth.py`
  - `backend/app/services/auth_service.py`
  - `backend/app/main.py` (SessionMiddleware uses `jwt_secret`)
- **Why it matters**: Missing standard claims/rotation; secrets are reused across concerns; cookie deletion may not match cookie attributes. Cookie auth also needs a CSRF strategy for state-changing requests.
- **Fix later (medium)**: Separate secrets (JWT signing vs session middleware), add issuer/audience/iat, consider shorter TTL + refresh, ensure `delete_cookie()` matches flags, establish CSRF strategy.

### 6) Send flow status updates are not per-email accurate
- **Where**:
  - `backend/app/routers/campaigns.py`
  - `backend/app/services/campaign_send_service.py`
- **Why it matters**: Current approach can mislabel which email failed if failures are intermittent.
- **Fix later (medium)**: Return per-item results from sender and update each `emails` row individually. Add retries/backoff and idempotency to prevent double-sends.

### 7) Tracking pixel injection is fragile across email clients
- **Where**: `backend/app/services/campaign_send_service.py` (`inject_tracking_pixel`)
- **Why it matters**: CSS background images are more likely to be stripped than `<img>` pixels.
- **Fix later (quick)**: Inject a hidden 1×1 `<img>` pixel instead of a background-image div.

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

### 10) Frontend API integration mismatch (frontend calls endpoints backend doesn’t expose)
- **Where**:
  - `frontend/src/services/api.js`
  - `frontend/src/components/Dashboard.jsx`
  - `frontend/src/components/ProtectedRoute.jsx`
  - `frontend/src/pages/LoginPage.jsx`
- **Why it matters**: Frontend references `/analytics`, `/companies`, `/company-analytics` etc., while backend currently exposes `/auth`, `/contacts`, `/templates`, `/campaigns`, `/track`. Also base URL env vars + `withCredentials` usage are inconsistent.
- **Fix later (quick→medium)**: Align on a single base URL env var and ensure `withCredentials: true` for cookie auth. Either implement missing backend endpoints or refactor frontend to use existing endpoints.

---

## Quick wins (< 1 day)

- **Tighten CORS for cookie auth**
  - **Files**: `backend/app/main.py`, `backend/app/config.py`
  - **Change**: Replace wildcard CORS origin with explicit allowlist (local + Vercel).

- **Disable or gate `/track/pixel?email_id=...`**
  - **Files**: `backend/app/routers/tracking.py`
  - **Change**: Remove endpoint or require a signed/unguessable token; migrate callers to `tracking_id` pixel.

- **Use `<img>` tracking pixel injection**
  - **Files**: `backend/app/services/campaign_send_service.py`
  - **Change**: Inject `<img src=\"...\" width=\"1\" height=\"1\" style=\"display:none\" alt=\"\" />`.

- **Make SQLAlchemy `echo` configurable**
  - **Files**: `backend/app/database.py`
  - **Change**: Disable SQL echo by default in prod; enable only via env flag.

- **Unify frontend base URL + cookie credentials behavior**
  - **Files**: `frontend/src/services/api.js`, `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/pages/LoginPage.jsx`
  - **Change**: Single base URL env var; ensure `withCredentials: true` where required.

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

- **Centralize error handling + structured logs**
  - **Files**: `backend/app/main.py`, `backend/app/services/*`, `backend/app/routers/*`
  - **Change**: Global exception mapping + request IDs; avoid logging secrets.

---

## How to use this doc
- When taking on a ticket, scan this list for nearby quick wins.
- Add new findings as numbered items, keep “Quick/Medium wins” scoped to low-effort improvements.

