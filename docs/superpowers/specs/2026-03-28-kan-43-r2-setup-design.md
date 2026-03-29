# KAN-43: Cloudflare R2 Setup for Resume Storage
**Date:** 2026-03-28
**Status:** Approved
**Ticket:** https://callbackgetter.atlassian.net/browse/KAN-43
**Blocks:** KAN-30 (resume upload endpoint)

---

## Context

Phase 0 infrastructure ticket. The backend needs a Cloudflare R2 bucket for storing resume PDFs per-user. This ticket delivers the bucket, API credentials, config wiring, and a pre-configured boto3 R2 client module so KAN-30 can implement the upload endpoint without re-deriving connection logic.

---

## Deliverables

### 1. Manual Infra (Cloudflare Dashboard)

Steps to run once:
1. Log into Cloudflare dashboard → R2 → Create bucket named `email-automation-resumes`
2. R2 → Manage R2 API Tokens → Create token with **Object Read & Write** scoped to that bucket
3. Note down: Account ID, Access Key ID, Secret Access Key, Bucket Name

### 2. Config (`backend/app/config.py`)

Add four new fields to `Settings`:

```python
r2_account_id: str
r2_access_key_id: str
r2_secret_access_key: str
r2_bucket_name: str
```

R2 endpoint URL is derived at runtime as `https://<r2_account_id>.r2.cloudflarestorage.com` — not stored separately.

### 3. Storage Service (`backend/app/services/storage.py`)

New module exposing a pre-configured boto3 S3 client pointed at R2:

```python
import boto3
from app.config import settings

r2_client = boto3.client(
    "s3",
    endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
    aws_access_key_id=settings.r2_access_key_id,
    aws_secret_access_key=settings.r2_secret_access_key,
    region_name="auto",
)
```

KAN-30 imports `r2_client` and calls:
```python
r2_client.upload_fileobj(file, settings.r2_bucket_name, object_key)
```

### 4. Dependencies (`backend/requirements.txt`)

Add:
```
boto3
```

---

## Out of Scope

- `.env.example` update — KAN-46
- Resume upload FastAPI endpoint — KAN-30
- `users.resume_url` DB column — KAN-14 / KAN-12

---

## Verification

- `boto3` installs without conflict in the existing virtualenv
- App starts successfully with R2 env vars set (no import errors)
- A manual smoke test (`r2_client.list_buckets()`) returns the bucket without error
