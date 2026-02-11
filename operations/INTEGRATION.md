---
layout: default
title: Integration Guide
parent: Operations
nav_order: 11
---
{% raw %}

# Integration Guide

This guide provides a comprehensive overview of integrating with the OpenCTEM security platform.

## Platform Overview

OpenCTEM is a unified security platform that aggregates, analyzes, and manages security findings from multiple sources. It implements the CTEM (Continuous Threat Exposure Management) framework.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR INFRASTRUCTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   CI/CD      │  │   Daemon     │  │    Custom    │              │
│  │   Pipeline   │  │   Agent      │  │    Tool      │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                     │
│                            │                                        │
│                     ┌──────▼───────┐                                │
│                     │  OPENCTEM SDK │                                │
│                     │  (Go Module) │                                │
│                     └──────┬───────┘                                │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                      HTTP/REST or gRPC
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       OPENCTEM PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Workers   │  │  Findings   │  │   Assets    │                 │
│  │   Manager   │  │   Engine    │  │  Inventory  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Threat    │  │  Exposure   │  │   CTEM      │                 │
│  │   Intel     │  │   Monitor   │  │   Engine    │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Options

### Option 1: Pre-built Agent (Recommended)

Use the OpenCTEM Agent binary for quick integration.

```bash
# Install
go install github.com/openctemio/agent@latest

# Run scan
agent -tools semgrep,trivy,gitleaks \
      -target . \
      -push \
      -api-url https://api.openctem.io \
      -api-key $API_KEY
```

### Option 2: SDK Integration

Integrate the SDK into your Go application.

```go
import (
    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/scanners"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    // Initialize client
    c := client.New(&client.Config{
        BaseURL:  "https://api.openctem.io",
        APIKey:   os.Getenv("OPENCTEM_API_KEY"),
        WorkerID: "my-integration-001",
    })

    // Run scanner
    scanner := scanners.Semgrep()
    result, _ := scanner.Scan(ctx, "./src", nil)

    // Parse results
    parser := semgrep.NewParser()
    report, _ := parser.Parse(ctx, result.RawOutput, nil)

    // Push to platform
    c.PushFindings(ctx, report)
}
```

### Option 3: Direct API

Call the REST API directly.

```bash
curl -X POST https://api.openctem.io/api/v1/agent/ingest \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "metadata": {
      "tool_name": "custom-scanner",
      "worker_id": "my-integration"
    },
    "findings": [...]
  }'
```

## Data Types

### Findings

Security issues discovered by scanners:

| Type | Description |
|------|-------------|
| `vulnerability` | Code vulnerabilities, CVEs |
| `secret` | Exposed credentials |
| `misconfiguration` | IaC/config issues |
| `compliance` | Policy violations |
| `web3` | Smart contract vulnerabilities |

### Assets

Resources being monitored:

| Type | Description |
|------|-------------|
| `repository` | Git repositories |
| `domain` | DNS domains |
| `ip_address` | IP addresses |
| `smart_contract` | Blockchain contracts |
| `cloud_account` | AWS/GCP/Azure accounts |

### Exposures

Attack surface changes:

| Type | Description |
|------|-------------|
| `new_asset` | New asset discovered |
| `exposure_detected` | New exposure found |
| `exposure_resolved` | Exposure fixed |

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
      
      - name: Run OpenCTEM Scan
        uses: docker://openctemio/agent:ci
        with:
          args: >-
            -tools semgrep,gitleaks,trivy
            -target .
            -auto-ci
            -push
        env:
          API_URL: ${{ secrets.OPENCTEM_API_URL }}
          API_KEY: ${{ secrets.OPENCTEM_API_KEY }}
```

### GitLab CI

```yaml
security-scan:
  image: openctemio/agent:ci
  script:
    - agent -tools semgrep,gitleaks,trivy -target . -auto-ci -push
  variables:
    API_URL: $OPENCTEM_API_URL
    API_KEY: $OPENCTEM_API_KEY
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_URL` / `OPENCTEM_API_URL` | Yes | Platform API URL |
| `API_KEY` / `OPENCTEM_API_KEY` | Yes | API authentication key |
| `WORKER_ID` | No | Custom worker identifier |
| `GRPC_ADDR` | No | gRPC server address |

## Best Practices

1. **Use unique Worker IDs**: Each integration should have a distinct `worker_id` for traceability.

2. **Enable retry queue**: For unreliable networks:
   ```go
   client.New(&client.Config{
       EnableRetryQueue: true,
   })
   ```

3. **Use gRPC for high volume**: For large-scale deployments, use gRPC transport with streaming.

4. **Enrich with threat intel**: Add EPSS/KEV data for better prioritization:
   ```go
   findings, _ = client.EnrichFindings(ctx, findings)
   ```

5. **Implement heartbeat**: For daemon agents, send regular heartbeats:
   ```go
   agent.SetHeartbeatInterval(30 * time.Second)
   ```

## Support

- **Documentation**: https://docs.openctem.io
- **API Reference**: https://api.openctem.io/docs
- **SDK Source**: https://github.com/openctemio/sdk-go
{% endraw %}
