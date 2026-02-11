---
layout: default
title: SDK Development
parent: Platform Guides
nav_order: 8
---
# OpenCTEM SDK Development Guide

This guide shows how to use the **sdk** to build custom scanners, collectors, and agents.

---

## Overview

The `sdk` provides a complete toolkit for building security scanning and data collection tools that integrate with OpenCTEM. Key features:

- **Base implementations** - Extend `BaseScanner`, `BaseCollector`, `BaseAgent` for rapid development
- **Preset scanners** - Ready-to-use configurations for popular tools
- **Parser registry** - Built-in SARIF and JSON parsers with plugin support
- **CTIS types** - Complete type definitions for CTEM Ingest Schema
- **Push/Pull modes** - Support for both agent-based and collector-based architectures
- **Retry queue** - Automatic retry with disk persistence for offline resilience
- **Shared packages** - Unified fingerprint and severity algorithms (shared with backend)
- **Deduplication** - Fingerprint-based deduplication with server-side verification

---

## Installation

```bash
go get github.com/openctemio/sdk-go
```

---

## Quick Start

### Run a Preset Scanner

```go
package main

import (
    "context"
    "fmt"

    "github.com/openctemio/sdk-go/pkg/core"
)

func main() {
    ctx := context.Background()

    // Create a preset scanner (semgrep, trivy-fs, gitleaks, slither, etc.)
    scanner, _ := core.NewPresetScanner("semgrep")

    // Check if installed
    installed, version, _ := scanner.IsInstalled(ctx)
    if !installed {
        fmt.Println("Semgrep not installed")
        return
    }
    fmt.Printf("Using %s version %s\n", scanner.Name(), version)

    // Run scan
    result, _ := scanner.Scan(ctx, "/path/to/project", &core.ScanOptions{
        Verbose: true,
    })

    // Parse results
    parsers := core.NewParserRegistry()
    parser := parsers.FindParser(result.RawOutput)
    report, _ := parser.Parse(ctx, result.RawOutput, nil)

    fmt.Printf("Found %d findings\n", len(report.Findings))
}
```

### List Available Preset Scanners

```go
for _, name := range core.ListPresetScanners() {
    cfg := core.PresetScanners[name]
    fmt.Printf("%-15s - %s (%s)\n", name, cfg.Name, strings.Join(cfg.Capabilities, ", "))
}
```

**Available presets:**
| Name | Tool | Capabilities |
|------|------|--------------|
| `semgrep` | Semgrep | sast, secret |
| `trivy-fs` | Trivy (filesystem) | vulnerability, secret |
| `trivy-config` | Trivy (IaC) | misconfiguration |
| `gitleaks` | Gitleaks | secret |
| `slither` | Slither | web3 |
| `checkov` | Checkov | misconfiguration |
| `bandit` | Bandit | sast |
| `gosec` | Gosec | sast |
| `snyk` | Snyk Code | sast |
| `codeql` | CodeQL | sast |

---

## Building Custom Scanners

### Method 1: Use BaseScanner Directly

```go
package main

import (
    "context"
    "time"

    "github.com/openctemio/sdk-go/pkg/core"
)

func main() {
    // Create a custom scanner configuration
    scanner := core.NewBaseScanner(&core.BaseScannerConfig{
        Name:    "my-scanner",
        Version: "1.0.0",
        Binary:  "my-tool",

        // Arguments with {target} placeholder
        DefaultArgs: []string{
            "scan",
            "--format", "sarif",
            "--output", "-",
            "{target}",
        },

        Timeout:      30 * time.Minute,
        OKExitCodes:  []int{0, 1}, // Exit codes that indicate success
        Capabilities: []string{"vulnerability", "secret"},
        Verbose:      true,
    })

    // Run scan
    result, err := scanner.Scan(context.Background(), "/path/to/scan", nil)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Output: %s\n", result.RawOutput)
}
```

### Method 2: Embed BaseScanner (Recommended)

For more control, embed `BaseScanner` in your own struct:

```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/openctemio/sdk-go/pkg/core"
)

// MyScanner extends BaseScanner with custom logic
type MyScanner struct {
    *core.BaseScanner

    // Custom fields
    ruleset string
    configPath string
}

// NewMyScanner creates a new custom scanner
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
        Capabilities: []string{"sast", "secret"},
        Verbose:      verbose,
    })

    return &MyScanner{
        BaseScanner: base,
        ruleset:     ruleset,
    }
}

// BuildArgs overrides argument building to add custom logic
func (s *MyScanner) BuildArgs(target string, opts *core.ScanOptions) []string {
    // Get base args
    args := s.BaseScanner.BuildArgs(target, opts)

    // Add custom config if set
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

// Scan overrides to add pre/post processing
func (s *MyScanner) Scan(ctx context.Context, target string, opts *core.ScanOptions) (*core.ScanResult, error) {
    // Pre-scan hook
    fmt.Printf("[%s] Starting scan with ruleset: %s\n", s.Name(), s.ruleset)

    // Call base scan
    result, err := s.BaseScanner.Scan(ctx, target, opts)

    // Post-scan hook
    if err == nil {
        fmt.Printf("[%s] Scan completed, output size: %d bytes\n", s.Name(), len(result.RawOutput))
    }

    return result, err
}

// SetConfigPath allows runtime configuration
func (s *MyScanner) SetConfigPath(path string) {
    s.configPath = path
}
```

---

## Working with Parsers

### Using Built-in Parsers

```go
// Create parser registry (includes SARIF and JSON parsers)
parsers := core.NewParserRegistry()

// Auto-detect parser based on content
parser := parsers.FindParser(scanResult.RawOutput)
if parser == nil {
    // Default to SARIF
    parser = parsers.Get("sarif")
}

// Parse with options
report, err := parser.Parse(ctx, scanResult.RawOutput, &core.ParseOptions{
    ToolName:  "semgrep",
    ToolType:  "sast",
    AssetType: ctis.AssetTypeRepository,
    AssetValue: "github.com/org/repo",
    Branch:    "main",
    CommitSHA: "abc123",
})
```

### Creating Custom Parsers

```go
package main

import (
    "context"
    "encoding/json"

    "github.com/openctemio/sdk-go/pkg/core"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

// MyToolParser parses output from my-tool
type MyToolParser struct {
    *core.BaseParser
}

func NewMyToolParser() *MyToolParser {
    return &MyToolParser{
        BaseParser: core.NewBaseParser("my-tool", []string{"json", "mytool"}),
    }
}

// CanParse checks if this parser can handle the data
func (p *MyToolParser) CanParse(data []byte) bool {
    // Check for specific markers
    var raw map[string]any
    if err := json.Unmarshal(data, &raw); err != nil {
        return false
    }
    _, hasMyToolMarker := raw["my_tool_version"]
    return hasMyToolMarker
}

// Parse converts to CTIS format
func (p *MyToolParser) Parse(ctx context.Context, data []byte, opts *core.ParseOptions) (*ctis.Report, error) {
    // Parse your tool's output format
    var toolOutput MyToolOutput
    if err := json.Unmarshal(data, &toolOutput); err != nil {
        return nil, err
    }

    // Create report using helper
    report := p.CreateReport("my-tool", toolOutput.Version)

    // Convert findings
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

// Register the parser
func init() {
    parsers := core.NewParserRegistry()
    parsers.Register(NewMyToolParser())
}
```

---

## Building Collectors

Collectors pull data from external sources (GitHub, GitLab, APIs, etc.).

### Using GitHub Collector

```go
collector := core.NewGitHubCollector(&core.GitHubCollectorConfig{
    Token:   os.Getenv("GITHUB_TOKEN"),
    Owner:   "myorg",
    Repo:    "myrepo",
    Verbose: true,
})

// Test connection
if err := collector.TestConnection(ctx); err != nil {
    log.Fatal(err)
}

// Collect security alerts
result, err := collector.Collect(ctx, nil)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Collected %d items\n", result.TotalItems)
for _, report := range result.Reports {
    fmt.Printf("  - %d findings\n", len(report.Findings))
}
```

### Using Webhook Collector

```go
collector := core.NewWebhookCollector(&core.WebhookCollectorConfig{
    ListenAddr: ":8080",
    Verbose:    true,
})

// Start webhook server
collector.Start(ctx)
defer collector.Stop(ctx)

// Wait for incoming webhooks
for {
    result, err := collector.Collect(ctx, nil)
    if err != nil {
        continue
    }

    // Process received data
    for _, report := range result.Reports {
        processReport(report)
    }
}
```

