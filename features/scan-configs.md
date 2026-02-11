---
layout: default
title: Scan Configurations
parent: Features
nav_order: 8
---
{% raw %}

# Scan Configurations

## Overview

Scan Configurations bind assets with scanners or pipelines and define when scans should run. They are the primary way to set up recurring security scans.

## Key Concepts

### Scan Config Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     Scan Configuration                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│   │   TARGETS    │───▶│   SCANNER    │───▶│   SCHEDULE   │      │
│   │              │    │              │    │              │      │
│   │ Asset Group  │    │ Single Tool  │    │ When to run  │      │
│   │ or Targets   │    │ or Pipeline  │    │ the scan     │      │
│   └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Scan Types

### Single Scanner

Uses one tool to scan targets.

```json
{
  "name": "Weekly Nuclei Scan",
  "scan_type": "single",
  "scanner_name": "nuclei",
  "asset_group_id": "grp-web-apps",
  "schedule_type": "weekly"
}
```

### Workflow (Pipeline)

Uses a multi-step pipeline.

```json
{
  "name": "Full Security Audit",
  "scan_type": "workflow",
  "pipeline_id": "pip-full-recon",
  "asset_group_id": "grp-production",
  "schedule_type": "monthly"
}
```

## Schedule Types

| Schedule | Description | Configuration |
|----------|-------------|---------------|
| `manual` | On-demand only | None |
| `daily` | Every day at 2 AM UTC | `schedule_time` |
| `weekly` | Every Sunday at 2 AM UTC | `schedule_day`, `schedule_time` |
| `monthly` | First day of month at 2 AM UTC | `schedule_day`, `schedule_time` |
| `crontab` | Custom cron expression | `schedule_crontab` |

### Crontab Examples

```json
{
  "schedule_type": "crontab",
  "schedule_crontab": "0 2 * * 1-5"  // Weekdays at 2 AM
}
```

| Expression | Description |
|------------|-------------|
| `0 2 * * *` | Daily at 2 AM |
| `0 2 * * 0` | Weekly on Sunday at 2 AM |
| `0 2 1 * *` | Monthly on 1st at 2 AM |
| `0 2 * * 1-5` | Weekdays at 2 AM |
| `0 */6 * * *` | Every 6 hours |

## Scan Config Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name |
| `description` | string | No | Description |
| `scan_type` | string | Yes | `single` or `workflow` |
| `scanner_name` | string | If single | Tool to use |
| `pipeline_id` | string | If workflow | Pipeline to execute |
| `asset_group_id` | string | Yes | Target asset group |
| `schedule_type` | string | Yes | Schedule type |
| `schedule_crontab` | string | If crontab | Cron expression |
| `agent_preference` | string | No | Agent selection |
| `notifications` | object | No | Notification settings |
| `status` | string | Auto | active, paused, disabled |

## Status Lifecycle

```
┌──────────┐     activate      ┌──────────┐
│          │ ────────────────▶ │          │
│ DISABLED │                   │  ACTIVE  │
│          │ ◀──────────────── │          │
└──────────┘     disable       └──────────┘
      │                              │
      │                              │ pause
      │         ┌──────────┐         ▼
      └────────▶│  PAUSED  │◀────────┘
                │          │
                └──────────┘
                      │
                      │ activate
                      ▼
                ┌──────────┐
                │  ACTIVE  │
                └──────────┘
```

### Status Descriptions

| Status | Description |
|--------|-------------|
| `active` | Scheduled runs execute normally |
| `paused` | Temporarily halted, keeps schedule |
| `disabled` | Completely stopped, must re-enable |

## Agent Preference

Controls which agents execute the scan.

| Value | Description |
|-------|-------------|
| `auto` | Automatic (platform preferred) |
| `tenant_only` | Only tenant-deployed agents |
| `platform_only` | Only platform agents |
| `prefer_tenant` | Prefer tenant, fallback to platform |
| `prefer_platform` | Prefer platform, fallback to tenant |

## Notifications

Configure notifications for scan events.

