# RFC: Asset Type Consolidation

**Date**: 2026-04-13  
**Status**: Implemented (2026-04-14)  
**Related**: [CTEM Roadmap](./2026-04-ctem-roadmap.md)  
**Migrations**: 000128–000132  
**Tests**: 23 unit + 18 integration assertions

---

## Problem

33 asset types → sidebar sprawl, overlapping semantics, inconsistent properties.

## Current Types — Full Audit

### 33 types evaluated:

| # | Current Type | Used in Relationships? | Has UI Page? | Has Unique Properties? | Verdict |
|---|-------------|----------------------|-------------|----------------------|---------|
| 1 | `domain` | resolves_to source | Yes | DNS, whois, registrar | **Keep** |
| 2 | `subdomain` | resolves_to, cname_of | Yes | parent_domain | **Keep** |
| 3 | `certificate` | — | Yes | X.509 fields | **Keep** |
| 4 | `ip_address` | resolves_to target | Yes | ASN, ports, geo | **Keep** |
| 5 | `website` | — | Yes | URL, status_code | → Merge into `application` |
| 6 | `web_application` | — | Yes | URL, tech stack | → Merge into `application` |
| 7 | `api` | exposes source | Yes | endpoints, auth | → Merge into `application` |
| 8 | `mobile_app` | — | Yes | platform, store URL | → Merge into `application` |
| 9 | `service` | exposes target | Yes | port, protocol | **Keep** (network service) |
| 10 | `repository` | — | Yes | git platform, branches | **Keep** |
| 11 | `cloud_account` | contains source | Yes | provider, account_id | **Keep** |
| 12 | `compute` | runs_on target | Yes | instance type | → Alias to `host` |
| 13 | `storage` | stores_data_in target | Yes | provider, bucket | **Keep** |
| 14 | `serverless` | — | Yes | runtime, region | → Alias to `host` |
| 15 | `container_registry` | — | Yes | provider, images | → Alias to `storage` |
| 16 | `host` | runs_on, contains, many | Yes | OS, IP, hardware | **Keep** (core type) |
| 17 | `container` | runs_on source | Yes | image, container_id | **Keep** |
| 18 | `kubernetes_cluster` | contains source | Yes | provider, version | → Merge into `kubernetes` |
| 19 | `kubernetes_namespace` | — | Yes | cluster_name | → Merge into `kubernetes` |
| 20 | `database` | stores_data_in target | Yes | engine, connection | **Keep** |
| 21 | `data_store` | — | Yes | store type | → Alias to `database` |
| 22 | `s3_bucket` | — | Yes | bucket name, region | → Alias to `storage` |
| 23 | `network` | contains target | Yes | CIDR, VLAN | **Keep** |
| 24 | `vpc` | contains source | Yes | provider, CIDR | → Sub-type of `network` |
| 25 | `subnet` | — | Yes | CIDR, AZ | → Sub-type of `network` |
| 26 | `load_balancer` | load_balances, resolves_to | Yes | type, listeners | → Sub-type of `network` |
| 27 | `firewall` | — (no constraints!) | Yes | vendor, rules | → Sub-type of `network` |
| 28 | `iam_user` | — | Yes | provider, MFA | → Merge into `identity` |
| 29 | `iam_role` | granted_to source | Yes | policies, trust | → Merge into `identity` |
| 30 | `service_account` | — | Yes | provider, scope | → Merge into `identity` |
| 31 | `http_service` | — | No (recon artifact) | URL, status, headers | → Alias to `service` |
| 32 | `open_port` | — | No (recon artifact) | port, protocol, banner | → Alias to `service` |
| 33 | `discovered_url` | — | No (recon artifact) | URL, depth, source | → Alias to `service` |

---

## Target: 15 Core Types + Sub-types

### Category: external_surface

| Core Type | Sub-types | Notes |
|-----------|-----------|-------|
| `domain` | — | DNS, whois |
| `subdomain` | — | Parent domain linkage |
| `certificate` | — | X.509 specific |
| `ip_address` | — | Network endpoint from DNS/scan |

### Category: application

| Core Type | Sub-types | Notes |
|-----------|-----------|-------|
| `application` | `website`, `web_application`, `api`, `mobile_app` | Merged — all are "apps" with URL/endpoint |

### Category: infrastructure

| Core Type | Sub-types | Notes |
|-----------|-----------|-------|
| `host` | `server`, `vm`, `compute`, `serverless` | Physical/virtual machines, cloud compute |
| `container` | — | Docker/OCI containers |
| `kubernetes` | `cluster`, `namespace`, `workload` | Merged cluster + namespace |

