---
layout: default
title: Group-Based Access Control
parent: Platform Guides
nav_order: 6
---

# Group-Based Access Control Guide

Complete guide to the Group-based Access Control system in OpenCTEM CTEM platform.

---

## Overview

OpenCTEM uses a **Two-Layer Role Model** for access control:

1. **Layer 1: Tenant Membership** (`tenant_members.role`) - Who can administer the tenant
2. **Layer 2: Groups + Permission Sets** - What features users can access

This model enables:
- Multiple user personas (Security teams, Developers, Service Owners, Managers)
- Scoped access to specific assets
- Security sub-teams with different feature access
- Scalable management for large organizations

---

## Two-Layer Role Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TWO-LAYER ROLE MODEL                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LAYER 1: TENANT MEMBERSHIP (tenant_members.role)                       │
│  ─────────────────────────────────────────────────                      │
│  Purpose: WHO CAN ADMINISTER THE TENANT?                                │
│                                                                         │
│  ┌──────────┬───────────────────────────────────────────────────────┐  │
│  │ Role     │ Capabilities                                          │  │
│  ├──────────┼───────────────────────────────────────────────────────┤  │
│  │ owner    │ Full tenant control, billing, delete tenant           │  │
│  │ admin    │ Manage members, settings, integrations                │  │
│  │ member   │ Basic tenant access (features controlled by Layer 2)  │  │
│  │ viewer   │ Read-only tenant access                               │  │
│  └──────────┴───────────────────────────────────────────────────────┘  │
│                                                                         │
│  LAYER 2: GROUPS + PERMISSION SETS                                      │
│  ─────────────────────────────────                                      │
│  Purpose: WHAT FEATURES CAN USER ACCESS?                                │
│                                                                         │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│  │     User        │────▶│     Groups      │────▶│ Permission Sets │  │
│  │                 │     │                 │     │                 │  │
│  │ tenant_member   │     │ - API Team      │     │ - Developer     │  │
│  │ role: "member"  │     │ - Security Team │     │ - Full Admin    │  │
│  │                 │     │ - Pentest Team  │     │ - SOC Analyst   │  │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘  │
│                                                                         │
│  Key Insight: Most users are "member" at tenant level.                 │
│               Their actual permissions come from Groups.                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why Most Users Should Be "member"?

| Reason | Explanation |
|--------|-------------|
| **Separation of concerns** | Tenant administration ≠ Feature access |
| **Scalability** | 500 developers don't need admin rights |
| **Security** | Fewer admins = smaller attack surface |
| **Flexibility** | Feature access managed via groups, not hardcoded |
| **Audit clarity** | Clear who can change tenant settings vs who can use features |

**Rule of thumb:**
- `owner` / `admin` → Only for people who need to manage the tenant itself
- `member` → Everyone else (permissions come from groups)
- `viewer` → External stakeholders who only need to see reports

---

## Group Types

| Type | Purpose | Example |
|------|---------|---------|
| `security_team` | Feature access for security sub-teams | Pentest Team, SOC Team |
| `team` | Asset ownership for dev/owner teams | API Team, Frontend Team |
| `department` | Organizational structure | Engineering, Operations |
| `project` | Project-based access | Project Alpha, Compliance Audit |
| `external` | External contractors/vendors | Pentest Firm XYZ |

---

