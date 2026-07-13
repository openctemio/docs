---
layout: default
title: Module Feature Catalog
parent: Features
nav_order: 40
---

# OpenCTEM — Module Feature Catalog

**What this is.** For every platform module, the concrete features/capabilities it provides — grounded in the actual sidebar navigation, API routes, and application services (not aspirational). Organized by the CTEM 5-phase loop, then cross-cutting and platform modules.

**How to read the tags.**
`[core]` = always on (the substrate every tenant has). `[feature]` = toggleable / part of a bundle. Where useful, the primary bundle(s) that include a module are noted.

---

## PHASE 1 · SCOPING — *define the attack surface & what matters*

### Attack Surface `attack_surface` `[feature: ASM, CTEM]`
The aggregate exposure view + attack-path analysis.
- Attack-surface score & summary stats
- Attack-path visualization with per-path risk scoring
- Exposure chains — shortest multi-step sequences from a public entry point to a KEV/crown-jewel asset
- Internet-facing asset map; finding-risk rollup into the surface score

### Scope Config `scope_config` `[feature: most bundles]`
What's in/out of scope for scanning.
- Scope targets CRUD + activate/deactivate + bulk
- Scope exclusions with an **approval workflow** + auto-expiry
- Discovery / re-scan schedules (enable/disable/run-now, due polling)
- Live scope-check ("is this in scope?") + pattern-overlap detection
- Rule-based scope engine (create → preview → reconcile → evaluate)

### Business Services `business_services` `[feature]`
Model business services and the assets that support them.
- Business-service CRUD
- Link / unlink assets to a service; list backing assets (feeds business-impact weighting)

### Business Units `business_units` `[feature]`
Organize assets by org structure.
- Business-unit CRUD; assign / remove assets

### Crown Jewels `crown_jewels` *(view over assets)*
Flag and manage highest-value assets.
- Mark / unmark an asset as crown jewel; filtered crown-jewel browsing (drives P0/P1 prioritization)

### CTEM Cycles `ctem_cycles` `[feature: Offensive, CTEM]`
Run the program as discrete, lifecycle-managed cycles.
- Cycle CRUD + lifecycle (activate → start-review → close)
- Captured scope per cycle; attach attacker profiles to a cycle

### Attacker Profiles `attacker_profiles` `[feature: ASM, Offensive, CTEM]`
Define adversary profiles that drive scoping/prioritization.
- Attacker-profile CRUD; linkable into CTEM cycles and attack simulations

### Relationships `relationships` `[feature]`
The asset relationship graph, including auto-suggested links.
- Manual relationship CRUD + batch
- Auto-generate suggested relationships; review queue (pending + count badge)
- Approve (single / batch / all), dismiss, change suggested type before approving

---

## PHASE 2 · DISCOVERY — *find assets, components, exposures*

### Assets / Asset Inventory `assets` `[core]`
The central inventory — browse, enrich, group, import, lifecycle.
- List/detail (+ full & repository detail); faceted search (stats, facets, tags)
- Asset CRUD; lifecycle (activate/deactivate/archive, snooze) + worker-driven transitions
- Per-asset sync & on-demand scan; bulk sync/status
- Asset **owners** management; **groups** (membership, per-group findings)
- **Import**: CSV, Nessus, Nessus-findings, Kubernetes
- Asset-type taxonomy; **state/change history & discovery timeline** (shadow-IT candidates, newly-exposed, appearances/disappearances)
- Type sub-views (filtered): Domains, Certificates, IPs · Websites, APIs, Mobile, Services · Hosts, Containers/K8s, Network · Databases, Storage · Cloud Accounts, Identity · Repositories
- **Duplicate review**: correlator-flagged merge queue (approve/reject + merge-log)

### Scans `scans` `[core]`
Configure, trigger, schedule, monitor scans.
- Scan CRUD + clone; trigger + one-off Quick Scan; lifecycle (activate/pause/disable) + bulk
- Run history & latest run (+ retry); stats / overview / coverage dashboards
- Import/export config + CI snippet generation; scheduled scanning

### Components (SBOM / SCA) `components` `[feature: ASPM, SBOM, CTEM]`
Software bill-of-materials + composition analysis.
- Component inventory list/detail + stats; vulnerable-component view
- Ecosystem breakdown; license inventory/analysis
- SBOM **import** (SPDX/CycloneDX) and **export**; component↔asset mapping + per-component CVEs

### Branches `branches` `[feature: ASPM, SBOM]`
Track repository branches (code-scanning scope).
- Branch CRUD; default-branch get/set; branch **compare/diff**; per-branch scan-status

