---
layout: default
title: Quality Gates
parent: Features
nav_order: 8
---

# Quality Gates

## Overview

Quality Gates enable automated pass/fail decisions for CI/CD pipelines based on scan results. When enabled on a scan profile, the platform evaluates findings against configurable thresholds and returns a clear pass or fail status.

## Key Concepts

### What is a Quality Gate?

A Quality Gate is a set of threshold rules that scan results must pass. If any threshold is exceeded, the scan is marked as "failed" and CI/CD pipelines can block deployment.

```
┌───────────────────────────────────────────────────────────────────┐
│                       Quality Gate Flow                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│   SCAN COMPLETES          EVALUATE GATE           RETURN RESULT   │
│   ┌──────────────┐        ┌──────────────┐       ┌──────────────┐ │
│   │ 2 Critical   │───────▶│ Max Critical │──────▶│   ✗ FAILED   │ │
│   │ 5 High       │        │ = 0          │       │ 2 > 0        │ │
│   │ 12 Medium    │        │              │       │              │ │
│   └──────────────┘        └──────────────┘       └──────────────┘ │
│                                                                    │
│   ┌──────────────┐        ┌──────────────┐       ┌──────────────┐ │
│   │ 0 Critical   │───────▶│ Max Critical │──────▶│   ✓ PASSED   │ │
│   │ 3 High       │        │ = 0          │       │ 0 <= 0       │ │
│   │ 8 Medium     │        │ Max High = 5 │       │ 3 <= 5       │ │
│   └──────────────┘        └──────────────┘       └──────────────┘ │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### Quality Gate vs Scan Profile

| Component | Purpose |
|-----------|---------|
| **Scan Profile** | Defines which tools run and how |
| **Quality Gate** | Part of scan profile; defines pass/fail thresholds |

Quality Gates are configured within Scan Profiles.

---

## Configuration

### Quality Gate Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable quality gate evaluation |
| `fail_on_critical` | boolean | `false` | Fail immediately on any critical finding |
| `fail_on_high` | boolean | `false` | Fail immediately on any high finding |
| `max_critical` | integer | `-1` | Maximum allowed critical findings (-1 = unlimited) |
| `max_high` | integer | `-1` | Maximum allowed high findings (-1 = unlimited) |
| `max_medium` | integer | `-1` | Maximum allowed medium findings (-1 = unlimited) |
| `max_total` | integer | `-1` | Maximum allowed total findings (-1 = unlimited) |
| `new_findings_only` | boolean | `false` | Only count new findings (not in baseline) |
| `baseline_branch` | string | `""` | Branch to compare against for new findings |

### Example Configurations

**Strict (Production Deployments):**
```json
{
  "enabled": true,
  "fail_on_critical": true,
  "fail_on_high": true,
  "max_critical": 0,
  "max_high": 0,
  "max_medium": 5,
  "max_total": 20
}
```

**Moderate (Staging):**
```json
{
  "enabled": true,
  "fail_on_critical": true,
  "fail_on_high": false,
  "max_critical": 0,
  "max_high": 3,
  "max_medium": 10,
  "max_total": 50
}
```

**Lenient (Development):**
```json
{
  "enabled": true,
  "fail_on_critical": true,
  "fail_on_high": false,
  "max_critical": 0,
  "max_high": -1,
  "max_medium": -1,
  "max_total": -1
}
```

**New Findings Only (PR Checks):**
```json
{
  "enabled": true,
  "fail_on_critical": true,
  "fail_on_high": false,
  "max_critical": 0,
  "max_high": 0,
  "new_findings_only": true,
  "baseline_branch": "main"
}
```

---

## Threshold Rules

### Immediate Fail Rules

When `fail_on_critical` or `fail_on_high` is enabled, the gate fails immediately if **any** finding of that severity exists.

```
fail_on_critical: true
─────────────────────────
1 Critical finding → FAIL
0 Critical findings → Check other rules
```

### Maximum Count Rules

When `max_*` thresholds are set (not -1), the gate fails if the count exceeds the threshold.

```
max_high: 3
─────────────────────────
2 High findings → PASS
3 High findings → PASS
4 High findings → FAIL
```

### Unlimited (-1)

A value of `-1` means unlimited (no threshold for that severity).

```
max_medium: -1
─────────────────────────
100 Medium findings → PASS (no limit)
```

---

## Evaluation Order

1. **Check `fail_on_critical`** - If enabled and critical > 0, FAIL
2. **Check `fail_on_high`** - If enabled and high > 0, FAIL
3. **Check `max_critical`** - If set and critical > max, FAIL
4. **Check `max_high`** - If set and high > max, FAIL
5. **Check `max_medium`** - If set and medium > max, FAIL
6. **Check `max_total`** - If set and total > max, FAIL
7. **All checks pass** - PASS

---

## API Usage

### Create Scan Profile with Quality Gate

```bash
curl -X POST /api/v1/scan-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production CI/CD",
    "description": "Strict quality gate for production",
    "intensity": "high",
    "tools_config": {
      "semgrep": {"enabled": true},
      "trivy": {"enabled": true},
      "gitleaks": {"enabled": true}
    },
    "quality_gate": {
      "enabled": true,
      "fail_on_critical": true,
      "fail_on_high": true,
      "max_critical": 0,
      "max_high": 0,
      "max_medium": 5,
      "max_total": 20
    }
  }'
