# Ticket Execution Order

## Phase 0 — Infrastructure (do first, blocks everything)
Both devs complete these before writing any code.

| Ticket | Description |
|--------|-------------|
| KAN-41 | Create new Neon DB project and connection string |
| KAN-42 | Set up Google Cloud OAuth app and credentials |
| KAN-43 | Set up Cloudflare R2 bucket for resume storage |
| KAN-44 | Set up Render service for FastAPI backend |
| KAN-45 | Set up Vercel project for React frontend |
| KAN-46 | Create shared .env.example with all required variables |

---

## Phase 1 — Auth Foundation (both devs, blocks everything else)

| Ticket | Description |
|--------|-------------|
| KAN-14 | Alembic DB migrations for new schema |
| KAN-11 | Google OAuth login flow |
| KAN-12 | Users table and Gmail token encryption |
| KAN-13 | Per-user data isolation |

---

## Phase 2 — Parallel Tracks (after Phase 1)

### Dev 1 — Backend
| Order | Ticket | Description |
|-------|--------|-------------|
| 1 | KAN-18 | contact_lists table and recruiters migration |
| 2 | KAN-15 | ContactImporter pluggable interface |
| 3 | KAN-16 | Text file upload endpoint |
| 4 | KAN-19 | Templates table and CRUD API |
| 5 | KAN-30 | Cloudflare R2 setup and resume upload |
| 6 | KAN-31 | Attach resume to outgoing emails |
| 7 | KAN-23 | Campaigns table and CRUD API |
| 8 | KAN-24 | Campaign send flow |
| 9 | KAN-25 | Follow-up automation |
| 10 | KAN-26 | Campaign preview screen |
| 11 | KAN-27 | Tracking pixel endpoint |
| 12 | KAN-28 | Per-campaign metrics API |

### Dev 2 — Frontend
| Order | Ticket | Description |
|-------|--------|-------------|
| 1 | KAN-32 | React Router setup and page scaffolding |
| 2 | KAN-39 | Empty states and mobile-responsive layout |
| 3 | KAN-33 | Onboarding wizard for first-time users |
| 4 | KAN-35 | Contacts page |
| 5 | KAN-17 | Contact list preview and confirm UI |
| 6 | KAN-36 | Templates page |
| 7 | KAN-20 | Guided template builder |
| 8 | KAN-21 | Free-form rich text editor with variables |
| 9 | KAN-22 | Template persistence and selection |
| 10 | KAN-37 | Campaigns page |
| 11 | KAN-34 | Dashboard page |
| 12 | KAN-29 | Tracking dashboard UI |
| 13 | KAN-38 | Settings page |

---

## Phase 3 — Polish
| Ticket | Description |
|--------|-------------|
| KAN-33 | Onboarding wizard refinement (after all pages exist) |

---

## Dependency Summary

```
Phase 0 (Infra)
    └── Phase 1 (Auth)
            ├── Dev 1: Contact Import → File Storage → Campaigns → Tracking
            └── Dev 2: Scaffolding → Onboarding → Pages → Dashboard
```

> Dev 2 can mock API responses and build pages independently.
> Swap mocks for real endpoints as Dev 1 completes each backend story.