### Credentials `credentials` `[feature: ASM, VM, ASPM]`
Leaked/exposed credential tracking + triage.
- Leak list + stats; group-by-identity + per-identity exposures
- Import (JSON/CSV/template) + agent ingest; related-credential correlation
- Triage lifecycle (resolve / accept / false-positive / reactivate)

### Vulnerabilities / Active CVEs `vulnerabilities` `[feature]`
The active-CVE catalog and blast-radius mapping.
- Vulnerability list/detail + lookup by CVE; **Active CVEs** view + stats
- Affected-assets mapping (by vuln and by CVE); enrichment (EPSS/KEV) feeding prioritization

---

## PHASE 3 · PRIORITIZATION — *rank by real risk*

### Findings `findings` `[core]`
The core finding lifecycle — every exposure becomes a prioritized, workflow-driven finding.
- **Lifecycle state machine**: new → confirmed → in_progress → fix_applied → resolved (+ false_positive, accepted/expirable, duplicate)
- Status / severity / classification / triage edits; **bulk** status & assign (abuse-guarded)
- **Assignment** (assign/unassign, bulk, to-owners)
- Fix workflow actions (fix-applied → verify → reject-fix) with distinct permissions
- **Approval workflow** for false-positive / risk-accept
- Comments, tags, **activity timeline** (WebSocket live)
- Jira ticket link/create; data-flow / taint view; source analytics

### Risk Scoring & Priority `risk_scoring` `[feature: all VM-like bundles]`
Compute each finding's P-class (P0–P3).
- P0–P3 classification from exploitability × reachability × business context (P0 = KEV+reachable or validated path to crown jewel)
- EPSS + KEV batch enrichment feeding classification
- **Priority explanation** ("why this P-class") — explainability endpoint
- P0-flood guard; tenant scoring config (preview, recalculate-all, presets)

### Threat Intel `threat_intel` `[feature: most bundles]`
Global CISA KEV + FIRST.org EPSS, synced and used to enrich.
- Unified threat-intel stats dashboard
- CVE enrichment (single + batch); EPSS lookups/stats; KEV lookups/stats
- Feed sync management (status, trigger, enable/disable per source; SSRF-hardened)
- **KEV auto-escalation** (open KEV findings → critical)

### Threat Actors `threat_actors` `[feature: Threat Intel]`
Tenant catalog of tracked adversary groups.
- Threat-actor CRUD (attribution/prioritization context)

### AI Triage `ai_triage` `[feature]`
LLM-assisted finding triage, prompt-injection hardened.
- **Auto** triage on finding creation; **manual** on-demand; **bulk**
- Result + history retrieval; config (modes: disabled / platform / BYOK / agent)
- Prompt-injection defenses (input sanitizer + output validator; blocks auto-apply on LLM-vs-scanner severity mismatch)
- Token **budget guard**; emits workflow events (completed/failed)

### Exposures `exposures` `[feature]`
Event-style (non-CVE) attack-surface exposures with their own lifecycle.
- CRUD + list/stats; bulk ingest; state transitions (resolve/accept/false-positive/reactivate); history timeline

### Priority Rules `priority_rules` `[feature]`
Tenant-defined override rules that force a finding's priority.
- Rule CRUD; evaluated during classification

### Business Impact `business_impact` *(composite view)*
Rank findings by the business value of the assets they touch.
- Business-service ↔ asset linkage feeding crown-jewel-weighted P0/P1

### SLA `sla` `[feature: VM, ASPM, CTEM]`
Remediation SLA policies + breach tracking.
- SLA-policy CRUD + default; per-asset override; SLA application to findings; breach notifications (via outbox)

---

## PHASE 4 · VALIDATION — *prove it's real / prove it's fixed*

### Pentest `pentest` `[feature: Offensive, CTEM]`
Full manual pentest workflow.
- **Campaigns** (CRUD, status, per-campaign stats)
- Campaign **team + RBAC roles** (Lead / Tester / Reviewer / Observer)
- Campaign findings (create, list, import, export); retests per finding
- **Reports / PDF** (create + download); reusable finding **templates**
- MITRE ATT&CK coverage view

### Attack Simulation (BAS) `attack_simulation` `[feature: Offensive, CTEM]`
Breach-and-attack simulation.
- Simulation CRUD; **run** a simulation + list past runs; technique execution → evidence (via validation engine)

### Control Testing `control_testing` `[feature: Offensive, CSPM, CTEM]`
Record security-control test results.
- Control-test list + stats; create; **record result**; delete

### Compensating Controls `compensating_controls` `[feature: Validation bundles]`
Track controls and link them to assets/findings (downgrades priority to P2).
- Control CRUD; effectiveness test; link to assets & to findings (consumed by priority classification)