### Category: network

| Core Type | Sub-types | Notes |
|-----------|-----------|-------|
| `network` | `lan`, `vlan`, `vpc`, `subnet`, `firewall`, `load_balancer` | All network-related assets |
| `service` | `http`, `ssh`, `database`, `open_port` | Network services, absorbs recon types |

### Category: cloud

| Core Type | Sub-types | Notes |
|-----------|-----------|-------|
| `cloud_account` | `aws`, `gcp`, `azure` | Cloud provider account |
| `storage` | `s3`, `gcs`, `blob`, `container_registry` | Cloud storage + registries |

### Category: data

| Core Type | Sub-types | Notes |
|-----------|-----------|-------|
| `database` | `postgresql`, `mysql`, `mongodb`, `redis`, `data_store` | All database engines |
| `repository` | `github`, `gitlab`, `bitbucket` | Source code repos |

### Category: identity

| Core Type | Sub-types | Notes |
|-----------|-----------|-------|
| `identity` | `iam_user`, `iam_role`, `service_account` | All identity entities |

### Category: other

| Core Type | Sub-types | Notes |
|-----------|-----------|-------|
| `unclassified` | — | Catch-all |

### Summary:

```
Before: 33 types (flat)
After:  15 core types + unlimited sub_types
```

---

## Relationship Constraints Impact

Types used in relationship constraints that need attention:

| Relationship | Current Source/Target | After Consolidation | Action |
|-------------|---------------------|--------------------| -------|
| `resolves_to` | domain → ip_address, load_balancer | domain → ip_address, network(load_balancer) | Update constraint |
| `runs_on` | container → host, compute | container → host | compute alias handles |
| `contains` | cloud_account → host, k8s | cloud_account → host, kubernetes | Update constraint |
| `load_balances` | load_balancer → host, service | network(load_balancer) → host, service | Update constraint |
| `exposes` | host, service → api, port | host, service → application, service | Update constraint |
| `granted_to` | iam_role → user | identity(role) → identity(user) | Update constraint |
| `stores_data_in` | host → database, storage | host → database, storage | No change |

**Note**: Constraints reference type strings. When type becomes `network` + sub_type `load_balancer`, constraints need to match `type=network AND sub_type=load_balancer` OR simplify to `type=network`.

---

## Migration Plan (4 steps, no breaking change)

### Step 1: Add category mapping (code only, no DB)

```go
var TypeToCategory = map[AssetType]string{
    "domain":               "external_surface",
    "subdomain":            "external_surface",
    "certificate":          "external_surface",
    "ip_address":           "external_surface",
    "website":              "application",
    "web_application":      "application",
    "api":                  "application",
    "mobile_app":           "application",
    "host":                 "infrastructure",
    "compute":              "infrastructure",
    "serverless":           "infrastructure",
    "container":            "infrastructure",
    "kubernetes_cluster":   "infrastructure",
    "kubernetes_namespace": "infrastructure",
    "network":              "network",
    "vpc":                  "network",
    "subnet":               "network",
    "firewall":             "network",
    "load_balancer":        "network",
    "service":              "network",
    "http_service":         "network",
    "open_port":            "network",
    "discovered_url":       "network",
    "cloud_account":        "cloud",
    "storage":              "cloud",
    "container_registry":   "cloud",
    "database":             "data",
    "data_store":           "data",
    "s3_bucket":            "data",
    "repository":           "code",
    "iam_user":             "identity",
    "iam_role":             "identity",
    "service_account":      "identity",
    "unclassified":         "other",
}
```

API response includes `category` field. UI groups by category.

### Step 2: Add `sub_type` column