### Creating Custom Collectors

```go
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
    // Fetch data using built-in HTTP helpers
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
        report.Findings = append(report.Findings, convertVuln(vuln))
    }

    return &core.CollectResult{
        SourceName: c.Name(),
        SourceType: c.Type(),
        Reports:    []*ctis.Report{report},
        TotalItems: len(data.Vulnerabilities),
    }, nil
}
```

---

## Building Agents

Agents run as daemons, continuously scanning and pushing results.

### Using BaseAgent

```go
package main

import (
    "context"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/core"
)

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Handle signals
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        <-sigCh
        cancel()
    }()

    // Create API client for pushing results
    pusher := client.New(&client.Config{
        BaseURL: "https://api.openctem.io",
        APIKey:  os.Getenv("API_KEY"),
    })

    // Create agent
    agent := core.NewBaseAgent(&core.BaseAgentConfig{
        Name:              "my-scanner-agent",
        Version:           "1.0.0",
        ScanInterval:      1 * time.Hour,
        HeartbeatInterval: 1 * time.Minute,
        Targets:           []string{"/path/to/scan"},
        Verbose:           true,
    }, pusher)

    // Add scanners
    semgrep, _ := core.NewPresetScanner("semgrep")
    agent.AddScanner(semgrep)

    gitleaks, _ := core.NewPresetScanner("gitleaks")
    agent.AddScanner(gitleaks)

    // Add collectors
    ghCollector := core.NewGitHubCollector(&core.GitHubCollectorConfig{
        Token: os.Getenv("GITHUB_TOKEN"),
        Owner: "myorg",
        Repo:  "myrepo",
    })
    agent.AddCollector(ghCollector)

    // Start agent
    if err := agent.Start(ctx); err != nil {
        panic(err)
    }

    fmt.Println("Agent started. Press Ctrl+C to stop.")

    // Wait for shutdown
    <-ctx.Done()

    // Graceful shutdown
    shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    agent.Stop(shutdownCtx)
}
```

### Using CLI Tool

The SDK includes a ready-to-use CLI:

```bash
# Build
go build -o agent ./cmd/agent

# Run single scan
./agent -tool semgrep -target /path/to/project -api-url https://api.openctem.io -api-key $API_KEY

# Run as daemon with config file
./agent -daemon -config config.yaml

# List available tools
./agent -list-tools
```

**Example config.yaml:**

```yaml
agent:
  name: my-scanner-agent
  scan_interval: 1h
  heartbeat_interval: 1m
  verbose: true

server:
  base_url: https://api.openctem.io
  api_key: ${API_KEY}
  timeout: 30s

scanners:
  - name: semgrep
    enabled: true
  - name: gitleaks
    enabled: true
  - name: trivy-fs
    enabled: true

collectors:
  - name: github
    token: ${GITHUB_TOKEN}
    owner: myorg
    repo: myrepo
    enabled: true

targets:
  - /path/to/project1
  - /path/to/project2
```

---

## CTIS (CTEM Ingest Schema)

### Creating Reports Programmatically

```go
import "github.com/openctemio/sdk-go/pkg/ctis"

// Create new report
report := ctis.NewReport()

// Set tool info
report.Tool = &ctis.Tool{
    Name:         "my-scanner",
    Version:      "1.0.0",
    Capabilities: []string{"vulnerability", "secret"},
}

// Add assets
report.Assets = append(report.Assets, ctis.Asset{
    ID:          "asset-1",
    Type:        ctis.AssetTypeRepository,
    Value:       "github.com/org/repo",
    Name:        "My Repository",
    Criticality: ctis.CriticalityHigh,
})

// Add findings
report.Findings = append(report.Findings, ctis.Finding{
    ID:          "finding-1",
    Type:        ctis.FindingTypeVulnerability,
    Title:       "SQL Injection",
    Severity:    ctis.SeverityCritical,
    Confidence:  95,
    RuleID:      "CWE-89",
    AssetRef:    "asset-1",
    Location: &ctis.FindingLocation{
        Path:      "src/db/query.go",
        StartLine: 45,
        EndLine:   47,
        Snippet:   "query := \"SELECT * FROM users WHERE id = \" + userID",
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
})
```

### Converting SARIF to CTIS

```go
import "github.com/openctemio/sdk-go/pkg/ctis"

sarifData := []byte(`{"version": "2.1.0", ...}`)

report, err := ctis.FromSARIF(sarifData, &ctis.ConvertOptions{
    AssetType:  ctis.AssetTypeRepository,
    AssetValue: "github.com/org/repo",
    Branch:     "main",
    CommitSHA:  "abc123",
    ToolType:   "sast", // sast, sca, secret, iac, web3
})
```

### Type Constants

```go
// Asset Types
ctis.AssetTypeDomain         // "domain"
ctis.AssetTypeIPAddress      // "ip_address"
ctis.AssetTypeRepository     // "repository"
ctis.AssetTypeSmartContract  // "smart_contract"
// ... see types.go for full list

// Finding Types
ctis.FindingTypeVulnerability    // "vulnerability"
ctis.FindingTypeSecret           // "secret"
ctis.FindingTypeMisconfiguration // "misconfiguration"
ctis.FindingTypeCompliance       // "compliance"
ctis.FindingTypeWeb3             // "web3"

// Severity Levels
ctis.SeverityCritical // "critical"
ctis.SeverityHigh     // "high"
ctis.SeverityMedium   // "medium"
ctis.SeverityLow      // "low"
ctis.SeverityInfo     // "info"

// Criticality Levels
ctis.CriticalityCritical // "critical"
ctis.CriticalityHigh     // "high"
ctis.CriticalityMedium   // "medium"
ctis.CriticalityLow      // "low"
ctis.CriticalityInfo     // "info"
```

---

## Web3 Scanner Example

For smart contract security scanning:

```go
package main

import (
    "context"
    "fmt"

    "github.com/openctemio/sdk-go/pkg/core"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    ctx := context.Background()

    // Use Slither preset
    scanner, _ := core.NewPresetScanner("slither")

    // Scan Solidity contracts
    result, _ := scanner.Scan(ctx, "/path/to/contracts", &core.ScanOptions{
        Verbose: true,
    })

    // Parse results
    parsers := core.NewParserRegistry()
    report, _ := parsers.Get("sarif").Parse(ctx, result.RawOutput, &core.ParseOptions{
        ToolType: "web3",
        AssetType: ctis.AssetTypeSmartContract,
        AssetValue: "0x1234567890abcdef1234567890abcdef12345678",
    })

    // Print findings
    for _, f := range report.Findings {
        fmt.Printf("[%s] %s: %s\n", f.Severity, f.RuleID, f.Title)
        if f.Web3 != nil {
            fmt.Printf("  SWC: %s, Chain: %s\n", f.Web3.SWCID, f.Web3.Chain)
        }
    }
}
```

---

## Pushing Results to OpenCTEM

```go
import "github.com/openctemio/sdk-go/pkg/client"

// Create API client
c := client.New(&client.Config{
    BaseURL: "https://api.openctem.io",
    APIKey:  os.Getenv("API_KEY"),
    Timeout: 30 * time.Second,
    Verbose: true,
})

// Test connection
if err := c.TestConnection(ctx); err != nil {
    log.Fatal(err)
}

// Push findings
result, err := c.PushFindings(ctx, report)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Created: %d, Updated: %d\n", result.FindingsCreated, result.FindingsUpdated)

// Push assets
assetResult, err := c.PushAssets(ctx, report)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Assets Created: %d, Updated: %d\n", assetResult.AssetsCreated, assetResult.AssetsUpdated)
```

---

## Best Practices

### 1. Error Handling

```go
result, err := scanner.Scan(ctx, target, opts)
if err != nil {
    // Check if it's a timeout
    if errors.Is(err, context.DeadlineExceeded) {
        log.Printf("Scan timed out for %s", target)
        return
    }
    // Handle other errors
    log.Printf("Scan failed: %v", err)
    return
}

// Check exit code for tool-specific errors
if result.ExitCode != 0 && result.ExitCode != 1 {
    log.Printf("Tool returned unexpected exit code: %d", result.ExitCode)
    log.Printf("Stderr: %s", result.Stderr)
}
```

### 2. Context Cancellation

