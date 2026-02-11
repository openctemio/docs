---
layout: default
title: Asset Auto-Creation
parent: Architecture
nav_order: 15
---

# Asset Auto-Creation in Ingest Pipeline

This document explains how assets are automatically created during the ingest process when agents send scan results.

---

## Overview

When agents (CI/CD runners or daemon workers) send scan results to the API, they may not explicitly include an `assets` section in the CTIS report. The ingest pipeline automatically creates assets from report metadata to ensure findings always have a target asset.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ASSET AUTO-CREATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

 Agent Scan         CTIS Report            API Ingest             Database
    │                   │                     │                     │
    │  gitleaks scan    │                     │                     │
    ├──────────────────▶│                     │                     │
    │                   │  report.Assets=[]   │                     │
    │                   │  report.Findings=[..]│                     │
    │                   │  report.Metadata.   │                     │
    │                   │    Branch.          │                     │
    │                   │    RepositoryURL=   │                     │
    │                   │    "github.com/o/r" │                     │
    │                   ├────────────────────▶│                     │
    │                   │                     │  Auto-create asset  │
    │                   │                     │  from RepositoryURL │
    │                   │                     ├────────────────────▶│
    │                   │                     │                     │ assets
    │                   │                     │  Link findings to   │
    │                   │                     │  auto-created asset │
    │                   │                     ├────────────────────▶│
    │                   │                     │                     │ findings
```

---

## Canonical Repository Naming

Assets are identified by their **canonical name** which includes the provider domain:

| Provider | Format | Example |
|----------|--------|---------|
| GitHub | `github.com/{owner}/{repo}` | `github.com/openctemio/api` |
| GitHub Enterprise | `github.mycompany.com/{owner}/{repo}` | `github.mycompany.com/team/project` |
| GitLab | `gitlab.com/{namespace}/{project}` | `gitlab.com/myorg/myrepo` |
| GitLab Self-hosted | `gitlab.mycompany.com/{namespace}/{project}` | `gitlab.mycompany.com/team/project` |

This ensures:
- `github.com/org/repo` and `gitlab.com/org/repo` are **different assets**
- Self-hosted instances are tracked separately from cloud instances
- No duplicate assets across different providers

### SDK Implementation

```go
// sdk/pkg/gitenv/github.go
func (g *GitHubEnv) CanonicalRepoName() string {
    serverURL := os.Getenv("GITHUB_SERVER_URL")
    repo := os.Getenv("GITHUB_REPOSITORY")
    if repo == "" {
        return ""
    }
    domain := "github.com"
    if serverURL != "" {
        domain = strings.TrimPrefix(serverURL, "https://")
        domain = strings.TrimPrefix(domain, "http://")
        domain = strings.TrimSuffix(domain, "/")
    }
    return fmt.Sprintf("%s/%s", domain, repo)
}

// sdk/pkg/gitenv/gitlab.go
func (g *GitLabEnv) CanonicalRepoName() string {
    projectPath := os.Getenv("CI_PROJECT_PATH")
    if projectPath == "" {
        return ""
    }
    serverHost := os.Getenv("CI_SERVER_HOST")
    if serverHost == "" {
        serverHost = "gitlab.com"
    }
    return fmt.Sprintf("%s/%s", serverHost, projectPath)
}
```

---

## Auto-Creation Logic

The `AssetProcessor.ProcessBatch()` method handles auto-creation with a **5-level priority chain**:

| Priority | Source | Reliability | Asset Type |
|----------|--------|-------------|------------|
| 1 | BranchInfo.RepositoryURL | Highest | Repository |
| 2 | Unique AssetValue from ALL findings | High | Varies |
| 3 | Scope.Name from metadata | Medium | Varies |
| 4 | Path inference (git host patterns) | Medium | Repository |
| 5 | Tool+ScanID fallback | Fallback | Other |

### Priority 1: BranchInfo.RepositoryURL (Most Reliable)

```go
if report.Metadata.Branch != nil && report.Metadata.Branch.RepositoryURL != "" {
    return &ctis.Asset{
        ID:          "auto-asset-1",
        Type:        ctis.AssetTypeRepository,
        Value:       report.Metadata.Branch.RepositoryURL,
        Name:        report.Metadata.Branch.RepositoryURL,
        Criticality: ctis.CriticalityHigh,
        Properties: ctis.Properties{
            "auto_created":   true,
            "source":         "branch_info",
            "commit_sha":     report.Metadata.Branch.CommitSHA,
            "branch":         report.Metadata.Branch.Name,
            "default_branch": report.Metadata.Branch.IsDefaultBranch,
        },
    }
}
```

### Priority 2: Unique AssetValue from ALL Findings

**Changed**: Now scans ALL findings (not just first) and only creates asset if ALL findings share the SAME AssetValue.

```go
// Collect unique asset values from ALL findings
assetSet := make(map[string]*assetInfo)
for _, finding := range report.Findings {
    if finding.AssetValue != "" {
        // Track count and type
        assetSet[finding.AssetValue] = &assetInfo{...}
    }
}