```

### Update Quality Gate

```bash
curl -X PATCH /api/v1/scan-profiles/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quality_gate": {
      "enabled": true,
      "fail_on_critical": true,
      "max_critical": 0,
      "max_high": 2
    }
  }'
```

### Get Quality Gate Result

After a scan completes, the result includes quality gate evaluation:

```bash
curl /api/v1/scans/{scan_id} \
  -H "Authorization: Bearer $TOKEN"
```

**Response with Quality Gate:**
```json
{
  "id": "scan-123",
  "status": "completed",
  "quality_gate_result": {
    "passed": false,
    "reason": "Quality gate thresholds exceeded",
    "breaches": [
      {
        "metric": "critical",
        "limit": 0,
        "actual": 2
      },
      {
        "metric": "high",
        "limit": 0,
        "actual": 5
      }
    ],
    "counts": {
      "critical": 2,
      "high": 5,
      "medium": 12,
      "low": 8,
      "info": 3,
      "total": 30
    }
  }
}
```

---

## CI/CD Integration

### GitHub Actions

{% raw %}
```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run OpenCTEM Scan
        id: scan
        run: |
          RESULT=$(curl -s -X POST https://api.openctem.io/api/v1/scans \
            -H "Authorization: Bearer ${{ secrets.OPENCTEM_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "asset_id": "${{ vars.ASSET_ID }}",
              "scan_profile_id": "${{ vars.SCAN_PROFILE_ID }}",
              "branch": "${{ github.ref_name }}",
              "commit": "${{ github.sha }}"
            }')

          SCAN_ID=$(echo $RESULT | jq -r '.id')
          echo "scan_id=$SCAN_ID" >> $GITHUB_OUTPUT

          # Wait for scan completion and check quality gate
          while true; do
            STATUS=$(curl -s "https://api.openctem.io/api/v1/scans/$SCAN_ID" \
              -H "Authorization: Bearer ${{ secrets.OPENCTEM_TOKEN }}" \
              | jq -r '.status')

            if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
              break
            fi
            sleep 10
          done

          # Check quality gate result
          PASSED=$(curl -s "https://api.openctem.io/api/v1/scans/$SCAN_ID" \
            -H "Authorization: Bearer ${{ secrets.OPENCTEM_TOKEN }}" \
            | jq -r '.quality_gate_result.passed')

          if [ "$PASSED" != "true" ]; then
            echo "Quality gate failed!"
            exit 1
          fi
