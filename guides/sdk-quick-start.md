---
layout: default
title: SDK Quick Start
parent: Platform Guides
nav_order: 10
---
{% raw %}

# SDK Quick Start Guide

Get started with the OpenCTEM SDK to run security scans and push results to the platform.

---

## Installation

```bash
go get github.com/openctemio/sdk-go@latest
```

For private repositories:

```bash
# Set GOPRIVATE to bypass public proxy
export GOPRIVATE=github.com/openctemio/*

# Configure Git authentication (SSH recommended)
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

---

## Quick Example

Run a Semgrep scan and push results to OpenCTEM:

```go
package main

import (
    "context"
    "fmt"
    "os"

    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/core"
)

func main() {
    ctx := context.Background()

    // 1. Create a scanner
    scanner, _ := core.NewPresetScanner("semgrep")

    // 2. Run the scan
    result, err := scanner.Scan(ctx, "./src", &core.ScanOptions{
        Verbose: true,
    })
    if err != nil {
        panic(err)
    }

    // 3. Parse results to CTIS format
    parsers := core.NewParserRegistry()
    parser := parsers.FindParser(result.RawOutput)
    report, _ := parser.Parse(ctx, result.RawOutput, nil)

    fmt.Printf("Found %d findings\n", len(report.Findings))

    // 4. Push to OpenCTEM platform
    apiClient := client.New(&client.Config{
        BaseURL: "https://api.openctem.io",
        APIKey:  os.Getenv("API_KEY"),
    })

    pushResult, _ := apiClient.PushFindings(ctx, report)
    fmt.Printf("Created: %d, Updated: %d\n",
        pushResult.FindingsCreated, pushResult.FindingsUpdated)
}
```

---

## Available Scanners

Use pre-built scanners with `core.NewPresetScanner()`:

| Scanner | Type | Description |
|---------|------|-------------|
| `semgrep` | SAST | Static code analysis with dataflow tracking |
| `trivy-fs` | SCA | Filesystem vulnerability scanning |
| `trivy-config` | IaC | Infrastructure as Code scanning |
| `trivy-image` | Container | Container image scanning |
| `gitleaks` | Secrets | Secret and credential detection |
| `slither` | Web3 | Solidity smart contract analysis |
| `checkov` | IaC | Cloud infrastructure scanning |
| `bandit` | SAST | Python security linting |
| `gosec` | SAST | Go security linting |

### Check Installation Status

```go
scanner, _ := core.NewPresetScanner("semgrep")

installed, version, err := scanner.IsInstalled(ctx)
if installed {
    fmt.Printf("Semgrep %s is installed\n", version)
}
```

### List All Available Scanners

```go
for _, name := range core.ListPresetScanners() {
    fmt.Println(name)
}
```

---

## Scan Options

Customize scans with `core.ScanOptions`:

```go
result, err := scanner.Scan(ctx, target, &core.ScanOptions{
    // Logging
    Verbose: true,

    // File filtering
    Include: []string{"*.go", "*.py"},
    Exclude: []string{"vendor/", "node_modules/"},

    // Scan scope
    Branch:    "main",
    CommitSHA: "abc123",

    // Timeout
    Timeout: 30 * time.Minute,
})
```

---

## Pushing Results

### Create API Client

```go
import "github.com/openctemio/sdk-go/pkg/client"

apiClient := client.New(&client.Config{
    BaseURL:  "https://api.openctem.io",
    APIKey:   os.Getenv("API_KEY"),
    WorkerID: "worker-uuid",  // Optional: for tracking
    Timeout:  30 * time.Second,
    Verbose:  true,
})
```

### Push Findings

```go
result, err := apiClient.PushFindings(ctx, report)
if err != nil {
    log.Printf("Push failed: %v", err)
    return
}

fmt.Printf("Created: %d\n", result.FindingsCreated)
fmt.Printf("Updated: %d\n", result.FindingsUpdated)
fmt.Printf("Skipped: %d\n", result.FindingsSkipped)
```

### Push Assets

```go
assetResult, err := apiClient.PushAssets(ctx, report)
if err != nil {
    log.Printf("Push failed: %v", err)
    return
}

fmt.Printf("Assets Created: %d\n", assetResult.AssetsCreated)
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Security Scan
        uses: docker://openctemio/agent:ci
        with:
          args: >-
            -tools semgrep,gitleaks,trivy
            -target .
            -auto-ci
            -push
            -verbose
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          API_URL: ${{ secrets.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}
```

### GitLab CI

```yaml
security-scan:
  image: openctemio/agent:ci
  script:
    - agent -tools semgrep,gitleaks,trivy -target . -auto-ci -push
  variables:
    GITLAB_TOKEN: $CI_JOB_TOKEN
    API_URL: $API_URL
    API_KEY: $API_KEY
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_URL` | Yes* | Platform API URL |
| `API_KEY` | Yes* | API key from Worker |
| `WORKER_ID` | No | Worker UUID for tracking |
| `GITHUB_TOKEN` | Auto | GitHub token for PR comments |
| `GITLAB_TOKEN` | Auto | GitLab token for MR comments |

*Required when pushing results

---

## Next Steps

- **[Custom Tools Development](custom-tools-development.md)** - Build your own scanners
- **[Agent Usage](agent-usage.md)** - Run the full scanning agent
- **[Running Workers](running-workers.md)** - Setup workers in OpenCTEM UI
- **[SDK Development Guide](sdk-development.md)** - Advanced SDK usage
{% endraw %}
