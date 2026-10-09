---
title: "Scans and workflows permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 18
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Scans and workflows: permissions

Scans, scan runs and workflows, profiles, tools, templates, content packs, the secret store and freeze windows.

- **CTEM stages:** discovery, validation
- **Modules:** `scan_workflows`, `scanner_templates`, `scans`, `template_sources` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `scans:content:read`, `scans:content:write`, `scans:delete`, `scans:execute`, `scans:profiles:delete`, `scans:profiles:read`, `scans:profiles:write`, `scans:read`, `scans:secret_store:delete`, `scans:secret_store:read`, `scans:secret_store:write`, `scans:sources:delete`, `scans:sources:read`, `scans:sources:write`, `scans:templates:delete`, `scans:templates:read`, `scans:templates:write`, `scans:tenant_tools:write`, `scans:tools:delete`, `scans:tools:read`, `scans:tools:write`, `scans:workflows:delete`, `scans:workflows:read`, `scans:workflows:write`, `scans:write`, `sensors:commands:delete`, `sensors:commands:read`, `sensors:commands:write`, `sensors:read`, `sensors:zones:delete`, `sensors:zones:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `scans:content:read` | Owner, Administrator, Scan operator |
| `scans:content:write` | Owner, Administrator |
| `scans:delete` | Owner, Administrator |
| `scans:execute` | Owner, Administrator, Member, Security analyst, Vulnerability manager, AppSec engineer, Scan operator, Validation engineer |
| `scans:profiles:delete` | Owner, Administrator |
| `scans:profiles:read` | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, Scan operator, Validation engineer |
| `scans:profiles:write` | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| `scans:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| `scans:secret_store:delete` | Owner, Administrator |
| `scans:secret_store:read` | Owner, Administrator, Member |
| `scans:secret_store:write` | Owner, Administrator, Member |
| `scans:sources:delete` | Owner, Administrator |
| `scans:sources:read` | Owner, Administrator, Member, Viewer, Scan operator |
| `scans:sources:write` | Owner, Administrator |
| `scans:templates:delete` | Owner, Administrator |
| `scans:templates:read` | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| `scans:templates:write` | Owner, Administrator |
| `scans:tenant_tools:write` | Owner, Administrator, Member |
| `scans:tools:delete` | Owner, Administrator |
| `scans:tools:read` | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| `scans:tools:write` | Owner, Administrator |
| `scans:workflows:delete` | Owner, Administrator |
| `scans:workflows:read` | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| `scans:workflows:write` | Owner, Administrator, Member, Scan operator |
| `scans:write` | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| `sensors:commands:delete` | Owner, Administrator |
| `sensors:commands:read` | Owner, Administrator, Member, Viewer, Scan operator |
| `sensors:commands:write` | Owner, Administrator, Member |
| `sensors:read` | Owner, Administrator, Member, Viewer, Scan operator |
| `sensors:zones:delete` | Owner, Administrator |
| `sensors:zones:write` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/capabilities` | `scans:tools:read` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/capabilities` | `scans:tools:write` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator |
| GET | `/api/v1/capabilities/categories` | `scans:tools:read` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| DELETE | `/api/v1/capabilities/{id}` | `scans:tools:delete` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator |
| GET | `/api/v1/capabilities/{id}` | `scans:tools:read` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| PUT | `/api/v1/capabilities/{id}` | `scans:tools:write` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator |
| GET | `/api/v1/commands` | `sensors:commands:read` | gap: L-06 (command payloads) |  | Owner, Administrator, Member, Viewer, Scan operator |
| POST | `/api/v1/commands` | `sensors:commands:write` | gap: L-06 (command payloads) |  | Owner, Administrator, Member |
| DELETE | `/api/v1/commands/{id}` | `sensors:commands:delete` | gap: L-06 (command payloads) |  | Owner, Administrator |
| GET | `/api/v1/commands/{id}` | `sensors:commands:read` | gap: L-06 (command payloads) |  | Owner, Administrator, Member, Viewer, Scan operator |
| POST | `/api/v1/commands/{id}/cancel` | `sensors:commands:write` | gap: L-06 (command payloads) |  | Owner, Administrator, Member |
| GET | `/api/v1/commands/{id}/logs` | `sensors:commands:read` | gap: L-06 (command payloads) |  | Owner, Administrator, Member, Viewer, Scan operator |
| GET | `/api/v1/content-packs` | `scans:content:read` | config: content packs (RFC-061): the tenant own templates, rules and wordlists |  | Owner, Administrator, Scan operator |
| POST | `/api/v1/content-packs` | `scans:content:write` | config: content packs (RFC-061): the tenant own templates, rules and wordlists | yes | Owner, Administrator |
| GET | `/api/v1/content-packs/signing-key` | `scans:content:read` | config: content packs (RFC-061): the tenant own templates, rules and wordlists |  | Owner, Administrator, Scan operator |
| GET | `/api/v1/content-packs/{id}` | `scans:content:read` | config: content packs (RFC-061): the tenant own templates, rules and wordlists |  | Owner, Administrator, Scan operator |
| GET | `/api/v1/content-packs/{id}/download` | `scans:content:read` | config: content packs (RFC-061): the tenant own templates, rules and wordlists |  | Owner, Administrator, Scan operator |
| POST | `/api/v1/content-packs/{id}/revoke` | `scans:content:write` | config: content packs (RFC-061): the tenant own templates, rules and wordlists | yes | Owner, Administrator |
| GET | `/api/v1/platform/scanning` | one of `scans:read`, `sensors:read` | system: platform sensors |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scan-freeze-windows` | `scans:read` | config: scan freeze windows: tenant dispatch configuration, no asset data |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scan-freeze-windows` | `sensors:zones:write` | config: scan freeze windows: tenant dispatch configuration, no asset data |  | Owner, Administrator |
| DELETE | `/api/v1/scan-freeze-windows/{id}` | `sensors:zones:delete` | config: scan freeze windows: tenant dispatch configuration, no asset data |  | Owner, Administrator |
| GET | `/api/v1/scan-freeze-windows/{id}` | `scans:read` | config: scan freeze windows: tenant dispatch configuration, no asset data |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| PATCH | `/api/v1/scan-freeze-windows/{id}` | `sensors:zones:write` | config: scan freeze windows: tenant dispatch configuration, no asset data |  | Owner, Administrator |
| GET | `/api/v1/scan-profiles` | `scans:profiles:read` | config: scan profiles |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, Scan operator, Validation engineer |
| POST | `/api/v1/scan-profiles` | `scans:profiles:write` | config: scan profiles |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scan-profiles/default` | `scans:profiles:read` | config: scan profiles |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, Scan operator, Validation engineer |
| DELETE | `/api/v1/scan-profiles/{id}` | `scans:profiles:delete` | config: scan profiles |  | Owner, Administrator |
| GET | `/api/v1/scan-profiles/{id}` | `scans:profiles:read` | config: scan profiles |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, Scan operator, Validation engineer |
| PUT | `/api/v1/scan-profiles/{id}` | `scans:profiles:write` | config: scan profiles |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scan-profiles/{id}/clone` | `scans:profiles:write` | config: scan profiles |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scan-profiles/{id}/evaluate-quality-gate` | `scans:profiles:read` | config: scan profiles |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, Scan operator, Validation engineer |
| PUT | `/api/v1/scan-profiles/{id}/quality-gate` | `scans:profiles:write` | config: scan profiles |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scan-profiles/{id}/set-default` | `scans:profiles:write` | config: scan profiles |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scan-runs` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scan-runs/{id}` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scan-runs/{id}/cancel` | `scans:write` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scan-runs/{id}/events` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scan-runs/{id}/map` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scan-runs/{id}/outputs` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scan-runs/{id}/stages` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scan-runs/{id}/tasks` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scan-runs/{id}/tasks/{task_id}/logs` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scan-workflows` | `scans:workflows:read` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scan-workflows` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/verify` | `scans:workflows:write` | config: draft graph check against the capability catalog; reads no asset or finding data |  | Owner, Administrator, Member, Scan operator |
| DELETE | `/api/v1/scan-workflows/{id}` | `scans:workflows:delete` | gap: L-06 (scan workflow reads) |  | Owner, Administrator |
| GET | `/api/v1/scan-workflows/{id}` | `scans:workflows:read` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| PUT | `/api/v1/scan-workflows/{id}` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/activate` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/clone` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/deactivate` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| DELETE | `/api/v1/scan-workflows/{id}/draft` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| GET | `/api/v1/scan-workflows/{id}/draft` | `scans:workflows:read` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| PUT | `/api/v1/scan-workflows/{id}/draft` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/publish` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/steps` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| DELETE | `/api/v1/scan-workflows/{id}/steps/{stepId}` | `scans:workflows:delete` | gap: L-06 (scan workflow reads) |  | Owner, Administrator |
| PUT | `/api/v1/scan-workflows/{id}/steps/{stepId}` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| GET | `/api/v1/scanner-templates` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scanner-templates` | `scans:templates:write` | config: scanner templates |  | Owner, Administrator |
| GET | `/api/v1/scanner-templates/signing-key` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scanner-templates/usage` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scanner-templates/validate` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| DELETE | `/api/v1/scanner-templates/{id}` | `scans:templates:delete` | config: scanner templates |  | Owner, Administrator |
| GET | `/api/v1/scanner-templates/{id}` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| PUT | `/api/v1/scanner-templates/{id}` | `scans:templates:write` | config: scanner templates |  | Owner, Administrator |
| POST | `/api/v1/scanner-templates/{id}/deprecate` | `scans:templates:write` | config: scanner templates |  | Owner, Administrator |
| GET | `/api/v1/scanner-templates/{id}/download` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scans` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scans` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/bulk/activate` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/bulk/delete` | `scans:delete` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator |
| POST | `/api/v1/scans/bulk/disable` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/bulk/pause` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scans/coverage` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scans/import` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scans/overview-stats` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scans/quick` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/quick` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/schedule-preview` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scans/sensor-opt-in-impact` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scans/stages` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scans/stats` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scans/workflow-preview` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| DELETE | `/api/v1/scans/{id}` | `scans:delete` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator |
| GET | `/api/v1/scans/{id}` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| PUT | `/api/v1/scans/{id}` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/{id}/activate` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scans/{id}/ci-snippet` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scans/{id}/clone` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/{id}/disable` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scans/{id}/export` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scans/{id}/pause` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scans/{id}/runs` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scans/{id}/runs/latest` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| GET | `/api/v1/scans/{id}/runs/{runId}` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Auditor |
| POST | `/api/v1/scans/{id}/save` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/{id}/trigger` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scans/{id}/trigger` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/secret-store` | `scans:secret_store:read` | config: scanner credentials |  | Owner, Administrator, Member |
| POST | `/api/v1/secret-store` | `scans:secret_store:write` | config: scanner credentials |  | Owner, Administrator, Member |
| DELETE | `/api/v1/secret-store/{id}` | `scans:secret_store:delete` | config: scanner credentials |  | Owner, Administrator |
| GET | `/api/v1/secret-store/{id}` | `scans:secret_store:read` | config: scanner credentials |  | Owner, Administrator, Member |
| PUT | `/api/v1/secret-store/{id}` | `scans:secret_store:write` | config: scanner credentials |  | Owner, Administrator, Member |
| POST | `/api/v1/secret-store/{id}/rotate` | `scans:secret_store:write` | config: scanner credentials |  | Owner, Administrator, Member |
| GET | `/api/v1/template-sources` | `scans:sources:read` | config: template sources |  | Owner, Administrator, Member, Viewer, Scan operator |
| POST | `/api/v1/template-sources` | `scans:sources:write` | config: template sources |  | Owner, Administrator |
| DELETE | `/api/v1/template-sources/{id}` | `scans:sources:delete` | config: template sources |  | Owner, Administrator |
| GET | `/api/v1/template-sources/{id}` | `scans:sources:read` | config: template sources |  | Owner, Administrator, Member, Viewer, Scan operator |
| PUT | `/api/v1/template-sources/{id}` | `scans:sources:write` | config: template sources |  | Owner, Administrator |
| POST | `/api/v1/template-sources/{id}/disable` | `scans:sources:write` | config: template sources |  | Owner, Administrator |
| POST | `/api/v1/template-sources/{id}/enable` | `scans:sources:write` | config: template sources |  | Owner, Administrator |
| POST | `/api/v1/template-sources/{id}/sync` | `scans:sources:write` | config: template sources |  | Owner, Administrator |
| GET | `/api/v1/tool-categories` | `scans:tools:read` | config: tool categories (platform + own custom) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/tool-categories` | `scans:tools:write` | config: tool categories (platform + own custom) |  | Owner, Administrator |
| DELETE | `/api/v1/tool-categories/{id}` | `scans:tools:delete` | config: tool categories (platform + own custom) |  | Owner, Administrator |
| GET | `/api/v1/tool-categories/{id}` | `scans:tools:read` | config: tool categories (platform + own custom) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| PUT | `/api/v1/tool-categories/{id}` | `scans:tools:write` | config: tool categories (platform + own custom) |  | Owner, Administrator |
| GET | `/api/v1/tools` | `scans:tools:read` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/tools` | `scans:tools:write` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator |
| PATCH | `/api/v1/tools/settings` | `scans:tenant_tools:write` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator, Member |
| DELETE | `/api/v1/tools/{id}` | `scans:tools:delete` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator |
| GET | `/api/v1/tools/{id}` | `scans:tools:read` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator |
| PUT | `/api/v1/tools/{id}` | `scans:tools:write` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator |
| PATCH | `/api/v1/tools/{id}/settings` | `scans:tenant_tools:write` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator, Member |
