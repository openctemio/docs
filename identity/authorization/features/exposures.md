---
title: "Exposures and leaked credentials permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 11
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Exposures and leaked credentials: permissions

Non-vulnerability exposures (misconfiguration, identity, leaked credentials, lookalike domains) and the leaked-credential register.

- **CTEM stages:** discovery, prioritization
- **Modules:** `credentials`, `exposures` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `findings:approve`, `findings:credentials:read`, `findings:credentials:reveal`, `findings:credentials:write`, `findings:delete`, `findings:exposures:delete`, `findings:exposures:read`, `findings:exposures:triage`, `findings:exposures:write`, `findings:read`, `findings:vulnerabilities:read`, `findings:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `findings:approve` | Owner, Administrator, CTEM program lead, Risk approver |
| `findings:credentials:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| `findings:credentials:reveal` | Owner, Administrator |
| `findings:credentials:write` | Owner, Administrator, Threat intelligence analyst |
| `findings:delete` | Owner, Administrator |
| `findings:exposures:delete` | Owner, Administrator |
| `findings:exposures:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `findings:exposures:triage` | Owner, Administrator, Member, Security analyst, Vulnerability manager, Threat intelligence analyst |
| `findings:exposures:write` | Owner, Administrator, Member, Security analyst, Vulnerability manager, Threat intelligence analyst |
| `findings:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `findings:vulnerabilities:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| `findings:write` | Owner, Administrator, Member, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Validation engineer, Threat intelligence analyst |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/credentials` | `findings:credentials:read` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| GET | `/api/v1/credentials/enums` | `findings:credentials:read` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| GET | `/api/v1/credentials/identities` | `findings:credentials:read` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| GET | `/api/v1/credentials/identities/{identity}/exposures` | `findings:credentials:read` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| POST | `/api/v1/credentials/import` | `findings:credentials:write` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Threat intelligence analyst |
| POST | `/api/v1/credentials/import/csv` | `findings:credentials:write` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Threat intelligence analyst |
| GET | `/api/v1/credentials/import/template` | `findings:credentials:read` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| GET | `/api/v1/credentials/stats` | `findings:credentials:read` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| GET | `/api/v1/credentials/{id}` | `findings:credentials:read` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| POST | `/api/v1/credentials/{id}/accept` | `findings:approve`, `findings:credentials:write` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator |
| POST | `/api/v1/credentials/{id}/false-positive` | `findings:approve`, `findings:credentials:write` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator |
| POST | `/api/v1/credentials/{id}/reactivate` | `findings:credentials:write` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Threat intelligence analyst |
| GET | `/api/v1/credentials/{id}/related` | `findings:credentials:read` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Threat intelligence analyst, Auditor |
| POST | `/api/v1/credentials/{id}/resolve` | `findings:credentials:write` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) |  | Owner, Administrator, Threat intelligence analyst |
| POST | `/api/v1/credentials/{id}/reveal` | `findings:credentials:reveal` | scoped: leaks on in-scope assets; asset-less leaks: unrestricted callers only (L-10) | yes | Owner, Administrator |
| GET | `/api/v1/ctem-ids` | `findings:vulnerabilities:read` | system: identifier catalog |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/exposures` | `findings:exposures:read`, `findings:read` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/exposures` | `findings:exposures:write`, `findings:write` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator, Member, Security analyst, Vulnerability manager, Threat intelligence analyst |
| POST | `/api/v1/exposures/ingest` | `findings:exposures:write`, `findings:write` | gap: §3 H1 of research 21b: asset_id checked (C3), but the fingerprint upsert can overwrite an out-of-scope or asset-less exposure |  | Owner, Administrator, Member, Security analyst, Vulnerability manager, Threat intelligence analyst |
| GET | `/api/v1/exposures/stats` | `findings:exposures:read`, `findings:read` | partial: counts tenant-wide (L-18) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| DELETE | `/api/v1/exposures/{id}` | `findings:delete`, `findings:exposures:delete` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator |
| GET | `/api/v1/exposures/{id}` | `findings:exposures:read`, `findings:read` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/exposures/{id}/accept` | `findings:approve`, `findings:exposures:triage` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator |
| PUT | `/api/v1/exposures/{id}/ctem-id` | `findings:exposures:write`, `findings:write` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator, Member, Security analyst, Vulnerability manager, Threat intelligence analyst |
| POST | `/api/v1/exposures/{id}/false-positive` | `findings:approve`, `findings:exposures:triage` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator |
| GET | `/api/v1/exposures/{id}/history` | `findings:exposures:read`, `findings:read` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/exposures/{id}/reactivate` | `findings:exposures:triage`, `findings:write` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator, Member, Security analyst, Vulnerability manager, Threat intelligence analyst |
| POST | `/api/v1/exposures/{id}/resolve` | `findings:exposures:triage`, `findings:write` | scoped: exposure service scope; POST / checks asset_id with AssertAssetRef (research 21b C3) |  | Owner, Administrator, Member, Security analyst, Vulnerability manager, Threat intelligence analyst |