// Only auto-create if exactly 1 unique asset value
// Multiple different values = require explicit assets (safer)
if len(assetSet) != 1 {
    return nil  // Skip to next priority
}

// SECURITY: Sanitize user-provided asset value
sanitizedValue := sanitizeAssetName(value)
return &ctis.Asset{
    ID:          "auto-asset-1",
    Type:        info.assetType,
    Value:       sanitizedValue,
    Criticality: ctis.CriticalityHigh,
    Properties: ctis.Properties{
        "auto_created":  true,
        "source":        "finding_asset_value",
        "finding_count": info.count,
    },
}
```

### Priority 3: Scope Information

```go
if report.Metadata.Scope != nil && report.Metadata.Scope.Name != "" {
    scopeType := ctis.AssetTypeOther
    switch report.Metadata.Scope.Type {
    case "repository":
        scopeType = ctis.AssetTypeRepository
    case "domain":
        scopeType = ctis.AssetTypeDomain
    case "ip_address":
        scopeType = ctis.AssetTypeIPAddress
    case "container":
        scopeType = ctis.AssetTypeContainer
    case "cloud_account":
        scopeType = ctis.AssetTypeCloudAccount
    }
    return &ctis.Asset{
        ID:          "auto-asset-1",
        Type:        scopeType,
        Value:       report.Metadata.Scope.Name,
        Criticality: ctis.CriticalityMedium,
        Properties: ctis.Properties{
            "auto_created": true,
            "source":       "scope",
            "scope_type":   report.Metadata.Scope.Type,
        },
    }
}
```

### Priority 4: Path Inference (NEW)

Infers repository from file path patterns in findings.

**Pattern 1: Git Host URLs**

```go
// e.g., github.com/org/repo/src/main.go → https://github.com/org/repo
gitHostPattern := regexp.MustCompile(`(github\.com|gitlab\.com|bitbucket\.org)/([^/]+)/([^/]+)`)

// SECURITY: Only allow known git hosts
if !isValidGitHost(host) {
    continue
}

// SECURITY: Sanitize org and repo names
org = sanitizeAssetName(org)
repo = sanitizeAssetName(repo)
```

**Pattern 2: Common Path Prefix**

```go
// If all paths share a common directory prefix
// /home/user/myproject/src/main.go
// /home/user/myproject/pkg/utils.go
// → Asset: "myproject"

// SECURITY: Sanitize to avoid path disclosure
sanitizedPrefix := sanitizePathForProperty(commonPrefix)
```

### Priority 5: Tool+ScanID Fallback (NEW)

Last resort to ensure findings are NEVER orphaned.

```go
if report.Tool != nil && report.Tool.Name != "" {
    scanID := report.Metadata.ID
    if scanID == "" {
        scanID = "unknown"
    }
    assetName := fmt.Sprintf("scan:%s:%s", toolName, scanID)
    return &ctis.Asset{
        ID:          "auto-asset-1",
        Type:        ctis.AssetTypeOther,
        Value:       assetName,
        Criticality: ctis.CriticalityMedium,
        Properties: ctis.Properties{
            "auto_created": true,
            "source":       "tool_fallback",
            "tool_name":    toolName,
            "scan_id":      scanID,
        },
    }
}
```

---

## Upsert Behavior

When an asset is auto-created or explicitly provided:

1. **Check Existence**: Batch lookup by asset names within tenant
2. **Create if New**: Insert new asset with auto-generated UUID
3. **Update if Exists**: Merge properties, add tags, update `last_seen_at`

```sql
-- Batch lookup
SELECT * FROM assets WHERE tenant_id = $1 AND name IN ($2, $3, ...);

-- Batch upsert
INSERT INTO assets (id, tenant_id, name, type, criticality, properties, ...)
VALUES ($1, $2, $3, ...)
ON CONFLICT (tenant_id, name) DO UPDATE SET
    properties = assets.properties || EXCLUDED.properties,
    last_seen_at = NOW();
```

---

## Agent Configuration

### GitHub Actions Example

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        with:
          format: json
          report: gitleaks-report.json

      - name: Push to OpenCTEM
        env:
          OPENCTEM_API_URL: ${{ secrets.OPENCTEM_API_URL }}
          OPENCTEM_API_KEY: ${{ secrets.OPENCTEM_API_KEY }}
        run: |
          openctem-agent push --scanner gitleaks --file gitleaks-report.json
```

The agent automatically:
1. Detects GitHub Actions environment (`GITHUB_ACTIONS=true`)
2. Extracts `CanonicalRepoName()` → `github.com/{owner}/{repo}`
3. Builds `BranchInfo` with `RepositoryURL`
4. Sends to API where asset is auto-created

