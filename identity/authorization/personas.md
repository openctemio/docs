---
title: "Personas"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 2
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Personas and recommended access

Give each person the **roles** for what they do, a **team** for what they see, and an **end date** when they come from outside. Roles combine: a person may hold several.

| Persona | Roles | Team | Data scope | Access |
|---|---|---|---|---|
| **Organization owner** | Owner |  | Everything (built in). | One named owner plus a backup administrator. Not the account used for daily work. |
| **Organization administrator** | Administrator |  | Everything (built in). | Granted only by the owner, with step-up. Keep to two or three people. |
| **CISO or security leader** | CTEM program lead |  | Everything (the template carries full data access). | Permanent. |
| **CTEM program manager** | CTEM program lead |  | Everything. | Permanent. |
| **Security analyst** | Security analyst | Security operations | The program scope, through the security operations team. | Permanent. |
| **Vulnerability manager** | Vulnerability manager | Security operations | The program scope. | Permanent. |
| **Threat intelligence analyst** | Threat intelligence analyst | Security operations | The program scope; external exposures. | Permanent. |
| **Brand protection or legal** | Threat intelligence analyst | Security operations | Domain assets and their exposures. | Permanent. |
| **AppSec or DevSecOps engineer** | AppSec engineer | Product: <name> | The repositories and services of the products they cover. | Permanent. |
| **Cloud security engineer** | Security analyst, Scan operator | Infrastructure: <domain> | The cloud accounts and their resources. | Permanent. |
| **Red team or internal penetration tester** | Validation engineer | Validation and red team | The current validation scope. | Permanent; campaign membership per engagement. |
| **Breach and attack simulation engineer** | Validation engineer | Validation and red team | The assets the simulations target. | Permanent. |
| **Detection engineer or SOC analyst** | Security analyst | Security operations | The program scope. | Permanent. |
| **Scanning operations engineer** | Scan operator | Infrastructure: <domain> | The assets they scan. | Permanent. |
| **Asset or system owner** | Remediation owner | Business unit: <name> | Their business unit's or system's assets only. | Permanent; usually provisioned by SCIM into the team. |
| **IT or infrastructure engineer** | Remediation owner | Infrastructure: <domain> | Their infrastructure domain. | Permanent. |
| **Developer** | Remediation owner | Product: <name> | Their product's repositories and services. | Permanent; usually through SSO and SCIM. |
| **Engineering manager** | Remediation owner, Executive viewer | Product: <name> | Their product's assets. | Permanent. |
| **GRC, risk or compliance manager** | Risk approver | Leadership | The assets whose risk they govern (or the whole scope). | Permanent. |
| **Internal or external auditor** | Auditor | Audit <period> | Everything, read-only. | External membership with an end date (90 days by default); internal auditors by the same team with an end date. |
| **Executive or board member** | Executive viewer | Leadership | The crown-jewel and in-scope assets, or one business unit. | Permanent. |
| **Procurement or third-party risk** | Executive viewer | Business unit: <name> | Assets tagged as vendor-managed (a scope rule on a vendor tag). | Permanent. |
| **External penetration testing vendor** | External tester | Engagement: <vendor> <dates> | Only the engagement's assets and the campaign they are a member of. | External membership (viewer on entry), mandatory end date when unmanaged; campaign role tester. |
| **Bug-bounty researcher** | Researcher (RFC-064) | Program: <bug-bounty program> | The targets of the programs they belong to. | The built-in Researcher role (RFC-064) and a program group. |
| **Managed security service analyst** | Security analyst | Security operations | The customer's program scope. | An external membership in each customer organization (managed by the provider's own organization, which the customer trusts), never a cross-tenant account. |
| **CI pipeline** | none (machine identity) |  | The repository the run is bound to. | OIDC workload identity exchanged for a 15-minute run token (RFC-051); no user, no role, no API key. |
| **API integration** | Viewer |  | The data scope of the user the key belongs to, never full data. | An oct_ API key of a dedicated user with a narrow custom role; keys are read-only on the REST API and are suspended with their user. |
| **AI assistant (MCP client)** | none (machine identity) |  | The person's own data scope. | An OAuth grant on the MCP endpoint (RFC-062): granted scopes intersected with the person's live permissions; the administrator bypass never applies. |
| **Platform operator** | none (machine identity) |  | No organization data. | The platform admin console realm (RFC-022), never a member of an organization. |

