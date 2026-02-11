---
layout: default
title: Custom Tools Development
parent: Platform Guides
nav_order: 11
---

# Custom Tools Development Guide

Build custom security scanners, parsers, and collectors using the OpenCTEM SDK.

---

## Overview

The SDK provides base implementations that you can extend:

| Interface | Base Class | Purpose |
|-----------|------------|---------|
| `Scanner` | `BaseScanner` | Execute security tools |
| `Parser` | `BaseParser` | Convert tool output to CTIS |
| `Collector` | `BaseCollector` | Pull data from external APIs |
| `Agent` | `BaseAgent` | Run as continuous daemon |

---

## Creating a Custom Scanner

### Method 1: Configuration-Based

For tools that follow standard CLI patterns:

```go
package main

import (
    "time"
    "github.com/openctemio/sdk-go/pkg/core"
)

func main() {
    // Create scanner via configuration
    scanner := core.NewBaseScanner(&core.BaseScannerConfig{
        Name:    "my-scanner",
        Version: "1.0.0",
        Binary:  "my-tool",

        // {target} is replaced with actual path
        DefaultArgs: []string{
            "scan",
            "--format", "sarif",
            "--output", "-",
            "{target}",
        },

        Timeout:      30 * time.Minute,
        OKExitCodes:  []int{0, 1},  // Exit codes that indicate success
        Capabilities: []string{"sast", "secret"},
        Verbose:      true,
    })

    // Use the scanner
    result, err := scanner.Scan(ctx, "/path/to/project", nil)
}
```

### Method 2: Embed BaseScanner (Recommended)

For more control, embed `BaseScanner` and override methods:

```go
package myscanner

import (
    "context"
    "fmt"
    "time"

    "github.com/openctemio/sdk-go/pkg/core"
)

// MyScanner extends BaseScanner with custom logic
type MyScanner struct {
    *core.BaseScanner

    // Custom configuration
    ruleset    string
    configPath string
}

// NewMyScanner creates a new scanner
func NewMyScanner(ruleset string, verbose bool) *MyScanner {
    base := core.NewBaseScanner(&core.BaseScannerConfig{
        Name:    "my-scanner",
        Version: "1.0.0",
        Binary:  "semgrep",
        DefaultArgs: []string{
            "scan",
            "--sarif",
            "--config", ruleset,
            "{target}",
        },
        Timeout:      30 * time.Minute,
        OKExitCodes:  []int{0, 1},
        Capabilities: []string{"sast"},
        Verbose:      verbose,
    })

    return &MyScanner{
        BaseScanner: base,
        ruleset:     ruleset,
    }
}

// BuildArgs override: add custom arguments
func (s *MyScanner) BuildArgs(target string, opts *core.ScanOptions) []string {
    args := s.BaseScanner.BuildArgs(target, opts)

    // Add custom config
    if s.configPath != "" {
        args = append(args, "--config", s.configPath)
    }

    // Add exclude patterns
    if opts != nil {
        for _, pattern := range opts.Exclude {
            args = append(args, "--exclude", pattern)
        }
    }

    return args
}

// Scan override: add pre/post hooks
func (s *MyScanner) Scan(ctx context.Context, target string, opts *core.ScanOptions) (*core.ScanResult, error) {
    // Pre-scan hook
    fmt.Printf("[%s] Starting scan with ruleset: %s\n", s.Name(), s.ruleset)

    // Call base scan
    result, err := s.BaseScanner.Scan(ctx, target, opts)

    // Post-scan hook
    if err == nil {
        fmt.Printf("[%s] Scan completed, output size: %d bytes\n",
            s.Name(), len(result.RawOutput))
    }

    return result, err
}

// SetConfigPath allows runtime configuration
func (s *MyScanner) SetConfigPath(path string) {
    s.configPath = path
}
```

---

## Creating a Custom Parser

Parsers convert tool output to CTIS (CTEM Ingest Schema) format:

```go
package myparser

import (
    "context"
    "encoding/json"

    "github.com/openctemio/sdk-go/pkg/core"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

// MyToolOutput represents your tool's JSON output format
type MyToolOutput struct {
    Version string      `json:"version"`
    Issues  []MyIssue   `json:"issues"`
}

type MyIssue struct {
    ID          string `json:"id"`
    Title       string `json:"title"`
    Severity    string `json:"severity"`
    Description string `json:"description"`
    File        string `json:"file"`
    Line        int    `json:"line"`
}

// MyParser converts my-tool output to CTIS
type MyParser struct {
    *core.BaseParser
}

func NewMyParser() *MyParser {
    return &MyParser{
        BaseParser: core.NewBaseParser("my-tool", []string{"json", "mytool"}),
    }
}

// CanParse checks if this parser can handle the data
func (p *MyParser) CanParse(data []byte) bool {
    var raw map[string]any
    if err := json.Unmarshal(data, &raw); err != nil {
        return false
    }
    // Check for specific markers in your tool's output
    _, hasMarker := raw["my_tool_version"]
    return hasMarker
}

// Parse converts to CTIS format
func (p *MyParser) Parse(ctx context.Context, data []byte, opts *core.ParseOptions) (*ctis.Report, error) {
    // Parse your tool's output
    var toolOutput MyToolOutput
    if err := json.Unmarshal(data, &toolOutput); err != nil {
        return nil, err
    }

    // Create CTIS report using helper
    report := p.CreateReport("my-tool", toolOutput.Version)

    // Convert each issue to a finding
    for _, issue := range toolOutput.Issues {
        finding := p.CreateFinding(
            issue.ID,
            issue.Title,
            mapSeverity(issue.Severity),
        )

        finding.Description = issue.Description
        finding.Location = &ctis.FindingLocation{
            Path:      issue.File,
            StartLine: issue.Line,
        }

        report.Findings = append(report.Findings, finding)
    }

    return report, nil
}

// mapSeverity converts your tool's severity to CTIS severity
func mapSeverity(severity string) ctis.Severity {
    switch severity {
    case "critical", "CRITICAL":
        return ctis.SeverityCritical
    case "high", "HIGH", "error", "ERROR":
        return ctis.SeverityHigh
    case "medium", "MEDIUM", "warning", "WARNING":
        return ctis.SeverityMedium
    case "low", "LOW":
        return ctis.SeverityLow
    default:
        return ctis.SeverityInfo
    }
}
```

### Register Your Parser

```go
// Register with the parser registry
parsers := core.NewParserRegistry()
parsers.Register(NewMyParser())

// Now it can be auto-detected
parser := parsers.FindParser(rawOutput)
```

---

## Creating a Custom Collector

Collectors pull data from external sources:

```go
package mycollector

import (
    "context"
    "time"

    "github.com/openctemio/sdk-go/pkg/core"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

type MyAPICollector struct {
    *core.BaseCollector

    projectID string
}

func NewMyAPICollector(apiKey, projectID string) *MyAPICollector {
    return &MyAPICollector{
        BaseCollector: core.NewBaseCollector(&core.BaseCollectorConfig{
            Name:       "my-api",
            SourceType: "api",
            BaseURL:    "https://api.myservice.com",
            APIKey:     apiKey,
            Timeout:    30 * time.Second,
        }),
        projectID: projectID,
    }
}

func (c *MyAPICollector) Collect(ctx context.Context, opts *core.CollectOptions) (*core.CollectResult, error) {
    // Use built-in HTTP helper
    var data MyAPIResponse
    err := c.FetchJSON(ctx, "/v1/vulnerabilities", map[string]string{
        "project_id": c.projectID,
    }, &data)
    if err != nil {
        return nil, err
    }

    // Convert to CTIS
    report := ctis.NewReport()
    for _, vuln := range data.Vulnerabilities {
        finding := ctis.Finding{
            Type:     ctis.FindingTypeVulnerability,
            Title:    vuln.Title,
            Severity: mapSeverity(vuln.Severity),
            // ... more fields
        }
        report.Findings = append(report.Findings, finding)
    }

    return &core.CollectResult{
        SourceName: c.Name(),
        SourceType: c.Type(),
        Reports:    []*ctis.Report{report},
        TotalItems: len(data.Vulnerabilities),
    }, nil
}

func (c *MyAPICollector) TestConnection(ctx context.Context) error {
    // Verify API connectivity
    var health struct{ Status string }
    return c.FetchJSON(ctx, "/health", nil, &health)
}
```

---

## CTIS Schema Reference

### Finding Types

```go
ctis.FindingTypeVulnerability    // "vulnerability" - CVE-based
ctis.FindingTypeSecret           // "secret" - hardcoded credentials
ctis.FindingTypeMisconfiguration // "misconfiguration" - IaC issues
ctis.FindingTypeCompliance       // "compliance" - policy violations
ctis.FindingTypeWeb3             // "web3" - smart contract vulns
```

