---
title: "Role and permission matrix"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 1
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Role and permission matrix

**Built-in roles** cannot be edited. Every new member starts as a viewer.

**Role templates** are starting points for custom roles (Settings > Roles > New role > Start from a template). A template grants nothing until a role is created from it, and nobody can create a role holding permissions they lack.

A person may hold several roles; their permissions are the union. Roles never decide which assets someone sees, except roles with full data access. Teams decide that.

| Role | Kind | Full data | For |
|---|---|---|---|
| **Owner** (`owner`) | built-in | yes | Full access to everything, including deleting the organization and changing administrators. Passes every permission check. |
| **Administrator** (`admin`) | built-in | yes | Administrative access to every feature except deleting the organization; only the owner manages other administrators. Passes every permission check. |
| **Member** (`member`) | built-in |  | Works with assets, findings, scans and remediation inside their data scope; no deletes, no administration. |
| **Viewer** (`viewer`) | built-in |  | Read-only access inside their data scope. Every new member starts here. |
| **CTEM program lead** (`program-lead`) | template | yes | Runs the program: scopes cycles, sets priority rules and SLAs, approves risk acceptance and suppressions, approves scope changes and reports to leadership. Does not administer members, sensors or integrations. |
| **Security analyst** (`security-analyst`) | template |  | Triages findings and exposures in their scope: severity, status, duplicates, assignment, comments and evidence; verifies fixes and requests retests. May request risk acceptance but never approves it. |
| **Vulnerability manager** (`vulnerability-manager`) | template |  | Owns the remediation backlog: routes work to owners with assignment rules, runs remediation campaigns, schedules scans and reports on SLA performance. Does not approve risk acceptance. |
| **Remediation owner** (`remediation-owner`) | template |  | Fixes what is assigned to their team: comments, remediation steps, tickets and marking a fix applied. Requests risk acceptance with a justification. Cannot verify their own fix, approve, delete or change scans. |
| **AppSec engineer** (`appsec-engineer`) | template |  | Runs code and dependency scanning for their repositories, triages application findings and works the CI gate with developers. |
| **Scan operator** (`scan-operator`) | template |  | Schedules and runs scans and scan workflows against approved scope and watches their results. Cannot change scope, sensors, templates or findings. |
| **Validation engineer** (`validation-engineer`) | template |  | Proves exploitability: runs pentest campaigns, attack simulations and control tests, records validated findings and retests fixes. Cannot approve risk or change scope. |
| **External tester** (`external-tester`) | template |  | A vendor penetration tester on an engagement: reads and writes findings of the campaigns they are a member of and their retests. Pair with an external membership that has an end date and a team that holds only the engagement's assets. |
| **Threat intelligence analyst** (`threat-intel-analyst`) | template |  | Maintains attacker profiles, threat actors and indicators, and records external exposures such as leaked credentials and lookalike domains. |
| **Risk approver** (`risk-approver`) | template |  | Governance: approves or rejects risk acceptance, false positives and suppression rules, and maintains compliance assessments. Holds no fix or triage permission, so the person who asks is never the person who approves. |
| **Auditor** (`auditor`) | template | yes | Read-only evidence for an audit: every asset, finding, decision and the audit log, plus exports. Changes nothing. Give it to internal or external auditors with an access end date. |
| **Executive viewer** (`executive`) | template |  | Dashboards, CTEM cycle outcomes and reports for leadership, inside the data scope of their teams. Less than the built-in viewer: no configuration, scans or member lists. |

## Separation of duties

- The person who marks a fix applied (`findings:fix_apply`) is never the one who verifies it (`findings:verify`).
- Risk acceptance and false positives are requested with `findings:status` and decided with `findings:approve`; no template holds both.
- Suppression rules are written with `findings:suppressions:write` and approved with `findings:suppressions:approve`.
- Scope is widened with `attack_surface:scope:write` and approved with `attack_surface:scope:approve`.
- Nobody grants a role carrying a permission they do not hold; only the owner creates administrators.

## Permissions

Columns: built-in roles, then templates. Owner and administrator pass every check whatever their list says.