### Environment Variables Used

| Provider | Variable | Description |
|----------|----------|-------------|
| GitHub | `GITHUB_SERVER_URL` | GitHub server URL (default: `https://github.com`) |
| GitHub | `GITHUB_REPOSITORY` | `owner/repo` format |
| GitLab | `CI_SERVER_HOST` | GitLab server domain (default: `gitlab.com`) |
| GitLab | `CI_PROJECT_PATH` | `namespace/project` format |

---

## Finding Association

After asset auto-creation, findings are linked to the asset:

```go
// FindingProcessor.ProcessBatch()

// Get default asset if only one exists (single-asset report)
var defaultAssetID shared.ID
if len(assetMap) == 1 {
    for _, id := range assetMap {
        defaultAssetID = id
        break
    }
}

for _, finding := range report.Findings {
    // Try explicit AssetRef first
    if finding.AssetRef != "" {
        if id, ok := assetMap[finding.AssetRef]; ok {
            targetAssetID = id
        }
    }

    // Fall back to default asset (auto-created)
    if targetAssetID.IsZero() && !defaultAssetID.IsZero() {
        targetAssetID = defaultAssetID
    }

    // Skip if no asset (shouldn't happen after auto-creation)
    if targetAssetID.IsZero() {
        addError(output, "finding: no target asset")
        continue
    }

    // Process finding with targetAssetID...
}
```

---

## Database Schema

### Assets Table

```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(1024) NOT NULL,
    type VARCHAR(50) NOT NULL,
    criticality VARCHAR(20) NOT NULL DEFAULT 'medium',
    description TEXT,
    properties JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    discovery_source VARCHAR(100),
    discovery_tool VARCHAR(100),
    discovered_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, name)
);
```

### Key Indexes

```sql
CREATE INDEX idx_assets_tenant_name ON assets(tenant_id, name);
CREATE INDEX idx_assets_tenant_type ON assets(tenant_id, type);
CREATE INDEX idx_assets_properties ON assets USING GIN (properties);
```

---

## Troubleshooting

### Findings Created = 0

If agent reports show `0 findings created, 0 updated`:

1. **Check BranchInfo**: Ensure agent sends `RepositoryURL` in `Metadata.Branch`
2. **Verify Canonical Name**: Check logs for `auto-created asset from report metadata`
3. **Check Asset Lookup**: Verify `name` matches between scans

### Duplicate Assets

If same repo creates multiple assets:

1. **Verify Canonical Format**: Should be `domain/owner/repo` not full URL
2. **Check Provider Detection**: Ensure `GITHUB_ACTIONS` or `GITLAB_CI` is set
3. **Review Agent Logs**: Look for `[gitenv]` log messages

### Log Examples

```
[gitenv] GitHub Actions environment detected
[ingest] auto-created asset from report metadata asset_name=github.com/org/repo asset_type=repository
[ingest] batch lookup complete total=1 existing=0
[ingest] ingestion complete assets_created=1 findings_created=5
```

---

## Related Documentation

- [Scan Flow Architecture](./scan-flow.md)
- [SDK Quick Start](../guides/sdk-quick-start.md)
- [End to End Workflow](../guides/END_TO_END_WORKFLOW.md)

---

---

## Security Measures

### Input Sanitization

All user-provided values are sanitized before use in auto-created assets:

```go
// helpers.go
func sanitizeAssetName(name string) string {
    // 1. Remove control characters (except common whitespace)
    // 2. Remove dangerous characters: <>'";$|&
    // 3. Block path traversal: ../ or ..\
    // 4. Normalize multiple slashes
    // 5. Trim whitespace
    // 6. Enforce length limit (500 chars)
}
```

### Path Information Disclosure Prevention

Server paths are sanitized before storing in properties:

```go
func sanitizePathForProperty(path string) string {
    // Removes sensitive prefixes:
    // - /home/, /root/, /var/, /tmp/, /etc/
    // - /Users/, C:\Users\, C:\Windows\
    // Returns only project-relative path
}
```

### Git Host Validation

Only known git hosts are accepted for path inference:

```go
func isValidGitHost(host string) bool {
    validHosts := map[string]bool{
        "github.com":    true,
        "gitlab.com":    true,
        "bitbucket.org": true,
    }
    return validHosts[strings.ToLower(host)]
}
```

---

## Summary

The asset auto-creation system ensures:

1. **No orphaned findings**: Every finding has a target asset (5-level fallback chain)
2. **Consistent naming**: Canonical format prevents duplicates across providers
3. **Automatic deduplication**: Upsert logic merges properties on repeat scans
4. **Zero configuration**: Agents auto-detect CI environment and build metadata
5. **Security**: Input sanitization prevents injection attacks and path disclosure