## Recommended Team Structure

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED TEAM STRUCTURE FOR CTEM                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  LAYER 1: SECURITY TEAMS (type: security_team)                                 │
│  ─────────────────────────────────────────────                                 │
│  Purpose: Feature access control - WHO can do WHAT in the platform             │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Security Core   │  │ AppSec Team     │  │ Cloud Security  │                │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────────── │                │
│  │ Full Admin      │  │ AppSec Engineer │  │ Cloud Security  │                │
│  │ Manage platform │  │ Code scanning,  │  │ Cloud assets,   │                │
│  │ All features    │  │ SAST, SCA, SBOM │  │ misconfigs      │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Pentest Team    │  │ SOC Team        │  │ Vulnerability   │                │
│  │ ─────────────── │  │ ─────────────── │  │ Management Team │                │
│  │ Pentest Operator│  │ SOC Analyst     │  │ ─────────────── │                │
│  │ Campaigns,      │  │ Monitoring,     │  │ Security Analyst│                │
│  │ manual testing  │  │ alerts          │  │ Triage findings │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  LAYER 2: ASSET OWNER TEAMS (type: team)                                       │
│  ───────────────────────────────────────                                       │
│  Purpose: Asset ownership - WHO owns WHAT assets                               │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Backend Team    │  │ Frontend Team   │  │ Mobile Team     │                │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────────── │                │
│  │ Owner: BE Lead  │  │ Owner: FE Lead  │  │ Owner: Mobile   │                │
│  │ Repos: api-*    │  │ Repos: web-*    │  │ Lead            │                │
│  │ Service Owner+  │  │ Service Owner+  │  │ Repos: ios-*,   │                │
│  │ Developer       │  │ Developer       │  │ android-*       │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Infrastructure  │  │ Data Platform   │  │ DevOps/SRE      │                │
│  │ Team            │  │ Team            │  │ Team            │                │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────────── │                │
│  │ Cloud assets,   │  │ DB, analytics,  │  │ CI/CD, K8s,     │                │
│  │ VMs, networks   │  │ pipelines       │  │ monitoring      │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  LAYER 3: CROSS-FUNCTIONAL TEAMS (type: project | department | external)       │
│  ───────────────────────────────────────────────────────────────────           │
│  Purpose: Temporary/organizational groupings                                   │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Management      │  │ External Pentest│  │ Compliance      │                │
│  │ (department)    │  │ (external)      │  │ Project         │                │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────────── │                │
│  │ Read Only       │  │ Scoped access   │  │ Audit+Reports   │                │
│  │ Reports only    │  │ Tagged assets   │  │ for compliance  │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Teams (Required)

Security teams control **feature access** within the platform.

| Team | Slug | Group Type | Permission Set | Purpose |
|------|------|-----------|----------------|---------|
| **Security Core** | `security-core` | security_team | Full Admin | Platform administration, policy, team management |
| **AppSec Team** | `appsec-team` | security_team | AppSec Engineer | Code scanning, SAST/SCA/SBOM, review findings |
| **Cloud Security** | `cloud-security` | security_team | Cloud Security Engineer | Cloud assets, misconfigs, CSPM |
| **Pentest Team** | `pentest-team` | security_team | Pentest Operator | Pentest campaigns, manual testing |
| **SOC Team** | `soc-team` | security_team | SOC Analyst | Monitoring, alerts, incident response |
| **Vulnerability Management** | `vuln-management` | security_team | Security Analyst | Triage, prioritize, track remediation |

### Security Team Capabilities

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    SECURITY TEAM CAPABILITIES                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Security Core (Full Admin)                                                    │
│  ───────────────────────────                                                   │
│  ✓ All platform features                                                       │
│  ✓ Manage teams, groups, permissions                                           │
│  ✓ Configure integrations                                                      │
│  ✓ Define policies and SLAs                                                    │
│  ✓ Access audit logs                                                           │
│                                                                                 │
│  AppSec Team (AppSec Engineer)                                                 │
│  ─────────────────────────────                                                 │
│  ✓ Dashboard, Assets, Findings (full)                                          │
│  ✓ Scans - view, execute                                                       │
│  ✓ Agents - view only                                                          │
│  ✓ Pipelines - view, execute                                                   │
│  ✓ Reports - view, create, export                                              │
│  ✗ Pentest module                                                              │
│  ✗ Team/Settings management                                                    │
│                                                                                 │
│  Cloud Security (Cloud Security Engineer)                                      │
│  ─────────────────────────────────────────                                     │
│  ✓ Dashboard, Assets, Findings (full)                                          │
│  ✓ Focus on cloud assets and misconfigurations                                 │
│  ✓ Scans - view, execute (cloud focused)                                       │
│  ✓ Reports - view, create, export                                              │
│  ✗ Pentest module                                                              │
│                                                                                 │
│  Pentest Team (Pentest Operator)                                               │
│  ───────────────────────────────                                               │
│  ✓ Dashboard (read)                                                            │
│  ✓ Assets - view only                                                          │
│  ✓ Findings - view, triage                                                     │
│  ✓ Pentest module (full access)                                                │
│  ✓ Reports - view, create pentest reports                                      │
│  ✗ Scans, Agents, Pipelines                                                    │
│                                                                                 │
│  SOC Team (SOC Analyst)                                                        │
│  ───────────────────────                                                       │
│  ✓ Dashboard (full)                                                            │
│  ✓ Assets - view only                                                          │
│  ✓ Findings - view, triage, comment                                            │
│  ✓ Reports - view                                                              │
│  ✓ Audit logs - view                                                           │
│  ✗ Scans, Agents, Pentest                                                      │
│                                                                                 │
│  Vulnerability Management (Security Analyst)                                   │
│  ───────────────────────────────────────────                                   │
│  ✓ Dashboard (full)                                                            │
│  ✓ Assets - view                                                               │
│  ✓ Findings - full (triage, assign, comment)                                   │
│  ✓ Reports - view, create, export                                              │
│  ✓ Scans - view                                                                │
│  ✗ Agents, Pentest, Settings                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Asset Owner Teams (Dynamic)

