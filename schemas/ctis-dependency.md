---
layout: default
title: CTIS Dependency Schema
parent: CTIS Schema Reference
nav_order: 4
---

# CTIS Dependency Schema

The Dependency schema represents software components and libraries (SBOM - Software Bill of Materials).

**Schema Location**: `schemas/ctis/v1/dependency.json`

---

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Component name |
| `version` | string | Component version |

---

## All Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | No | Unique identifier for the dependency |
| `name` | string | **Yes** | Component name |
| `version` | string | **Yes** | Component version |
| `type` | string | No | Component type (`library`, `application`, `framework`) |
| `ecosystem` | string | No | Package ecosystem (`npm`, `maven`, `pypi`, `go`, etc.) |
| `purl` | string | No | Package URL (PURL) identifier |
| `licenses` | array[string] | No | List of licenses |
| `relationship` | string | No | Relationship to the project (`direct`, `transitive`) |
| `depends_on` | array[string] | No | List of dependency IDs this component depends on |
| `path` | string | No | File path where defined (manifest file) |
| `location` | [Location](#location) | No | Precise location in the file |
| `target_index` | integer | No | Index of the target asset in the report's targets array |
| `properties` | object | No | Custom properties |

---

## Object Definitions

### Location

Precise location within a file.

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | File path |
| `line` | integer | Line number |
| `column` | integer | Column number |

---

## Package URL (PURL)

The `purl` field follows the [Package URL specification](https://github.com/package-url/purl-spec).

**Format**: `pkg:<type>/<namespace>/<name>@<version>?<qualifiers>#<subpath>`

### Common PURL Types

| Ecosystem | PURL Type | Example |
|-----------|-----------|---------|
| npm | `npm` | `pkg:npm/@angular/core@14.2.0` |
| PyPI | `pypi` | `pkg:pypi/requests@2.28.0` |
| Maven | `maven` | `pkg:maven/org.apache.commons/commons-lang3@3.12.0` |
| Go | `golang` | `pkg:golang/github.com/gin-gonic/gin@v1.8.1` |
| Cargo (Rust) | `cargo` | `pkg:cargo/serde@1.0.144` |
| NuGet | `nuget` | `pkg:nuget/Newtonsoft.Json@13.0.1` |
| RubyGems | `gem` | `pkg:gem/rails@7.0.4` |
| Composer (PHP) | `composer` | `pkg:composer/laravel/framework@9.0` |
| Hex (Elixir) | `hex` | `pkg:hex/phoenix@1.6.0` |
| CocoaPods | `cocoapods` | `pkg:cocoapods/Alamofire@5.6.0` |

---

## Examples

### Direct Dependency

```json
{
  "id": "dep-001",
  "name": "lodash",
  "version": "4.17.21",
  "type": "library",
  "ecosystem": "npm",
  "purl": "pkg:npm/lodash@4.17.21",
  "licenses": ["MIT"],
  "relationship": "direct",
  "path": "package.json",
  "location": {
    "path": "package.json",
    "line": 15,
    "column": 5
  }
}
```

### Transitive Dependency with Dependency Chain

```json
{
  "id": "dep-002",
  "name": "minimist",
  "version": "1.2.6",
  "type": "library",
  "ecosystem": "npm",
  "purl": "pkg:npm/minimist@1.2.6",
  "licenses": ["MIT"],
  "relationship": "transitive",
  "depends_on": ["dep-001"],
  "path": "package-lock.json",
  "location": {
    "path": "package-lock.json",
    "line": 1234
  }
}
```

### Go Module

```json
{
  "id": "dep-003",
  "name": "github.com/gin-gonic/gin",
  "version": "v1.9.1",
  "type": "library",
  "ecosystem": "go",
  "purl": "pkg:golang/github.com/gin-gonic/gin@v1.9.1",
  "licenses": ["MIT"],
  "relationship": "direct",
  "path": "go.mod",
  "location": {
    "path": "go.mod",
    "line": 5
  }
}
```

### Maven Dependency

```json
{
  "id": "dep-004",
  "name": "commons-lang3",
  "version": "3.12.0",
  "type": "library",
  "ecosystem": "maven",
  "purl": "pkg:maven/org.apache.commons/commons-lang3@3.12.0",
  "licenses": ["Apache-2.0"],
  "relationship": "direct",
  "path": "pom.xml",
  "location": {
    "path": "pom.xml",
    "line": 45
  },
  "properties": {
    "groupId": "org.apache.commons",
    "artifactId": "commons-lang3",
    "scope": "compile"
  }
}
```

### Python Package

```json
{
  "id": "dep-005",
  "name": "requests",
  "version": "2.31.0",
  "type": "library",
  "ecosystem": "pip",
  "purl": "pkg:pypi/requests@2.31.0",
  "licenses": ["Apache-2.0"],
  "relationship": "direct",
  "path": "requirements.txt",
  "depends_on": ["dep-006", "dep-007"],
  "location": {
    "path": "requirements.txt",
    "line": 3
  }
}
```

---

## SBOM Report Example

A complete SBOM report with dependencies:

```json
{
  "version": "1.0",
  "metadata": {
    "timestamp": "2026-01-29T10:00:00Z",
    "source_type": "scanner"
  },
  "tool": {
    "name": "trivy",
    "version": "0.50.0",
    "capabilities": ["sca", "dependency_scanning"]
  },
  "dependencies": [
    {
      "id": "dep-001",
      "name": "express",
      "version": "4.18.2",
      "ecosystem": "npm",
      "purl": "pkg:npm/express@4.18.2",
      "licenses": ["MIT"],
      "relationship": "direct",
      "path": "package.json"
    },
    {
      "id": "dep-002",
      "name": "body-parser",
      "version": "1.20.2",
      "ecosystem": "npm",
      "purl": "pkg:npm/body-parser@1.20.2",
      "licenses": ["MIT"],
      "relationship": "transitive",
      "depends_on": ["dep-001"],
      "path": "package-lock.json"
    },
    {
      "id": "dep-003",
      "name": "qs",
      "version": "6.11.0",
      "ecosystem": "npm",
      "purl": "pkg:npm/qs@6.11.0",
      "licenses": ["BSD-3-Clause"],
      "relationship": "transitive",
      "depends_on": ["dep-002"],
      "path": "package-lock.json"
    }
  ],
  "findings": [
    {
      "type": "vulnerability",
      "title": "CVE-2024-1234 in qs",
      "severity": "high",
      "vulnerability": {
        "cve_id": "CVE-2024-1234",
        "package": "qs",
        "purl": "pkg:npm/qs@6.11.0",
        "affected_version": "6.11.0",
        "fixed_version": "6.11.1",
        "ecosystem": "npm",
        "dependency_path": ["express", "body-parser", "qs"]
      }
    }
  ]
}
```

---

## Relationship Mapping

Understanding the dependency graph:

```
my-app (root)
├── express@4.18.2 (direct)
│   ├── body-parser@1.20.2 (transitive)
│   │   └── qs@6.11.0 (transitive)  <-- vulnerable
│   └── cookie@0.5.0 (transitive)
└── lodash@4.17.21 (direct)
```

The `depends_on` field creates links between dependencies:

```json
{
  "dependencies": [
    {"id": "express", "relationship": "direct"},
    {"id": "body-parser", "relationship": "transitive", "depends_on": ["express"]},
    {"id": "qs", "relationship": "transitive", "depends_on": ["body-parser"]},
    {"id": "cookie", "relationship": "transitive", "depends_on": ["express"]},
    {"id": "lodash", "relationship": "direct"}
  ]
}
```

---

## Related Documentation

- [Finding Schema](ctis-finding.md) - Vulnerability findings for dependencies
- [SCA Scanning Guide](../guides/sca-scanning.md) - Software Composition Analysis