```sql
ALTER TABLE assets ADD COLUMN sub_type VARCHAR(50);

-- Backfill sub_type from current type for types being merged
UPDATE assets SET sub_type = 'website' WHERE asset_type = 'website';
UPDATE assets SET sub_type = 'web_application' WHERE asset_type = 'web_application';
UPDATE assets SET sub_type = 'api' WHERE asset_type = 'api';
UPDATE assets SET sub_type = 'mobile_app' WHERE asset_type = 'mobile_app';
UPDATE assets SET sub_type = 'vpc' WHERE asset_type = 'vpc';
UPDATE assets SET sub_type = 'subnet' WHERE asset_type = 'subnet';
UPDATE assets SET sub_type = 'firewall' WHERE asset_type = 'firewall';
UPDATE assets SET sub_type = 'load_balancer' WHERE asset_type = 'load_balancer';
UPDATE assets SET sub_type = 'compute' WHERE asset_type = 'compute';
UPDATE assets SET sub_type = 'serverless' WHERE asset_type = 'serverless';
UPDATE assets SET sub_type = 'cluster' WHERE asset_type = 'kubernetes_cluster';
UPDATE assets SET sub_type = 'namespace' WHERE asset_type = 'kubernetes_namespace';
UPDATE assets SET sub_type = 'iam_user' WHERE asset_type = 'iam_user';
UPDATE assets SET sub_type = 'iam_role' WHERE asset_type = 'iam_role';
UPDATE assets SET sub_type = 'service_account' WHERE asset_type = 'service_account';
UPDATE assets SET sub_type = 'data_store' WHERE asset_type = 'data_store';
UPDATE assets SET sub_type = 's3' WHERE asset_type = 's3_bucket';
UPDATE assets SET sub_type = 'container_registry' WHERE asset_type = 'container_registry';
UPDATE assets SET sub_type = 'http' WHERE asset_type = 'http_service';
UPDATE assets SET sub_type = 'open_port' WHERE asset_type = 'open_port';
UPDATE assets SET sub_type = 'discovered_url' WHERE asset_type = 'discovered_url';
```

### Step 3: Type aliasing in ingest

```go
var TypeAliases = map[AssetType]AssetType{
    "website":              "application",
    "web_application":      "application",
    "api":                  "application",
    "mobile_app":           "application",
    "compute":              "host",
    "serverless":           "host",
    "vpc":                  "network",
    "subnet":               "network",
    "firewall":             "network",
    "load_balancer":        "network",
    "kubernetes_cluster":   "kubernetes",
    "kubernetes_namespace": "kubernetes",
    "iam_user":             "identity",
    "iam_role":             "identity",
    "service_account":      "identity",
    "data_store":           "database",
    "s3_bucket":            "storage",
    "container_registry":   "storage",
    "http_service":         "service",
    "open_port":            "service",
    "discovered_url":       "service",
}
```

Ingest API: `type: "firewall"` → stored as `type: "network"`, `sub_type: "firewall"`.
Old API still accepts all 33 types (backward compatible).

### Step 4: UI sidebar consolidation

```
Before (30+ entries):          After (9 entries):
├── Domains                    ├── External Surface
├── Subdomains                 │   tabs: Domains | Subdomains | Certs | IPs
├── Certificates               │
├── IP Addresses               ├── Applications
├── Websites                   │   tabs: Websites | Web Apps | APIs | Mobile
├── Web Applications           │
├── APIs                       ├── Infrastructure
├── Hosts                      │   tabs: Hosts | Containers | Kubernetes
├── Containers                 │
├── K8s Clusters               ├── Network
├── K8s Namespaces             │   tabs: Networks | Firewalls | Load Balancers | Services
├── Networks                   │
├── VPCs                       ├── Cloud
├── Subnets                    │   tabs: Accounts | Storage
├── Firewalls                  │
├── Load Balancers             ├── Data
├── Cloud Accounts             │   tabs: Databases | Repositories
├── Databases                  │
├── Repositories               ├── Identity
├── IAM Users                  │   tabs: Users | Roles | Service Accounts
├── IAM Roles                  │
├── Service Accounts           └── Unclassified
├── ...                        
```

---

## Timeline

| Step | Effort | Breaking Change | Quarter |
|------|--------|-----------------|---------|
| 1. Category mapping | 1 week | None | Q2 2026 |
| 2. sub_type column + backfill | 1 week | None (additive) | Q2 2026 |
| 3. Type aliasing in ingest | 2 weeks | None (backward compatible) | Q3 2026 |
| 4. UI sidebar consolidation | 3 weeks | UI only | Q3 2026 |
| 5. API v2 (15 types only) | — | API v2 (v1 still works) | 2027 |

---

## Open Questions

1. **Should `service` be under `network` or `infrastructure`?**
   - Network services (SSH, HTTP) are discovery artifacts → `network`
   - Application services (microservices) → could be `application`
   - **Decision**: Keep under `network` — services are discovered by network scans

2. **Should `kubernetes` be its own core type or sub-type of `infrastructure`?**
   - K8s has unique properties (cluster, namespace, workload)
   - But it's still infrastructure
   - **Decision**: Core type `kubernetes` under category `infrastructure`

3. **What about future types (IoT, OT, SCADA)?**
   - IoT devices → `host` sub_type `iot_device`
   - OT/SCADA → `host` sub_type `scada_controller`
   - No new core types needed — sub_type handles it
