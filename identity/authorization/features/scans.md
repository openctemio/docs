---
title: "Scans and workflows permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 19
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Scans and workflows: permissions

Scans, scan runs and workflows, profiles, tools, templates, rule sources, content packs and the content catalog, the secret store and freeze windows.

- **CTEM stages:** discovery, validation
- **Modules:** `scan_workflows`, `scanner_templates`, `scans`, `template_sources` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `attack_surface:programs:read`, `attack_surface:scope:approve`, `attack_surface:scope:read`, `content:install`, `content:publish`, `content:read`, `scans:approve`, `scans:content:read`, `scans:content:write`, `scans:delete`, `scans:execute`, `scans:profiles:delete`, `scans:profiles:read`, `scans:profiles:write`, `scans:read`, `scans:secret_store:delete`, `scans:secret_store:read`, `scans:secret_store:write`, `scans:sources:approve`, `scans:sources:delete`, `scans:sources:read`, `scans:sources:write`, `scans:templates:delete`, `scans:templates:read`, `scans:templates:write`, `scans:tenant_tools:write`, `scans:tools:delete`, `scans:tools:read`, `scans:tools:write`, `scans:windows:manage`, `scans:windows:override`, `scans:workflows:delete`, `scans:workflows:read`, `scans:workflows:write`, `scans:write`, `sensors:commands:read`, `sensors:commands:write`, `sensors:read`, `settings:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `attack_surface:programs:read` | Owner, Administrator, Researcher, Bug-bounty triager |
| `attack_surface:scope:approve` | Owner, Administrator, CTEM program lead |
| `attack_surface:scope:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| `content:install` | Owner, Administrator |
| `content:publish` | Owner, Administrator |
| `content:read` | Owner, Administrator, Member, Viewer |
| `scans:approve` | Owner, Administrator |
| `scans:content:read` | Owner, Administrator, Scan operator |
| `scans:content:write` | Owner, Administrator |
| `scans:delete` | Owner, Administrator |
| `scans:execute` | Owner, Administrator, Member, Security analyst, Vulnerability manager, AppSec engineer, Scan operator, Validation engineer, Researcher |
| `scans:profiles:delete` | Owner, Administrator |
| `scans:profiles:read` | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Validation engineer, Researcher |
| `scans:profiles:write` | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| `scans:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| `scans:secret_store:delete` | Owner, Administrator |
| `scans:secret_store:read` | Owner, Administrator, Member |
| `scans:secret_store:write` | Owner, Administrator |
| `scans:sources:approve` | Owner, Administrator |
| `scans:sources:delete` | Owner, Administrator |
| `scans:sources:read` | Owner, Administrator, Member, Viewer, Scan operator |
| `scans:sources:write` | Owner, Administrator |
| `scans:templates:delete` | Owner, Administrator |
| `scans:templates:read` | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| `scans:templates:write` | Owner, Administrator |
| `scans:tenant_tools:write` | Owner, Administrator, Member |
| `scans:tools:delete` | Owner, Administrator |
| `scans:tools:read` | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Sensor operator |
| `scans:tools:write` | Owner, Administrator |
| `scans:windows:manage` | Owner, Administrator |
| `scans:windows:override` | Owner, Administrator |
| `scans:workflows:delete` | Owner, Administrator |
| `scans:workflows:read` | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| `scans:workflows:write` | Owner, Administrator, Member, Scan operator |
| `scans:write` | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| `sensors:commands:read` | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| `sensors:commands:write` | Owner, Administrator, Member, Sensor operator |
| `sensors:read` | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| `settings:write` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/capabilities` | `scans:tools:read` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Sensor operator |
| POST | `/api/v1/capabilities` | `scans:tools:write` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator |
| GET | `/api/v1/capabilities/categories` | `scans:tools:read` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Sensor operator |
| DELETE | `/api/v1/capabilities/{id}` | `scans:tools:delete` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator |
| GET | `/api/v1/capabilities/{id}` | `scans:tools:read` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Sensor operator |
| PUT | `/api/v1/capabilities/{id}` | `scans:tools:write` | config: capability catalog (platform + own custom) with the usage by the tenant own tools and sensors |  | Owner, Administrator |
| GET | `/api/v1/commands` | `sensors:commands:read` | gap: L-06 (command payloads) |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/commands` | `sensors:commands:write` | gap: L-06 (command payloads) |  | Owner, Administrator, Member, Sensor operator |
| GET | `/api/v1/commands/{id}/logs` | `sensors:commands:read` | gap: L-06 (command payloads) |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v1/content-packs` | `scans:content:read` | config: content packs (RFC-061): the tenant own templates, rules and wordlists |  | Owner, Administrator, Scan operator |
| POST | `/api/v1/content-packs` | `scans:content:write` | config: content packs (RFC-061): the tenant own templates, rules and wordlists | yes | Owner, Administrator |
| GET | `/api/v1/content-packs/signing-key` | `scans:content:read` | config: content packs (RFC-061): the tenant own templates, rules and wordlists |  | Owner, Administrator, Scan operator |
| GET | `/api/v1/content-packs/{id}` | `scans:content:read` | config: content packs (RFC-061): the tenant own templates, rules and wordlists |  | Owner, Administrator, Scan operator |
| GET | `/api/v1/content-packs/{id}/download` | `scans:content:read` | config: content packs (RFC-061): the tenant own templates, rules and wordlists |  | Owner, Administrator, Scan operator |
| POST | `/api/v1/content-packs/{id}/revoke` | `scans:content:write` | config: content packs (RFC-061): the tenant own templates, rules and wordlists | yes | Owner, Administrator |
| GET | `/api/v1/content-sources` | `scans:sources:read` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) |  | Owner, Administrator, Member, Viewer, Scan operator |
| POST | `/api/v1/content-sources` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| POST | `/api/v1/content-sources/test` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| DELETE | `/api/v1/content-sources/{id}` | `scans:sources:delete` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| GET | `/api/v1/content-sources/{id}` | `scans:sources:read` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) |  | Owner, Administrator, Member, Viewer, Scan operator |
| PUT | `/api/v1/content-sources/{id}` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| DELETE | `/api/v1/content-sources/{id}/credential` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) |  | Owner, Administrator |
| PUT | `/api/v1/content-sources/{id}/credential` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| POST | `/api/v1/content-sources/{id}/rollback` | `scans:sources:approve` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| GET | `/api/v1/content-sources/{id}/snapshots` | `scans:sources:read` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) |  | Owner, Administrator, Member, Viewer, Scan operator |
| GET | `/api/v1/content-sources/{id}/snapshots/{snapshot_id}` | `scans:sources:read` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) |  | Owner, Administrator, Member, Viewer, Scan operator |
| POST | `/api/v1/content-sources/{id}/snapshots/{snapshot_id}/approve` | `scans:sources:approve` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| POST | `/api/v1/content-sources/{id}/snapshots/{snapshot_id}/reject` | `scans:sources:approve` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) |  | Owner, Administrator |
| POST | `/api/v1/content-sources/{id}/sync` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) |  | Owner, Administrator |
| POST | `/api/v1/content-sources/{id}/test` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| DELETE | `/api/v1/content-sources/{id}/webhook` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) |  | Owner, Administrator |
| POST | `/api/v1/content-sources/{id}/webhook` | `scans:sources:write` | config: rule sources: the organization's own sources and the offered platform sources (tenant-scoped repository reads) | yes | Owner, Administrator |
| GET | `/api/v1/content/installs` | `content:read` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/content/installs` | `content:install` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| DELETE | `/api/v1/content/installs/{namespace}/{name}` | `content:install` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| PUT | `/api/v1/content/installs/{namespace}/{name}/pin` | `content:install` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests |  | Owner, Administrator |
| POST | `/api/v1/content/installs/{namespace}/{name}/rollback` | `content:install` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| POST | `/api/v1/content/installs/{namespace}/{name}/update` | `content:install` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| GET | `/api/v1/content/packages` | `content:read` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests |  | Owner, Administrator, Member, Viewer |
| GET | `/api/v1/content/packages/{namespace}/{name}` | `content:read` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/content/private-packages` | `content:publish` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| POST | `/api/v1/content/private-packages/{namespace}/{name}/{version}/revoke` | `content:publish` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| GET | `/api/v1/content/requests` | `content:read` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/content/requests/{id}/approve` | `content:install` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| POST | `/api/v1/content/requests/{id}/cancel` | `content:install` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests |  | Owner, Administrator |
| POST | `/api/v1/content/requests/{id}/reject` | `content:install` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| GET | `/api/v1/content/settings` | `content:read` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests |  | Owner, Administrator, Member, Viewer |
| PUT | `/api/v1/content/settings` | `settings:write` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests | yes | Owner, Administrator |
| GET | `/api/v1/content/trust` | `content:read` | config: content catalog (RFC-099): instance catalog and the organization's private packages, installs, requests |  | Owner, Administrator, Member, Viewer |
| GET | `/api/v1/organization/settings/scan-governance` | `scans:read` | config: organization settings |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| PUT | `/api/v1/organization/settings/scan-governance/mode` | team role owner | config: organization settings | yes | Owner |
| PUT | `/api/v1/organization/settings/scan-governance/rules` | team role admin | config: organization settings | yes | Owner, Administrator |
| POST | `/api/v1/organization/settings/scan-governance/test` | team role admin | gap: L-06 (the rule tester evaluates the organization's scans, as scan reads; owner or administrator only; D9) |  | Owner, Administrator |
| GET | `/api/v1/platform-content-packs` | `scans:content:read` | config: platform content packs and channels (RFC-061): platform catalog, read-only, no tenant data |  | Owner, Administrator, Scan operator |
| GET | `/api/v1/platform-content-packs/channels` | `scans:content:read` | config: platform content packs and channels (RFC-061): platform catalog, read-only, no tenant data |  | Owner, Administrator, Scan operator |
| GET | `/api/v1/platform-content-packs/signing-key` | `scans:content:read` | config: platform content packs and channels (RFC-061): platform catalog, read-only, no tenant data |  | Owner, Administrator, Scan operator |
| GET | `/api/v1/platform-content-packs/{id}` | `scans:content:read` | config: platform content packs and channels (RFC-061): platform catalog, read-only, no tenant data |  | Owner, Administrator, Scan operator |
| GET | `/api/v1/platform/scanning` | one of `scans:read`, `sensors:read` | system: platform sensors |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-approvals` | `scans:read` | gap: L-06 (scan approval requests carry the scan definition and targets, as scan reads; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-approvals/{id}` | `scans:read` | gap: L-06 (scan approval requests carry the scan definition and targets, as scan reads; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scan-approvals/{id}/approve` | `scans:approve` | gap: L-06 (scan approval requests carry the scan definition and targets, as scan reads; D9) | yes | Owner, Administrator |
| POST | `/api/v1/scan-approvals/{id}/cancel` | `scans:write` | gap: L-06 (scan approval requests carry the scan definition and targets, as scan reads; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scan-approvals/{id}/reject` | `scans:approve` | gap: L-06 (scan approval requests carry the scan definition and targets, as scan reads; D9) |  | Owner, Administrator |
| POST | `/api/v1/scan-approvals/{id}/remind` | `scans:write` | gap: L-06 (scan approval requests carry the scan definition and targets, as scan reads; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scan-approvals/{id}/self-approve` | `scans:approve` | gap: L-06 (scan approval requests carry the scan definition and targets, as scan reads; D9) |  | Owner, Administrator |
| GET | `/api/v1/scan-profiles` | `scans:profiles:read` | config: scan profiles |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Validation engineer, Researcher |
| POST | `/api/v1/scan-profiles` | `scans:profiles:write` | config: scan profiles |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| GET | `/api/v1/scan-profiles/default` | `scans:profiles:read` | config: scan profiles |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Validation engineer, Researcher |
| DELETE | `/api/v1/scan-profiles/{id}` | `scans:profiles:delete` | config: scan profiles |  | Owner, Administrator |
| GET | `/api/v1/scan-profiles/{id}` | `scans:profiles:read` | config: scan profiles |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Validation engineer, Researcher |
| PUT | `/api/v1/scan-profiles/{id}` | `scans:profiles:write` | config: scan profiles |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scan-profiles/{id}/clone` | `scans:profiles:write` | config: scan profiles |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator |
| POST | `/api/v1/scan-profiles/{id}/evaluate-quality-gate` | `scans:profiles:read` | config: scan profiles |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Validation engineer, Researcher |
| PUT | `/api/v1/scan-profiles/{id}/quality-gate` | `scans:profiles:write` + team role admin | config: scan profiles |  | Owner, Administrator |
| POST | `/api/v1/scan-profiles/{id}/set-default` | `scans:profiles:write` + team role admin | config: scan profiles |  | Owner, Administrator |
| GET | `/api/v1/scan-runs` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-runs/{id}` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scan-runs/{id}/cancel` | `scans:write` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| GET | `/api/v1/scan-runs/{id}/events` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-runs/{id}/map` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-runs/{id}/outputs` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-runs/{id}/scope-snapshot` | `scans:read` + one of `attack_surface:programs:read`, `attack_surface:scope:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-runs/{id}/stages` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-runs/{id}/tasks` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-runs/{id}/tasks/{task_id}/logs` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-runs/{id}/tasks/{task_id}/placement` | `scans:read` | gap: L-06 (run reads) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-window-overrides` | `scans:read` | config: scan window overrides (RFC-067): tenant dispatch configuration |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scan-window-overrides` | `scans:windows:override` | config: scan window overrides (RFC-067): tenant dispatch configuration |  | Owner, Administrator |
| DELETE | `/api/v1/scan-window-overrides/{id}` | `scans:windows:override` | config: scan window overrides (RFC-067): tenant dispatch configuration |  | Owner, Administrator |
| GET | `/api/v1/scan-window-policies` | `scans:read` | config: scan window policies (RFC-067): tenant dispatch configuration |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scan-window-policies` | `scans:windows:manage` | config: scan window policies (RFC-067): tenant dispatch configuration |  | Owner, Administrator |
| POST | `/api/v1/scan-window-policies/preview` | `scans:read` | scoped: assets a draft policy selects, listed only within the caller's data scope (RFC-067) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| DELETE | `/api/v1/scan-window-policies/{id}` | `scans:windows:manage` | config: scan window policies (RFC-067): tenant dispatch configuration |  | Owner, Administrator |
| GET | `/api/v1/scan-window-policies/{id}` | `scans:read` | config: scan window policies (RFC-067): tenant dispatch configuration |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| PATCH | `/api/v1/scan-window-policies/{id}` | `scans:windows:manage` | config: scan window policies (RFC-067): tenant dispatch configuration |  | Owner, Administrator |
| POST | `/api/v1/scan-windows/preview` | `scans:read` | scoped: scan window decisions: an asset id out of the caller's data scope is 404; free-text targets return only window decisions (RFC-067) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scan-workflows` | `scans:workflows:read` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scan-workflows` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/verify` | `scans:workflows:write` | config: draft graph check against the capability catalog; reads no asset or finding data |  | Owner, Administrator, Member, Scan operator |
| DELETE | `/api/v1/scan-workflows/{id}` | `scans:workflows:delete` | gap: L-06 (scan workflow reads) |  | Owner, Administrator |
| GET | `/api/v1/scan-workflows/{id}` | `scans:workflows:read` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| PUT | `/api/v1/scan-workflows/{id}` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/activate` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/clone` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/deactivate` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| DELETE | `/api/v1/scan-workflows/{id}/draft` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| GET | `/api/v1/scan-workflows/{id}/draft` | `scans:workflows:read` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| PUT | `/api/v1/scan-workflows/{id}/draft` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/publish` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/steps` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| DELETE | `/api/v1/scan-workflows/{id}/steps/{stepId}` | `scans:workflows:delete` | gap: L-06 (scan workflow reads) |  | Owner, Administrator |
| PUT | `/api/v1/scan-workflows/{id}/steps/{stepId}` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| GET | `/api/v1/scan-workflows/{id}/template-update` | `scans:workflows:read` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scan-workflows/{id}/template-update/apply` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| POST | `/api/v1/scan-workflows/{id}/template-update/reject` | `scans:workflows:write` | gap: L-06 (scan workflow reads) |  | Owner, Administrator, Member, Scan operator |
| GET | `/api/v1/scanner-templates` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scanner-templates` | `scans:templates:write` | config: scanner templates |  | Owner, Administrator |
| GET | `/api/v1/scanner-templates/signing-key` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| GET | `/api/v1/scanner-templates/usage` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scanner-templates/validate` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| DELETE | `/api/v1/scanner-templates/{id}` | `scans:templates:delete` | config: scanner templates |  | Owner, Administrator |
| GET | `/api/v1/scanner-templates/{id}` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| PUT | `/api/v1/scanner-templates/{id}` | `scans:templates:write` | config: scanner templates |  | Owner, Administrator |
| POST | `/api/v1/scanner-templates/{id}/approve` | `attack_surface:scope:approve` | config: scanner templates | yes | Owner, Administrator, CTEM program lead |
| POST | `/api/v1/scanner-templates/{id}/deprecate` | `scans:templates:write` | config: scanner templates |  | Owner, Administrator |
| GET | `/api/v1/scanner-templates/{id}/download` | `scans:templates:read` | config: scanner templates |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| GET | `/api/v1/scans` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scans` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/approval-preview` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/bulk/activate` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/bulk/delete` | `scans:delete` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator |
| POST | `/api/v1/scans/bulk/disable` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/bulk/pause` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| GET | `/api/v1/scans/coverage` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scans/import` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| GET | `/api/v1/scans/overview-stats` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scans/quick` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/quick` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/quick/preview` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/quick/preview` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/schedule-preview` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scans/sensor-opt-in-impact` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scans/stages` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scans/stats` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scans/workflow-preview` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| DELETE | `/api/v1/scans/{id}` | `scans:delete` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator |
| GET | `/api/v1/scans/{id}` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| PUT | `/api/v1/scans/{id}` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/{id}/activate` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| GET | `/api/v1/scans/{id}/approval` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scans/{id}/approval` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/{id}/clone` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/{id}/disable` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/{id}/emergency-run` | `scans:approve`, `scans:execute` | gap: L-06 (scan reads and targets; D9) | yes | Owner, Administrator |
| GET | `/api/v1/scans/{id}/export` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scans/{id}/pause` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| GET | `/api/v1/scans/{id}/runs` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scans/{id}/runs/latest` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| GET | `/api/v1/scans/{id}/runs/{runId}` | `scans:read` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, Researcher, Auditor |
| POST | `/api/v1/scans/{id}/save` | `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/{id}/take-ownership` | `scans:write` + team role admin | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator |
| POST | `/api/v1/scans/{id}/trigger` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/scans/{id}/trigger` | `scans:execute`, `scans:write` | gap: L-06 (scan reads and targets; D9) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| GET | `/api/v1/secret-store` | `scans:secret_store:read` | config: scanner credentials |  | Owner, Administrator, Member |
| POST | `/api/v1/secret-store` | `scans:secret_store:write` + team role admin | config: scanner credentials | yes | Owner, Administrator |
| DELETE | `/api/v1/secret-store/{id}` | `scans:secret_store:delete` + team role admin | config: scanner credentials | yes | Owner, Administrator |
| GET | `/api/v1/secret-store/{id}` | `scans:secret_store:read` | config: scanner credentials |  | Owner, Administrator, Member |
| PUT | `/api/v1/secret-store/{id}` | `scans:secret_store:write` + team role admin | config: scanner credentials | yes | Owner, Administrator |
| POST | `/api/v1/secret-store/{id}/rotate` | `scans:secret_store:write` + team role admin | config: scanner credentials | yes | Owner, Administrator |
| GET | `/api/v1/tool-categories` | `scans:tools:read` | config: tool categories (platform + own custom) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Sensor operator |
| POST | `/api/v1/tool-categories` | `scans:tools:write` | config: tool categories (platform + own custom) |  | Owner, Administrator |
| DELETE | `/api/v1/tool-categories/{id}` | `scans:tools:delete` | config: tool categories (platform + own custom) |  | Owner, Administrator |
| GET | `/api/v1/tool-categories/{id}` | `scans:tools:read` | config: tool categories (platform + own custom) |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Sensor operator |
| PUT | `/api/v1/tool-categories/{id}` | `scans:tools:write` | config: tool categories (platform + own custom) |  | Owner, Administrator |
| GET | `/api/v1/tools` | `scans:tools:read` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Sensor operator |
| POST | `/api/v1/tools` | `scans:tools:write` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator |
| PATCH | `/api/v1/tools/settings` | `scans:tenant_tools:write` + team role admin | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator |
| DELETE | `/api/v1/tools/{id}` | `scans:tools:delete` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator |
| GET | `/api/v1/tools/{id}` | `scans:tools:read` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator, Member, Viewer, Vulnerability manager, AppSec engineer, CI integrator, Scan operator, Sensor operator |
| PUT | `/api/v1/tools/{id}` | `scans:tools:write` | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator |
| PATCH | `/api/v1/tools/{id}/settings` | `scans:tenant_tools:write` + team role admin | config: tool catalog (platform + own custom tools) with the tenant's settings of it |  | Owner, Administrator |
| POST | `/hooks/content-sources/{id}` | no permission: public: the URL names one rule source and its own webhook secret (header, SHA-256 compared in constant time) is the credential; the call carries no content and only queues a sync; every refusal is the same 401; per-IP, per-source and per-hour limits | system: inbound rule source webhook: the source named in the URL and its own secret decide the one tenant; the call only queues a sync |  | see Requires |