```go
// Use context for timeout and cancellation
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
defer cancel()

// Pass to all operations
result, err := scanner.Scan(ctx, target, opts)
```

### 3. Graceful Shutdown

```go
// Handle signals
sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

go func() {
    <-sigCh
    cancel() // Cancel context
}()

// Wait for agent to stop
<-ctx.Done()
agent.Stop(context.WithTimeout(context.Background(), 30*time.Second))
```

### 4. Logging

```go
scanner.SetVerbose(true) // Enable verbose logging

// Or use structured logging
log.Printf("[%s] Scanning %s", scanner.Name(), target)
```

---

## Server-Controlled Agents

Agents can be controlled remotely from the OpenCTEM platform using the CommandPoller.

### Command Poller Setup

```go
package main

import (
    "context"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/core"
)

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Handle signals
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        <-sigCh
        cancel()
    }()

    // Create API client (implements core.CommandClient)
    apiClient := client.New(&client.Config{
        BaseURL:  "https://api.openctem.io",
        APIKey:   os.Getenv("API_KEY"),
        SourceID: os.Getenv("SOURCE_ID"), // For tenant tracking
        Verbose:  true,
    })

    // Create command executor
    executor := core.NewDefaultCommandExecutor(apiClient)

    // Add scanners to executor
    semgrep, _ := core.NewPresetScanner("semgrep")
    executor.AddScanner(semgrep)

    gitleaks, _ := core.NewPresetScanner("gitleaks")
    executor.AddScanner(gitleaks)

    // Create command poller
    poller := core.NewCommandPoller(apiClient, executor, &core.CommandPollerConfig{
        PollInterval:  30 * time.Second,
        MaxConcurrent: 5,
        AllowedTypes:  []string{"scan", "collect", "health_check"},
        Verbose:       true,
    })

    // Start polling for commands
    if err := poller.Start(ctx); err != nil {
        if err != context.Canceled {
            panic(err)
        }
    }
}
```

### Operating Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Standalone** | Agent runs scans based on local config | Edge deployments, offline |
| **Server-Controlled** | Agent waits for server commands | Centralized management |
| **Hybrid** | Both local scans and server commands | Flexible deployments |

### Hybrid Mode Configuration

```yaml
agent:
  name: hybrid-scanner
  scan_interval: 24h  # Daily local scans
  enable_command_polling: true
  command_poll_interval: 30s

targets:
  - /opt/code/project1

# Server can also dispatch additional scans on-demand
```

---

## Using the Processor

The Processor provides a complete scan-parse-push workflow.

```go
import (
    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/core"
)

// Create API client
pusher := client.New(&client.Config{
    BaseURL:  "https://api.openctem.io",
    APIKey:   os.Getenv("API_KEY"),
    SourceID: "src_abc123",
})

// Create processor
processor := core.NewBaseProcessor(pusher)
processor.SetVerbose(true)

// Process a single scanner
scanner, _ := core.NewPresetScanner("semgrep")
result, err := processor.Process(ctx, scanner, &core.ProcessOptions{
    ScanOptions: &core.ScanOptions{
        TargetDir: "/path/to/project",
    },
    ParseOptions: &core.ParseOptions{
        ToolName: "semgrep",
        ToolType: "sast",
    },
    Push:      true,  // Push to OpenCTEM
    SaveLocal: true,  // Also save locally
    OutputDir: "./reports",
})

// Process multiple scanners in parallel
scanners := []core.Scanner{
    semgrep,
    gitleaks,
    trivy,
}
results, err := processor.ProcessBatch(ctx, scanners, opts)
```

---

## Custom Logging

Replace the default `fmt.Printf` logging with your own logger.

### Logger Interface

```go
// Logger is the interface for logging in the SDK
type Logger interface {
    Debug(format string, args ...interface{})
    Info(format string, args ...interface{})
    Warn(format string, args ...interface{})
    Error(format string, args ...interface{})
}
```

### Using a Custom Logger

```go
import (
    "github.com/openctemio/sdk-go/pkg/core"
    "github.com/sirupsen/logrus"
)

// LogrusAdapter adapts logrus to the SDK Logger interface
type LogrusAdapter struct {
    logger *logrus.Logger
}

func (l *LogrusAdapter) Debug(format string, args ...interface{}) {
    l.logger.Debugf(format, args...)
}

func (l *LogrusAdapter) Info(format string, args ...interface{}) {
    l.logger.Infof(format, args...)
}

func (l *LogrusAdapter) Warn(format string, args ...interface{}) {
    l.logger.Warnf(format, args...)
}

func (l *LogrusAdapter) Error(format string, args ...interface{}) {
    l.logger.Errorf(format, args...)
}

// Set as default logger
func main() {
    logger := logrus.New()
    logger.SetLevel(logrus.DebugLevel)

    core.SetDefaultLogger(&LogrusAdapter{logger: logger})
}
```

### Built-in Loggers

```go
// Default logger - writes to stderr with timestamps
logger := core.NewDefaultLogger("my-scanner", core.LogLevelInfo)

// Printf logger - simple fmt.Printf output (like verbose mode)
logger := core.NewPrintfLogger("my-scanner")

// Nop logger - discards all output
logger := &core.NopLogger{}

// Create logger based on verbose flag
logger := core.LoggerFromVerbose("my-scanner", verbose)
```

---

## Configuration Validation

Validate configurations before use.

### Using the Validator

```go
import "github.com/openctemio/sdk-go/pkg/core"

// Validate scanner config
err := core.ValidateBaseScannerConfig(&core.BaseScannerConfig{
    Name:    "my-scanner",
    Binary:  "semgrep",
    Timeout: 30 * time.Minute,
})
if err != nil {
    log.Fatalf("Invalid config: %v", err)
}

// Validate agent config
err = core.ValidateBaseAgentConfig(&core.BaseAgentConfig{
    Name:              "my-agent",
    ScanInterval:      1 * time.Hour,
    HeartbeatInterval: 1 * time.Minute,
})

// Validate command poller config
err = core.ValidateCommandPollerConfig(&core.CommandPollerConfig{
    PollInterval:  30 * time.Second,
    MaxConcurrent: 5,
})
```

### Custom Validation

```go
v := core.NewValidator()

v.Required("name", cfg.Name).
  URL("base_url", cfg.BaseURL).
  APIKey("api_key", cfg.APIKey).
  SourceID("source_id", cfg.SourceID).
  MinDuration("timeout", cfg.Timeout, 5*time.Second).
  MaxDuration("timeout", cfg.Timeout, 1*time.Hour).
  DirectoryExists("target_dir", cfg.TargetDir)

if err := v.Validate(); err != nil {
    // err contains all validation errors
    log.Fatal(err)
}
```

---

## Tenant Identification

When pushing data to OpenCTEM, tenant identification is done via API Key + Source ID.

### How It Works

1. **API Key** identifies the tenant: `rs_src_xxxxxxxx` (Source Key)
2. **Source ID** provides audit trail: `src_abc123def456`

```go
// Create client with Source ID
client := client.New(&client.Config{
    BaseURL:  "https://api.openctem.io",
    APIKey:   "rs_src_xxxxxxxxxxxxxxxxxxxxxxxx", // Identifies tenant
    SourceID: "src_abc123def456",                // Identifies this scanner/agent
    Timeout:  30 * time.Second,
})
```

### Headers Sent

```http
POST /api/v1/ingest/findings HTTP/1.1
Host: api.openctem.io
Content-Type: application/json
Authorization: Bearer rs_src_xxxxxxxxxxxxxxxxxxxxxxxx
X-OpenCTEM-Source-ID: src_abc123def456
User-Agent: sdk/1.0
```

### Registering a Source

Sources should be registered via the OpenCTEM API or UI before use:

```bash
curl -X POST https://api.openctem.io/api/v1/sources \
  -H "Authorization: Bearer $USER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Semgrep Scanner",
    "type": "scanner",
    "capabilities": ["sast", "secret"]
  }'
```

Response:
```json
{
  "id": "src_abc123def456",
  "api_key": "rs_src_xxxxxxxxxxxxxxxxxxxx"
}
```

---

## CI Environment Detection

The SDK can auto-detect CI environments (GitHub Actions, GitLab CI) and provide unified access to repository, commit, and MR/PR information.

### Auto-Detection