## Administration

### Organization owner

Accountable for the organization in OpenCTEM: billing, administrators, deletion.

- **Roles:** Owner
- **Sees:** Everything (built in).
- **Access:** One named owner plus a backup administrator. Not the account used for daily work.
- **Must not:** share the account; use it without two-factor authentication

### Organization administrator

Runs the tool: members, teams, roles, SSO, integrations, sensors.

- **Roles:** Administrator
- **Sees:** Everything (built in).
- **Access:** Granted only by the owner, with step-up. Keep to two or three people.
- **Must not:** manage other administrators (owner only); delete the organization

## Security program

### CISO or security leader

Sets risk appetite, sponsors the program, approves material risk acceptance, reports to the board.

- **CTEM stages:** scoping, prioritization, mobilization
- **Roles:** CTEM program lead
- **Sees:** Everything (the template carries full data access).
- **Access:** Permanent.
- **Must not:** triage or fix findings they then approve; administer members or sensors

### CTEM program manager

Runs each cycle: scope charter, priority policy and SLAs, approvals, metrics.

- **CTEM stages:** scoping, prioritization, validation, mobilization
- **Roles:** CTEM program lead
- **Sees:** Everything.
- **Access:** Permanent.
- **Must not:** widen scope and approve the same change; approve their own risk requests

### Security analyst

Triages findings and exposures, assigns owners, verifies fixes.

- **CTEM stages:** discovery, prioritization, mobilization
- **Roles:** Security analyst
- **Team:** Security operations
- **Sees:** The program scope, through the security operations team.
- **Access:** Permanent.
- **Must not:** approve risk acceptance or false positives; delete findings; reveal secrets

### Vulnerability manager

Owns the remediation backlog, routing rules, campaigns and SLA reporting.

- **CTEM stages:** prioritization, mobilization
- **Roles:** Vulnerability manager
- **Team:** Security operations
- **Sees:** The program scope.
- **Access:** Permanent.
- **Must not:** approve risk acceptance; change scope

### Threat intelligence analyst

Keeps attacker profiles and threat intel current; records leaked credentials and lookalike domains.

- **CTEM stages:** discovery, prioritization
- **Roles:** Threat intelligence analyst
- **Team:** Security operations
- **Sees:** The program scope; external exposures.
- **Access:** Permanent.
- **Must not:** reveal leaked secrets (owner and administrators, with step-up)

### Brand protection or legal

Acts on lookalike domains and brand impersonation (takedowns).

- **CTEM stages:** discovery, mobilization
- **Roles:** Threat intelligence analyst
- **Team:** Security operations
- **Sees:** Domain assets and their exposures.
- **Access:** Permanent.
- **Must not:** run scans; see unrelated findings

### AppSec or DevSecOps engineer

Runs code, dependency and secret scanning for repositories; works the CI gate with developers.

- **CTEM stages:** discovery, mobilization
- **Roles:** AppSec engineer
- **Team:** Product: <name>
- **Sees:** The repositories and services of the products they cover.
- **Access:** Permanent.
- **Must not:** override the CI gate (administrators); author scanner templates (administrators)

### Cloud security engineer

Triages cloud exposures and runs scans of cloud accounts.

- **CTEM stages:** discovery, prioritization
- **Roles:** Security analyst, Scan operator
- **Team:** Infrastructure: <domain>
- **Sees:** The cloud accounts and their resources.
- **Access:** Permanent.
- **Must not:** manage sensors or scan zones (administrators)

### Red team or internal penetration tester

Proves exploitability and attack paths on prioritized exposures.

- **CTEM stages:** validation
- **Roles:** Validation engineer
- **Team:** Validation and red team
- **Sees:** The current validation scope.
- **Access:** Permanent; campaign membership per engagement.
- **Must not:** test outside approved scope; approve risk

### Breach and attack simulation engineer

