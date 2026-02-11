---
layout: default
parent: Architecture
---
# Access Control - Detailed Flows, Data & Architecture

> **Supplement to**: access-control-implementation-plan.md
> **Version**: 1.0
> **Created**: January 21, 2026

---

## Table of Contents

1. [Architecture Diagrams](#1-architecture-diagrams)
2. [Detailed Flow Diagrams](#2-detailed-flow-diagrams)
3. [Data Examples](#3-data-examples)
4. [API Request/Response Examples](#4-api-requestresponse-examples)
5. [State Diagrams](#5-state-diagrams)
6. [Error Handling](#6-error-handling)
7. [Performance Considerations](#7-performance-considerations)
8. [Caching Strategy](#8-caching-strategy)

---

## 1. Architecture Diagrams

### 1.1 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              OPENCTEM PLATFORM                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                           FRONTEND (Next.js)                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │   │
│  │  │  Auth       │  │ Permission  │  │    UI       │  │   API       │        │   │
│  │  │  Provider   │  │  Provider   │  │ Components  │  │  Client     │        │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │   │
│  │         │                │                │                │                │   │
│  │         └────────────────┴────────────────┴────────────────┘                │   │
│  │                                   │                                          │   │
│  └───────────────────────────────────┼──────────────────────────────────────────┘   │
│                                      │ HTTP/REST                                    │
│  ┌───────────────────────────────────┼──────────────────────────────────────────┐   │
│  │                           API GATEWAY                                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │    Auth     │  │   Rate      │  │   CORS      │  │  Request    │          │   │
│  │  │ Middleware  │  │  Limiter    │  │  Handler    │  │   Logger    │          │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼──────────────────┘   │
│            │                │                │                │                      │
│  ┌─────────┼────────────────┼────────────────┼────────────────┼──────────────────┐   │
│  │         │         BACKEND (Go)           │                │                   │   │
│  │         │                                                                     │   │
│  │  ┌──────┴──────────────────────────────────────────────────────────────┐     │   │
│  │  │                      PERMISSION LAYER                                │     │   │
│  │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │     │   │
│  │  │  │   Permission   │  │   Permission   │  │    Scope       │         │     │   │
│  │  │  │   Middleware   │  │   Resolver     │  │   Evaluator    │         │     │   │
│  │  │  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘         │     │   │
│  │  └──────────┼───────────────────┼───────────────────┼──────────────────┘     │   │
│  │             │                   │                   │                        │   │
│  │  ┌──────────┴───────────────────┴───────────────────┴──────────────────┐     │   │
│  │  │                      SERVICE LAYER                                   │     │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │     │   │
│  │  │  │  Group   │ │Permission│ │  Asset   │ │ Finding  │ │Assignment│  │     │   │
│  │  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │ │  Rules   │  │     │   │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │     │   │
│  │  └───────┼────────────┼────────────┼────────────┼────────────┼────────┘     │   │
│  │          │            │            │            │            │              │   │
│  │  ┌───────┴────────────┴────────────┴────────────┴────────────┴────────┐     │   │
│  │  │                      REPOSITORY LAYER                               │     │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │     │   │
│  │  │  │  Group   │ │Permission│ │  Asset   │ │ Audit    │               │     │   │
│  │  │  │   Repo   │ │   Repo   │ │   Repo   │ │   Repo   │               │     │   │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘               │     │   │
│  │  └───────┼────────────┼────────────┼────────────┼─────────────────────┘     │   │
│  │          │            │            │            │                           │   │
│  └──────────┼────────────┼────────────┼────────────┼───────────────────────────┘   │
│             │            │            │            │                               │
│  ┌──────────┴────────────┴────────────┴────────────┴───────────────────────────┐   │
│  │                           DATA LAYER                                         │   │
│  │  ┌────────────────────────────┐  ┌────────────────────────────┐             │   │
│  │  │       PostgreSQL           │  │          Redis              │             │   │
│  │  │  ┌──────────────────────┐  │  │  ┌──────────────────────┐  │             │   │
│  │  │  │ groups        │  │  │  │ permission_cache     │  │             │   │
│  │  │  │ group_members │  │  │  │ user_groups_cache    │  │             │   │
│  │  │  │ permission_sets      │  │  │  │ session_cache        │  │             │   │
│  │  │  │ group_permissions    │  │  │  └──────────────────────┘  │             │   │
│  │  │  │ asset_owners         │  │  │                            │             │   │
│  │  │  │ assignment_rules     │  │  │                            │             │   │
│  │  │  └──────────────────────┘  │  │                            │             │   │
│  │  └────────────────────────────┘  └────────────────────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                      EXTERNAL INTEGRATIONS                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │   │
│  │  │  GitHub  │  │  GitLab  │  │ Azure AD │  │   Okta   │  │  Slack   │      │   │
│  │  │   Sync   │  │   Sync   │  │   Sync   │  │   Sync   │  │  Notify  │      │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Permission Resolution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        PERMISSION RESOLUTION ENGINE                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  INPUT                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  User ID: "user-123"                                                         │   │
│  │  Tenant ID: "tenant-456"                                                     │   │
│  │  Permission: "findings.triage"                                               │   │
│  │  Resource: { type: "finding", id: "finding-789" }                           │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│                                      ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: CHECK USER DIRECT PERMISSIONS                                       │   │
│  │  ─────────────────────────────────────                                       │   │
│  │  Query: user_permissions WHERE user_id = 'user-123'                          │   │
│  │         AND permission_id = 'findings.triage'                                │   │
│  │                                                                              │   │
│  │  Results:                                                                    │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ (empty - no direct user permissions)                                    │ │   │
│  │  └────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                              │   │
│  │  Decision: Continue to groups                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│                                      ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 2: GET USER'S GROUPS                                                   │   │
│  │  ────────────────────────────                                                │   │
│  │  Query: groups JOIN group_members WHERE user_id = 'user-123'   │   │
│  │         AND tenant_id = 'tenant-456'                                         │   │
│  │                                                                              │   │
│  │  Results:                                                                    │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ group_id: "security-team"    (type: security_team)                     │ │   │
│  │  │ group_id: "appsec-team"      (type: security_team)                     │ │   │
│  │  └────────────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│                                      ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: CHECK EACH GROUP (Parallel)                                         │   │
│  │  ───────────────────────────────────                                         │   │
│  │                                                                              │   │
│  │  GROUP: security-team                                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ 3a. Check group_permissions:                                            │ │   │
│  │  │     Query: WHERE group_id = 'security-team'                             │ │   │
│  │  │            AND permission_id = 'findings.triage'                        │ │   │
│  │  │     Result: (empty)                                                     │ │   │
│  │  │                                                                         │ │   │
│  │  │ 3b. Check permission sets:                                              │ │   │
│  │  │     Query: group_permission_sets WHERE group_id = 'security-team'       │ │   │
│  │  │     Result: permission_set_id = 'full-admin'                            │ │   │
│  │  │                                                                         │ │   │
│  │  │ 3c. Resolve permission set:                                             │ │   │
│  │  │     'full-admin' type = 'system', contains '*' (all permissions)        │ │   │
│  │  │     → 'findings.triage' FOUND                                           │ │   │
│  │  │                                                                         │ │   │
│  │  │ Decision: ALLOW (via permission set)                                    │ │   │
│  │  └────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                              │   │
│  │  GROUP: appsec-team                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ 3a. Check group_permissions:                                            │ │   │
│  │  │     Result: (empty)                                                     │ │   │
│  │  │                                                                         │ │   │
│  │  │ 3b. Check permission sets:                                              │ │   │
│  │  │     Result: permission_set_id = 'appsec-engineer'                       │ │   │
│  │  │                                                                         │ │   │
│  │  │ 3c. Resolve permission set:                                             │ │   │
│  │  │     'appsec-engineer' type = 'system'                                   │ │   │
│  │  │     Contains: findings.* → 'findings.triage' FOUND                      │ │   │
│  │  │                                                                         │ │   │
│  │  │ Decision: ALLOW (via permission set)                                    │ │   │
│  │  └────────────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│                                      ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 4: MERGE RESULTS                                                       │   │
│  │  ─────────────────────                                                       │   │
│  │  Results collected:                                                          │   │
│  │  - security-team: ALLOW                                                      │   │
│  │  - appsec-team: ALLOW                                                        │   │
│  │                                                                              │   │
│  │  Merge logic:                                                                │   │
│  │  - Any DENY? No                                                              │   │
│  │  - Any ALLOW? Yes                                                            │   │
│  │                                                                              │   │
│  │  Decision: ALLOW                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│                                      ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 5: APPLY SCOPE (if applicable)                                         │   │
│  │  ───────────────────────────────────                                         │   │
│  │  Check if any group has scope restrictions for this permission               │   │
│  │                                                                              │   │
│  │  security-team: No scope (full access)                                       │   │
│  │  appsec-team: No scope (full access)                                         │   │
│  │                                                                              │   │
│  │  Resource finding-789 in scope? YES (no restrictions)                        │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│                                      ▼                                              │
│  OUTPUT                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  {                                                                           │   │
│  │    "allowed": true,                                                          │   │
│  │    "permission": "findings.triage",                                          │   │
│  │    "granted_via": [                                                          │   │
│  │      { "group": "security-team", "source": "permission_set:full-admin" },    │   │
│  │      { "group": "appsec-team", "source": "permission_set:appsec-engineer" }  │   │
│  │    ],                                                                        │   │
│  │    "scope": null                                                             │   │
│  │  }                                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Extended Permission Set Resolution

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                   EXTENDED PERMISSION SET RESOLUTION                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  TENANT'S SET: "APAC SOC Lead" (type: extended)                                    │
│  PARENT: "SOC Analyst" (system)                                                     │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: GET PARENT PERMISSIONS                                              │   │
│  │                                                                              │   │
│  │  Query: permission_set_items WHERE permission_set_id = 'soc-analyst'         │   │
│  │                                                                              │   │
│  │  Parent Permissions (SOC Analyst):                                           │   │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ alerts.view          ✓                                                │   │   │
│  │  │ alerts.acknowledge   ✓                                                │   │   │
│  │  │ alerts.mute          ✓  (newly added by system)                       │   │   │
│  │  │ monitoring.view      ✓                                                │   │   │
│  │  │ monitoring.configure ✓                                                │   │   │
│  │  │ incidents.view       ✓                                                │   │   │
│  │  │ incidents.create     ✓                                                │   │   │
│  │  │ incidents.manage     ✓                                                │   │   │
│  │  │ findings.view        ✓                                                │   │   │
│  │  │ reports.view         ✓                                                │   │   │
│  │  └──────────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│                                      ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 2: GET MODIFICATIONS                                                   │   │
│  │                                                                              │   │
│  │  Query: permission_set_items WHERE permission_set_id = 'apac-soc-lead'       │   │
│  │                                                                              │   │
│  │  Modifications (APAC SOC Lead):                                              │   │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ incidents.escalate   ADD    (tenant added)                            │   │   │
│  │  │ reports.create       ADD    (tenant added)                            │   │   │
│  │  │ alerts.mute          REMOVE (tenant removed)                          │   │   │
│  │  └──────────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│                                      ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: MERGE                                                               │   │
│  │                                                                              │   │
│  │  Algorithm:                                                                  │   │
│  │  1. Start with parent permissions (as set)                                   │   │
│  │  2. For each modification:                                                   │   │
│  │     - ADD: insert into set                                                   │   │
│  │     - REMOVE: delete from set                                                │   │
│  │                                                                              │   │
│  │  Effective Permissions (APAC SOC Lead):                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │   │
│  │  │ alerts.view          ✓  (from parent)                                 │   │   │
│  │  │ alerts.acknowledge   ✓  (from parent)                                 │   │   │
│  │  │ alerts.mute          ✗  (removed by tenant)                           │   │   │
│  │  │ monitoring.view      ✓  (from parent)                                 │   │   │
│  │  │ monitoring.configure ✓  (from parent)                                 │   │   │
│  │  │ incidents.view       ✓  (from parent)                                 │   │   │
│  │  │ incidents.create     ✓  (from parent)                                 │   │   │
│  │  │ incidents.manage     ✓  (from parent)                                 │   │   │
│  │  │ incidents.escalate   ✓  (added by tenant)                             │   │   │
│  │  │ findings.view        ✓  (from parent)                                 │   │   │
│  │  │ reports.view         ✓  (from parent)                                 │   │   │
│  │  │ reports.create       ✓  (added by tenant)                             │   │   │
│  │  └──────────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  NOTE: When system adds new permission to "SOC Analyst", it automatically          │
│        appears in "APAC SOC Lead" effective permissions (unless tenant removes it) │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Flow Diagrams

### 2.1 User Authentication & Permission Loading Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    USER LOGIN & PERMISSION LOADING FLOW                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  User                   Frontend              Backend                  Database     │
│   │                        │                     │                        │         │
│   │  1. Login request      │                     │                        │         │
│   │ ──────────────────────>│                     │                        │         │
│   │                        │                     │                        │         │
│   │                        │  2. POST /auth/login│                        │         │
│   │                        │ ───────────────────>│                        │         │
│   │                        │                     │                        │         │
│   │                        │                     │  3. Verify credentials │         │
│   │                        │                     │ ──────────────────────>│         │
│   │                        │                     │                        │         │
│   │                        │                     │  4. User data          │         │
│   │                        │                     │ <──────────────────────│         │
│   │                        │                     │                        │         │
│   │                        │                     │  5. Get user's tenants │         │
│   │                        │                     │ ──────────────────────>│         │
│   │                        │                     │                        │         │
│   │                        │                     │  6. Tenants list       │         │
│   │                        │                     │ <──────────────────────│         │
│   │                        │                     │                        │         │
│   │                        │                     │  7. Generate JWT       │         │
│   │                        │                     │     (no tenant yet)    │         │
│   │                        │                     │                        │         │
│   │                        │  8. JWT + tenants   │                        │         │
│   │                        │ <───────────────────│                        │         │
│   │                        │                     │                        │         │
│   │  9. Show tenant picker │                     │                        │         │
│   │ <──────────────────────│                     │                        │         │
│   │                        │                     │                        │         │
│   │  10. Select tenant     │                     │                        │         │
│   │ ──────────────────────>│                     │                        │         │
│   │                        │                     │                        │         │
│   │                        │  11. POST /auth/token                        │         │
│   │                        │      { tenant_id }  │                        │         │
│   │                        │ ───────────────────>│                        │         │
│   │                        │                     │                        │         │
│   │                        │                     │  12. Verify membership │         │
│   │                        │                     │ ──────────────────────>│         │
│   │                        │                     │                        │         │
│   │                        │                     │  13. Get groups        │         │
│   │                        │                     │ ──────────────────────>│         │
│   │                        │                     │                        │         │
│   │                        │                     │  14. Groups data       │         │
│   │                        │                     │ <──────────────────────│         │
│   │                        │                     │                        │         │
│   │                        │                     │  15. Generate          │         │
│   │                        │                     │      tenant-scoped JWT │         │
│   │                        │                     │      with groups       │         │
│   │                        │                     │                        │         │
│   │                        │  16. Tenant JWT     │                        │         │
│   │                        │ <───────────────────│                        │         │
│   │                        │                     │                        │         │
│   │                        │  17. GET /me/permissions                     │         │
│   │                        │ ───────────────────>│                        │         │
│   │                        │                     │                        │         │
│   │                        │                     │  18. Resolve all perms │         │
│   │                        │                     │ ──────────────────────>│         │
│   │                        │                     │                        │         │
│   │                        │                     │  19. Permission data   │         │
│   │                        │                     │ <──────────────────────│         │
│   │                        │                     │                        │         │
│   │                        │  20. Permissions    │                        │         │
│   │                        │ <───────────────────│                        │         │
│   │                        │                     │                        │         │
│   │                        │  21. Store in       │                        │         │
│   │                        │      PermissionCtx  │                        │         │
│   │                        │                     │                        │         │
│   │  22. Render UI based   │                     │                        │         │
│   │      on permissions    │                     │                        │         │
│   │ <──────────────────────│                     │                        │         │
│   │                        │                     │                        │         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Finding Creation & Auto-Assignment Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    FINDING CREATION & AUTO-ASSIGNMENT FLOW                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Agent           API             FindingService    AssignmentEngine    Notification │
│   │               │                    │                 │                  │       │
│   │  1. Ingest    │                    │                 │                  │       │
│   │     findings  │                    │                 │                  │       │
│   │ ─────────────>│                    │                 │                  │       │
│   │               │                    │                 │                  │       │
│   │               │  2. Validate &     │                 │                  │       │
│   │               │     parse findings │                 │                  │       │
│   │               │ ──────────────────>│                 │                  │       │
│   │               │                    │                 │                  │       │
│   │               │                    │  3. For each finding:              │       │
│   │               │                    │                 │                  │       │
│   │               │                    │  4. Get asset   │                  │       │
│   │               │                    │     owners      │                  │       │
│   │               │                    │ ───────────────>│                  │       │
│   │               │                    │                 │                  │       │
│   │               │                    │  5. Asset owners│                  │       │
│   │               │                    │ <───────────────│                  │       │
│   │               │                    │                 │                  │       │
│   │               │                    │  6. Get matching│                  │       │
│   │               │                    │     rules       │                  │       │
│   │               │                    │ ───────────────>│                  │       │
│   │               │                    │                 │                  │       │
│   │               │                    │                 │  7. Evaluate     │       │
│   │               │                    │                 │     conditions   │       │
│   │               │                    │                 │                  │       │
│   │               │                    │                 │  Conditions:     │       │
│   │               │                    │                 │  - asset_type?   │       │
│   │               │                    │                 │  - file_path?    │       │
│   │               │                    │                 │  - severity?     │       │
│   │               │                    │                 │  - tags?         │       │
│   │               │                    │                 │                  │       │
│   │               │                    │  8. Matching    │                  │       │
│   │               │                    │     rules       │                  │       │
│   │               │                    │ <───────────────│                  │       │
│   │               │                    │                 │                  │       │
│   │               │                    │  9. Create finding with:           │       │
│   │               │                    │     - owner_groups (from asset)    │       │
│   │               │                    │     - assigned_group (from rule)   │       │
│   │               │                    │                 │                  │       │
│   │               │                    │  10. Save       │                  │       │
│   │               │                    │      finding    │                  │       │
│   │               │                    │ ─────────────────────────────────> │       │
│   │               │                    │                 │                  │       │
│   │               │                    │  11. Trigger    │                  │       │
│   │               │                    │      notification                  │       │
│   │               │                    │ ─────────────────────────────────────────> │
│   │               │                    │                 │                  │       │
│   │               │                    │                 │                  │  12.  │
│   │               │                    │                 │                  │  Get  │
│   │               │                    │                 │                  │  group│
│   │               │                    │                 │                  │  notif│
│   │               │                    │                 │                  │  config│
│   │               │                    │                 │                  │       │
│   │               │                    │                 │                  │  13.  │
│   │               │                    │                 │                  │  Send │
│   │               │                    │                 │                  │  Slack│
│   │               │                    │                 │                  │  Email│
│   │               │                    │                 │                  │       │
│   │               │  14. Success       │                 │                  │       │
│   │ <─────────────│                    │                 │                  │       │
│   │               │                    │                 │                  │       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 GitHub Sync Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           GITHUB SYNC FLOW                                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Scheduler        SyncService         GitHub API         Database        Audit     │
│   │                   │                    │                 │              │       │
│   │  1. Trigger sync  │                    │                 │              │       │
│   │      (cron/manual)│                    │                 │              │       │
│   │ ─────────────────>│                    │                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  2. Get sync config│                 │              │       │
│   │                   │ ──────────────────────────────────>  │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  3. Config         │                 │              │       │
│   │                   │ <──────────────────────────────────  │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  4. List org teams │                 │              │       │
│   │                   │ ──────────────────>│                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  5. Teams list     │                 │              │       │
│   │                   │ <──────────────────│                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  FOR EACH MAPPED TEAM:               │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  6. Get team members                 │              │       │
│   │                   │ ──────────────────>│                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  7. Members        │                 │              │       │
│   │                   │ <──────────────────│                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  8. Get team repos │                 │              │       │
│   │                   │ ──────────────────>│                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  9. Repos          │                 │              │       │
│   │                   │ <──────────────────│                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  10. Find/create   │                 │              │       │
│   │                   │      OpenCTEM group │                 │              │       │
│   │                   │ ──────────────────────────────────>  │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  11. Sync members: │                 │              │       │
│   │                   │      - Add new     │                 │              │       │
│   │                   │      - Remove left │                 │              │       │
│   │                   │ ──────────────────────────────────>  │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  12. Sync asset    │                 │              │       │
│   │                   │      ownership     │                 │              │       │
│   │                   │ ──────────────────────────────────>  │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  13. Log changes   │                 │              │       │
│   │                   │ ─────────────────────────────────────────────────> │       │
│   │                   │                    │                 │              │       │
│   │                   │  IF CODEOWNERS ENABLED:              │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  14. Fetch         │                 │              │       │
│   │                   │      CODEOWNERS    │                 │              │       │
│   │                   │ ──────────────────>│                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  15. CODEOWNERS    │                 │              │       │
│   │                   │      content       │                 │              │       │
│   │                   │ <──────────────────│                 │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  16. Parse and     │                 │              │       │
│   │                   │      create rules  │                 │              │       │
│   │                   │ ──────────────────────────────────>  │              │       │
│   │                   │                    │                 │              │       │
│   │                   │  17. Update sync   │                 │              │       │
│   │                   │      status        │                 │              │       │
│   │                   │ ──────────────────────────────────>  │              │       │
│   │                   │                    │                 │              │       │
│   │  18. Complete     │                    │                 │              │       │
│   │ <─────────────────│                    │                 │              │       │
│   │                   │                    │                 │              │       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Permission Set Update Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION SET UPDATE FLOW                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Platform Admin    API         PermSetService      Database       TenantNotify     │
│       │             │               │                  │               │            │
│       │  1. Update  │               │                  │               │            │
│       │     system  │               │                  │               │            │
│       │     template│               │                  │               │            │
│       │ ───────────>│               │                  │               │            │
│       │             │               │                  │               │            │
│       │             │  2. Validate  │                  │               │            │
│       │             │ ─────────────>│                  │               │            │
│       │             │               │                  │               │            │
│       │             │               │  3. Update set   │               │            │
│       │             │               │ ────────────────>│               │            │
│       │             │               │                  │               │            │
│       │             │               │  4. Record       │               │            │
│       │             │               │     version      │               │            │
│       │             │               │ ────────────────>│               │            │
│       │             │               │                  │               │            │
│       │             │               │  5. Find tenants │               │            │
│       │             │               │     with cloned  │               │            │
│       │             │               │     sets         │               │            │
│       │             │               │ ────────────────>│               │            │
│       │             │               │                  │               │            │
│       │             │               │  6. Cloned sets  │               │            │
│       │             │               │ <────────────────│               │            │
│       │             │               │                  │               │            │
│       │             │               │  FOR EACH CLONED SET:            │            │
│       │             │               │                  │               │            │
│       │             │               │  7. Create       │               │            │
│       │             │               │     notification │               │            │
│       │             │               │ ────────────────>│               │            │
│       │             │               │                  │               │            │
│       │             │               │  8. Notify       │               │            │
│       │             │               │     tenant       │               │            │
│       │             │               │ ─────────────────────────────────>│            │
│       │             │               │                  │               │            │
│       │             │               │                  │               │  9. Send   │
│       │             │               │                  │               │     email  │
│       │             │               │                  │               │     to     │
│       │             │               │                  │               │     admins │
│       │             │               │                  │               │            │
│       │             │               │  NOTE: Extended sets              │            │
│       │             │               │  automatically inherit            │            │
│       │             │               │  new permissions -                │            │
│       │             │               │  no action needed                 │            │
│       │             │               │                  │               │            │
│       │  10. Success│               │                  │               │            │
│       │ <───────────│               │                  │               │            │
│       │             │               │                  │               │            │
│                                                                                     │
│  TENANT ADMIN FLOW (later):                                                        │
│                                                                                     │
│  Tenant Admin     Frontend           API            PermSetService                  │
│       │              │                │                  │                          │
│       │  11. View    │                │                  │                          │
│       │      notif   │                │                  │                          │
│       │ ────────────>│                │                  │                          │
│       │              │                │                  │                          │
│       │              │  12. GET       │                  │                          │
│       │              │  /permission-sets/notifications   │                          │
│       │              │ ──────────────>│                  │                          │
│       │              │                │                  │                          │
│       │              │  13. Notifications                │                          │
│       │              │ <──────────────│                  │                          │
│       │              │                │                  │                          │
│       │  14. Review  │                │                  │                          │
│       │      changes │                │                  │                          │
│       │ ────────────>│                │                  │                          │
│       │              │                │                  │                          │
│       │  15. Apply   │                │                  │                          │
│       │      selected│                │                  │                          │
│       │ ────────────>│                │                  │                          │
│       │              │                │                  │                          │
│       │              │  16. POST action                  │                          │
│       │              │  { action: 'apply', perms: [...] }│                          │
│       │              │ ──────────────>│                  │                          │
│       │              │                │                  │                          │
│       │              │                │  17. Update      │                          │
│       │              │                │      cloned set  │                          │
│       │              │                │ ────────────────>│                          │
│       │              │                │                  │                          │
│       │              │  18. Updated   │                  │                          │
│       │              │ <──────────────│                  │                          │
│       │              │                │                  │                          │
│       │  19. Success │                │                  │                          │
│       │ <────────────│                │                  │                          │
│       │              │                │                  │                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Examples

### 3.0 Two-Layer Role Model Examples

#### Developer Onboarding (Complete Data)

```json
{
  "scenario": "Developer John joins API Team",

  "step_1_tenant_membership": {
    "table": "tenant_members",
    "data": {
      "user_id": "user-john",
      "tenant_id": "tenant-acme-corp",
      "role": "member",
      "joined_at": "2024-01-15T10:00:00Z"
    },
    "explanation": "John becomes a tenant member with 'member' role - NOT admin"
  },

  "step_2_group_membership": {
    "table": "group_members",
    "data": {
      "group_id": "group-api-team",
      "user_id": "user-john",
      "role": "member",
      "joined_at": "2024-01-15T10:05:00Z"
    },
    "explanation": "John joins API Team as regular member"
  },

  "group_context": {
    "group": {
      "id": "group-api-team",
      "name": "API Team",
      "group_type": "team",
      "permission_sets": ["developer"]
    },
    "owned_assets": [
      { "asset_id": "asset-backend-api", "ownership_type": "primary" },
      { "asset_id": "asset-api-gateway", "ownership_type": "primary" }
    ]
  },

  "effective_permissions": {
    "permissions": [
      "dashboard.view",
      "findings.view",
      "findings.comment",
      "findings.status"
    ],
    "scope": {
      "type": "owned_assets",
      "assets": ["asset-backend-api", "asset-api-gateway"]
    }
  },

  "what_john_can_do": [
    "View dashboard",
    "View findings on backend-api and api-gateway",
    "Comment on those findings",
    "Update status (open → in_progress → fixed)"
  ],

  "what_john_cannot_do": [
    "View findings on frontend-web (owned by Frontend Team)",
    "Assign findings to other users",
    "Run security scans",
    "Manage agents",
    "Access pentest module",
    "Invite new members to tenant"
  ]
}
```

#### Service Owner Onboarding (Complete Data)

```json
{
  "scenario": "Sarah becomes Service Owner of API service",

  "step_1_tenant_membership": {
    "table": "tenant_members",
    "data": {
      "user_id": "user-sarah",
      "tenant_id": "tenant-acme-corp",
      "role": "member",
      "joined_at": "2024-01-10T09:00:00Z"
    },
    "explanation": "Sarah is also 'member' at tenant level - same as developers"
  },

  "step_2_group_membership": {
    "table": "group_members",
    "data": {
      "group_id": "group-api-team",
      "user_id": "user-sarah",
      "role": "lead",
      "joined_at": "2024-01-10T09:05:00Z"
    },
    "explanation": "Sarah is 'lead' in the group - this is the key difference"
  },

  "step_3_asset_ownership": {
    "table": "asset_owners",
    "data": {
      "asset_id": "asset-backend-api",
      "group_id": "group-api-team",
      "ownership_type": "primary",
      "assigned_by": "user-security-admin"
    },
    "explanation": "API Team (Sarah's group) is PRIMARY owner of backend-api"
  },

  "group_context": {
    "group": {
      "id": "group-api-team",
      "name": "API Team",
      "group_type": "team",
      "permission_sets": ["asset-owner"]
    }
  },

  "effective_permissions": {
    "permissions": [
      "dashboard.view",
      "findings.view",
      "findings.comment",
      "findings.status",
      "findings.assign",
      "reports.view",
      "groups.members"
    ],
    "scope": {
      "type": "owned_assets",
      "assets": ["asset-backend-api", "asset-api-gateway"]
    }
  },

  "what_sarah_can_do": [
    "Everything John can do, plus:",
    "Assign findings to team members",
    "View team reports and SLA compliance",
    "Add/remove team members",
    "Set finding priorities",
    "Receive escalation notifications"
  ],

  "what_sarah_cannot_do": [
    "Access other teams' findings",
    "Run security scans",
    "Manage agents",
    "Access pentest module",
    "Change tenant settings"
  ]
}
```

#### Comparison: Developer vs Service Owner vs Security Admin

```json
{
  "comparison_table": [
    {
      "attribute": "tenant_members.role",
      "developer": "member",
      "service_owner": "member",
      "security_admin": "admin"
    },
    {
      "attribute": "group",
      "developer": "API Team",
      "service_owner": "API Team",
      "security_admin": "Security Team"
    },
    {
      "attribute": "group_members.role",
      "developer": "member",
      "service_owner": "lead",
      "security_admin": "owner"
    },
    {
      "attribute": "permission_set",
      "developer": "developer",
      "service_owner": "asset-owner",
      "security_admin": "full-admin"
    },
    {
      "attribute": "asset_scope",
      "developer": "owned_assets",
      "service_owner": "owned_assets",
      "security_admin": "all"
    },
    {
      "attribute": "can_assign_findings",
      "developer": false,
      "service_owner": true,
      "security_admin": true
    },
    {
      "attribute": "can_manage_group_members",
      "developer": false,
      "service_owner": true,
      "security_admin": true
    },
    {
      "attribute": "can_run_scans",
      "developer": false,
      "service_owner": false,
      "security_admin": true
    },
    {
      "attribute": "can_manage_tenant",
      "developer": false,
      "service_owner": false,
      "security_admin": true
    }
  ]
}
```

#### SQL Queries for Onboarding

```sql
-- =====================================================
-- DEVELOPER ONBOARDING
-- =====================================================

-- 1. Add to tenant (if not already member)
INSERT INTO tenant_members (user_id, tenant_id, role, joined_at)
VALUES ('user-john', 'tenant-acme', 'member', NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- 2. Add to team group
INSERT INTO group_members (group_id, user_id, role, joined_at, added_by)
VALUES ('group-api-team', 'user-john', 'member', NOW(), 'user-admin');

-- =====================================================
-- SERVICE OWNER ONBOARDING
-- =====================================================

-- 1. Add to tenant (if not already member)
INSERT INTO tenant_members (user_id, tenant_id, role, joined_at)
VALUES ('user-sarah', 'tenant-acme', 'member', NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- 2. Add to team group as LEAD
INSERT INTO group_members (group_id, user_id, role, joined_at, added_by)
VALUES ('group-api-team', 'user-sarah', 'lead', NOW(), 'user-admin');

-- 3. (Optional) Assign asset ownership if not already done
INSERT INTO asset_owners (asset_id, group_id, ownership_type, assigned_by)
VALUES ('asset-backend-api', 'group-api-team', 'primary', 'user-admin')
ON CONFLICT (asset_id, group_id) DO UPDATE SET ownership_type = 'primary';

-- =====================================================
-- PROMOTE DEVELOPER TO SERVICE OWNER
-- =====================================================

-- Just update the group role
UPDATE group_members
SET role = 'lead'
WHERE group_id = 'group-api-team' AND user_id = 'user-john';

-- The permission change happens automatically via group's permission set
```

### 3.1 Complete Tenant Setup Example

```json
{
  "tenant": {
    "id": "tenant-acme-corp",
    "name": "Acme Corporation",
    "slug": "acme-corp"
  },

  "groups": [
    {
      "id": "group-security-team",
      "name": "Security Team",
      "slug": "security-team",
      "group_type": "security_team",
      "members": [
        { "user_id": "user-alice", "role": "owner" },
        { "user_id": "user-bob", "role": "member" }
      ],
      "permission_sets": ["full-admin"],
      "custom_permissions": [],
      "notification_config": {
        "slack_channel": "#security-alerts",
        "notify_new_critical": true,
        "notify_new_high": true,
        "weekly_digest": true
      }
    },
    {
      "id": "group-pentest-team",
      "name": "Pentest Team",
      "slug": "pentest-team",
      "group_type": "security_team",
      "members": [
        { "user_id": "user-charlie", "role": "lead" },
        { "user_id": "user-dave", "role": "member" }
      ],
      "permission_sets": ["pentest-operator"],
      "custom_permissions": [
        { "permission_id": "reports.export", "effect": "allow" }
      ],
      "notification_config": {
        "slack_channel": "#pentest-team",
        "notify_new_critical": true
      }
    },
    {
      "id": "group-api-team",
      "name": "API Team",
      "slug": "api-team",
      "group_type": "team",
      "members": [
        { "user_id": "user-eve", "role": "lead" },
        { "user_id": "user-frank", "role": "member" },
        { "user_id": "user-grace", "role": "member" }
      ],
      "permission_sets": ["developer"],
      "custom_permissions": [],
      "notification_config": {
        "email_list": "api-team@acme.com",
        "notify_new_critical": true,
        "notify_new_high": true
      }
    },
    {
      "id": "group-external-pentest",
      "name": "External Pentest Firm",
      "slug": "external-pentest",
      "group_type": "external",
      "members": [
        { "user_id": "user-external-1", "role": "member" }
      ],
      "permission_sets": ["custom-external-pentester"],
      "custom_permissions": [
        {
          "permission_id": "assets.view",
          "effect": "allow",
          "scope_type": "asset_tags",
          "scope_value": { "tags": ["pentest-scope-q1-2024"] }
        }
      ]
    }
  ],

  "permission_sets": [
    {
      "id": "custom-external-pentester",
      "name": "External Pentester (Q1 2024)",
      "set_type": "cloned",
      "parent_set_id": "pentest-operator",
      "modifications": [
        { "permission_id": "reports.export", "type": "remove" },
        { "permission_id": "assets.delete", "type": "remove" }
      ]
    }
  ],

  "asset_ownership": [
    {
      "asset_id": "asset-backend-api",
      "group_id": "group-api-team",
      "ownership_type": "primary"
    },
    {
      "asset_id": "asset-backend-api",
      "group_id": "group-security-team",
      "ownership_type": "secondary"
    },
    {
      "asset_id": "asset-frontend-web",
      "group_id": "group-frontend-team",
      "ownership_type": "primary"
    }
  ],

  "assignment_rules": [
    {
      "id": "rule-1",
      "name": "Critical to Security Lead",
      "priority": 100,
      "conditions": {
        "finding_severity": ["critical"]
      },
      "target_group_id": "group-security-team"
    },
    {
      "id": "rule-2",
      "name": "API Code Findings",
      "priority": 50,
      "conditions": {
        "asset_type": ["repository"],
        "file_path_pattern": "src/api/**"
      },
      "target_group_id": "group-api-team"
    },
    {
      "id": "rule-3",
      "name": "Default Catch-all",
      "priority": 0,
      "conditions": {},
      "target_group_id": "group-security-team"
    }
  ]
}
```

### 3.2 User Effective Permissions Example

```json
{
  "user_id": "user-charlie",
  "tenant_id": "tenant-acme-corp",

  "groups": [
    {
      "id": "group-pentest-team",
      "name": "Pentest Team",
      "role": "lead"
    }
  ],

  "effective_permissions": [
    "dashboard.view",
    "assets.view",
    "findings.view",
    "findings.create",
    "findings.update",
    "findings.triage",
    "findings.comment",
    "scans.view",
    "scans.execute",
    "pentest.campaigns.view",
    "pentest.campaigns.create",
    "pentest.campaigns.manage",
    "pentest.findings.create",
    "pentest.reports",
    "reports.view",
    "reports.create",
    "reports.export"
  ],

  "accessible_modules": [
    "dashboard",
    "assets",
    "findings",
    "scans",
    "pentest",
    "reports"
  ],

  "permission_sources": {
    "dashboard.view": [
      { "group": "pentest-team", "source": "permission_set:pentest-operator" }
    ],
    "reports.export": [
      { "group": "pentest-team", "source": "custom_permission" }
    ]
  }
}
```

### 3.3 Finding with Ownership Example

```json
{
  "finding": {
    "id": "finding-sql-injection-001",
    "title": "SQL Injection in UserController",
    "severity": "critical",
    "status": "open",
    "asset_id": "asset-backend-api",
    "file_path": "src/api/controllers/UserController.java",
    "line_number": 45,

    "ownership": {
      "owner_groups": [
        {
          "group_id": "group-api-team",
          "group_name": "API Team",
          "ownership_type": "primary"
        },
        {
          "group_id": "group-security-team",
          "group_name": "Security Team",
          "ownership_type": "secondary"
        }
      ],
      "assigned_group": {
        "group_id": "group-security-team",
        "group_name": "Security Team",
        "assigned_via": "rule:Critical to Security Lead"
      }
    },

    "visible_to_users": [
      "user-alice",
      "user-bob",
      "user-eve",
      "user-frank",
      "user-grace"
    ]
  }
}
```

---

## 4. API Request/Response Examples

### 4.1 Create Group

**Request:**
```http
POST /api/v1/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Cloud Security Team",
  "slug": "cloud-security",
  "description": "Team responsible for cloud infrastructure security",
  "group_type": "security_team",
  "settings": {
    "allow_self_join": false,
    "require_approval": true
  },
  "notification_config": {
    "slack_enabled": true,
    "slack_channel": "#cloud-security-alerts",
    "notify_new_critical": true,
    "notify_new_high": true,
    "notify_sla_warning": true,
    "weekly_digest": true
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-acme-corp",
  "name": "Cloud Security Team",
  "slug": "cloud-security",
  "description": "Team responsible for cloud infrastructure security",
  "group_type": "security_team",
  "external_id": null,
  "external_source": null,
  "settings": {
    "allow_self_join": false,
    "require_approval": true
  },
  "notification_config": {
    "slack_enabled": true,
    "slack_channel": "#cloud-security-alerts",
    "email_enabled": false,
    "notify_new_critical": true,
    "notify_new_high": true,
    "notify_new_medium": false,
    "notify_sla_warning": true,
    "notify_sla_breach": true,
    "weekly_digest": true
  },
  "metadata": {},
  "is_active": true,
  "created_at": "2024-01-21T10:30:00Z",
  "updated_at": "2024-01-21T10:30:00Z",
  "members_count": 0,
  "assets_count": 0
}
```

### 4.2 Get My Permissions

**Request:**
```http
GET /api/v1/me/permissions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user_id": "user-charlie",
  "tenant_id": "tenant-acme-corp",
  "permissions": [
    "dashboard.view",
    "dashboard.customize",
    "assets.view",
    "findings.view",
    "findings.create",
    "findings.update",
    "findings.triage",
    "findings.comment",
    "scans.view",
    "scans.execute",
    "pentest.campaigns.view",
    "pentest.campaigns.create",
    "pentest.campaigns.manage",
    "pentest.findings.create",
    "pentest.reports",
    "reports.view",
    "reports.create",
    "reports.export"
  ],
  "modules": [
    "dashboard",
    "assets",
    "findings",
    "scans",
    "pentest",
    "reports"
  ],
  "groups": [
    {
      "id": "group-pentest-team",
      "name": "Pentest Team",
      "role": "lead",
      "group_type": "security_team"
    }
  ],
  "scopes": {
    "assets.view": { "type": "all" },
    "findings.view": { "type": "all" }
  }
}
```

### 4.3 Create Permission Set (Clone)

**Request:**
```http
POST /api/v1/permission-sets/clone
Authorization: Bearer <token>
Content-Type: application/json

{
  "source_id": "00000000-0000-0000-0000-000000000004",
  "name": "APAC SOC Lead",
  "description": "SOC Lead for APAC region with escalation rights",
  "mode": "extended",
  "additional_permissions": [
    "incidents.escalate",
    "reports.create"
  ],
  "removed_permissions": [
    "alerts.mute"
  ]
}
```

**Response:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "tenant_id": "tenant-acme-corp",
  "name": "APAC SOC Lead",
  "slug": "apac-soc-lead",
  "description": "SOC Lead for APAC region with escalation rights",
  "set_type": "extended",
  "parent_set_id": "00000000-0000-0000-0000-000000000004",
  "parent_set_name": "SOC Analyst",
  "cloned_from_version": null,
  "is_active": true,
  "created_at": "2024-01-21T10:35:00Z",
  "updated_at": "2024-01-21T10:35:00Z",
  "modifications": {
    "additions": [
      "incidents.escalate",
      "reports.create"
    ],
    "removals": [
      "alerts.mute"
    ]
  },
  "effective_permissions": [
    "dashboard.view",
    "assets.view",
    "findings.view",
    "findings.comment",
    "monitoring.view",
    "monitoring.configure",
    "alerts.view",
    "alerts.acknowledge",
    "incidents.view",
    "incidents.create",
    "incidents.manage",
    "incidents.escalate",
    "reports.view",
    "reports.create"
  ],
  "groups_count": 0
}
```

### 4.4 Create Assignment Rule

**Request:**
```http
POST /api/v1/assignment-rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Cloud Misconfigurations to Cloud Team",
  "description": "Route all cloud misconfiguration findings to the cloud security team",
  "priority": 75,
  "conditions": {
    "asset_tags": ["type:cloud"],
    "finding_type": ["misconfiguration", "iac-violation"],
    "finding_source": ["checkov", "tfsec", "trivy"]
  },
  "target_group_id": "group-cloud-security",
  "options": {
    "notify_group": true,
    "set_finding_priority": "high"
  }
}
```

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "tenant_id": "tenant-acme-corp",
  "name": "Cloud Misconfigurations to Cloud Team",
  "description": "Route all cloud misconfiguration findings to the cloud security team",
  "priority": 75,
  "is_active": true,
  "conditions": {
    "asset_tags": ["type:cloud"],
    "finding_type": ["misconfiguration", "iac-violation"],
    "finding_source": ["checkov", "tfsec", "trivy"]
  },
  "target_group_id": "group-cloud-security",
  "target_group_name": "Cloud Security Team",
  "options": {
    "notify_group": true,
    "set_finding_priority": "high"
  },
  "created_at": "2024-01-21T10:40:00Z",
  "updated_at": "2024-01-21T10:40:00Z",
  "matched_findings_count": 0
}
```

---

## 5. State Diagrams

### 5.1 Permission Set States

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION SET STATE DIAGRAM                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│                                                                                     │
│        ┌──────────────┐                                                            │
│        │              │                                                            │
│        │    DRAFT     │ ──── Save ────► ┌──────────────┐                          │
│        │   (future)   │                 │              │                          │
│        │              │                 │    ACTIVE    │                          │
│        └──────────────┘                 │              │                          │
│                                         └───────┬──────┘                          │
│                                                 │                                  │
│                              ┌──────────────────┼──────────────────┐              │
│                              │                  │                  │              │
│                              ▼                  ▼                  ▼              │
│                     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│                     │              │   │              │   │              │        │
│                     │   UPDATED    │   │  DEACTIVATED │   │   DELETED    │        │
│                     │              │   │              │   │              │        │
│                     └───────┬──────┘   └───────┬──────┘   └──────────────┘        │
│                             │                  │                                   │
│                             │                  │                                   │
│                             └────────┬─────────┘                                   │
│                                      │                                             │
│                                      ▼                                             │
│                             ┌──────────────┐                                       │
│                             │              │                                       │
│                             │    ACTIVE    │                                       │
│                             │              │                                       │
│                             └──────────────┘                                       │
│                                                                                     │
│                                                                                     │
│  FOR CLONED SETS:                                                                  │
│                                                                                     │
│  ┌──────────────┐                     ┌──────────────┐                            │
│  │              │                     │              │                            │
│  │   CURRENT    │ ── Parent Updated ─►│   OUTDATED   │                            │
│  │              │                     │              │                            │
│  └──────────────┘                     └───────┬──────┘                            │
│                                               │                                    │
│                     ┌─────────────────────────┼─────────────────────────┐         │
│                     │                         │                         │         │
│                     ▼                         ▼                         ▼         │
│            ┌──────────────┐          ┌──────────────┐          ┌──────────────┐  │
│            │              │          │              │          │              │   │
│            │   UPDATED    │          │  ACKNOWLEDGED│          │   IGNORED    │   │
│            │  (applied)   │          │              │          │              │   │
│            │              │          │              │          │              │   │
│            └──────────────┘          └──────────────┘          └──────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Finding Assignment States

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    FINDING ASSIGNMENT STATE DIAGRAM                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│                                                                                     │
│        ┌──────────────────┐                                                        │
│        │                  │                                                        │
│        │     CREATED      │                                                        │
│        │   (no owner)     │                                                        │
│        │                  │                                                        │
│        └────────┬─────────┘                                                        │
│                 │                                                                  │
│                 │ Auto-assignment                                                  │
│                 │ rules evaluated                                                  │
│                 │                                                                  │
│                 ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐             │
│  │                                                                  │             │
│  │                      RULE EVALUATION                             │             │
│  │                                                                  │             │
│  │  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐ │             │
│  │  │ Rule 1 (P:100) │───►│ Rule 2 (P:75)  │───►│ Rule 3 (P:50)  │ │             │
│  │  │ Match? NO      │    │ Match? YES     │    │                │ │             │
│  │  └────────────────┘    └───────┬────────┘    └────────────────┘ │             │
│  │                                │                                 │             │
│  └────────────────────────────────┼─────────────────────────────────┘             │
│                                   │                                               │
│                                   │ First match wins                              │
│                                   │                                               │
│                                   ▼                                               │
│                          ┌──────────────────┐                                     │
│                          │                  │                                     │
│                          │    ASSIGNED      │                                     │
│                          │  (to group)      │                                     │
│                          │                  │                                     │
│                          └────────┬─────────┘                                     │
│                                   │                                               │
│                    ┌──────────────┼──────────────┐                               │
│                    │              │              │                                │
│                    ▼              ▼              ▼                                │
│           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                     │
│           │              │ │              │ │              │                     │
│           │  REASSIGNED  │ │   CLAIMED    │ │  ESCALATED   │                     │
│           │ (manual)     │ │ (by member)  │ │ (to lead)    │                     │
│           │              │ │              │ │              │                     │
│           └──────────────┘ └──────────────┘ └──────────────┘                     │
│                                                                                   │
│                                                                                   │
│  Notification sent at each transition to relevant groups                          │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Error Handling

### 6.1 Permission Errors

```json
// 403 Forbidden - No permission
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action",
    "details": {
      "required_permission": "agents.create",
      "user_permissions": ["agents.view"],
      "groups": ["api-team"]
    }
  }
}

// 403 Forbidden - Scope restriction
{
  "error": {
    "code": "SCOPE_RESTRICTED",
    "message": "You can only access resources within your scope",
    "details": {
      "permission": "findings.view",
      "scope_type": "owned_assets",
      "requested_resource": "finding-123",
      "resource_asset": "asset-456",
      "your_owned_assets": ["asset-789", "asset-012"]
    }
  }
}
```

### 6.2 Group Errors

```json
// 400 Bad Request - Invalid group type
{
  "error": {
    "code": "INVALID_GROUP_TYPE",
    "message": "Invalid group type specified",
    "details": {
      "provided": "invalid_type",
      "allowed": ["security_team", "team", "department", "project", "external"]
    }
  }
}

// 409 Conflict - Duplicate group
{
  "error": {
    "code": "GROUP_ALREADY_EXISTS",
    "message": "A group with this slug already exists",
    "details": {
      "slug": "api-team",
      "existing_group_id": "group-123"
    }
  }
}
```

### 6.3 Permission Set Errors

```json
// 400 Bad Request - Cannot modify system set
{
  "error": {
    "code": "CANNOT_MODIFY_SYSTEM_SET",
    "message": "System permission sets cannot be modified",
    "details": {
      "permission_set_id": "00000000-0000-0000-0000-000000000001",
      "permission_set_name": "Full Admin",
      "set_type": "system"
    }
  }
}

// 400 Bad Request - Invalid permission
{
  "error": {
    "code": "INVALID_PERMISSION",
    "message": "One or more permissions do not exist",
    "details": {
      "invalid_permissions": ["invalid.permission", "another.invalid"]
    }
  }
}
```

---

## 7. Performance Considerations

### 7.1 Query Optimization

```sql
-- Efficient permission check query
-- Uses indexes and avoids N+1 queries

WITH user_groups AS (
    SELECT g.id, g.slug
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = $1 AND g.tenant_id = $2
),
group_perms AS (
    -- Direct group permissions
    SELECT gp.permission_id, gp.effect, gp.scope_type, gp.scope_value
    FROM group_permissions gp
    WHERE gp.group_id IN (SELECT id FROM user_groups)
    AND gp.permission_id = $3

    UNION ALL

    -- Permissions from permission sets
    SELECT psi.permission_id, 'allow'::varchar, null, null
    FROM group_permission_sets gps
    JOIN permission_set_items psi ON gps.permission_set_id = psi.permission_set_id
    WHERE gps.group_id IN (SELECT id FROM user_groups)
    AND psi.permission_id = $3
    AND psi.modification_type = 'add'
)
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM group_perms WHERE effect = 'deny') THEN false
        WHEN EXISTS (SELECT 1 FROM group_perms WHERE effect = 'allow') THEN true
        ELSE false
    END as allowed;
```

### 7.2 Recommended Indexes

```sql
-- Critical indexes for permission resolution
CREATE INDEX idx_group_members_user ON group_members(user_id)
    INCLUDE (group_id);

CREATE INDEX idx_group_permissions_lookup ON group_permissions(group_id, permission_id)
    INCLUDE (effect, scope_type, scope_value);

CREATE INDEX idx_permission_set_items_lookup ON permission_set_items(permission_set_id, permission_id)
    WHERE modification_type = 'add';

CREATE INDEX idx_asset_owners_group ON asset_owners(group_id)
    INCLUDE (asset_id, ownership_type);

-- For assignment rules
CREATE INDEX idx_assignment_rules_active ON assignment_rules(tenant_id, priority DESC)
    WHERE is_active = true;
```

### 7.3 Expected Query Performance

| Operation | Target Latency | Max Acceptable |
|-----------|---------------|----------------|
| Permission check (cached) | < 1ms | 5ms |
| Permission check (uncached) | < 10ms | 50ms |
| Get user permissions (all) | < 20ms | 100ms |
| Assignment rule evaluation | < 15ms | 75ms |
| Group list | < 10ms | 50ms |

---

## 8. Caching Strategy

### 8.1 Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           CACHING ARCHITECTURE                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                           REDIS CACHE                                        │   │
│  │                                                                              │   │
│  │  KEY PATTERNS:                                                               │   │
│  │                                                                              │   │
│  │  user:{user_id}:groups:{tenant_id}                                          │   │
│  │  └── List of group IDs user belongs to                                      │   │
│  │  └── TTL: 5 minutes                                                         │   │
│  │                                                                              │   │
│  │  user:{user_id}:permissions:{tenant_id}                                     │   │
│  │  └── Full effective permissions list                                        │   │
│  │  └── TTL: 5 minutes                                                         │   │
│  │                                                                              │   │
│  │  group:{group_id}:permissions                                               │   │
│  │  └── Group's effective permissions (resolved from sets)                     │   │
│  │  └── TTL: 10 minutes                                                        │   │
│  │                                                                              │   │
│  │  permission_set:{set_id}:effective                                          │   │
│  │  └── Permission set's effective permissions                                 │   │
│  │  └── TTL: 30 minutes (longer for system sets)                              │   │
│  │                                                                              │   │
│  │  asset:{asset_id}:owners                                                    │   │
│  │  └── List of owner group IDs                                               │   │
│  │  └── TTL: 10 minutes                                                        │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  INVALIDATION TRIGGERS:                                                            │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                              │   │
│  │  Event                          │ Invalidate Keys                           │   │
│  │  ───────────────────────────────┼─────────────────────────────────────────  │   │
│  │  User joins group               │ user:{id}:groups:*, user:{id}:permissions │   │
│  │  User leaves group              │ user:{id}:groups:*, user:{id}:permissions │   │
│  │  Group permission set changed   │ group:{id}:permissions, all member perms  │   │
│  │  Group custom permission added  │ group:{id}:permissions, all member perms  │   │
│  │  Permission set updated         │ permission_set:{id}:effective             │   │
│  │  System set updated             │ All extended sets, all affected groups    │   │
│  │  Asset ownership changed        │ asset:{id}:owners                         │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Cache Implementation

```go
type PermissionCache struct {
    redis *redis.Client
    ttl   struct {
        userGroups      time.Duration
        userPermissions time.Duration
        groupPerms      time.Duration
        permSetEffective time.Duration
        assetOwners     time.Duration
    }
}

func NewPermissionCache(redis *redis.Client) *PermissionCache {
    return &PermissionCache{
        redis: redis,
        ttl: struct {
            userGroups      time.Duration
            userPermissions time.Duration
            groupPerms      time.Duration
            permSetEffective time.Duration
            assetOwners     time.Duration
        }{
            userGroups:      5 * time.Minute,
            userPermissions: 5 * time.Minute,
            groupPerms:      10 * time.Minute,
            permSetEffective: 30 * time.Minute,
            assetOwners:     10 * time.Minute,
        },
    }
}

func (c *PermissionCache) GetUserPermissions(ctx context.Context, userID, tenantID string) ([]string, error) {
    key := fmt.Sprintf("user:%s:permissions:%s", userID, tenantID)

    // Try cache
    cached, err := c.redis.SMembers(ctx, key).Result()
    if err == nil && len(cached) > 0 {
        return cached, nil
    }

    return nil, ErrCacheMiss
}

func (c *PermissionCache) SetUserPermissions(ctx context.Context, userID, tenantID string, permissions []string) error {
    key := fmt.Sprintf("user:%s:permissions:%s", userID, tenantID)

    pipe := c.redis.Pipeline()
    pipe.Del(ctx, key)
    if len(permissions) > 0 {
        pipe.SAdd(ctx, key, permissions)
    }
    pipe.Expire(ctx, key, c.ttl.userPermissions)

    _, err := pipe.Exec(ctx)
    return err
}

func (c *PermissionCache) InvalidateUser(ctx context.Context, userID, tenantID string) error {
    pattern := fmt.Sprintf("user:%s:*:%s", userID, tenantID)
    keys, err := c.redis.Keys(ctx, pattern).Result()
    if err != nil {
        return err
    }

    if len(keys) > 0 {
        return c.redis.Del(ctx, keys...).Err()
    }
    return nil
}
```

---

## Document End

This supplement provides detailed flows, data examples, and technical specifications to support the main implementation plan. Use this alongside `access-control-implementation-plan.md` for complete implementation guidance.