```go
import "github.com/openctemio/sdk-go/pkg/gitenv"

// Auto-detect CI environment
ci := gitenv.Detect()

if ci != nil {
    fmt.Printf("CI Provider: %s\n", ci.Provider())       // "github" or "gitlab"
    fmt.Printf("Repository: %s\n", ci.ProjectName())     // "org/repo"
    fmt.Printf("Branch: %s\n", ci.CommitBranch())        // "feature/xyz"
    fmt.Printf("Commit: %s\n", ci.CommitSha())           // "abc123..."
    fmt.Printf("MR/PR ID: %s\n", ci.MergeRequestID())    // "123"
} else {
    fmt.Println("Running locally (no CI detected)")
}
```

### Detect from Directory

```go
// Detect from local git repository
ci := gitenv.DetectFromDirectory("/path/to/repo", true) // verbose=true

// Returns ManualEnv if no CI, reading from .git
fmt.Printf("Branch: %s\n", ci.CommitBranch())
```

### GitEnv Interface

| Method | Description |
|--------|-------------|
| `Provider()` | CI provider name: "github", "gitlab", "manual" |
| `IsActive()` | Whether this CI environment is detected |
| `ProjectID()` | Repository ID |
| `ProjectName()` | Repository name (org/repo format) |
| `ProjectURL()` | Repository URL |
| `CommitSha()` | Current commit SHA |
| `CommitBranch()` | Current branch name |
| `MergeRequestID()` | MR/PR number (if in MR/PR context) |
| `SourceBranch()` | Source branch for MR/PR |
| `TargetBranch()` | Target branch for MR/PR |
| `TargetBranchSha()` | Base commit SHA for MR/PR diff |
| `CreateMRComment()` | Create inline comment on MR/PR |

### Environment Variables

**GitHub Actions:**
- `GITHUB_ACTIONS`, `GITHUB_TOKEN`, `GITHUB_SHA`, `GITHUB_REF_NAME`
- `GITHUB_REPOSITORY`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF`
- `GITHUB_EVENT_PATH` (JSON payload)

**GitLab CI:**
- `GITLAB_CI`, `GITLAB_TOKEN`, `CI_COMMIT_SHA`, `CI_COMMIT_BRANCH`
- `CI_PROJECT_ID`, `CI_MERGE_REQUEST_IID`, `CI_MERGE_REQUEST_DIFF_BASE_SHA`

---

## Scan Strategy

Automatically determine whether to scan all files or only changed files based on CI context.

### Strategy Types

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `AllFiles` | Scan entire repository | Default, scheduled scans |
| `ChangedFileOnly` | Scan only changed files | MR/PR scans, faster feedback |

### Auto-Determination

```go
import (
    "github.com/openctemio/sdk-go/pkg/gitenv"
    "github.com/openctemio/sdk-go/pkg/strategy"
)

// Detect CI environment
ci := gitenv.Detect()

// Determine scan strategy
scanCtx := &strategy.ScanContext{
    GitEnv:   ci,
    RepoPath: ".",
    Verbose:  true,
}

scanStrategy, changedFiles := strategy.DetermineStrategy(scanCtx)

fmt.Printf("Strategy: %s\n", scanStrategy) // "all_files" or "changed_files_only"

if scanStrategy == strategy.ChangedFileOnly {
    fmt.Printf("Changed files: %d\n", len(changedFiles))
    for _, f := range changedFiles {
        fmt.Printf("  %s: %s\n", f.Status, f.Path) // "added", "modified", "deleted"
    }
}
```

### Filter Changed Files

```go
// Filter by file extension
goFiles := strategy.FilterByExtensions(changedFiles, []string{".go"})

// Get just the paths
paths := strategy.GetPaths(changedFiles)

// Check if a path is in the changed files
if strategy.ContainsPath(changedFiles, "src/main.go") {
    fmt.Println("main.go was changed")
}
```

### Strategy Logic

```
IF no git environment detected:
    → AllFiles

IF not in MR/PR context:
    → AllFiles

IF MR/PR context but no baseline commit:
    → AllFiles

IF too many files changed (> 512):
    → AllFiles

ELSE:
    → ChangedFileOnly (with list of changed files)
```

---

## Handler Pattern

Handlers manage the scan lifecycle with clear callbacks: start → handle findings → complete/error.

### ScanHandler Interface

```go
type ScanHandler interface {
    OnStart(gitEnv GitEnv, scannerName, scannerType string) (*ScanInfo, error)
    HandleFindings(params HandleFindingsParams) error
    OnCompleted() error
    OnError(err error) error
}
```

### Console Handler (Local Development)

```go
import "github.com/openctemio/sdk-go/pkg/handler"

// Simple handler that prints to console
h := handler.NewConsoleHandler(true) // verbose=true

// Use in scan workflow
h.OnStart(gitEnv, "semgrep", "sast")
h.HandleFindings(handler.HandleFindingsParams{
    Report:       report,
    Strategy:     scanStrategy,
    ChangedFiles: changedFiles,
    GitEnv:       gitEnv,
})
h.OnCompleted()
```

### Remote Handler (Push to Server + PR Comments)

```go
import (
    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/handler"
)

// Create API client
pusher := client.New(&client.Config{
    BaseURL: "https://api.openctem.io",
    APIKey:  os.Getenv("API_KEY"),
})

// Create remote handler with PR comment support
h := handler.NewRemoteHandler(&handler.RemoteHandlerConfig{
    Pusher:         pusher,
    Verbose:        true,
    CreateComments: true,  // Enable PR/MR inline comments
    MaxComments:    10,    // Max comments per PR (default: 10)
})

// Use in scan workflow
scanInfo, _ := h.OnStart(gitEnv, "semgrep", "sast")
h.HandleFindings(handler.HandleFindingsParams{
    Report:       report,
    Strategy:     strategy.ChangedFileOnly,
    ChangedFiles: changedFiles,
    GitEnv:       gitEnv,
})
h.OnCompleted()
```

### PR/MR Inline Comments

The Remote Handler automatically creates inline comments on PRs/MRs for findings on changed files:

```go
// Comments are created for findings where:
// 1. The finding has a valid location (path, line)
// 2. The file is in the changed files list (for ChangedFileOnly strategy)
// 3. We haven't exceeded MaxComments limit

// Comment format:
// 🔴 **critical**
// ### SQL Injection in login handler
// User input is directly concatenated into SQL query...
// **Rule:** `CWE-89`
// **Remediation:** Use parameterized queries
// ---
// *Detected by OpenCTEM Security Scanner*
```

### Custom Handler

```go
type MyHandler struct {
    slack *SlackClient
}

func (h *MyHandler) OnStart(gitEnv gitenv.GitEnv, name, typ string) (*handler.ScanInfo, error) {
    h.slack.Send(fmt.Sprintf("🔍 Starting %s scan on %s", name, gitEnv.ProjectName()))
    return &handler.ScanInfo{}, nil
}

func (h *MyHandler) HandleFindings(params handler.HandleFindingsParams) error {
    critical := countBySeverity(params.Report.Findings, "critical")
    if critical > 0 {
        h.slack.Send(fmt.Sprintf("🚨 Found %d critical findings!", critical))
    }
    return nil
}

func (h *MyHandler) OnCompleted() error {
    h.slack.Send("✅ Scan completed")
    return nil
}

func (h *MyHandler) OnError(err error) error {
    h.slack.Send(fmt.Sprintf("❌ Scan failed: %v", err))
    return nil
}
```

---

## Native Scanners

The SDK includes native scanner implementations with full parsing support.

### Semgrep Scanner

```go
import (
    "github.com/openctemio/sdk-go/pkg/scanners"
    "github.com/openctemio/sdk-go/pkg/scanners/semgrep"
)

// Create scanner with defaults
scanner := scanners.Semgrep()
scanner.Verbose = true
scanner.DataflowTrace = true // Enable taint tracking

// Or with custom configuration
scanner := scanners.SemgrepWithConfig(scanners.SemgrepOptions{
    Configs:       []string{"p/security-audit", "p/owasp-top-ten"},
    Severities:    []string{"ERROR", "WARNING"},
    ExcludePaths:  []string{"vendor", "node_modules"},
    ProEngine:     true,  // Use Semgrep Pro
    DataflowTrace: true,  // Enable dataflow traces
    MaxMemory:     4096,  // MB
    Jobs:          4,     // Parallel jobs
})

// Run scan
result, _ := scanner.Scan(ctx, "/path/to/project", &core.ScanOptions{})

