---
title: "Threat intelligence permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 23
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Threat intelligence: permissions

EPSS, KEV, threat actors and indicators of compromise.

- **CTEM stages:** prioritization
- **Modules:** `iocs`, `threat_intel` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `findings:vulnerabilities:read`, `threat_intel:read`, `threat_intel:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `findings:vulnerabilities:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| `threat_intel:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Threat intelligence analyst |
| `threat_intel:write` | Owner, Administrator, Threat intelligence analyst |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/iocs` | `threat_intel:read` | gap: §1.3 IOC matches (L-18) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Threat intelligence analyst |
| POST | `/api/v1/iocs` | `threat_intel:write` | gap: §1.3 IOC matches (L-18) |  | Owner, Administrator, Threat intelligence analyst |
| GET | `/api/v1/iocs/matches` | `threat_intel:read` | gap: §1.3 IOC matches (L-18) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Threat intelligence analyst |
| DELETE | `/api/v1/iocs/{id}` | `threat_intel:write` | gap: §1.3 IOC matches (L-18) |  | Owner, Administrator, Threat intelligence analyst |
| GET | `/api/v1/iocs/{id}` | `threat_intel:read` | gap: §1.3 IOC matches (L-18) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Threat intelligence analyst |
| GET | `/api/v1/iocs/{id}/matches` | `threat_intel:read` | gap: §1.3 IOC matches (L-18) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Threat intelligence analyst |
| GET | `/api/v1/threat-actors` | `threat_intel:read` | system: threat actor catalog |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Threat intelligence analyst |
| POST | `/api/v1/threat-actors` | `threat_intel:write` | system: threat actor catalog |  | Owner, Administrator, Threat intelligence analyst |
| DELETE | `/api/v1/threat-actors/{id}` | `threat_intel:write` | system: threat actor catalog |  | Owner, Administrator, Threat intelligence analyst |
| GET | `/api/v1/threat-actors/{id}` | `threat_intel:read` | system: threat actor catalog |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Threat intelligence analyst |
| POST | `/api/v1/threat-intel/enrich` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/threat-intel/enrich/{cveId}` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/threat-intel/epss/stats` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/threat-intel/epss/{cveId}` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/threat-intel/kev/stats` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/threat-intel/kev/{cveId}` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/threat-intel/stats` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/threat-intel/sync` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/threat-intel/sync/{source}` | `findings:vulnerabilities:read` | system: global EPSS/KEV feeds |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
