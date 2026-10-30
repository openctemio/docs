---
title: File storage
parent: Configuration
nav_order: 4
---

# File storage
{: .no_toc }

Where OpenCTEM keeps uploaded files (pentest evidence, finding evidence,
authorization letters, report templates, stored reports, web evidence
screenshots), how to point it at a local volume or an S3-compatible bucket,
and what it does to protect them.

1. TOC
{:toc}

## What is stored

| Files | Limit |
|---|---|
| Evidence attachments, manual finding evidence, authorization letters | 10 MiB per file |
| Report templates (Word) | 10 MiB, 20 per organization |
| Stored pentest reports | 50 MiB |
| Web evidence screenshots | 10 MiB, kept 30 days |

Scan-result imports (findings, SBOM, CSV) are read while they stream and are
not stored. Every organization's files sit under its own namespace (its
organization id), in the server storage or in the organization's own bucket.

## Local volume (default)

```env
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./data/attachments   # /app/data/attachments in the API image
```

- **Docker Compose**: the `api-data` volume is mounted at `/app/data`.
- **Kubernetes (Helm)**: `api.attachments.storage: local` (a ReadWriteOnce
  volume). More than one API replica needs a ReadWriteMany volume or S3.

Files are written atomically (temporary file, sync, rename), directories
`0700` and files `0600`. Back the volume up with the database: a database
restored without its files leaves attachments that answer 404.

## S3-compatible bucket

AWS S3 or any service that speaks the S3 API.

```env
STORAGE_PROVIDER=s3            # minio: custom endpoint with path-style addressing
STORAGE_BUCKET=openctem-attachments
STORAGE_REGION=eu-west-1
STORAGE_ENDPOINT=              # empty for AWS S3; e.g. https://objects.example.com
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_SSE=aws:kms            # optional: AES256 or aws:kms
STORAGE_SSE_KMS_KEY_ID=        # optional KMS key for aws:kms
```

- **Kubernetes (Helm)**: `api.attachments.storage: s3` and
  `api.attachments.s3.{provider,bucket,region,endpoint,existingSecret}`;
  other `STORAGE_*` variables go in `api.extraEnv`.
- Only static keys are used; nothing is read from the ambient AWS
  environment.

Bucket checklist:

- block all public access and deny requests without TLS;
- turn on default encryption, or set `STORAGE_SSE` so every object written
  asks for it (`aws:kms` needs `kms:GenerateDataKey` and `kms:Decrypt` on the
  key for the API's credentials);
- give the key only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the
  bucket's objects and `s3:ListBucket` on the bucket (used to erase a deleted
  organization and by the copy command).

### Moving between a local volume and S3

Switching `STORAGE_PROVIDER` does not move files: copy them first with
`bootstrap-admin` from the `openctem-api` image (`/app/bootstrap-admin`; with
Docker Compose, `docker compose run --rm bootstrap-admin ...`), using the
`STORAGE_*` variables the API will use:

```sh
# what would be copied
bootstrap-admin storage migrate -from local -to s3 -local-path /app/data/attachments -dry-run
# copy while the API runs (repeatable: copied files are skipped)
bootstrap-admin storage migrate -from local -to s3 -local-path /app/data/attachments
# stop the API, copy once more, set STORAGE_PROVIDER=s3, start the API
```

Each file keeps its path, is read back and compared by SHA-256, and the
source is never changed. `-verify` also checks files already copied,
`-tenant <organization id>` copies one organization, and
`-from s3 -to local` copies back.

## An organization's own bucket

An organization administrator can store the organization's files in its own
S3-compatible bucket (Settings > Organization > General, **Storage** tab; needs a second
factor, audited). Its endpoint must be reachable and is checked against
internal addresses. When that bucket cannot be used, uploads fail with 503
instead of landing on the server storage.

## Quota

How many MiB of attachments one organization may hold is decided in this order:

1. The organization's own **`storage_mb`** limit (a platform administrator sets it on the
   organization's **Limits** tab in the platform console).
2. The platform default, set in the platform console under **Settings > Limits** (a super
   admin, with a fresh confirmation and a reason; audited). It applies to the next upload
   on every replica without a restart.
3. Until the console stores a default, `STORAGE_TENANT_QUOTA_MB` (default 20480 = 20 GiB).

A default of 0 means no quota. An upload over the quota is refused with
`413 STORAGE_QUOTA_EXCEEDED`. If the stored quota cannot be read, the upload is refused too.

## Retention

An hourly job removes files nobody can reach any more, and records each
removal in the audit log (`attachment.purged`):

| Files | Removed after | Variable |
|---|---|---|
| Evidence of a deleted finding or campaign | 7 days | `STORAGE_ORPHAN_GRACE_DAYS` |
| Uploads never linked to a finding or campaign | 24 hours | `STORAGE_UNLINKED_RETENTION_HOURS` |
| Report templates and stored reports whose record was deleted | at the next run | |

0 keeps that class of file. Authorization letter files are never removed.

## Images

Uploaded PNG, JPEG, GIF and WebP files lose their metadata (location, camera,
author, comments) before they are stored; the picture itself is not changed.
The audit event of the upload keeps the SHA-256 of the original file. Images
larger than 50 megapixels are refused.

## Malware scanning

Optional, off by default. Point `STORAGE_CLAMD_ADDRESS` at a ClamAV daemon
and new uploads are scanned in the background. A flagged file is **kept and
marked**, not blocked (pentest evidence often contains exploit code on
purpose): it is listed apart with the signature, never shown inline or put
in a report, and downloads only after a confirmation that is recorded in the
audit log.

**Docker Compose** (from the `deploy` directory of the release):

```sh
docker compose -f docker-compose.yml -f docker-compose.clamav.yml up -d
```

**Kubernetes**: apply `api/deploy/kubernetes/clamav.yaml` from the
OpenCTEM release you run (a ClamAV Deployment, Service and a NetworkPolicy
that admits only the API pods) and set the address:

```sh
kubectl -n openctem apply -f api/deploy/kubernetes/clamav.yaml
```

```yaml
api:
  extraEnv:
    - name: STORAGE_CLAMD_ADDRESS
      value: openctem-clamav:3310
```

ClamAV needs about 1.5 GB of memory and outbound HTTPS to download its
signatures. While it is starting or down, new files wait as "pending" and are
scanned when it is back.

## Direct downloads from a bucket

With `STORAGE_DIRECT_DOWNLOAD=true` and an HTTPS bucket, the console
downloads files straight from the bucket with a link that works for 60
seconds, for that one file, after the same permission checks as any
download. Files on a local volume, in a bucket without HTTPS and flagged
files keep downloading through the API.

## Metrics

With `METRICS_TOKEN` set, `/metrics` exports
`openctem_storage_operations_total`, `openctem_storage_operation_seconds`,
`openctem_storage_bytes_written_total` and `openctem_storage_events_total`
(quota rejections, purges, scan results). No label names an organization or
a file.

## Environment variables

All `STORAGE_*` variables, with defaults:
[Environment variables, Attachment storage](environment-variables.md#attachment-storage).