### Severity Levels

```go
ctis.SeverityCritical  // "critical" - CVSS 9.0-10.0
ctis.SeverityHigh      // "high" - CVSS 7.0-8.9
ctis.SeverityMedium    // "medium" - CVSS 4.0-6.9
ctis.SeverityLow       // "low" - CVSS 0.1-3.9
ctis.SeverityInfo      // "info" - informational
```

### Asset Types

```go
ctis.AssetTypeDomain         // "domain"
ctis.AssetTypeIPAddress      // "ip_address"
ctis.AssetTypeRepository     // "repository"
ctis.AssetTypeSmartContract  // "smart_contract"
ctis.AssetTypeCloudAccount   // "cloud_account"
// ... see ctis/types.go for full list
```

### Creating a Finding

```go
finding := ctis.Finding{
    ID:          "finding-uuid",
    Type:        ctis.FindingTypeVulnerability,
    Title:       "SQL Injection in login handler",
    Description: "User input is concatenated directly into SQL query",
    Severity:    ctis.SeverityCritical,
    Confidence:  95,
    RuleID:      "CWE-89",

    Location: &ctis.FindingLocation{
        Path:      "src/auth/login.go",
        StartLine: 45,
        EndLine:   47,
        Snippet:   `query := "SELECT * FROM users WHERE id = " + userID`,
    },

    Vulnerability: &ctis.VulnerabilityDetails{
        CWEID:      "CWE-89",
        CVSSScore:  9.8,
        CVSSVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    },

    Remediation: &ctis.Remediation{
        Recommendation: "Use parameterized queries",
        Steps: []string{
            "Replace string concatenation with prepared statements",
            "Use database/sql placeholder syntax",
        },
    },

    Tags: []string{"sql-injection", "owasp-top-10"},
}
```

---

## Fingerprint Generation

Use the shared fingerprint package for consistent deduplication:

```go
import "github.com/openctemio/sdk-go/pkg/shared/fingerprint"

// SAST findings
fp := fingerprint.GenerateSAST("src/main.go", "CWE-89", 42, 44)

// SCA findings
fp := fingerprint.GenerateSCA("lodash", "4.17.20", "CVE-2021-23337")

// Secret findings
fp := fingerprint.GenerateSecret("config.yaml", "api-key", 10, "sk_live_xxx")

// Auto-detect type
fp := fingerprint.GenerateAuto(fingerprint.Input{
    FilePath:        "package.json",
    PackageName:     "lodash",
    PackageVersion:  "4.17.20",
    VulnerabilityID: "CVE-2021-23337",
})
```

---

## Testing Your Custom Tool

```go
package myscanner_test

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "myproject/myscanner"
)

func TestMyScanner_Scan(t *testing.T) {
    ctx := context.Background()
    scanner := myscanner.NewMyScanner("p/security-audit", false)

    // Check if tool is installed
    installed, _, err := scanner.IsInstalled(ctx)
    if !installed {
        t.Skip("Scanner not installed")
    }

    // Run scan on test fixtures
    result, err := scanner.Scan(ctx, "./testdata", nil)
    assert.NoError(t, err)
    assert.NotEmpty(t, result.RawOutput)
}

func TestMyParser_Parse(t *testing.T) {
    ctx := context.Background()
    parser := myscanner.NewMyParser()

    testData := []byte(`{"my_tool_version": "1.0", "issues": [...]}`)

    assert.True(t, parser.CanParse(testData))

    report, err := parser.Parse(ctx, testData, nil)
    assert.NoError(t, err)
    assert.Greater(t, len(report.Findings), 0)
}
```

---

## Best Practices

1. **Use Context**: Always pass context for timeout/cancellation support
2. **Generate Fingerprints**: Use consistent fingerprinting for deduplication
3. **Map Severities**: Use the shared severity package for consistency
4. **Handle Errors**: Use proper error wrapping and types
5. **Test Thoroughly**: Unit test parsers with sample outputs
6. **Document Capabilities**: Specify what your tool can detect

---

## Next Steps

- **[SDK Quick Start](sdk-quick-start.md)** - Basic SDK usage
- **[Agent Usage](agent-usage.md)** - Run as continuous scanner
- **[Building Ingestion Tools](building-ingestion-tools.md)** - Detailed guide
- **[CTIS Schema Reference](https://github.com/openctemio/schemas)** - Full schema documentation
