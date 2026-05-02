# Analytics Router + Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken home page by adding missing backend analytics endpoints and protect all frontend routes behind Google OAuth login.

**Architecture:** Two independent branches/PRs — one for the backend analytics router, one for the frontend auth gate. The backend exposes five scoped analytics endpoints using the existing JWT auth. The frontend adds a `RequireAuth` wrapper that checks `/auth/me` and redirects to a new `LoginPage` if unauthenticated.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React 19/React Router v6/MUI (frontend)

---

## Branch 1: `feature/analytics-router`

Create this branch from `main` before starting:
```bash
git checkout main && git pull
git checkout -b feature/analytics-router
```

---

### Task 1: Create the analytics router

**Files:**
- Create: `backend/app/routers/analytics.py`

- [ ] **Step 1: Create `backend/app/routers/analytics.py` with this exact content**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import User, Recruiter, Email, EmailTracking, EmailType
from app.services.auth_service import get_current_user, get_db

router = APIRouter(tags=["analytics"])


def _open_count_subq():
    return (
        select(EmailTracking.email_id, func.count(EmailTracking.id).label("open_count"))
        .group_by(EmailTracking.email_id)
        .subquery()
    )


def _row_to_email_dict(row) -> dict:
    return {
        "email_id": row["email_id"],
        "recruiter_name": row["recruiter_name"],
        "company": row["company"],
        "email_type": row["email_type"],
        "status": row["status"],
        "is_opened": row["is_opened"],
        "open_count": row["open_count"],
        "sent_date": row["sent_date"].isoformat() if row["sent_date"] else None,
    }


@router.get("/companies")
async def get_companies(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(distinct(Recruiter.company))
        .where(Recruiter.user_id == current_user.id)
        .order_by(Recruiter.company)
    )
    return {"companies": [row[0] for row in result.fetchall()]}