```
{% endraw %}

### GitLab CI

```yaml
security-scan:
  stage: test
  script:
    - |
      RESULT=$(curl -s -X POST https://api.openctem.io/api/v1/scans \
        -H "Authorization: Bearer $OPENCTEM_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
          \"asset_id\": \"$ASSET_ID\",
          \"scan_profile_id\": \"$SCAN_PROFILE_ID\",
          \"branch\": \"$CI_COMMIT_REF_NAME\",
          \"commit\": \"$CI_COMMIT_SHA\"
        }")

      SCAN_ID=$(echo $RESULT | jq -r '.id')

      # Poll for completion
      while true; do
        SCAN=$(curl -s "https://api.openctem.io/api/v1/scans/$SCAN_ID" \
          -H "Authorization: Bearer $OPENCTEM_TOKEN")
        STATUS=$(echo $SCAN | jq -r '.status')

        if [ "$STATUS" = "completed" ]; then
          PASSED=$(echo $SCAN | jq -r '.quality_gate_result.passed')
          if [ "$PASSED" != "true" ]; then
            echo "Quality gate failed!"
            echo $SCAN | jq '.quality_gate_result'
            exit 1
          fi
          echo "Quality gate passed!"
          break
        elif [ "$STATUS" = "failed" ]; then
          echo "Scan failed!"
          exit 1
        fi
        sleep 10
      done
```

### OpenCTEM Agent (CLI)

```bash
# Run scan with quality gate check
openctem scan --profile production-ci \
  --target . \
  --branch main \
  --commit $(git rev-parse HEAD) \
  --fail-on-gate

# Exit codes:
# 0 = Scan passed quality gate
# 1 = Scan failed quality gate
# 2 = Scan error
```

---

## New Findings Only Mode

When `new_findings_only: true` is set, the quality gate only counts findings that are **new** compared to a baseline branch.

### How It Works

1. Scan completes on feature branch
2. Compare findings to baseline branch (e.g., `main`)
3. Only count findings not present in baseline
4. Evaluate thresholds against new findings only

### Use Case: PR Checks

Block PRs that introduce new vulnerabilities while allowing existing ones:

```json
{
  "enabled": true,
  "fail_on_critical": true,
  "max_critical": 0,
  "max_high": 0,
  "new_findings_only": true,
  "baseline_branch": "main"
}
```

**Example:**
- `main` branch has: 5 High, 10 Medium
- PR introduces: 2 new High, 3 new Medium
- Quality gate evaluates: 2 High (new), 3 Medium (new)
- With `max_high: 0`: **FAIL** (2 new high > 0)

---

## Quality Gate Result Schema

```typescript
interface QualityGateResult {
  passed: boolean;           // Overall pass/fail
  reason?: string;           // Failure reason
  breaches?: GateBreach[];   // List of threshold violations
  counts: FindingCounts;     // Actual finding counts
}

interface GateBreach {
  metric: string;  // "critical" | "high" | "medium" | "total"
  limit: number;   // Configured threshold
  actual: number;  // Actual count
}

interface FindingCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}
```

---

## Best Practices

### 1. Start Lenient, Tighten Over Time

Begin with lenient thresholds and gradually tighten as your codebase improves:

```
Week 1: max_critical=5, max_high=20
Week 4: max_critical=2, max_high=10
Week 8: max_critical=0, max_high=5
```

### 2. Use Different Profiles Per Environment

| Environment | Gate Strictness |
|-------------|-----------------|
| Development | Lenient (warnings only) |
| Staging | Moderate (block criticals) |
| Production | Strict (block high+critical) |

### 3. Enable New Findings Only for PRs

Avoid blocking PRs due to pre-existing issues:

```json
{
  "new_findings_only": true,
  "baseline_branch": "main"
}
```

### 4. Document Acceptance Criteria

Make quality gate configuration visible to developers:

```markdown
## Security Requirements

- No critical vulnerabilities in production deployments
- Maximum 5 high vulnerabilities per release
- All new code must pass security scan
```

### 5. Review Breaches, Don't Just Bypass

When a gate fails, investigate the findings rather than disabling the gate.

---

## Permissions

| Action | Admin | Member | Viewer |
|--------|-------|--------|--------|
| View quality gate config | Yes | Yes | Yes |
| Create/update quality gate | Yes | Yes | No |
| View quality gate results | Yes | Yes | Yes |

Permission ID: `scans:profiles:write` - Required to modify quality gate settings.

---

## Related Documentation

- [Scan Profiles](scan-profiles.md)
- [CI/CD Integration](../guides/cicd-integration.md)
- [Agent Configuration](../guides/agent-configuration.md)
- [Findings Management](../guides/findings-management.md)
