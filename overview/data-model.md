---
title: Data model
parent: Overview
nav_order: 3
---

# Data model
{: .no_toc }

The main records OpenCTEM keeps and how they relate, with the PostgreSQL table
names used in the code. This is an overview of the key entities, not the full
schema: the schema is defined by the migrations in
[`api/migrations`](https://github.com/openctemio/openctem/tree/develop/api/migrations).

1. TOC
{:toc}

---

## Organizations, people and access

An organization is a row in `tenants`. Accounts (`users`) are global to the
installation; a membership (`tenant_members`) links an account to an
organization with a base role, and custom roles and groups refine what the
member can do and see.

```mermaid
erDiagram
    tenants ||--o{ tenant_members : "has members"
    users ||--o{ tenant_members : "belongs through"
    users ||--o{ user_identities : "signs in with"
    tenants ||--o{ roles : "defines custom"
    roles ||--o{ user_roles : "granted by"
    users ||--o{ user_roles : "holds"
    tenants ||--o{ groups : "has"
    groups ||--o{ group_members : "has"
    users ||--o{ group_members : "is in"
    tenants ||--o{ tenant_identity_providers : "configures SSO"
    tenants ||--o{ verified_domains : "proves"
    users ||--o| admin_users : "may be a platform admin"

    tenants {
        uuid id PK
        string slug
        jsonb settings
    }
    users {
        uuid id PK
        string email
        string auth_provider
    }
    tenant_members {
        uuid tenant_id FK
        uuid user_id FK
        string role "owner, admin, member, viewer"
        string status
    }
    roles {
        uuid id PK
        uuid tenant_id "null for system roles"
        bool has_full_data_access
    }
    groups {
        uuid id PK
        uuid tenant_id FK
        string external_id "SCIM"
    }
    verified_domains {
        uuid tenant_id FK
        string domain
        string purpose "easm or sso"
        string status
    }
    admin_users {
        uuid user_id FK
        string role "super_admin, ops_admin, readonly"
        bool is_break_glass
    }
```

- **System roles** (owner, admin, member, viewer) are shared rows with no
  `tenant_id`; custom roles belong to one organization.
- **Groups** decide which assets a member sees: through `group_asset_scope_rules`
  and the per-asset `asset_access_grants`, resolved into
  `user_accessible_assets`.
- **Platform administrators** (`admin_users`) are linked to an account that
  belongs to no organization.

## Assets, findings and exposures

```mermaid
erDiagram
    tenants ||--o{ assets : owns
    assets ||--o{ asset_relationships : "source of"
    assets ||--o{ asset_relationships : "target of"
    assets ||--o{ findings : "has"
    assets ||--o{ exposure_events : "has"
    assets ||--o{ asset_components : "contains"
    components ||--o{ asset_components : "used in"
    components |o--o{ findings : "vulnerable in"
    findings ||--o{ finding_evidence : "proved by"
    findings ||--o{ finding_activities : "history"
    findings ||--o{ finding_comments : "discussed in"

    assets {
        uuid id PK
        uuid tenant_id FK
        string asset_type
        string name
        uuid parent_id
    }
    asset_relationships {
        uuid source_asset_id FK
        uuid target_asset_id FK
        string relationship_type
    }
    findings {
        uuid id PK
        uuid tenant_id FK
        uuid asset_id FK
        string fingerprint "de-duplication"
        string status
        string severity
        string priority_class
        bool is_in_kev
        float epss_score
    }
    exposure_events {
        uuid id PK
        uuid asset_id FK
        string event_type
        string state
        string fingerprint
    }
    components {
        uuid id PK
        string purl "global catalog"
        string version
    }
    asset_components {
        uuid asset_id FK
        uuid component_id FK
    }
    finding_evidence {
        uuid finding_id FK
        uuid retest_id
    }
```

- A **finding** is one weakness on one asset; its `fingerprint` makes a rescan
  update the same row instead of adding a new one. Its statuses are described in
  [Exposures and findings](../user-guide/05-exposures-and-findings.md#status-workflow).
- An **exposure event** is one attack-surface change on an asset, with a state
  (active, resolved, accepted, false positive) and first and last sightings.
- **Components** (packages with a version, identified by a purl) are a catalog
  shared by the installation; which asset uses which component is
  per organization (`asset_components`).

## Scans, sensors and scope

```mermaid
erDiagram
    scan_workflows ||--o{ scan_workflow_steps : "defines"
    scan_workflows ||--o{ scan_workflow_versions : "frozen as"
    scans }o--o| scan_workflows : "runs"
    scans ||--o{ scan_runs : "fires"
    scan_runs ||--o{ scan_run_steps : "has"
    scan_run_steps ||--o{ commands : "cut into tasks"
    sensors ||--o{ commands : "claims"
    sensors ||--o{ sensor_keys : "signs with"
    sensors ||--|| sensor_grants : "limited by"
    scan_zones ||--o{ scan_zone_sensors : "pool"
    sensors ||--o{ scan_zone_sensors : "member of"
    scan_zones |o--o{ commands : "routes"
    tenants ||--o{ scope_targets : "authorizes"
    tenants ||--o{ scope_exclusions : "excludes"
    tenants ||--o{ integrations : "connects"

    scans {
        uuid id PK
        uuid tenant_id FK
        uuid scan_workflow_id FK
        string schedule_type
        string schedule_rrule
        string status "active, paused, disabled"
    }
    scan_runs {
        uuid id PK
        uuid scan_id FK
        int scan_workflow_version
        string kind "scan, quick, retest, validation..."
        string status
    }
    scan_run_steps {
        uuid id PK
        uuid scan_run_id FK
        string status
    }
    commands {
        uuid id PK
        uuid scan_run_step_id FK
        uuid sensor_id FK
        string status
        timestamp lease_expires_at
    }
    sensors {
        uuid id PK
        uuid tenant_id FK
        bool is_platform_sensor
        string trust_level
    }
    sensor_grants {
        uuid sensor_id FK
        string profile
        string tier_ceiling
    }
    scope_targets {
        uuid id PK
        string target_type
        string pattern
        string status
        int max_tier "0, 1, 2 (T0 to T2)"
    }
    scope_exclusions {
        uuid id PK
        string exclusion_type
        string pattern
    }
    integrations {
        uuid id PK
        string category
        string provider
        bytes credentials_encrypted
    }
```

- **Tasks** are rows of `commands`: each belongs to one step run, may be pinned
  to a scan zone, and carries the lease of the sensor that claimed it.
- A run records the **version** of the scan workflow it executes
  (`scan_workflow_versions`), so editing a workflow never changes a run in
  progress.
- A sensor's **grant** (`sensor_grants`) and **keys** (`sensor_keys`, public
  keys only) are checked on every request; `scan_zone_sensors` is the zone's pool.
- **Integrations** hold per-organization credentials, encrypted with
  `APP_ENCRYPTION_KEY`; notification channels are integrations too.

## Organization isolation in the schema

Every organization-owned table has a `tenant_id` column, and the application
filters every query on it. Child rows that have no `tenant_id` of their own
(for example `scan_workflow_steps`, `scan_run_steps`, `group_members`) are only
reached through a parent row that has one. A few tables are installation-wide by
design: `users`, `components`, `permissions`, `admin_users` and the platform
settings. See [Tenancy and isolation](architecture.md#tenancy-and-isolation).