| Permission | Description | owner | admin | member | viewer | program-lead | security-analyst | vulnerability-manager | remediation-owner | appsec-engineer | scan-operator | validation-engineer | external-tester | threat-intel-analyst | risk-approver | auditor | executive |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `ai_triage:read` | View AI Triage: View AI triage results | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  |  |  |  |
| `ai_triage:trigger` | Trigger AI Triage: Run AI triage on findings | ✓ | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |
| `assets:components:delete` | Delete Components: Remove components | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `assets:components:read` | View Components: View software components | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |
| `assets:components:write` | Manage Components: Update component info | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |  |  |  |  |
| `assets:delete` | Delete Assets: Remove assets permanently | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `assets:export` | Export Assets: Export asset data | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `assets:groups:delete` | Delete Asset Groups: Remove asset groups | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `assets:groups:read` | View Asset Groups: View asset groups | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |
| `assets:groups:write` | Manage Asset Groups: Create and update asset groups | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `assets:import` | Import Assets: Import assets from external sources | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `assets:read` | View Assets: View asset details and list | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `assets:write` | Manage Assets: Create and update assets | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |  |  |  |  |
| `attack_surface:scope:approve` | Approve Scope Changes: Create effective scope entries and approve or reject scope requests and widenings (RFC-054) | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `attack_surface:scope:delete` | Delete Scope: Remove scope rules | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `attack_surface:scope:exclusions:approve` | Approve Scope Exclusions: Approve or reject a pending scope exclusion (it suppresses scanning) | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `attack_surface:scope:read` | View Scope: View scope configuration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |
| `attack_surface:scope:write` | Manage Scope: Configure scope rules | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `audit:read` | View Audit Logs: See audit history | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  | ✓ |  |
| `compliance:assessments:read` | View Compliance Assessments: View control assessments | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  | ✓ | ✓ |  |
| `compliance:assessments:write` | Manage Compliance Assessments: Update control assessments | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  | ✓ |  |  |
| `compliance:frameworks:read` | View Compliance Frameworks: View compliance frameworks and controls | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  | ✓ | ✓ |  |
| `compliance:mappings:read` | View Compliance Mappings: View finding-to-control mappings | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  | ✓ | ✓ |  |
| `compliance:mappings:write` | Manage Compliance Mappings: Create/delete finding-to-control mappings | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  | ✓ |  |  |
| `ctem:attacker_profiles:read` | ctem:attacker_profiles:read | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  | ✓ |  |  |  |
| `ctem:attacker_profiles:write` | ctem:attacker_profiles:write | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |
| `ctem:business_services:read` | ctem:business_services:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  | ✓ | ✓ | ✓ |
| `ctem:business_services:write` | ctem:business_services:write | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `ctem:compensating_controls:read` | ctem:compensating_controls:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  | ✓ |  |  | ✓ | ✓ |  |
| `ctem:compensating_controls:write` | ctem:compensating_controls:write | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `ctem:cycles:read` | ctem:cycles:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  | ✓ | ✓ | ✓ |
| `ctem:cycles:write` | ctem:cycles:write | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `ctem:priority_rules:read` | ctem:priority_rules:read | ✓ | ✓ |  |  | ✓ |  | ✓ |  |  |  |  |  |  |  | ✓ |  |
| `ctem:priority_rules:write` | ctem:priority_rules:write | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `ctem:verification_checklists:read` | ctem:verification_checklists:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |  |  |  | ✓ |  |
| `ctem:verification_checklists:write` | ctem:verification_checklists:write | ✓ | ✓ | ✓ |  |  | ✓ | ✓ |  |  |  |  |  |  |  |  |  |
| `dashboard:aggregate` | View Organization Totals: See organization-wide dashboard totals even with a restricted data scope (breakdowns under 5 are hidden) | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `dashboard:read` | View Dashboard: View main dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `findings:approve` | Approve Findings: Approve or reject finding status change requests | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  | ✓ |  |  |
| `findings:assign` | Assign Findings: Assign findings to users/groups | ✓ | ✓ | ✓ |  |  | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  |
| `findings:bulk_update` | Bulk Update: Update multiple findings at once | ✓ | ✓ | ✓ |  |  | ✓ | ✓ |  |  |  |  |  |  |  |  |  |
| `findings:credentials:read` | View Credentials: View leaked credentials | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  | ✓ |  | ✓ |  |
| `findings:credentials:reveal` | Reveal Credential Secrets: Reveal the plaintext secret of a leaked credential (audited) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `findings:credentials:write` | Manage Credentials: Update credential records | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  | ✓ |  |  |  |
| `findings:delete` | Delete Findings: Remove findings | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `findings:evidence:reveal` | Reveal Evidence Secrets: Reveal the masked secret values in finding evidence (step-up, audited) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `findings:export` | Export Findings: Export findings data | ✓ | ✓ |  |  | ✓ |  | ✓ |  |  |  |  |  |  |  | ✓ |  |
| `findings:exposures:delete` | Delete Exposures: Remove exposure records | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `findings:exposures:read` | View Exposures: View security exposures | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ | ✓ |
| `findings:exposures:triage` | Triage Exposures: Triage and categorize exposures | ✓ | ✓ | ✓ |  |  | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |
| `findings:exposures:write` | Manage Exposures: Update exposure status | ✓ | ✓ | ✓ |  |  | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |
| `findings:fix_apply` | Mark Fix Applied: Mark findings as fix applied (dev/owner action) | ✓ | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |  |  |  |  |  |
| `findings:read` | View Findings: View security findings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ | ✓ |
| `findings:remediation:read` | View Remediation: View remediation tasks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ | ✓ |
| `findings:remediation:write` | Manage Remediation: Create and update tasks | ✓ | ✓ | ✓ |  |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `findings:status` | Change Status: Update finding status | ✓ | ✓ | ✓ |  |  | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |
| `findings:suppressions:approve` | Approve Suppressions: Approve suppression requests | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  | ✓ |  |  |
| `findings:suppressions:delete` | Delete Suppression Rules: Remove suppression rules | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `findings:suppressions:read` | View Suppression Rules: View suppression rules | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |  |  |  | ✓ | ✓ |  |
| `findings:suppressions:write` | Manage Suppression Rules: Create and update rules | ✓ | ✓ |  |  |  | ✓ | ✓ |  | ✓ |  |  |  |  |  |  |  |
| `findings:triage` | Triage Findings: Triage and categorize findings | ✓ | ✓ | ✓ |  |  | ✓ | ✓ |  | ✓ |  |  |  | ✓ |  |  |  |
| `findings:verify` | Verify Findings: Verify and resolve fix-applied findings (security action) | ✓ | ✓ |  |  |  | ✓ | ✓ |  | ✓ |  | ✓ |  |  |  |  |  |
| `findings:vulnerabilities:read` | View Vulnerabilities: View vulnerability database | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |
| `findings:workflows:read` | View Workflows: View automation workflows | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |  |  |  |  |  |  |  |  |
| `findings:workflows:write` | Manage Workflows: Create and update workflows | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `findings:write` | Update Findings: Modify finding details | ✓ | ✓ | ✓ |  |  | ✓ | ✓ | ✓ | ✓ |  | ✓ |  | ✓ |  |  |  |
| `integrations:api_keys:delete` | Delete API Keys: Revoke API keys | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:api_keys:read` | View API Keys: View API key list | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:api_keys:write` | Manage API Keys: Create and update API keys | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:manage` | Manage Integrations: Configure integrations | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:notifications:delete` | Delete Notifications: Remove notifications | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:notifications:read` | View Notifications: View notification settings | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:notifications:write` | Manage Notifications: Configure notifications | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:read` | View Integrations: View external integrations | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:scm:delete` | Delete SCM Connections: Remove SCM integrations | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `integrations:scm:read` | View SCM Connections: View SCM integrations | ✓ | ✓ | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |  |  |  |  |
| `integrations:scm:write` | Manage SCM Connections: Configure SCM integrations | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `pentest:campaigns:delete` | Delete Pentest Campaigns: Delete pentest campaigns | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `pentest:campaigns:read` | View Pentest Campaigns: View penetration testing campaigns | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ | ✓ |  |  | ✓ |  |
| `pentest:campaigns:write` | Manage Pentest Campaigns: Create and edit pentest campaigns | ✓ | ✓ | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |  |  |
| `pentest:findings:delete` | Delete Pentest Findings: Delete pentest findings | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `pentest:findings:read` | View Pentest Findings: View pentest findings | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ | ✓ |  |  | ✓ |  |
| `pentest:findings:write` | Manage Pentest Findings: Create and edit pentest findings | ✓ | ✓ | ✓ |  |  |  |  |  |  |  | ✓ | ✓ |  |  |  |  |
| `pentest:reports:write` | Manage Pentest Reports: Generate and manage pentest reports | ✓ | ✓ | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |  |  |
| `pentest:retests:read` | View Pentest Retests: View retest history | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  | ✓ | ✓ |  |  | ✓ |  |
| `pentest:retests:write` | Manage Pentest Retests: Create and update retests | ✓ | ✓ | ✓ |  |  |  |  |  |  |  | ✓ | ✓ |  |  |  |  |
| `pentest:templates:read` | View Pentest Templates: View finding templates | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  | ✓ | ✓ |  |  |  |  |
| `pentest:templates:write` | Manage Pentest Templates: Create and edit finding templates | ✓ | ✓ | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |  |  |
| `reports:read` | View Reports: View reports and analytics | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |  |  | ✓ | ✓ | ✓ | ✓ |
| `reports:write` | Create Reports: Generate custom reports | ✓ | ✓ | ✓ |  | ✓ |  | ✓ |  |  |  |  |  |  | ✓ |  |  |
| `scans:ci:override` | Override the CI Gate: Let one commit pass the CI gate for a limited time (break-glass, audited) (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:ci:read` | View CI Runs: See CI runs, their verdicts, the CI trust configurations and the gate policies | ✓ | ✓ | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |  |  |  |  |
| `scans:ci:write` | Manage CI Trust and Gate: Create, change and delete CI trust configurations and gate policies (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:content:read` | View Content Packs: View content packs (templates, rules, wordlists), their lint results and archives | ✓ | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |  |  |  |
| `scans:content:write` | Manage Content Packs: Upload and revoke content packs | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:delete` | Delete Scans: Remove scan history | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:execute` | Execute Scans: Trigger new scans | ✓ | ✓ | ✓ |  |  | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |  |
| `scans:freeze:override` | Override Scan Freeze Windows: Start a scan by hand while a freeze window is active (audited) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:profiles:delete` | Delete Scan Profiles: Remove scan profiles | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:profiles:read` | View Scan Profiles: View scan profiles | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |  |
| `scans:profiles:write` | Manage Scan Profiles: Create and update scan profiles | ✓ | ✓ | ✓ |  |  |  | ✓ |  | ✓ | ✓ |  |  |  |  |  |  |
| `scans:read` | View Scans: View scan history and results | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  | ✓ |  |
| `scans:secret_store:delete` | Delete Secrets: Remove secrets | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:secret_store:read` | View Secret Store: View secret store | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:secret_store:write` | Manage Secret Store: Create and update secrets | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:sources:delete` | Delete Sources: Remove data sources | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:sources:read` | View Sources: View data sources | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |  |  |  |
| `scans:sources:write` | Manage Sources: Configure data sources | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:templates:delete` | Delete Scanner Templates: Remove scanner templates | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:templates:read` | View Scanner Templates: View scanner templates | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |  | ✓ | ✓ |  |  |  |  |  |  |
| `scans:templates:write` | Manage Scanner Templates: Create and update templates | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:tenant_tools:read` | View Tool Configs: View tenant tool configurations | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |  |  |  |
| `scans:tenant_tools:write` | Manage Tool Configs: Configure tenant tools | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:tools:delete` | Delete Tools: Remove tools | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:tools:read` | View Tools: View available tools | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |  | ✓ | ✓ |  |  |  |  |  |  |
| `scans:tools:write` | Manage Tools: Configure tool settings | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:workflows:delete` | scans:workflows:delete | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scans:workflows:read` | scans:workflows:read | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |  | ✓ | ✓ |  |  |  |  |  |  |
| `scans:workflows:write` | scans:workflows:write | ✓ | ✓ | ✓ |  |  |  |  |  |  | ✓ |  |  |  |  |  |  |
| `scans:write` | Manage Scans: Configure scan settings | ✓ | ✓ | ✓ |  |  |  | ✓ |  | ✓ | ✓ |  |  |  |  |  |  |
| `sensors:approve` | Approve Sensors: Approve a pairing request: bind a sensor key to this organization (with re-authentication) (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:commands:delete` | Delete Commands: Remove sensor commands (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:commands:read` | View Commands: View sensor commands | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |  |  |  |
| `sensors:commands:write` | Send Commands: Send commands to sensors | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:delete` | Delete Sensors: Remove sensors (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:grant:narrow` | Narrow Sensor Grants: Narrow what a sensor may do (zones, tools, tier, targets, credentials, push ingest) and demote its trust level (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:grant:widen` | Widen Sensor Grants: Widen what a sensor may do and promote its trust level (audited, all administrators notified) (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:pair` | Pair Sensors: Look up a pairing code, expect a sensor and deny pairing requests (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:read` | View Sensors: View sensors | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |  |  |  |
| `sensors:revoke` | Revoke Sensors: Revoke a sensor or one of its keys (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:write` | Manage Sensors: Configure sensors (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:zones:delete` | Delete Scan Zones: Delete scan zones (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sensors:zones:read` | View Scan Zones: View scan zones, their ranges, assigned sensors and coverage | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |  |  |  |
| `sensors:zones:write` | Manage Scan Zones: Create and edit scan zones and assign sensors to them (owner and administrators only) | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `settings:read` | View Settings: See workspace configuration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |
| `settings:sla:delete` | Delete SLA: Remove SLA policies | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `settings:sla:read` | View SLA: View SLA policies and status | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  | ✓ | ✓ | ✓ |
| `settings:sla:write` | Manage SLA: Create and update SLA policies | ✓ | ✓ |  |  | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `settings:write` | Update Settings: Modify settings | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:assignment_rules:delete` | Delete Assignment Rules: Remove assignment rules | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:assignment_rules:read` | View Assignment Rules: View assignment rules | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `team:assignment_rules:write` | Manage Assignment Rules: Create and edit rules | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `team:delete` | Delete Team: Remove team permanently | ✓ | (✓) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:groups:assets` | Manage Group Assets: Assign assets to groups | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:groups:delete` | Delete Groups: Remove groups | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:groups:members` | Manage Group Members: Add/remove group members | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:groups:read` | View Groups: See groups list | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  | ✓ |  |
| `team:groups:write` | Manage Groups: Create and edit groups | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:members:invite` | Invite Members: Send invitations | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:members:read` | View Members: See team members | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |
| `team:members:write` | Manage Members: Change roles, remove members | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:read` | View Team Settings: See team configuration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `team:roles:assign` | Assign Roles: Assign roles to users | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:roles:delete` | Delete Roles: Remove custom roles | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:roles:read` | View Roles: See available roles | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  | ✓ |  |
| `team:roles:write` | Manage Roles: Create and edit custom roles | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `team:update` | Update Team: Modify team settings | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `threat_intel:read` | View Threat Intel: View threat intelligence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  | ✓ |  | ✓ |  |  |  |
| `threat_intel:write` | Manage Threat Intel: Configure threat intel sources | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  | ✓ |  |  |  |
| `validation:read` | View Validation: View penetration testing | ✓ | ✓ | ✓ | ✓ |  |  |  |  |  |  | ✓ |  |  |  |  |  |
| `validation:write` | Manage Validation: Configure pentest settings | ✓ | ✓ | ✓ |  |  |  |  |  |  |  | ✓ |  |  |  |  |  |