// Parse to CTIS
parser := &semgrep.Parser{}
report, _ := parser.Parse(ctx, result.RawOutput, nil)

// Report includes DataFlow for taint tracking findings
for _, f := range report.Findings {
    if f.DataFlow != nil {
        fmt.Println("Taint flow:")
        for _, src := range f.DataFlow.Sources {
            fmt.Printf("  Source: %s:%d\n", src.Path, src.Line)
        }
        for _, sink := range f.DataFlow.Sinks {
            fmt.Printf("  Sink: %s:%d\n", sink.Path, sink.Line)
        }
    }
}
```

### Gitleaks Scanner

```go
import (
    "github.com/openctemio/sdk-go/pkg/scanners"
    "github.com/openctemio/sdk-go/pkg/scanners/gitleaks"
)

// Create scanner with defaults
scanner := scanners.Gitleaks()
scanner.Verbose = true

// Or with custom configuration
scanner := scanners.GitleaksWithConfig(scanners.GitleaksOptions{
    ConfigFile: ".gitleaks.toml", // Custom rules
    Timeout:    30 * time.Minute,
    Verbose:    true,
})

// Run scan (returns SecretResult with structured findings)
result, _ := scanner.Scan(ctx, "/path/to/project", &core.SecretScanOptions{
    NoGit: false, // Scan git history
})

fmt.Printf("Found %d secrets\n", len(result.Secrets))
for _, s := range result.Secrets {
    fmt.Printf("  %s in %s:%d (masked: %s)\n",
        s.SecretType, s.File, s.StartLine, s.MaskedValue)
}

// Or use generic scan for CTIS parsing
genericResult, _ := scanner.GenericScan(ctx, "/path/to/project", nil)
parser := &gitleaks.Parser{}
report, _ := parser.Parse(ctx, genericResult.RawOutput, nil)
```

### Trivy Scanner

```go
import (
    "github.com/openctemio/sdk-go/pkg/scanners"
    "github.com/openctemio/sdk-go/pkg/scanners/trivy"
)

// Create scanner with defaults (filesystem mode, vulnerability scanning)
scanner := scanners.Trivy()
scanner.Verbose = true

// Different scan modes
fsScanner := scanners.TrivyFS()           // Filesystem scanning
configScanner := scanners.TrivyConfig()   // IaC/misconfiguration scanning
imageScanner := scanners.TrivyImage()     // Container image scanning
fullScanner := scanners.TrivyFull()       // All scanners (vuln, misconfig, secret)

// Or with custom configuration
scanner := scanners.TrivyWithConfig(scanners.TrivyOptions{
    Mode:          "fs",                                    // fs, config, image, repo
    Scanners:      []string{"vuln", "misconfig", "secret"}, // What to scan for
    Severity:      []string{"CRITICAL", "HIGH", "MEDIUM"},  // Severity filter
    IgnoreUnfixed: true,                                    // Skip unfixed vulns
    SkipDBUpdate:  false,                                   // Update vuln DB
    SkipDirs:      []string{"vendor", "node_modules"},      // Exclude directories
    Timeout:       30 * time.Minute,
    Verbose:       true,
})

// Run scan (returns ScanResult with raw JSON)
result, _ := scanner.Scan(ctx, "/path/to/project", &core.ScanOptions{})

// Parse to CTIS
parser := &trivy.Parser{Verbose: true}
report, _ := parser.Parse(ctx, result.RawOutput, nil)

fmt.Printf("Found %d findings\n", len(report.Findings))
for _, f := range report.Findings {
    fmt.Printf("  [%s] %s: %s\n", f.Type, f.Severity, f.Title)

    // Vulnerability details
    if f.Vulnerability != nil {
        fmt.Printf("    Package: %s@%s -> %s\n",
            f.Vulnerability.Package,
            f.Vulnerability.AffectedVersion,
            f.Vulnerability.FixedVersion)
        fmt.Printf("    CVSS: %.1f (%s)\n",
            f.Vulnerability.CVSSScore,
            f.Vulnerability.CVSSVector)
    }

    // Misconfiguration details
    if f.Misconfiguration != nil {
        fmt.Printf("    Policy: %s\n", f.Misconfiguration.PolicyID)
        fmt.Printf("    Resource: %s\n", f.Misconfiguration.ResourceName)
    }

    // Secret details
    if f.Secret != nil {
        fmt.Printf("    Type: %s (masked: %s)\n",
            f.Secret.SecretType,
            f.Secret.MaskedValue)
    }
}
```

### Trivy SCA Mode

For Software Composition Analysis (SCA) with structured results:

```go
// Use ScanSCA for detailed package/vulnerability information
result, _ := scanner.ScanSCA(ctx, "/path/to/project", &core.ScaScanOptions{
    SkipDBUpdate:  false,
    IgnoreUnfixed: false,
})

// Access packages
fmt.Printf("Found %d packages\n", len(result.Packages))
for _, pkg := range result.Packages {
    fmt.Printf("  %s@%s (%s)\n", pkg.Name, pkg.Version, pkg.Type)
    if pkg.PURL != "" {
        fmt.Printf("    PURL: %s\n", pkg.PURL)
    }
}

// Access vulnerabilities
fmt.Printf("Found %d vulnerabilities\n", len(result.Vulnerabilities))
for _, vuln := range result.Vulnerabilities {
    fmt.Printf("  %s [%s]: %s\n", vuln.ID, vuln.Severity, vuln.Name)
    fmt.Printf("    Package: %s@%s\n", vuln.PkgName, vuln.PkgVersion)
    if vuln.FixedVersion != "" {
        fmt.Printf("    Fix: upgrade to %s\n", vuln.FixedVersion)
    }
    if vuln.Metadata != nil && vuln.Metadata.CVSSScore > 0 {
        fmt.Printf("    CVSS: %.1f\n", vuln.Metadata.CVSSScore)
    }
}
```

### Trivy Scan Modes

| Mode | Description | Preset Function |
|------|-------------|-----------------|
| `fs` | Scan filesystem for vulnerabilities | `scanners.TrivyFS()` |
| `config` | Scan for IaC misconfigurations | `scanners.TrivyConfig()` |
| `image` | Scan container images | `scanners.TrivyImage()` |
| `repo` | Scan git repository | N/A (use TrivyWithConfig) |

### Trivy Scanner Types

| Scanner | Detects |
|---------|---------|
| `vuln` | Package vulnerabilities (CVEs) |
| `misconfig` | IaC misconfigurations (Terraform, K8s, Dockerfile) |
| `secret` | Embedded secrets and credentials |
| `license` | License compliance issues |

### Scanner Registry

```go
import "github.com/openctemio/sdk-go/pkg/scanners"

// Create registry with all built-in scanners
registry := scanners.NewRegistry()

// Get scanners by type
secretScanner := registry.GetSecretScanner("gitleaks")
sastScanner := registry.GetSASTScanner("semgrep")
scaScanner := registry.GetSCAScanner("trivy")

// List available scanners
fmt.Println("Secret scanners:", registry.ListSecretScanners())
fmt.Println("SAST scanners:", registry.ListSASTScanners())
fmt.Println("SCA scanners:", registry.ListSCAScanners())

// Register custom scanner
registry.RegisterSecretScanner(myCustomSecretScanner)
registry.RegisterSASTScanner(myCustomSASTScanner)
registry.RegisterSCAScanner(myCustomSCAScanner)
```

---

## Recon Scanners (Attack Surface Discovery)

The SDK includes reconnaissance scanners for external attack surface discovery.

### Available Recon Scanners

| Scanner | Type | Description |
|---------|------|-------------|
| `subfinder` | Subdomain | Passive subdomain enumeration |
| `dnsx` | DNS | DNS resolution and record lookup |
| `naabu` | Port | Fast port scanning |
| `httpx` | HTTP | HTTP/HTTPS probing and tech detection |
| `katana` | Crawler | Web crawling and URL discovery |

### Using Recon Scanners

```go
import (
    "context"
    "fmt"

    "github.com/openctemio/sdk-go/pkg/core"
    "github.com/openctemio/sdk-go/pkg/scanners/recon/subfinder"
    "github.com/openctemio/sdk-go/pkg/scanners/recon/httpx"
)

