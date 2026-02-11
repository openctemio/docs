# Component-Dependency System

> Software Bill of Materials (SBOM) tracking for vulnerability management.

## Overview

The Component-Dependency System tracks software components (packages, libraries) used by assets, enabling:

- Vulnerability correlation (CVE → affected components → affected assets)
- License compliance tracking
- Dependency tree analysis for risk scoring
- SBOM generation (CycloneDX, SPDX compatible)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         COMPONENTS                               │
│  Global registry of unique packages (deduplicated by PURL)       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ id | purl                        | name    | version | eco  ││
│  │ 1  | pkg:npm/lodash@4.17.21      | lodash  | 4.17.21 | npm  ││
│  │ 2  | pkg:npm/express@4.18.0      | express | 4.18.0  | npm  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ASSET_COMPONENTS                            │
│  Links assets to components with context (path, depth, parent)   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ asset_id | component_id | path         | type   | depth     ││
│  │ A        | 1 (lodash)   | package.json | direct | 1         ││
│  │ A        | 2 (express)  | package.json | trans  | 2         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Ingestion Flow

```
Agent (Trivy)
    │
    ▼
┌─────────────────┐
│ CTIS Report      │
│ {               │
│   dependencies: │
│   [{            │
│     name,       │
│     version,    │
│     purl,       │
│     ecosystem,  │
│     relationship│  ← "direct", "indirect", "transit"
│     depends_on  │  ← Parent references
│   }]            │
│ }               │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ API Processor   │────▶│ ParseDependency │
│                 │     │ Type()          │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Pass 1: Upsert  │  Component deduplication by PURL
│ Components      │  Returns existing ID if exists
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Pass 2: Link    │  Create asset_components with:
│ to Assets       │  - Parent tracking (parent_component_id)
│                 │  - Depth calculation (parent.depth + 1)
└─────────────────┘
```

## Scanner Compatibility

### Relationship Mapping

Different scanners use different terminology for dependency relationships:

| Scanner Value | API DependencyType | Notes |
|---------------|-------------------|-------|
| `direct` | `direct` | Explicitly declared in manifest |
| `root` | `direct` | Top-level package (Trivy) |
| `indirect` | `transitive` | Pulled in by another package |
| `transit` | `transitive` | Alternative term |
| `transitive` | `transitive` | Standard term |
| `dev` | `dev` | Development dependency |
| `development` | `dev` | Alternative term |
| `optional` | `optional` | Optional dependency |
| `peer` | `optional` | npm peer dependency |

### Implementation

```go
// domain/component/value_objects.go
func ParseDependencyType(s string) (DependencyType, error) {
    normalized := strings.ToLower(strings.TrimSpace(s))

    switch normalized {
    case "direct", "root":
        return DependencyTypeDirect, nil
    case "transitive", "indirect", "transit":
        return DependencyTypeTransitive, nil
    case "dev", "development":
        return DependencyTypeDev, nil
    case "optional", "peer":
        return DependencyTypeOptional, nil
    default:
        return DependencyTypeDirect, nil // Safe default
    }
}
```

### Ecosystem Support Matrix

| Ecosystem | Scanner | Relationship | DependsOn | Depth Tracking |
|-----------|---------|--------------|-----------|----------------|
| **npm** | Trivy | ✅ direct/indirect | ✅ Yes | ✅ Full support |
| **yarn** | Trivy | ✅ direct/indirect | ✅ Yes | ✅ Full support |
| **pnpm** | Trivy | ✅ direct/indirect | ✅ Yes | ✅ Full support |
| **composer** | Trivy | ⚠️ All "direct" | ✅ Yes | ❌ All depth=1 |
| **maven** | Trivy | ⚠️ All "direct" | ✅ Yes | ❌ All depth=1 |
| **gradle** | Trivy | ⚠️ All "direct" | ✅ Yes | ❌ All depth=1 |
| **pip** | Trivy | ⚠️ All "direct" | ⚠️ Limited | ❌ All depth=1 |
| **go modules** | Trivy | ✅ direct/indirect | ✅ Yes | ✅ Full support |
| **cargo** | Trivy | ✅ direct/indirect | ✅ Yes | ✅ Full support |
| **nuget** | Trivy | ⚠️ All "direct" | ⚠️ Limited | ❌ All depth=1 |

**Legend:**

- ✅ Full support
- ⚠️ Limited (scanner limitation)
- ❌ Not available

### Why Some Ecosystems Report All "direct"

**Composer (PHP):**

- `composer.lock` flattens the dependency tree
- All packages are locked at the same level
- Trivy cannot determine original hierarchy

**Maven (Java):**

- `pom.xml` dependencies are resolved at build time
- Trivy scans the effective POM, not the resolution tree

**Workaround:** Use native tools for accurate dependency trees:

```bash
# Composer
composer show --tree

# Maven
mvn dependency:tree

# npm (Trivy handles correctly)
npm ls --all
```

## Depth Tracking

### Depth Calculation

```
depth = 1: Direct dependency (declared in manifest)
depth = 2: Transitive (pulled by direct dep)
depth = 3: Transitive (pulled by depth=2 dep)
...
```

### Algorithm

```go
// Transitive dependency depth calculation
if depType == DependencyTypeTransitive {
    if len(dep.DependsOn) > 0 {
        // 1. Try in-memory lookup (current batch)
        parentID, parentDepth, found := findParentInMaps(dep.DependsOn, ...)

        // 2. Fallback: DB lookup (previous scans)
        if !found {
            parentID, parentDepth, found = findParentInDB(ctx, assetID, dep.DependsOn)
        }

        if found {
            depth = parentDepth + 1
            assetDep.SetParentComponentID(parentID)
        } else {
            depth = 2 // Default for unknown parent
        }
    }
}
```

### Parent Lookup Priority

1. **In-memory maps** (O(1)) - Components from current batch
2. **Database lookup** (O(1)) - Components from previous scans
3. **Default** - depth=2, parent=NULL

## Edge Cases

### 1. Component Reuse Across Assets

```
Asset A: lodash@4.17.21 (scan 1)
Asset B: lodash@4.17.21 (scan 2)

Result:
- components: 1 row (PURL unique)
- asset_components: 2 rows (one per asset)
```

### 2. Rescan with New Child Dependency

```
Scan 1: express@4.18.0 (direct)
Scan 2: body-parser@1.20.0 (transitive, depends_on: express)
        express NOT in batch

Result:
- DB lookup finds express from scan 1
- body-parser gets parent_component_id = express
- body-parser gets depth = 2
```

### 3. Same Component, Different Paths

```
Unique constraint: (asset_id, component_id, path)

asset_components:
  {asset: A, component: lodash, path: "package.json"}      ← OK
  {asset: A, component: lodash, path: "lib/package.json"}  ← OK (different path)
```

### 4. PURL Preference

```go
// Agent's PURL preferred over generated
// Agent may include namespace, qualifiers
comp := NewComponent(name, version, ecosystem)
if dep.PURL != "" {
    comp.SetPURL(dep.PURL)  // Override generated PURL
}
```

## Database Schema

### components table

```sql
CREATE TABLE components (
    id UUID PRIMARY KEY,
    purl VARCHAR(1000) UNIQUE NOT NULL,  -- Package URL
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    ecosystem VARCHAR(50) NOT NULL,
    description TEXT,
    homepage VARCHAR(500),
    vulnerability_count INTEGER DEFAULT 0,  -- Updated by background job
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### asset_components table

```sql
CREATE TABLE asset_components (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    asset_id UUID NOT NULL REFERENCES assets(id),
    component_id UUID NOT NULL REFERENCES components(id),
    path VARCHAR(1000),
    manifest_file VARCHAR(255),
    dependency_type VARCHAR(50) DEFAULT 'direct',
    parent_component_id UUID REFERENCES asset_components(id),
    depth INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (asset_id, component_id, path),
    CHECK (parent_component_id IS NULL OR parent_component_id != id)
);
```

### Indexes

```sql
-- Risk-based queries
CREATE INDEX idx_asset_components_risk_query
    ON asset_components(asset_id, dependency_type, depth);

-- Direct dependencies only
CREATE INDEX idx_asset_components_direct_deps
    ON asset_components(asset_id, component_id)
    WHERE depth = 1;

-- Parent lookup
CREATE INDEX idx_asset_components_parent
    ON asset_components(parent_component_id)
    WHERE parent_component_id IS NOT NULL;
```

## Security Considerations

### Metadata Size Limits

```go
const (
    MaxMetadataSize = 64 * 1024  // 64KB
    MaxMetadataKeys = 100
)
```

### vulnerability_count Protection

```sql
-- NOT updated from agent data (prevents reset to 0)
ON CONFLICT (purl) DO UPDATE SET
    description = EXCLUDED.description,
    homepage = EXCLUDED.homepage,
    -- vulnerability_count: managed by background job only
    metadata = components.metadata || EXCLUDED.metadata,
    updated_at = NOW()
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/components` | GET | List global components |
| `/api/v1/components/{id}` | GET | Get component details |
| `/api/v1/assets/{id}/dependencies` | GET | List asset dependencies |
| `/api/v1/components/stats` | GET | Component statistics |
| `/api/v1/components/vulnerable` | GET | Vulnerable components |

## Related Documentation

- [Scan Flow](./scan-flow.md)
- [SDK API Integration](./sdk-api-integration.md)
- [Finding Type System](../_internal/finding-type-system.md)

---

**Last Updated:** 2026-01-30