```json
{
  "notifications": {
    "on_start": false,
    "on_complete": true,
    "on_failure": true,
    "channels": ["slack", "email"],
    "recipients": ["security-team@example.com"]
  }
}
```

## API Reference

### Scan Configs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/scans` | Create scan config |
| `GET` | `/api/v1/scans` | List scan configs |
| `GET` | `/api/v1/scans/{id}` | Get scan config |
| `PUT` | `/api/v1/scans/{id}` | Update scan config |
| `DELETE` | `/api/v1/scans/{id}` | Delete scan config |
| `GET` | `/api/v1/scans/stats` | Get statistics |

### Status Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/scans/{id}/activate` | Activate scan |
| `POST` | `/api/v1/scans/{id}/pause` | Pause scan |
| `POST` | `/api/v1/scans/{id}/disable` | Disable scan |

### Execution Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/scans/{id}/trigger` | Trigger immediate run |
| `POST` | `/api/v1/scans/{id}/clone` | Clone scan config |
| `GET` | `/api/v1/scans/{id}/runs` | List runs for config |
| `GET` | `/api/v1/scans/{id}/runs/latest` | Get latest run |

### Quick Scan

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/quick-scan` | Run ad-hoc scan |

**Request:**
```json
{
  "targets": ["example.com", "192.168.1.0/24"],
  "scanner_name": "nuclei",
  "agent_preference": "auto"
}
```

## Complete Example

### Create Weekly Vulnerability Scan

```json
POST /api/v1/scans

{
  "name": "Weekly Production Vuln Scan",
  "description": "Scans all production web apps for vulnerabilities",
  "scan_type": "workflow",
  "pipeline_id": "pip-web-vuln-scan",
  "asset_group_id": "grp-prod-webapps",
  "schedule_type": "weekly",
  "agent_preference": "prefer_platform",
  "notifications": {
    "on_complete": true,
    "on_failure": true,
    "channels": ["slack"],
    "recipients": ["#security-scans"]
  }
}
```

### Response

```json
{
  "id": "scan-abc123",
  "name": "Weekly Production Vuln Scan",
  "scan_type": "workflow",
  "pipeline_id": "pip-web-vuln-scan",
  "asset_group_id": "grp-prod-webapps",
  "schedule_type": "weekly",
  "status": "active",
  "next_run_at": "2026-02-02T02:00:00Z",
  "last_run_id": null,
  "created_at": "2026-01-30T10:00:00Z"
}
```

## Statistics

The stats endpoint returns aggregate information:

```json
GET /api/v1/scans/stats

{
  "total": 25,
  "by_status": {
    "active": 18,
    "paused": 5,
    "disabled": 2
  },
  "by_type": {
    "single": 15,
    "workflow": 10
  },
  "by_schedule": {
    "manual": 5,
    "daily": 8,
    "weekly": 10,
    "monthly": 2
  }
}
```

## Permissions

| Action | Admin | Member | Viewer |
|--------|-------|--------|--------|
| View scans | Yes | Yes | Yes |
| Create scans | Yes | Yes | No |
| Update scans | Yes | Yes | No |
| Delete scans | Yes | No | No |
| Trigger scans | Yes | Yes | No |
| Change status | Yes | Yes | No |

Permission IDs:
- `scans:read` - View scan configs and runs
- `scans:write` - Create/update scan configs
- `scans:delete` - Delete scan configs
- `scans:execute` - Trigger scans manually

## Best Practices

### Scheduling

1. **Stagger Scans**: Don't schedule all scans at the same time
2. **Off-Peak Hours**: Run heavy scans during low traffic
3. **Right Frequency**: Daily for critical, weekly for standard
4. **Time Zones**: Consider target time zones

### Configuration

1. **Use Asset Groups**: Group assets for easier management
2. **Pipeline for Complex**: Use pipelines for multi-step scans
3. **Single for Simple**: Use single scanner for focused scans
4. **Notifications**: Enable failure notifications always

### Monitoring

1. **Check Stats**: Regularly review scan statistics
2. **Review Failures**: Investigate failed scans promptly
3. **Adjust Schedules**: Optimize based on run duration
4. **Clean Up**: Disable or delete unused configs

{% endraw %}