func main() {
    ctx := context.Background()

    // Subdomain enumeration
    subScanner := subfinder.NewScanner()
    subScanner.Threads = 50
    subScanner.All = true // Use all sources

    result, err := subScanner.Scan(ctx, "example.com", &core.ReconOptions{
        Threads:   50,
        RateLimit: 100,
    })
    if err != nil {
        panic(err)
    }

    fmt.Printf("Found %d subdomains\n", len(result.Subdomains))
    for _, sub := range result.Subdomains {
        fmt.Printf("  %s (source: %s)\n", sub.Host, sub.Source)
    }

    // HTTP probing with tech detection
    httpScanner := httpx.NewFullProber()
    httpResult, _ := httpScanner.Scan(ctx, "example.com", &core.ReconOptions{})

    for _, host := range httpResult.LiveHosts {
        fmt.Printf("%s [%d] %s\n", host.URL, host.StatusCode, host.Title)
        if len(host.Technologies) > 0 {
            fmt.Printf("  Tech: %v\n", host.Technologies)
        }
    }
}
```

### Recon Pipeline

```go
// Chain recon tools: Subdomain -> DNS -> HTTP -> Crawl
targets := []string{"example.com"}

// Step 1: Find subdomains
subScanner := subfinder.NewAggressiveScanner()
subResult, _ := subScanner.Scan(ctx, targets[0], nil)

// Step 2: Resolve DNS
dnsScanner := dnsx.NewFullRecordScanner()
for _, sub := range subResult.Subdomains {
    dnsResult, _ := dnsScanner.Scan(ctx, sub.Host, nil)
    // Process DNS records...
}

// Step 3: HTTP probe live hosts
httpScanner := httpx.NewFullProber()
// ... continue pipeline
```

---

## Enrichers (Threat Intelligence)

Enrichers add threat intelligence data to findings.

### Available Enrichers

| Enricher | Source | Data Provided |
|----------|--------|---------------|
| `epss` | FIRST.org | Exploit Prediction Scoring System |
| `kev` | CISA | Known Exploited Vulnerabilities catalog |

### Using EPSS Enricher

```go
import (
    "context"
    "github.com/openctemio/sdk-go/pkg/enrichers/epss"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    ctx := context.Background()

    // Create enricher
    enricher := epss.NewEnricher()

    // Enrich a single finding
    finding := ctis.Finding{
        Type: ctis.FindingTypeVulnerability,
        Vulnerability: &ctis.VulnerabilityDetails{
            CVEID: "CVE-2023-44487",
        },
    }

    enriched, _ := enricher.Enrich(ctx, &finding)
    fmt.Printf("EPSS Score: %.4f (%.1f percentile)\n",
        enriched.Vulnerability.EPSSScore,
        enriched.Vulnerability.EPSSPercentile)

    // Batch enrichment
    findings := []ctis.Finding{finding1, finding2, finding3}
    enrichedFindings, _ := enricher.EnrichBatch(ctx, findings)
}
```

### Using KEV Enricher

```go
import (
    "context"
    "github.com/openctemio/sdk-go/pkg/enrichers/kev"
)

func main() {
    ctx := context.Background()

    // Create enricher
    enricher := kev.NewEnricher()

    // Check if CVE is in KEV catalog
    inKEV, _ := enricher.IsInKEV(ctx, "CVE-2023-44487")
    if inKEV {
        fmt.Println("WARNING: This CVE is actively exploited!")
    }

    // Get full KEV entry
    entry, _ := enricher.GetKEVEntry(ctx, "CVE-2023-44487")
    if entry != nil {
        fmt.Printf("Vendor: %s, Product: %s\n", entry.VendorProject, entry.Product)
        fmt.Printf("Required Action: %s\n", entry.RequiredAction)
        fmt.Printf("Due Date: %s\n", entry.DueDate)
        if entry.KnownRansomware == "Known" {
            fmt.Println("Used in ransomware campaigns!")
        }
    }

    // Enrich findings - KEV entries get elevated severity
    enriched, _ := enricher.Enrich(ctx, &finding)
    // Finding severity is elevated to Critical if in KEV
}
```

### Combining Enrichers

```go
// Create enricher chain
epssEnricher := epss.NewEnricher()
kevEnricher := kev.NewEnricher()

// Enrich findings with both
findings, _ := scanner.ScanToFindings(ctx, target, opts)
findings, _ = epssEnricher.EnrichBatch(ctx, findings)
findings, _ = kevEnricher.EnrichBatch(ctx, findings)

// Now findings have EPSS scores and KEV status
for _, f := range findings {
    if f.Type == ctis.FindingTypeVulnerability && f.Vulnerability != nil {
        fmt.Printf("%s: EPSS=%.4f, InKEV=%v\n",
            f.Vulnerability.CVEID,
            f.Vulnerability.EPSSScore,
            f.Vulnerability.InCISAKEV)
    }
}
```

---

## Complete CI Integration Example

```go
package main

import (
    "context"
    "fmt"
    "os"

    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/gitenv"
    "github.com/openctemio/sdk-go/pkg/handler"
    "github.com/openctemio/sdk-go/pkg/scanners"
    "github.com/openctemio/sdk-go/pkg/scanners/semgrep"
    "github.com/openctemio/sdk-go/pkg/strategy"
)

func main() {
    ctx := context.Background()

    // 1. Detect CI environment
    ci := gitenv.DetectWithVerbose(true)
    if ci != nil {
        fmt.Printf("Running in %s CI\n", ci.Provider())
    }

    // 2. Determine scan strategy
    scanCtx := &strategy.ScanContext{
        GitEnv:   ci,
        RepoPath: ".",
        Verbose:  true,
    }
    scanStrategy, changedFiles := strategy.DetermineStrategy(scanCtx)
    fmt.Printf("Strategy: %s (%d changed files)\n", scanStrategy, len(changedFiles))

    // 3. Initialize handler
    pusher := client.New(&client.Config{
        BaseURL: "https://api.openctem.io",
        APIKey:  os.Getenv("API_KEY"),
    })
    h := handler.NewRemoteHandler(&handler.RemoteHandlerConfig{
        Pusher:         pusher,
        Verbose:        true,
        CreateComments: ci != nil && ci.MergeRequestID() != "",
    })

    // 4. Start scan
    h.OnStart(ci, "semgrep", "sast")

    // 5. Run scanner
    scanner := scanners.Semgrep()
    scanner.DataflowTrace = true
    result, err := scanner.Scan(ctx, ".", nil)
    if err != nil {
        h.OnError(err)
        os.Exit(1)
    }

    // 6. Parse results
    parser := &semgrep.Parser{}
    report, _ := parser.Parse(ctx, result.RawOutput, nil)
    fmt.Printf("Found %d findings\n", len(report.Findings))

    // 7. Handle findings (push to server + create PR comments)
    h.HandleFindings(handler.HandleFindingsParams{
        Report:       report,
        Strategy:     scanStrategy,
        ChangedFiles: changedFiles,
        GitEnv:       ci,
    })

    // 8. Complete
    h.OnCompleted()
}
```

---

## Retry Queue (Offline Resilience)

The SDK includes a built-in retry queue for handling failed uploads. This ensures data is not lost during network outages or server unavailability.

### How It Works

1. When a push fails, findings are automatically queued to disk
2. A background worker periodically retries failed uploads
3. Before retrying, it checks with the server if data already exists (deduplication)
4. Successfully uploaded data is removed from the queue

### Basic Usage

```go
import (
    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/retry"
)

// Create client with retry enabled
c := client.New(&client.Config{
    BaseURL:       "https://api.openctem.io",
    APIKey:        os.Getenv("API_KEY"),
    RetryEnabled:  true,                        // Enable retry queue
    RetryQueueDir: "/var/lib/openctem/queue",    // Queue storage path
})

// Push findings - automatically queued on failure
result, err := c.PushFindings(ctx, report)
if err != nil {
    // Data is queued for retry, not lost
    log.Printf("Push failed, queued for retry: %v", err)
}

// Graceful shutdown - wait for pending uploads
defer c.Close()
```

### Manual Queue Management

```go
import "github.com/openctemio/sdk-go/pkg/retry"

// Create queue directly
queue, _ := retry.NewFileQueue(&retry.FileQueueConfig{
    StoragePath:   "/var/lib/openctem/queue",
    MaxItems:      10000,
    MaxItemAge:    7 * 24 * time.Hour, // 7 days
    FlushInterval: 5 * time.Second,
})

// Add item to queue
queue.Enqueue(&retry.QueueItem{
    Type:        retry.ItemTypeFinding,
    Data:        jsonData,
    Fingerprint: "sha256hash...",
    CreatedAt:   time.Now(),
})

