---
layout: default
title: Docker Deployment
parent: Platform Guides
nav_order: 13
---
{% raw %}
# Docker Deployment Guide

Deploy and run OpenCTEM Agent using Docker for consistent, reproducible security scanning.

---

## Docker Images

The OpenCTEM Agent is available on both **GitHub Container Registry (GHCR)** and **Docker Hub**:

### Available Tags

| Tag | Description | Use Case |
|-----|-------------|----------|
| `latest` | All tools included (semgrep, gitleaks, trivy) | Production, general use |
| `slim` | Minimal, tools mounted from host | Size-constrained environments |
| `ci` | Optimized for CI/CD pipelines | GitHub Actions, GitLab CI |

### Pull Images

```bash
# From Docker Hub (recommended)
docker pull openctemio/agent:latest
docker pull openctemio/agent:slim
docker pull openctemio/agent:ci

# From GitHub Container Registry
docker pull ghcr.io/openctemio/agent:latest
docker pull ghcr.io/openctemio/agent:slim
docker pull openctemio/agent:ci
```

---

## Quick Start

### Scan Local Directory

```bash
# Scan current directory with all tools
docker run --rm -v $(pwd):/scan openctemio/agent:latest \
    -tools semgrep,gitleaks,trivy -target /scan -verbose

# Scan specific directory
docker run --rm -v /path/to/project:/scan openctemio/agent:latest \
    -tool semgrep -target /scan

# Push results to OpenCTEM platform
docker run --rm -v $(pwd):/scan \
    -e API_URL=https://api.openctem.io \
    -e API_KEY=your-api-key \
    openctemio/agent:latest \
    -tools semgrep,gitleaks,trivy -target /scan -push -verbose

# Generate JSON and SARIF output
docker run --rm -v $(pwd):/scan openctemio/agent:latest \
    -tools semgrep,gitleaks,trivy -target /scan \
    -json -output /scan/results.json \
    -sarif -sarif-output /scan/results.sarif
```

### Check Tool Installation

```bash
docker run --rm ghcr.io/openctemio/agent:latest -check-tools
```

Output:
```
Checking scanner tools installation...

  ✓ semgrep      SAST scanner with dataflow/taint tracking (installed: 1.56.0)
  ✓ gitleaks     Secret detection scanner (installed: 8.28.0)
  ✓ trivy        SCA/Container/IaC scanner (installed: 0.67.2)

All tools are installed! Ready to scan.
```

---

## Image Details

### Full Image (`latest`)

The full image includes:
- **agent** binary
- **semgrep** - SAST with dataflow/taint tracking
- **gitleaks** - Secret detection
- **trivy** - SCA, container, and IaC scanning
- **git** - For repository operations

```dockerfile
# Base: python:3.12-slim
# Size: ~500MB
# User: non-root (openctem)
```

**Usage:**
```bash
docker run --rm -v $(pwd):/scan ghcr.io/openctemio/agent:latest \
    -tools semgrep,gitleaks,trivy -target /scan
```

### Slim Image (`slim`)

Minimal image with only the agent binary. Tools must be mounted from host.

```dockerfile
# Base: gcr.io/distroless/static-debian12:nonroot
# Size: ~20MB
# User: non-root
```

**Usage:**
```bash
# Mount tools from host
docker run --rm \
    -v $(pwd):/scan \
    -v /usr/local/bin/semgrep:/usr/local/bin/semgrep:ro \
    -v /usr/local/bin/gitleaks:/usr/local/bin/gitleaks:ro \
    -v /usr/local/bin/trivy:/usr/local/bin/trivy:ro \
    ghcr.io/openctemio/agent:slim \
    -tools semgrep,gitleaks,trivy -target /scan
```

### CI Image (`ci`)

Optimized for CI/CD pipelines with:
- Pre-downloaded Trivy vulnerability database
- Git safe directory configured
- CI environment variables ready

```dockerfile
# Base: python:3.12-slim
# Size: ~600MB (includes trivy DB cache)
# User: root (for CI compatibility)
```

**Usage:**
```bash
docker run --rm \
    -v $(pwd):/github/workspace \
    -e GITHUB_ACTIONS=true \
    -e GITHUB_TOKEN=$GITHUB_TOKEN \
    openctemio/agent:ci \
    -tools semgrep,gitleaks,trivy -target . -auto-ci
```

---

## Docker Compose

Use docker-compose for local development and testing.

### docker-compose.yml

```yaml
services:
  scan:
    image: ghcr.io/openctemio/agent:latest
    volumes:
      - ./:/scan:ro
      - scan-cache:/cache
    environment:
      - API_URL=${API_URL:-}
      - API_KEY=${API_KEY:-}
    working_dir: /scan
    command: ["-tools", "semgrep,gitleaks,trivy", "-target", "/scan", "-verbose"]

  agent:
    image: ghcr.io/openctemio/agent:latest
    volumes:
      - ./:/scan:ro
      - ./config.yaml:/config/config.yaml:ro
      - scan-cache:/cache
    environment:
      - API_URL=${API_URL}
      - API_KEY=${API_KEY}
    restart: unless-stopped
    command: ["-daemon", "-config", "/config/config.yaml"]

volumes:
  scan-cache:
```

### Commands