Runs simulations and control tests; checks that detections fire.

- **CTEM stages:** validation
- **Roles:** Validation engineer
- **Team:** Validation and red team
- **Sees:** The assets the simulations target.
- **Access:** Permanent.
- **Must not:** run simulations against assets outside their act scope

### Detection engineer or SOC analyst

Uses validation results to tune detections; follows exposures on critical assets.

- **CTEM stages:** validation, mobilization
- **Roles:** Security analyst
- **Team:** Security operations
- **Sees:** The program scope.
- **Access:** Permanent.
- **Must not:** approve risk

### Scanning operations engineer

Schedules and runs scans and workflows on approved scope.

- **CTEM stages:** discovery
- **Roles:** Scan operator
- **Team:** Infrastructure: <domain>
- **Sees:** The assets they scan.
- **Access:** Permanent.
- **Must not:** change scope; manage sensors; change findings

## Owners and fixers

### Asset or system owner

Accountable for their systems: fixes or requests risk acceptance with a reason.

- **CTEM stages:** mobilization
- **Roles:** Remediation owner
- **Team:** Business unit: <name>
- **Sees:** Their business unit's or system's assets only.
- **Access:** Permanent; usually provisioned by SCIM into the team.
- **Must not:** verify their own fix; approve their own risk request; see other units' findings

### IT or infrastructure engineer

Patches and reconfigures hosts, network devices and cloud resources.

- **CTEM stages:** mobilization
- **Roles:** Remediation owner
- **Team:** Infrastructure: <domain>
- **Sees:** Their infrastructure domain.
- **Access:** Permanent.
- **Must not:** verify their own fix; change scans or scope

### Developer

Fixes code and dependency findings in their repositories.

- **CTEM stages:** mobilization
- **Roles:** Remediation owner
- **Team:** Product: <name>
- **Sees:** Their product's repositories and services.
- **Access:** Permanent; usually through SSO and SCIM.
- **Must not:** verify their own fix; see other products' findings

### Engineering manager

Plans remediation work for a team and follows its SLA.

- **CTEM stages:** mobilization
- **Roles:** Remediation owner, Executive viewer
- **Team:** Product: <name>
- **Sees:** Their product's assets.
- **Access:** Permanent.
- **Must not:** approve risk acceptance

## Governance and leadership

### GRC, risk or compliance manager

Approves time-bound risk acceptance and suppressions; maps controls to frameworks.

- **CTEM stages:** prioritization, mobilization
- **Roles:** Risk approver
- **Team:** Leadership
- **Sees:** The assets whose risk they govern (or the whole scope).
- **Access:** Permanent.
- **Must not:** triage, fix or verify the findings they approve

### Internal or external auditor

Collects evidence: decisions, approvals, the audit log, exports.

- **Roles:** Auditor
- **Team:** Audit <period>
- **Sees:** Everything, read-only.
- **Access:** External membership with an end date (90 days by default); internal auditors by the same team with an end date.
- **Must not:** change anything; keep access after the audit

### Executive or board member

Follows outcomes: exposure trend, SLA performance, cycle results.

- **Roles:** Executive viewer
- **Team:** Leadership
- **Sees:** The crown-jewel and in-scope assets, or one business unit.
- **Access:** Permanent.
- **Must not:** see configuration, scans or member lists

### Procurement or third-party risk

Follows exposures of vendor-managed systems and vendor credential dumps.

- **Roles:** Executive viewer
- **Team:** Business unit: <name>
- **Sees:** Assets tagged as vendor-managed (a scope rule on a vendor tag).
- **Access:** Permanent.
- **Must not:** see internal findings unrelated to vendors

## External people

### External penetration testing vendor

Tests within rules of engagement and reports findings into the campaign.

- **CTEM stages:** validation
- **Roles:** External tester
- **Team:** Engagement: <vendor> <dates>
- **Sees:** Only the engagement's assets and the campaign they are a member of.
- **Access:** External membership (viewer on entry), mandatory end date when unmanaged; campaign role tester.
- **Must not:** see the organization's other findings or inventory; keep access after the engagement

### Bug-bounty researcher