// Start retry worker
worker := retry.NewRetryWorker(&retry.RetryWorkerConfig{
    Queue:             queue,
    Client:            apiClient,
    RetryInterval:     5 * time.Minute,
    MaxRetries:        10,
    BackoffMultiplier: 2.0,
    MaxBackoff:        1 * time.Hour,
})

worker.Start(ctx)
defer worker.Stop()
```

### Queue Item Types

| Type | Description |
|------|-------------|
| `ItemTypeFinding` | Security findings |
| `ItemTypeAsset` | Asset information |
| `ItemTypeBatch` | Batch of multiple items |

### Backoff Strategy

The retry worker uses exponential backoff with jitter:

```
Wait time = min(initialInterval * multiplier^attempts + jitter, maxBackoff)
```

Default configuration:
- Initial interval: 5 minutes
- Multiplier: 2.0
- Max backoff: 1 hour
- Jitter: ±10%

---

## Fingerprint Deduplication

The SDK uses fingerprints to deduplicate findings. Both SDK and backend use the same algorithm from the shared package.

### Shared Fingerprint Package

```go
import "github.com/openctemio/sdk-go/pkg/shared/fingerprint"

// Generate fingerprint based on finding type
fp := fingerprint.Generate(fingerprint.Input{
    Type:      fingerprint.TypeSAST,
    FilePath:  "src/main.go",
    RuleID:    "CWE-89",
    StartLine: 42,
    EndLine:   44,
})

// Auto-detect type based on available fields
fp := fingerprint.GenerateAuto(fingerprint.Input{
    FilePath:        "package.json",
    PackageName:     "lodash",
    PackageVersion:  "4.17.20",
    VulnerabilityID: "CVE-2021-23337",
})
```

### Finding Types and Algorithms

| Type | Algorithm | Fields Used |
|------|-----------|-------------|
| `TypeSAST` | `sha256(sast:file:rule:startLine:endLine)` | FilePath, RuleID, StartLine, EndLine |
| `TypeSCA` | `sha256(sca:pkg:version:vulnID)` | PackageName, PackageVersion, VulnerabilityID |
| `TypeSecret` | `sha256(secret:file:rule:line:secretHash)` | FilePath, RuleID, StartLine, SecretValue |
| `TypeMisconfiguration` | `sha256(misconfig:type:name:rule:file)` | ResourceType, ResourceName, RuleID, FilePath |
| `TypeGeneric` | `sha256(generic:rule:file:start:end:message)` | RuleID, FilePath, StartLine, EndLine, Message |

### Convenience Functions

```go
// SAST findings
fp := fingerprint.GenerateSAST("src/db.go", "CWE-89", 42, 44)

// SCA findings
fp := fingerprint.GenerateSCA("lodash", "4.17.20", "CVE-2021-23337")

// Secret findings
fp := fingerprint.GenerateSecret("config.yaml", "api-key", 10, "sk_live_xxx")

// Misconfiguration findings
fp := fingerprint.GenerateMisconfiguration("aws_s3_bucket", "my-bucket", "S3-PUBLIC", "main.tf")
```

### CheckFingerprints API

Before retrying uploads, check if data already exists:

```go
// Check which fingerprints already exist on server
result, err := client.CheckFingerprints(ctx, []string{
    "abc123...",
    "def456...",
    "ghi789...",
})

// result.Existing = fingerprints that already exist
// result.Missing = fingerprints that need to be uploaded

// Only upload missing data
for _, fp := range result.Missing {
    uploadFinding(findingsByFingerprint[fp])
}
```

---

## Metrics Collection

The SDK includes a metrics package for collecting and exposing application metrics with Prometheus support.

### Basic Usage

```go
import "github.com/openctemio/sdk-go/pkg/metrics"

// Create Prometheus collector with default metrics
collector := metrics.NewPrometheusCollector(&metrics.PrometheusConfig{
    Namespace:              .openctemio",
    RegisterDefaultMetrics: true,
})

// Set as default collector
metrics.SetDefaultCollector(collector)

