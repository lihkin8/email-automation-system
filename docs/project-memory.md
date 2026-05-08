# Project Memory — Email Automation System

## Purpose

This document is the durable context for agents working in this repo: what the system is, why it’s built this way, where things live, and the intended work order. Keep it updated as the architecture evolves.

## High-level product

**Email Automation SaaS**: users sign in with Google, connect Gmail, import recruiter contacts, create templates, run campaigns, track opens, and send follow-ups.

Canonical design spec: `docs/superpowers/specs/2026-03-28-saas-revamp-design.md`.

## Architecture overview

- **Frontend**: React SPA (CRA) with React Router + MUI. TipTap editor is included for template editing.
  - Dependencies reference: `frontend/package.json`.
- **Backend**: FastAPI app providing REST endpoints (auth, contacts, templates, campaigns…).
  - Entry: `backend/app/main.py`.
- **Database**: PostgreSQL (Neon) accessed via async SQLAlchemy. Schema changes via Alembic.
  - Runtime session: `backend/app/database.py`.
  - Migrations: `backend/alembic/versions/`.

## Work order (do not reorder)

Source of truth: `docs/ticket-order.md`.

Backend track (relevant slice):
- KAN-18/15/16: contact import (already implemented)
- KAN-19: templates table + CRUD (already implemented)
- **KAN-23**: campaigns table + CRUD
- **KAN-24**: campaign send flow
- **KAN-25**: follow-up automation

## Backend: how code is organized

### Key paths

- **App bootstrap**: `backend/app/main.py`
- **Config**: `backend/app/config.py` (Pydantic Settings, `.env`)
- **DB session**: `backend/app/database.py` (`get_session()` yields `AsyncSession`)
- **Models**: `backend/app/models.py` (all ORM models + enums live here)
- **Repository layer**: `backend/app/repositories.py`
- **Routers**: `backend/app/routers/*.py`
- **Migrations**: `backend/alembic/versions/000x_*.py`
- **Tests**: `backend/tests/*`

### CRUD convention (copy this pattern)

Templates are the best reference:
- Router: `backend/app/routers/templates.py`
  - Defines Pydantic request/response schemas
  - Endpoints call repository methods
  - Scopes reads/writes to the authenticated `user_id`
- Repository: `backend/app/repositories.py` (`TemplateRepository`)

Tests also follow a standard style:
- `backend/tests/test_templates_router.py` patches the repository class and overrides dependencies (`get_current_user_id`, `get_session`) using `TestClient`.

### Auth model and dependencies

Current behavior:
- Google OAuth handled in `backend/app/routers/auth.py`.
- Backend sets an HTTP-only cookie `session_token` containing a signed JWT.
- `backend/app/services/auth_service.py` provides `get_current_user()` dependency (loads the user from cookie).
- Many routers depend on `backend/app/dependencies.py:get_current_user_id()` to get the integer `user_id` for scoping.

Important: **do not accept `user_id` from request bodies**; always derive from auth.

## Database + migrations conventions

- Alembic online mode uses a **sync** driver URL even though the app uses async SQLAlchemy. This is handled in `backend/alembic/env.py`.
- Postgres ENUMs are created explicitly in migrations before creating tables that reference them (see `0004_add_templates.py`).

## Current schema highlights

See `backend/app/models.py` and Alembic migrations for authoritative schema. Important existing tables:
- `users`
- `contact_lists`, `recruiters`
- `templates`
- `emails`, `email_tracking`

## Known gotchas / invariants

- Data is **always scoped by `user_id`** on every table and query (multi-user isolation).
- Contacts import is intentionally a two-step flow (`/contacts/upload` parse-only, then `/contacts` persist). Don’t collapse it into one endpoint.
- Tests are unit-ish: they patch repositories rather than hitting a real DB.