Hunts on bug-bounty programs and records findings against program targets.

- **CTEM stages:** discovery, validation
- **Roles:** Researcher (RFC-064)
- **Team:** Program: <bug-bounty program>
- **Sees:** The targets of the programs they belong to.
- **Access:** The built-in Researcher role (RFC-064) and a program group.
- **Must not:** widen the organization's own scope; approve scope entries

### Managed security service analyst

Operates the program for a customer organization.

- **CTEM stages:** discovery, prioritization, validation, mobilization
- **Roles:** Security analyst
- **Team:** Security operations
- **Sees:** The customer's program scope.
- **Access:** An external membership in each customer organization (managed by the provider's own organization, which the customer trusts), never a cross-tenant account.
- **Must not:** be an owner or administrator of the customer; carry full data access; reuse one customer's data in another

## Machines

### CI pipeline

Uploads scan results from a build and asks the gate for a verdict.

- **CTEM stages:** discovery, mobilization
- **Sees:** The repository the run is bound to.
- **Access:** OIDC workload identity exchanged for a 15-minute run token (RFC-051); no user, no role, no API key.
- **Must not:** read the organization's data; override the gate

### API integration

Reads data into another system (SIEM, data lake, ticketing).

- **Roles:** Viewer
- **Sees:** The data scope of the user the key belongs to, never full data.
- **Access:** An oct_ API key of a dedicated user with a narrow custom role; keys are read-only on the REST API and are suspended with their user.
- **Must not:** write through the REST API; act as an administrator

### AI assistant (MCP client)

Answers questions about exposures for a signed-in person.

- **Sees:** The person's own data scope.
- **Access:** An OAuth grant on the MCP endpoint (RFC-062): granted scopes intersected with the person's live permissions; the administrator bypass never applies.
- **Must not:** exceed the person's permissions; write without the person's confirmation

### Platform operator

Runs the OpenCTEM service: health, organizations, first owners.

- **Sees:** No organization data.
- **Access:** The platform admin console realm (RFC-022), never a member of an organization.
- **Must not:** read an organization's data without a support grant (RFC-063)

## Recommended teams

A team (access group) decides what its members see: the assets assigned to it, directly or by scope rules on tags and asset groups.

| Team | Type | Purpose | Assets | Usual roles | End date |
|---|---|---|---|---|---|
| Security operations | `security_team` | The central security team that triages and validates across the program scope. | A scope rule on the asset groups (or tags) that make up the current CTEM scope. | Security analyst, Vulnerability manager, Threat intelligence analyst |  |
| Business unit: <name> | `department` | Everyone who owns or fixes the systems of one business unit, and its leader. | A scope rule on the business unit's tag (for example bu:payments) or its asset groups. | Remediation owner, Executive viewer |  |
| Product: <name> | `team` | A product's engineers: its repositories, services and hosts. | The product's asset group, or a scope rule on its tag; repositories by owner. | Remediation owner, AppSec engineer |  |
| Infrastructure: <domain> | `team` | IT and infrastructure engineers for one domain (network, cloud account, endpoints). | A scope rule on the domain's tag or asset group (for example env:cloud-prod). | Remediation owner, Scan operator |  |
| Validation and red team | `security_team` | Internal testers who prove exploitability on the prioritized exposures. | The assets in the current validation scope (an asset group refreshed each cycle). | Validation engineer |  |
| Engagement: <vendor> <dates> | `external` | One external testing engagement. Pair with a pentest campaign whose team is this group. | Only the assets named in the rules of engagement, added explicitly. | External tester | yes |
| Program: <bug-bounty program> | `project` | Researchers working one bug-bounty program (RFC-064). | The program's targets; nothing from the organization's own inventory. | Researcher (RFC-064) |  |
| Leadership | `department` | Executives who follow outcomes on dashboards and reports. | A scope rule on the crown-jewel and in-scope asset groups, or per business unit. | Executive viewer |  |
| Audit <period> | `external` | Auditors for one audit period. The auditor role sees all data, so the team only tracks membership and its end date. | None needed (the auditor role carries full data access). | Auditor | yes |