Asset owner teams control **asset ownership** and determine which findings users can see.

| Team | Slug | Group Type | Permission Set | Assets Owned |
|------|------|-----------|----------------|--------------|
| **Backend Team** | `backend-team` | team | Asset Owner + Developer | api-*, service-* repos |
| **Frontend Team** | `frontend-team` | team | Asset Owner + Developer | web-*, ui-* repos |
| **Mobile Team** | `mobile-team` | team | Asset Owner + Developer | ios-*, android-* repos |
| **Infrastructure Team** | `infrastructure-team` | team | Asset Owner + Developer | Cloud accounts, VMs, networks |
| **Data Platform Team** | `data-platform-team` | team | Asset Owner + Developer | Databases, data pipelines |
| **DevOps/SRE Team** | `devops-team` | team | Asset Owner | CI/CD, K8s, monitoring infra |

### Asset Owner vs Developer

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 DEVELOPER vs SERVICE OWNER                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                      DEVELOPER                    SERVICE OWNER                 │
│                      ─────────                    ─────────────                 │
│                                                                                 │
│  tenant_members.role    member                      member                      │
│  group                  API Team                    API Team                    │
│  group_members.role     member                      lead / owner                │
│  permission_set         Developer                   Asset Owner                 │
│  asset_ownership        secondary                   PRIMARY                     │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ CAPABILITIES COMPARISON                                                  │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │ Action                              │ Developer │ Service Owner          │  │
│  ├─────────────────────────────────────┼───────────┼────────────────────────┤  │
│  │ View findings on owned assets       │     ✓     │       ✓                │  │
│  │ Comment on findings                 │     ✓     │       ✓                │  │
│  │ Update finding status               │     ✓     │       ✓                │  │
│  │ Assign findings to team members     │     ✗     │       ✓                │  │
│  │ Receive all notifications           │     ✗     │       ✓                │  │
│  │ Manage group members                │     ✗     │       ✓                │  │
│  │ Set asset ownership                 │     ✗     │       ✓                │  │
│  │ View team's SLA compliance          │     ✗     │       ✓                │  │
│  │ Access other teams' findings        │     ✗     │       ✗                │  │
│  │ Run security scans                  │     ✗     │       ✗                │  │
│  │ Manage agents                       │     ✗     │       ✗                │  │
│  └─────────────────────────────────────┴───────────┴────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-functional Teams (Optional)

| Team | Slug | Group Type | Permission Set | Purpose |
|------|------|-----------|----------------|---------|
| **Management** | `management` | department | Read Only | Dashboard, reports access for managers |
| **Compliance Audit** | `compliance-audit` | project | Read Only + Reports | Compliance projects (SOC2, ISO27001) |
| **External Pentest** | `external-pentest` | external | Scoped Custom | External vendor access (tagged assets) |

---

## Team Sizing Recommendations

### Minimum Teams (Startup / Small Org - < 50 employees)

```
MINIMUM TEAMS:
──────────────
1. Security Team (security_team) → Full Admin
   - 1-3 security engineers doing everything

2. Engineering Team (team) → Developer + Asset Owner
   - All developers, own all repos

3. Management (department) → Read Only
   - C-level, managers only view reports
```

### Recommended Teams (Medium Org - 50-200 employees)

```
RECOMMENDED TEAMS:
──────────────────
Security Teams:
1. Security Core → Full Admin
2. AppSec Team → AppSec Engineer
3. SOC Team → SOC Analyst (if monitoring)

Asset Owner Teams:
4. Backend Team → Asset Owner + Developer
5. Frontend Team → Asset Owner + Developer
6. Infrastructure Team → Asset Owner + Developer

Cross-functional:
7. Management → Read Only
```