```bash
# Run one-time scan
docker compose run --rm scan

# Start daemon agent
docker compose up -d agent

# View logs
docker compose logs -f agent

# Stop
docker compose down
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff-based scanning

      - name: Run OpenCTEM Security Scan
        uses: docker://openctemio/agent:ci
        with:
          args: >-
            -tools semgrep,gitleaks,trivy
            -target .
            -auto-ci
            -comments
            -push
            -verbose
            -json
            -output /github/workspace/results.json
            -sarif
            -sarif-output /github/workspace/results.sarif
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          API_URL: ${{ secrets.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}

      - name: Upload SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif

      - name: Upload Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-scan-results
          path: |
            results.json
            results.sarif
```

### GitLab CI

```yaml
stages:
  - security

security-scan:
  stage: security
  image: openctemio/agent:ci
  variables:
    GIT_DEPTH: 0
    GITLAB_TOKEN: $CI_JOB_TOKEN
    API_URL: $API_URL
    API_KEY: $API_KEY
  script:
    - |
      agent \
        -tools semgrep,gitleaks,trivy \
        -target . \
        -auto-ci \
        -comments \
        -push \
        -verbose \
        -json \
        -output results.json \
        -sarif \
        -sarif-output gl-sast-report.json
  artifacts:
    paths:
      - results.json
      - gl-sast-report.json
    reports:
      sast: gl-sast-report.json
    expire_in: 30 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### Jenkins

```groovy
pipeline {
    agent {
        docker {
            image 'openctemio/agent:ci'
        }
    }

    environment {
        API_URL = credentials('api-url')
        API_KEY = credentials('api-key')
    }

    stages {
        stage('Security Scan') {
            steps {
                sh '''
                    agent \
                        -tools semgrep,gitleaks,trivy \
                        -target . \
                        -verbose \
                        -json \
                        -output results.json
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'results.json', fingerprint: true
        }
    }
}
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | OpenCTEM platform API URL | - |
| `API_KEY` | API key for authentication | - |
| `WORKER_ID` | Worker identifier | auto-generated |
| `GITHUB_TOKEN` | GitHub token for PR comments | - |
| `GITLAB_TOKEN` | GitLab token for MR comments | - |
| `SEMGREP_SEND_METRICS` | Semgrep telemetry | `off` |
| `TRIVY_CACHE_DIR` | Trivy cache directory | `/cache/trivy` |
| `TRIVY_NO_PROGRESS` | Disable progress bar | `true` in CI |

### Volume Mounts

| Mount | Purpose | Recommended |
|-------|---------|-------------|
| `/scan` | Source code to scan | Required |
| `/config` | Configuration files | Optional |
| `/cache` | Persistent cache (trivy DB) | Recommended |
| `/output` | Output files | Optional |

### Example with All Options

```bash
docker run --rm \
    -v $(pwd):/scan:ro \
    -v $(pwd)/config.yaml:/config/config.yaml:ro \
    -v app-cache:/cache \
    -v $(pwd)/output:/output \
    -e API_URL=https://api.openctem.io \
    -e API_KEY=your-api-key \
    -e WORKER_ID=scanner-001 \
    ghcr.io/openctemio/agent:latest \
    -config /config/config.yaml \
    -target /scan \
    -push \
    -json \
    -output /output/results.json
```

---

## Building Custom Images

### Extend the Base Image

```dockerfile
FROM ghcr.io/openctemio/agent:latest

# Add custom tools
RUN apt-get update && apt-get install -y \
    your-custom-tool \
    && rm -rf /var/lib/apt/lists/*

# Add custom configuration
COPY your-config.yaml /config/

# Set default command
CMD ["-daemon", "-config", "/config/your-config.yaml"]
```

### Build from Source

```bash
# Clone repository
git clone https://github.com/openctemio/sdk-go.git
cd sdk

# Build images
make docker-all

# Or build specific image
docker build -t my-agent:latest -f docker/Dockerfile .
```

---

## Troubleshooting

### Permission Denied

```bash
# Run with specific user
docker run --rm --user $(id -u):$(id -g) -v $(pwd):/scan ...

# Or use root (not recommended for production)
docker run --rm --user root -v $(pwd):/scan ...
```

### Git Safe Directory Error

```bash
# Add safe directory inside container
docker run --rm -v $(pwd):/scan ghcr.io/openctemio/agent:latest \
    sh -c "git config --global --add safe.directory /scan && agent -tool semgrep -target /scan"
```

### Trivy Database Update

```bash
# Force update trivy database
docker run --rm -v trivy-cache:/cache ghcr.io/openctemio/agent:latest \
    sh -c "trivy image --download-db-only"
```

### Network Issues

```bash
# Use host network
docker run --rm --network host -v $(pwd):/scan ...

# Or specify DNS
docker run --rm --dns 8.8.8.8 -v $(pwd):/scan ...
```

---

## Related Documentation

- [SDK Development Guide](./sdk-development.md) - Building custom scanners
- [CI Environment Detection](./sdk-development.md#ci-environment-detection) - Auto-detection features
- [Handler Pattern](./sdk-development.md#handler-pattern) - Scan lifecycle management
- [Authentication Guide](./authentication.md) - API key management
{% endraw %}