@router.get("/analytics")
async def get_analytics(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    total = (await session.execute(
        select(func.count(Email.id)).where(Email.user_id == current_user.id)
    )).scalar()

    ocsq = _open_count_subq()
    result = await session.execute(
        select(
            Email.id.label("email_id"),
            Recruiter.name.label("recruiter_name"),
            Recruiter.company,
            Email.email_type,
            Email.status,
            Email.is_opened,
            Email.created_at.label("sent_date"),
            func.coalesce(ocsq.c.open_count, 0).label("open_count"),
        )
        .join(Recruiter, Email.recruiter_id == Recruiter.id)
        .outerjoin(ocsq, Email.id == ocsq.c.email_id)
        .where(Email.user_id == current_user.id)
        .order_by(Email.created_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    rows = result.mappings().all()
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "analytics": [_row_to_email_dict(r) for r in rows],
        "pagination": {"total": total, "page": page, "page_size": page_size, "total_pages": total_pages},
    }


@router.get("/company-analytics")
async def get_company_analytics(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    ocsq = _open_count_subq()
    result = await session.execute(
        select(
            Recruiter.company,
            func.count(distinct(Email.id)).label("total_emails"),
            func.count(distinct(Email.id)).filter(Email.is_opened.is_(True)).label("opened_emails"),
            func.count(distinct(Email.id)).filter(Email.email_type == EmailType.FOLLOW_UP).label("follow_ups"),
            func.coalesce(func.sum(ocsq.c.open_count), 0).label("total_opens"),
            func.max(EmailTracking.opened_at).label("last_interaction"),
        )
        .select_from(Recruiter)
        .join(Email, Recruiter.id == Email.recruiter_id)
        .outerjoin(ocsq, Email.id == ocsq.c.email_id)
        .outerjoin(EmailTracking, Email.id == EmailTracking.email_id)
        .where(Recruiter.user_id == current_user.id)
        .group_by(Recruiter.company)
        .order_by(Recruiter.company)
    )
    agg_rows = result.mappings().all()

    status_result = await session.execute(
        select(Recruiter.company, Email.status)
        .join(Email, Recruiter.id == Email.recruiter_id)
        .where(Recruiter.user_id == current_user.id)
        .distinct()
    )
    statuses: dict[str, set] = {}
    for company, status in status_result.fetchall():
        statuses.setdefault(company, set()).add(status)

    return {
        "company_analytics": [
            {
                "company": row["company"],
                "total_emails": row["total_emails"],
                "opened_emails": row["opened_emails"],
                "follow_ups": row["follow_ups"],
                "total_opens": int(row["total_opens"]),
                "last_interaction": row["last_interaction"].isoformat() if row["last_interaction"] else None,
                "email_statuses": ", ".join(sorted(statuses.get(row["company"], set()))),
            }
            for row in agg_rows
        ]
    }


@router.get("/company/{company_name}")
async def get_company_details(
    company_name: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    ocsq = _open_count_subq()
    result = await session.execute(
        select(
            func.count(distinct(Email.id)).label("total_emails"),
            func.count(distinct(Email.id)).filter(Email.is_opened.is_(True)).label("opened_emails"),
            func.count(distinct(Email.id)).filter(Email.email_type == EmailType.FOLLOW_UP).label("follow_ups"),
            func.coalesce(func.sum(ocsq.c.open_count), 0).label("total_opens"),
            func.max(EmailTracking.opened_at).label("last_interaction"),
        )
        .select_from(Recruiter)
        .join(Email, Recruiter.id == Email.recruiter_id)
        .outerjoin(ocsq, Email.id == ocsq.c.email_id)
        .outerjoin(EmailTracking, Email.id == EmailTracking.email_id)
        .where(Recruiter.user_id == current_user.id, Recruiter.company == company_name)
    )
    row = result.mappings().first()
    if row is None or row["total_emails"] == 0:
        raise HTTPException(status_code=404, detail="Company not found")

    return {
        "company_details": {
            "total_emails": row["total_emails"],
            "opened_emails": row["opened_emails"],
            "follow_ups": row["follow_ups"],
            "total_opens": int(row["total_opens"]),
            "last_interaction": row["last_interaction"].isoformat() if row["last_interaction"] else None,
        }
    }


@router.get("/company/{company_name}/emails")
async def get_company_emails(
    company_name: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    ocsq = _open_count_subq()
    result = await session.execute(
        select(
            Email.id.label("email_id"),
            Recruiter.name.label("recruiter_name"),
            Recruiter.company,
            Email.email_type,
            Email.status,
            Email.is_opened,
            Email.created_at.label("sent_date"),
            func.coalesce(ocsq.c.open_count, 0).label("open_count"),
        )
        .join(Recruiter, Email.recruiter_id == Recruiter.id)
        .outerjoin(ocsq, Email.id == ocsq.c.email_id)
        .where(Email.user_id == current_user.id, Recruiter.company == company_name)
        .order_by(Email.created_at.desc())
    )
    return {"company_emails": [_row_to_email_dict(r) for r in result.mappings().all()]}
```

---

### Task 2: Register the analytics router and include the CORS fix

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Update `backend/app/main.py` to register the analytics router and fix CORS**

Replace the full file content with:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.routers import auth, contacts, templates, analytics

app = FastAPI(title="Email Automation API")

app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router)
app.include_router(contacts.router)
app.include_router(templates.router)
app.include_router(analytics.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

### Task 3: Write and run tests for the analytics router

**Files:**
- Create: `backend/tests/test_analytics_router.py`

- [ ] **Step 1: Create `backend/tests/test_analytics_router.py`**

```python
"""Tests for analytics endpoints."""
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import get_current_user, get_db


def _mock_user(user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    return user


def _override_auth(user_id: int = 1):
    user = _mock_user(user_id)
    async def _dep():
        return user
    return _dep


def _override_session(execute_return=None):
    mock_session = AsyncMock()
    if execute_return is not None:
        mock_session.execute.return_value = execute_return
    async def _dep():
        yield mock_session
    return _dep


def _empty_result():
    result = MagicMock()
    result.fetchall.return_value = []
    result.mappings.return_value.all.return_value = []
    result.scalar.return_value = 0
    result.first.return_value = None
    return result


# ── /companies ────────────────────────────────────────────────────────────────

def test_companies_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/companies")
    assert response.status_code == 401


def test_companies_returns_list():
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [("Google",), ("Meta",)]

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _override_session(mock_result)
    client = TestClient(app)
    response = client.get("/companies")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"companies": ["Google", "Meta"]}


# ── /analytics ────────────────────────────────────────────────────────────────

def test_analytics_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/analytics")
    assert response.status_code == 401


def test_analytics_returns_paginated_shape():
    count_result = MagicMock()
    count_result.scalar.return_value = 0

    rows_result = MagicMock()
    rows_result.mappings.return_value.all.return_value = []

    mock_session = AsyncMock()
    mock_session.execute.side_effect = [count_result, rows_result]

    async def _dep():
        yield mock_session

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _dep
    client = TestClient(app)
    response = client.get("/analytics?page=1&page_size=20")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert "analytics" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["page_size"] == 20


# ── /company-analytics ────────────────────────────────────────────────────────

def test_company_analytics_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/company-analytics")
    assert response.status_code == 401


def test_company_analytics_returns_list():
    agg_result = MagicMock()
    agg_result.mappings.return_value.all.return_value = []

    status_result = MagicMock()
    status_result.fetchall.return_value = []

    mock_session = AsyncMock()
    mock_session.execute.side_effect = [agg_result, status_result]

    async def _dep():
        yield mock_session

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _dep
    client = TestClient(app)
    response = client.get("/company-analytics")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"company_analytics": []}


# ── /company/{name} ───────────────────────────────────────────────────────────

def test_company_details_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/company/Google")
    assert response.status_code == 401


def test_company_details_404_when_not_found():
    mock_result = MagicMock()
    mock_result.mappings.return_value.first.return_value = {"total_emails": 0}

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _override_session(mock_result)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/company/NonExistent")
    app.dependency_overrides.clear()

    assert response.status_code == 404


# ── /company/{name}/emails ────────────────────────────────────────────────────

def test_company_emails_requires_auth():
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/company/Google/emails")
    assert response.status_code == 401


def test_company_emails_returns_list():
    mock_result = MagicMock()
    mock_result.mappings.return_value.all.return_value = []

    app.dependency_overrides[get_current_user] = _override_auth()
    app.dependency_overrides[get_db] = _override_session(mock_result)
    client = TestClient(app)
    response = client.get("/company/Google/emails")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"company_emails": []}
```

- [ ] **Step 2: Run the tests**

```bash
cd backend && python -m pytest tests/test_analytics_router.py -v
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/analytics.py backend/app/main.py backend/tests/test_analytics_router.py
git commit -m "feat: add analytics router with 5 endpoints and CORS fix"
```

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feature/analytics-router
gh pr create --title "feat: analytics router + CORS fix" --body "$(cat <<'EOF'
## Summary
- Adds 5 analytics endpoints the Dashboard depends on: /companies, /analytics, /company-analytics, /company/{name}, /company/{name}/emails
- All endpoints scoped to authenticated user via JWT cookie
- Fixes CORS: replaces allow_origins=["*"] with settings.frontend_url

## Non-coding checklist
- [ ] Set FRONTEND_URL on Render to your Netlify URL (e.g. https://your-site.netlify.app)
- [ ] Confirm BASE_URL on Render is set to the Render backend URL
EOF
)"
```

---

## Branch 2: `feature/auth-gate`

Create this branch from `main` after merging Branch 1, or from `main` now (they don't conflict):

```bash
git checkout main && git pull
git checkout -b feature/auth-gate
```

---

### Task 4: Add fetchMe to the API service

**Files:**
- Modify: `frontend/src/services/api.js`

- [ ] **Step 1: Add `fetchMe` to the bottom of `frontend/src/services/api.js`**

```js
export const fetchMe = async () => {
  const response = await axios.get(`${API_BASE_URL}/auth/me`, {
    withCredentials: true,
  });
  return response.data;
};
```

---

### Task 5: Create the RequireAuth component

**Files:**
- Create: `frontend/src/components/RequireAuth.jsx`

- [ ] **Step 1: Create `frontend/src/components/RequireAuth.jsx`**

```jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { fetchMe } from "../services/api";

const RequireAuth = () => {
  const [status, setStatus] = useState("checking"); // "checking" | "authenticated" | "unauthenticated"

  useEffect(() => {
    fetchMe()
      .then(() => setStatus("authenticated"))
      .catch(() => setStatus("unauthenticated"));
  }, []);

  if (status === "checking") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
```

---

### Task 6: Create the LoginPage component

**Files:**
- Create: `frontend/src/components/LoginPage.jsx`

- [ ] **Step 1: Create `frontend/src/components/LoginPage.jsx`**

```jsx
import React from "react";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";

const LoginPage = () => {
  const handleLogin = () => {
    window.location.href = `${process.env.REACT_APP_API_URL}/auth/login`;
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f5f5f5",
      }}
    >
      <Card sx={{ minWidth: 320, p: 2, textAlign: "center" }} elevation={3}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Email Automation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to access your dashboard
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleLogin}
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
```

---

### Task 7: Update App.jsx with protected routes

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Replace `frontend/src/App.jsx` with this content**

```jsx
import React from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
} from "@mui/material";
import Dashboard from "./components/Dashboard";
import ContactImport from "./components/ContactImport";
import TemplatesPage from "./components/TemplatesPage";
import LoginPage from "./components/LoginPage";
import RequireAuth from "./components/RequireAuth";

const NAV_LINKS = [
  { label: "Dashboard", path: "/" },
  { label: "Contacts", path: "/contacts" },
  { label: "Templates", path: "/templates" },
];

function NavBar() {
  const location = useLocation();
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Email Automation
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {NAV_LINKS.map(({ label, path }) => (
            <Button
              key={path}
              component={Link}
              to={path}
              color={location.pathname === path ? "primary" : "inherit"}
              variant={location.pathname === path ? "outlined" : "text"}
            >
              {label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function AppShell() {
  return (
    <>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<ContactImport />} />
            <Route path="/templates" element={<TemplatesPage />} />
          </Route>
        </Routes>
      </Container>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.js frontend/src/components/RequireAuth.jsx frontend/src/components/LoginPage.jsx frontend/src/App.jsx
git commit -m "feat: add login page and RequireAuth gate for all protected routes"
```

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feature/auth-gate
gh pr create --title "feat: login page + auth gate" --body "$(cat <<'EOF'
## Summary
- Adds /login page with Sign in with Google button
- Adds RequireAuth wrapper — checks /auth/me on mount, redirects to /login on 401
- All app routes (/, /contacts, /templates) now require authentication

## Non-coding checklist
- [ ] Ensure FRONTEND_URL on Render is set to your Netlify URL — the OAuth callback redirects there after login
- [ ] Google Cloud Console: confirm Authorised redirect URI includes {RENDER_BACKEND_URL}/auth/callback
EOF
)"
```