### Full Teams (Enterprise - 500+ employees)

```
FULL TEAMS:
───────────
Security Teams: (6 teams)
- Security Core, AppSec, Cloud Security, Pentest, SOC, Vuln Management

Asset Owner Teams: (6+ teams, per org structure)
- Backend, Frontend, Mobile, Infrastructure, Data, DevOps

Cross-functional: (2-3 teams)
- Management, External Pentest, Compliance
```

---

## Role Mapping Reference

| User Type | tenant_members.role | Group Type | Group Role | Permission Set | Asset Ownership |
|-----------|---------------------|------------|------------|----------------|-----------------|
| **Tenant Owner** | `owner` | Security Team | owner | Full Admin | All (implicit) |
| **Security Admin** | `admin` | Security Team | lead | Full Admin | All (implicit) |
| **Security Analyst** | `member` | Security Team | member | Security Analyst | All (implicit) |
| **Pentest Lead** | `member` | Pentest Team | lead | Pentest Operator | Scoped |
| **Pentester** | `member` | Pentest Team | member | Pentest Operator | Scoped |
| **SOC Lead** | `member` | SOC Team | lead | SOC Analyst | All (implicit) |
| **SOC Analyst** | `member` | SOC Team | member | SOC Analyst | All (implicit) |
| **Service Owner** | `member` | Dev Team | **lead** | Asset Owner | **Primary** |
| **Developer** | `member` | Dev Team | member | Developer | Secondary |
| **Manager** | `member` | Management | member | Read Only | Scoped |
| **External Contractor** | `member` | External | member | Scoped Custom | Scoped (tagged) |

---

## Onboarding Examples

### Developer Onboarding

```
Developer "john@company.com" joins the platform
│
├── Step 1: Tenant Membership
│   INSERT INTO tenant_members (user_id, tenant_id, role)
│   VALUES ('john-id', 'acme-tenant', 'member');
│   → John can now access the Acme tenant
│   → But has no feature permissions yet (controlled by groups)
│
├── Step 2: Group Membership
│   INSERT INTO group_members (group_id, user_id, role)
│   VALUES ('api-team-id', 'john-id', 'member');
│   → John is now part of API Team
│   → API Team has permission set "Developer"
│   → API Team owns asset "backend-api" (primary)
│
├── Step 3: Effective Access
│   John can now:
│   ✓ View dashboard (from Developer permission set)
│   ✓ View findings on "backend-api" (owned by his group)
│   ✓ Comment on findings
│   ✓ Update finding status (mark as fixed, etc.)
│
│   John cannot:
│   ✗ View findings on "frontend-web" (owned by Frontend Team)
│   ✗ Run scans
│   ✗ Manage agents
│   ✗ Access pentest module
│
└── Result: Least-privilege access automatically applied
```

### Service Owner Onboarding

```
Service Owner "sarah@company.com" takes ownership of API service
│
├── Step 1: Tenant Membership (same as developer)
│   INSERT INTO tenant_members (user_id, tenant_id, role)
│   VALUES ('sarah-id', 'acme-tenant', 'member');
│
├── Step 2: Group Membership (as lead)
│   INSERT INTO group_members (group_id, user_id, role)
│   VALUES ('api-team-id', 'sarah-id', 'lead');  -- Note: 'lead' role
│   → Sarah is group lead of API Team
│   → Can manage team members
│   → Receives escalation notifications
│
├── Step 3: Permission Set
│   API Team has permission set "Asset Owner" (more than Developer)
│
├── Step 4: Asset Ownership
│   INSERT INTO asset_owners (asset_id, group_id, ownership_type)
│   VALUES ('backend-api-id', 'api-team-id', 'primary');
│   → API Team is PRIMARY owner of backend-api
│   → Sarah (as lead) has full responsibility
│
└── Result: Sarah owns the service, can manage findings and team
```

---

## Related Documentation

- [Roles and Permissions](roles-and-permissions.md) - Legacy role system reference
- [Multi-Tenancy Guide](multi-tenancy.md) - Tenant management
- [Authentication Guide](authentication.md) - Token and session management
- [Access Control Implementation Plan](../architecture/access-control-flows-and-data.md) - Technical details