### Validation Engine `validation` *(CTEM Stage-4)*
Dispatch safe-check / proof-of-fix jobs; collect agent evidence.
- **Validate a finding** (dispatches a non-intrusive safe-check job)
- **Proof-of-fix** retest (re-validate → apply outcome to finding status)
- Simulation-check dispatch (named ATT&CK technique vs an asset)
- Agent **evidence ingest** + per-finding evidence list; **coverage KPI** (% of findings validated by class)

---

## PHASE 5 · MOBILIZATION — *fix at scale & track it*

### Remediation Groups `remediation` (solution families) `[feature: remediation]`
Group findings by the single fix that resolves them (RFC-015).
- List groups over open findings; **bulk-resolve an entire solution family** in one action (→ fix_applied pending rescan, or resolved), with the verify-permission guard

### Remediation Campaigns `remediation` `[feature: remediation]`
Organized remediation drives with progress tracking.
- Campaign CRUD + status; **progress tracking** (findings matched by filter/key)
- **Active bulk resolve** (by filter or solution-family key; fails closed against tenant-wide resolves)
- Refresh progress; **create a ticket** for the campaign

### Remediation Tasks `remediation_tasks` *(operator surface)*
The operator-facing work queue — composed over finding fix-actions + groups + campaigns.

### Workflows `workflows` `[feature: most bundles]`
No-code security automation — a node/edge graph engine.
- Workflow CRUD + activate; graph editing (nodes/edges, atomic replace)
- **Triggers**: manual, schedule, finding_created/updated/status_changed/age, asset_discovered, scan_completed, webhook, ai_triage_completed/failed
- **Actions**: assign user/team, update priority/status, add/remove tags, create/update ticket, trigger pipeline/scan, http_request, run_script, trigger AI triage
- Manual execution + run management (list/get/cancel); event-driven execution

### Suppressions `suppressions` `[feature]`
Approval-gated false-positive suppression with audit trail.
- Rule CRUD; **approval workflow** (pending → approve/reject)
- **Active-rules feed for agents** (suppress at ingest); time-limited/expirable rules

### Policies `policies` *(realized as SLA policies + suppression rules)*

---

## CROSS-CUTTING

### Compliance `compliance` `[feature: Compliance, CSPM, CTEM]`
Framework-driven control coverage + finding↔control mapping.
- Framework catalog (list, controls, per-framework stats)
- Control detail + **assessment recording**; assessments list; org-wide posture stats
- **Finding-to-control mapping** (manual, **auto-map**, unmap); also exposed via the MCP `compliance_posture` tool

### IOCs `iocs` `[feature: Threat Intel]`
Indicator catalog feeding the runtime correlator.
- IOC CRUD; correlator matches IOCs vs telemetry/findings and can **reopen** findings

### Telemetry (EDR/XDR) `telemetry`
Ingest batched endpoint runtime events.
- Runtime-event ingest (rate-limited, body-limited); feeds IOC correlator + CTEM-maturity

---

## INSIGHTS — *reporting & program metrics*

### Reports & Schedules `reports` `[feature: most bundles]`
- Report-schedule CRUD + enable/disable; type, format, cron+timezone; validated recipient lists

### Executive Summary `executive_summary` `[feature]`
- Leadership risk-posture dashboard + export; KPI feeds (MTTR, risk velocity/trend, process metrics, data quality)

### CTEM Maturity `ctem_maturity` `[feature: CTEM]`
- Score the org against a CTEM maturity model (fed by telemetry + CTEM signals)

### MITRE Coverage `mitre_coverage` `[feature: Offensive, CSPM, CTEM]`
- ATT&CK matrix coverage from pentest/validation data

### SBOM Export `sbom_export` `[feature: ASPM, SBOM, CTEM]`
- Export SBOM (SPDX/CycloneDX) per repo/build from the component inventory

---

## OPERATIONS — *the scanning engine*

### Scan Profiles `scan_profiles` — reusable scan config + **quality gates** (config + evaluate)
### Scanner Templates `scanner_templates` — detection-template CRUD + validate/usage/download/deprecate
### Template Sources `template_sources` — git template sources (CRUD + enable/disable + **sync**)
### Scan Pipelines `pipelines` — multi-stage pipeline templates (steps, activate/clone, trigger runs) + **pipeline runs** (list/get/cancel)
### Tools `tools` — platform + **custom** tools, tenant enablement (enable/disable, bulk, effective config, stats), categories, **capabilities**
### Agents `agents` `[mandatory]` — platform scan-agent CRUD + lifecycle (activate/deactivate/revoke, key-rotate); agent protocol (heartbeat, poll/ack, ingest)
### Commands `commands` — control-plane command dispatch to agents (CRUD + cancel)
### Ingest (data plane) — CTIS / SARIF / recon / scan / **baseline-diff (PR)** / chunked ingest; job status
### Secret Store `secrets` — scan credential/secret CRUD referenced by tools