// Use metrics
metrics.GetDefaultCollector().CounterInc(.openctemio_scanner_scans_total", "scanner", "semgrep", "status", "success")
metrics.GetDefaultCollector().HistogramObserve(.openctemio_scanner_scan_duration_seconds", 45.5, "scanner", "semgrep")
metrics.GetDefaultCollector().GaugeSet(.openctemio_agent_active_jobs", 3)
```

### Timer Helper

```go
// Measure operation duration
timer := metrics.NewTimer(collector, .openctemio_http_request_duration_seconds", "method", "GET", "host", "api.openctemio.com")
// ... do operation ...
duration := timer.ObserveDuration() // Records to histogram and returns duration
```

### HTTP Handler for Prometheus

```go
import "net/http"

// Expose /metrics endpoint for Prometheus scraping
http.Handle("/metrics", collector.Handler())
http.ListenAndServe(":8080", nil)
```

### Built-in Metric Definitions

| Metric | Type | Description |
|--------|------|-------------|
| .openctemio_scanner_scans_total` | Counter | Total scans executed |
| .openctemio_scanner_scan_duration_seconds` | Histogram | Scan duration |
| .openctemio_scanner_findings_total` | Counter | Total findings discovered |
| .openctemio_agent_jobs_total` | Counter | Total jobs processed |
| .openctemio_agent_active_jobs` | Gauge | Currently executing jobs |
| .openctemio_enricher_cache_hits_total` | Counter | Cache hits |
| .openctemio_http_requests_total` | Counter | HTTP requests made |

### In-Memory Collector (Testing)

```go
// For testing without Prometheus
collector := metrics.NewInMemoryCollector()
collector.CounterInc("test_counter", "label", "value")

// Retrieve values for assertions
count := collector.GetCounter("test_counter", "label", "value")
```

---

## Credential Management

The SDK provides a credential management system for secure storage and retrieval of API keys, tokens, and other secrets.

### Store Interface

```go
import "github.com/openctemio/sdk-go/pkg/credentials"

// Get credential from default store (environment variables)
cred, err := credentials.Get(ctx, "github.token")
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Token: %s\n", cred.Value)

// Convenience function for just the value
value, err := credentials.GetValue(ctx, "api.key")
```

### Environment Store (Default)

```go
// Default store reads from environment variables with OPENCTEMIO_ prefix
// OPENCTEMIO_GITHUB_TOKEN -> key "github.token"

os.Setenv("OPENCTEMIO_GITHUB_TOKEN", "ghp_xxx")
cred, _ := credentials.Get(ctx, "github.token")
```

### Custom Mapping

```go
// Map specific keys to custom env vars
store := credentials.NewEnvStoreWithMapping("", map[string]string{
    "github.token": "GITHUB_TOKEN",
    "api.key":      "MY_API_KEY",
})
credentials.SetDefaultStore(store)
```

### Memory Store (Testing)

```go
store := credentials.NewMemoryStore()
store.Set(ctx, "test.key", &credentials.Credential{
    Type:  credentials.CredentialTypeAPIKey,
    Value: "test-value",
})

cred, _ := store.Get(ctx, "test.key")
```

### File Store (Local Development)

```go
// Store credentials in encrypted JSON file (NOT for production)
store, _ := credentials.NewFileStore("/path/to/credentials.json")
store.Set(ctx, "my.secret", &credentials.Credential{
    Value: "secret-value",
})
```

### Chained Store (Fallback)

```go
// Check multiple stores in order
env := credentials.NewEnvStore("OPENCTEMIO_")
file, _ := credentials.NewFileStore(".secrets.json")
chain := credentials.NewChainedStore(env, file) // env first, then file

// Finds credential from first store that has it
cred, _ := chain.Get(ctx, "api.key")
```

### Credential Expiration

```go
// Check if credential has expired
if cred.IsExpired() {
    // Refresh the credential
}
```

---

## Health Checks

The SDK includes Kubernetes-compatible health check endpoints for liveness and readiness probes.

### Basic Setup

```go
import "github.com/openctemio/sdk-go/pkg/health"

// Create health handler with version info
h := health.NewHandler(
    health.WithVersion("1.0.0"),
    health.WithTimeout(5*time.Second),
)

// Register custom health checks
h.RegisterFunc("database", func(ctx context.Context) health.CheckResult {
    if err := db.Ping(ctx); err != nil {
        return health.CheckResult{
            Status: health.StatusUnhealthy,
            Error:  err.Error(),
        }
    }
    return health.CheckResult{
        Status:  health.StatusHealthy,
        Message: "connected",
    }
})
```

### HTTP Handlers

```go
import "net/http"

mux := http.NewServeMux()

// Kubernetes liveness probe - always returns 200 if app is running
mux.Handle("/healthz", h.LivenessHandler())

// Kubernetes readiness probe - returns 503 if not ready
mux.Handle("/readyz", h.ReadinessHandler())

// Full health check - returns detailed check results
mux.Handle("/health", h.HealthHandler())

http.ListenAndServe(":8080", mux)
```

### Readiness Control

```go
// During startup
health.SetReady(false)

// After initialization complete
health.SetReady(true)

// During graceful shutdown
health.SetReady(false)
```

### Built-in Health Checks

```go
// HTTP endpoint check
h.Register("api", &health.HTTPCheck{
    URL:     "https://api.openctem.io/health",
    Timeout: 5 * time.Second,
})

// Database check
h.Register("db", &health.DatabaseCheck{
    PingFunc: db.PingContext,
})

// Simple ping check
h.Register("ping", &health.PingCheck{})
```

### Health Response Format

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "message": "connected",
      "duration_ms": 5
    },
    "api": {
      "status": "healthy",
      "message": "HTTP 200",
      "duration_ms": 120
    }
  }
}
```

### Status Aggregation

| Check Statuses | Overall Status |
|----------------|----------------|
| All healthy | `healthy` |
| Some degraded | `degraded` |
| Any unhealthy | `unhealthy` |

---

## Severity Normalization

The SDK provides unified severity mapping across different scanner formats.

### Shared Severity Package

```go
import "github.com/openctemio/sdk-go/pkg/shared/severity"

// Parse severity from various formats
level := severity.FromString("HIGH")      // From Trivy
level := severity.FromString("ERROR")     // From Semgrep
level := severity.FromString("CRITICAL")  // Standard

// Convert CVSS score to severity
level := severity.FromCVSS(9.8)  // Returns severity.Critical

// Compare severities
if severity.Critical.IsHigherThan(severity.High) {
    // true
}

// Get priority for sorting
priority := level.Priority()  // Critical=5, High=4, Medium=3, Low=2, Info=1

// Get CVSS range for severity
min, max := severity.High.ToCVSSRange()  // 7.0, 9.0
```

### Severity Levels

| Level | Priority | CVSS Range | Scanner Mappings |
|-------|----------|------------|------------------|
| `Critical` | 5 | 9.0-10.0 | CRITICAL, CRIT |
| `High` | 4 | 7.0-8.9 | HIGH, ERROR, SEVERE |
| `Medium` | 3 | 4.0-6.9 | MEDIUM, MODERATE, WARNING, WARN |
| `Low` | 2 | 0.1-3.9 | LOW |
| `Info` | 1 | 0.0 | INFO, INFORMATIONAL, NOTE, NONE |
| `Unknown` | 0 | - | Unknown/unmapped values |

### Counting by Severity

```go
counts := &severity.CountBySeverity{}

for _, finding := range findings {
    level := severity.FromString(finding.Severity)
    counts.Increment(level)
}

fmt.Printf("Critical: %d, High: %d, Total: %d\n",
    counts.Critical, counts.High, counts.Total)

highest := counts.HighestSeverity()  // Returns highest non-zero severity
```

---

## Docker Deployment

The SDK provides Docker images for easy deployment. See the [Docker Deployment Guide](./docker-deployment.md) for full details.

### Quick Start

```bash
# Run scan with Docker
docker run --rm -v $(pwd):/scan ghcr.io/openctemio/agent:latest \
    -tools semgrep,gitleaks,trivy -target /scan -verbose

# Check tools
docker run --rm ghcr.io/openctemio/agent:latest -check-tools
```

### Available Images

| Image | Description |
|-------|-------------|
| `ghcr.io/openctemio/agent:latest` | Full image with all tools |
| `ghcr.io/openctemio/agent:slim` | Minimal (tools mounted) |
| `ghcr.io/openctemio/agent:ci` | CI/CD optimized |

---

## Agent Resource Management

The SDK includes components for managing agent resources efficiently when running as a daemon.

### Auto-Cleanup

Prevent disk bloat by automatically cleaning up uploaded chunk data:

```go
import "github.com/openctemio/sdk-go/pkg/chunk"

cfg := &chunk.Config{
    AutoCleanupOnUpload:     true,   // Delete data after upload
    CleanupOnReportComplete: true,   // Delete all when done
    MaxStorageMB:            500,    // 500MB max storage
    RetentionHours:          24,     // Keep data for 24h max
    AggressiveCleanup:       true,   // Cleanup when over limit
}

manager, _ := chunk.NewManager(cfg)
defer manager.Close()
```

### Async Upload Pipeline

Separate scan and upload processes for non-blocking operations:

```go
import "github.com/openctemio/sdk-go/pkg/pipeline"

p := pipeline.NewPipeline(&pipeline.PipelineConfig{
    QueueSize:     1000,            // Max pending uploads
    Workers:       3,               // Concurrent workers
    RetryAttempts: 3,               // Retry failed uploads
    UploadTimeout: 2 * time.Minute,
}, uploader)

p.Start(ctx)
defer p.Stop(ctx)

// Submit reports (non-blocking)
id, _ := p.Submit(report, pipeline.WithJobID("job-123"))

// Continue scanning immediately
nextReport := scanner.Scan(target)

// Get statistics
stats := p.GetStats()
// {Submitted: 100, Completed: 95, Failed: 2, InProgress: 3}
```

### Resource Controller

Monitor CPU/memory and throttle jobs when resources are constrained:

```go
import "github.com/openctemio/sdk-go/pkg/resource"

controller := resource.NewController(&resource.ControllerConfig{
    CPUThreshold:      85.0,              // Pause above 85% CPU
    MemoryThreshold:   85.0,              // Pause above 85% memory
    MaxConcurrentJobs: runtime.NumCPU(),  // Max parallel jobs
    SampleInterval:    5 * time.Second,
    CooldownDuration:  30 * time.Second,
})

controller.Start(ctx)
defer controller.Stop()

// Before starting a job
if controller.AcquireSlot(ctx) {
    defer controller.ReleaseSlot()
    executeJob()
} else {
    // Throttled - retry later
    requeue(job)
}
```

### Audit Logging

Comprehensive structured logging for debugging and compliance:

```go
import "github.com/openctemio/sdk-go/pkg/audit"

logger, _ := audit.NewLogger(&audit.LoggerConfig{
    AgentID:  "agent-001",
    TenantID: "tenant-123",
    LogFile:  "~/.openctem/audit.log",
    Verbose:  true,
})

logger.Start()
defer logger.Stop()

// Log events
logger.JobStarted(jobID, "scan", nil)
logger.JobCompleted(jobID, duration, details)
logger.JobFailed(jobID, err, nil)
logger.ChunkUploaded(reportID, chunkIndex, totalChunks, size)
logger.ResourceThrottle("CPU 90% >= 85%", metrics)
```

See [Agent Resource Management Architecture](../architecture/agent-resource-management.md) for detailed documentation.

---

## Related Documentation

- [Docker Deployment Guide](./docker-deployment.md) - Docker images and CI/CD integration
- [SDK & API Integration Architecture](../architecture/sdk-api-integration.md) - How SDK integrates with API
- [Server-Agent Command Architecture](../architecture/server-agent-command.md) - Remote agent control
- [Agent Resource Management](../architecture/agent-resource-management.md) - Auto-cleanup, pipeline, throttling
- [Building Ingestion Tools](./building-ingestion-tools.md) - CTIS schema reference
- [API Reference](../backend/api-reference.md) - Full API documentation
- [Authentication Guide](./authentication.md) - API key management

---

## Examples

Full working examples are available in the SDK repository:

- [`examples/custom-scanner`](https://github.com/openctemio/sdk-go/tree/main/examples/custom-scanner) - Custom scanner implementation
- [`examples/semgrep-test`](https://github.com/openctemio/sdk-go/tree/main/examples/semgrep-test) - Semgrep scanner integration
- [`examples/integration-test`](https://github.com/openctemio/sdk-go/tree/main/examples/integration-test) - API client integration
- [`cmd/agent`](https://github.com/openctemio/sdk-go/tree/main/cmd/agent) - CLI agent