---

## INTEGRATIONS — *connect the ecosystem*

### Integrations core `integrations` `[mandatory]` — connector registry (CRUD, enable/disable, **test**, **sync**, test-credentials)
### SCM `integrations.scm` — GitHub/GitLab connect, **import repositories**, webhook secret rotate + incoming webhook
### Ticketing `integrations.ticketing` — **Jira** bidirectional sync (projects, HMAC incoming webhook, mapping, rescan hook) + GitHub Issues (with redaction)
### SIEM `integrations.siem` — event forwarding to SIEM platforms
### Cloud `integrations.cloud` — AWS / GCP / Azure / Kubernetes asset connectors (provider-native IDs as dedup keys)
### Notifications `integrations.notifications` `[mandatory]` — **Slack / Teams / Telegram / Email / webhook** channels; per-event routing; user prefs + email digest; **outbox** (retry/stats); in-app notifications (unread, mark-read)
### CI/CD `integrations.pipelines` — pipeline gating; scan **CI snippet** generation
### DefectDojo `integrations` — findings sync to DefectDojo
### MCP (AI Access) `integrations` — `POST /api/v1/mcp` exposing 9 read tools (findings, active CVEs, exposure chains, remediation groups, assets, compliance posture…) to AI clients
### Webhooks `webhooks` — outgoing event webhooks (CRUD + enable/disable + **delivery history**)
### API Keys `api_keys` `[mandatory]` — tenant-scoped programmatic tokens (CRUD + revoke; also authenticate the MCP endpoint)

---

## ACCESS · PLATFORM · ADMIN `[core]`

### Dashboard `dashboard` — global/tenant stats, MTTR, risk velocity/trend, data quality, process metrics, platform stats
### Roles & Permissions `roles` — role CRUD + members (bulk assign), user-role assignment, permission catalog, **permission sets**, real-time permission sync (`/me/permissions`)
### Groups / Teams + Data Scope `groups` — group CRUD + members + permission-sets; **asset ownership**; **scope rules** (data-scope: CRUD + reconcile + preview); `/me/groups`, `/me/assets`
### Assignment Rules `assignment_rules` — auto-assign findings/assets to owners (rule CRUD + test)
### SSO `saml/oidc` — SAML 2.0 SP (per-org metadata/login/ACS + admin config), OIDC/Keycloak, generic SSO & OAuth providers, **identity providers** admin (EntraID/OIDC)
### SCIM `scim` — SCIM 2.0 Users/Groups provisioning (+PATCH); token management + group mappings
### Audit `audit` `[core]` — tamper-evident trail (list/stats/history/user-activity) + **hash-chain verify/rebaseline**; admin audit logs
### Team / Tenant & Settings `settings` `[core]` — tenant + members (suspend/reactivate/remove), invitations; settings groups (general, branding, branch, pentest, asset-identity/source/lifecycle, risk-scoring, security, API); **module management** (toggles, dependency graph, presets, **bundles**)
### Admin `admin` — cross-tenant superuser (user CRUD + key-rotate, target mappings, audit)

---

## Appendix · Product bundles → which modules

The bundle catalog (`pkg/domain/module/presets.go`) packages these modules for common use cases. Every bundle also auto-includes the **8 core** modules + operational essentials (agents, integrations, notifications, groups, api_keys) + all transitive hard-dependencies.

| Bundle | Focus | Headline modules added |
|---|---|---|
| **Minimal** | blank start | core only |
| **Asset Inventory** | CMDB / IT register | attack_surface, scope_config, business_services, relationships, components |
| **VM Essentials** | Tenable/Qualys replacement | threat_intel, ai_triage, risk_*, sla, remediation, suppressions, workflows, reports |
| **ASM** | external recon | attack_surface, scope, attacker_profiles, relationships, exposure/attack-paths, credentials |
| **ASPM** | AppSec posture | components, branches, credentials, secrets, SCM/CI, pipelines, sbom_export + finding lifecycle |
| **SBOM & Supply Chain** | software composition | components, branches, sbom_export, SCM/pipelines |
| **CSPM** | cloud posture | cloud connectors, control_testing, compliance, remediation |
| **Compliance** | GRC / audit | compliance, compensating_controls, control_testing, exec reporting |
| **Offensive** | pentest / red team / bounty | pentest, attack_simulation, control_testing, ctem_cycles, mitre_coverage |
| **CTEM Full** | everything | all 5 phases + compliance + all integrations |

*A tenant subscribes to one or more bundles; the enabled set is the live union (plus per-module overrides). This document lists what each module contributes so you can compose bundles by capability.*
