---
layout: default
title: Admin UI User Guide
parent: Admin UI
nav_order: 1
---

# Admin UI User Guide

Complete guide for using the OpenCTEM Platform Admin UI to manage platform agents, jobs, tokens, and administrators.

---

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Dashboard](#dashboard)
- [Agents Management](#agents-management)
- [Jobs Management](#jobs-management)
- [Bootstrap Tokens](#bootstrap-tokens)
- [Admin Users](#admin-users)
- [Audit Logs](#audit-logs)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Overview

The Admin UI is a web-based management console for platform administrators. It provides:

- **Real-time Monitoring**: Live dashboard with platform statistics
- **Agent Management**: View, drain, and delete platform agents
- **Job Queue Management**: Monitor and manage platform scan jobs
- **Token Management**: Create and revoke bootstrap tokens for agent registration
- **Admin Management**: Manage platform administrator accounts (super_admin only)
- **Audit Logging**: View all administrative actions for compliance

### Role-Based Access

| Role | Dashboard | Agents | Jobs | Tokens | Admins | Audit |
|------|-----------|--------|------|--------|--------|-------|
| `super_admin` | View | Full | Full | Full | Full | View |
| `ops_admin` | View | Full | Full | Full | Read | View |
| `viewer` | View | Read | Read | Read | Read | View |

---

## Getting Started

### Accessing the Admin UI

1. Navigate to your Admin UI URL (e.g., `https://admin.openctem.io`)
2. Enter your API key on the login page
3. Click "Sign In"

### Obtaining an API Key

API keys are created when bootstrapping an admin account. Choose one method:

**Method 1: Using Setup Makefile (Recommended)**

```bash
cd setup

# Staging
make bootstrap-admin-staging email=admin@yourcompany.com

# Production
make bootstrap-admin-prod email=admin@yourcompany.com

# With specific role
make bootstrap-admin-staging email=ops@yourcompany.com role=ops_admin
```

**Method 2: Using Docker Compose**

```bash
# From the API directory
docker compose exec api ./bootstrap-admin \
  -email "admin@yourcompany.com" \
  -role "super_admin"
```

**Method 3: Using Admin CLI**

```bash
# Create admin via CLI (requires existing admin API key)
openctem-admin create admin --email=you@company.com --role=ops_admin
```

**Output:**

```
=== Bootstrap Admin Created ===
  ID:    550e8400-e29b-41d4-a716-446655440000
  Email: admin@yourcompany.com
  Role:  super_admin

API Key (save this, it won't be shown again):
  oc-admin-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

> **Important**: API keys are shown only once. Store them securely.

---

## Dashboard

The dashboard provides a real-time overview of platform health.

### Statistics Cards

| Metric | Description |
|--------|-------------|
| **Total Agents** | All registered platform agents (online/offline) |
| **Jobs Today** | Jobs processed in last 24 hours |
| **Success Rate** | Percentage of completed vs failed jobs |
| **Active Tenants** | Tenants with jobs in queue |
| **Avg Duration** | Average job execution time |
| **Throughput** | Jobs per minute rate |

### Recent Activity

- **Recent Agents**: Last 5 agents to report heartbeat
- **Recent Jobs**: Last 5 jobs created or updated

### Auto-Refresh

- Dashboard refreshes automatically every **30 seconds**
- Click the refresh icon for immediate update

---

## Agents Management

### Agent List

Navigate to **Agents** in the sidebar to view all platform agents.

**Columns:**
- **Name**: Agent identifier
- **Status**: online, offline, draining, unhealthy
- **Region**: Deployment region (e.g., us-east-1)
- **Jobs**: Current jobs / max concurrent jobs
- **Resources**: CPU and memory usage
- **Last Heartbeat**: Time since last heartbeat

**Filters:**
- Status: Filter by agent status
- Region: Filter by deployment region

### Agent Details

Click on an agent name to view detailed information:

- **Overview**: Status, version, region, job counts
- **Resource Usage**: CPU, memory, disk with progress bars
- **Capabilities**: Installed scanners (sast, sca, secrets, etc.)
- **Metadata**: ID, registration date, last update

### Agent Operations

| Action | Description | Availability |
|--------|-------------|--------------|
| **Drain** | Stop accepting new jobs | Online agents only |
| **Uncordon** | Resume accepting jobs | Drained agents only |
| **Delete** | Remove agent permanently | All agents |

**To drain an agent:**
1. Click the **...** menu on the agent row
2. Select **Drain**
3. Confirm the action

**To uncordon (resume) an agent:**
1. Click the **...** menu on the agent row
2. Select **Uncordon**

**To delete an agent:**
1. Click the **...** menu on the agent row
2. Select **Delete**
3. Type the agent name to confirm
4. Click **Delete**

---

## Jobs Management

### Job List

Navigate to **Jobs** in the sidebar to view platform jobs.

**Columns:**
- **Scanner**: Type of scan (sast, sca, secrets)
- **Target**: Repository or target being scanned
- **Status**: Job status with color indicator
- **Progress**: Progress bar for running jobs
- **Agent**: Assigned agent (if any)
- **Tenant**: Tenant that requested the scan
- **Created**: Job creation time

**Filters:**
- Status: pending, queued, assigned, running, completed, failed, cancelled, timeout

### Job Status Colors

| Status | Color | Description |
|--------|-------|-------------|
| `pending` | Yellow | Waiting to be queued |
| `queued` | Blue | In queue, waiting for agent |
| `assigned` | Blue | Agent assigned, starting |
| `running` | Blue | Currently executing |
| `completed` | Green | Successfully finished |
| `failed` | Red | Finished with error |
| `cancelled` | Gray | Cancelled by user/admin |
| `timeout` | Orange | Exceeded timeout limit |

### Job Details

Click on a job row to view detailed information:

- **Header**: Scanner, target, current status
- **Progress**: For running jobs, shows completion percentage
- **Queue Position**: For queued jobs, shows position in queue
- **Error**: For failed jobs, shows error message
- **Statistics**: Type, priority, timeout, assigned agent
- **Timeline**: Created, started, completed timestamps

### Job Operations

| Action | Description | Availability |
|--------|-------------|--------------|
| **Cancel** | Stop job execution | pending, queued, running |
| **Retry** | Re-queue failed job | failed, timeout |

**To cancel a job:**
1. Open job details or click **...** menu
2. Select **Cancel**
3. Confirm the action

**To retry a failed job:**
1. Open job details or click **...** menu
2. Select **Retry**
3. Job will be re-queued with same parameters

### Auto-Refresh

- Job list refreshes every **10 seconds**
- Job details page refreshes every **5 seconds** (for running/queued jobs)

---

## Bootstrap Tokens

Bootstrap tokens are one-time use tokens for registering new platform agents.

### Token List

Navigate to **Tokens** in the sidebar.

**Columns:**
- **Token Prefix**: First characters of token (masked)
- **Description**: Optional description
- **Status**: active, expired, exhausted
- **Uses**: Current uses / max uses
- **Expires**: Time until expiration
- **Created**: Creation timestamp

### Creating a Token

1. Click **Create Token** button
2. Fill in the form:
   - **Description** (optional): e.g., "US East region deployment"
   - **Max Uses**: 1, 5, 10, 25, 50, or 100
   - **Expires In**: 1h, 6h, 24h, 3d, or 1w
3. Click **Create**
4. **Copy the token immediately** - it won't be shown again!

### Using a Token

After creating a token, use it to register a platform agent:

```bash
./agent -platform \
  -bootstrap-token=<full-token> \
  -api-url=https://api.openctem.io \
  -region=us-east-1
```

### Token States

| State | Description |
|-------|-------------|
| **Active** | Token can be used for registration |
| **Expired** | Token has passed its expiration time |
| **Exhausted** | Token has reached max uses |
| **Revoked** | Token was manually revoked |

### Revoking a Token

1. Click the **...** menu on the token row
2. Select **Revoke**
3. Confirm the action

Revoked tokens cannot be used, even if uses remain.

---

## Admin Users

> **Note**: Admin management is only available to `super_admin` users.

### Admin List

Navigate to **Admins** in the sidebar.

**Columns:**
- **Name**: Admin display name
- **Email**: Admin email address
- **Role**: super_admin, ops_admin, viewer
- **Status**: Active or Inactive
- **Last Login**: Last login timestamp
- **Created**: Account creation date

### Creating an Admin

1. Click **Create Admin** button
2. Fill in the form:
   - **Email**: Admin email address
   - **Name**: Display name
   - **Role**: super_admin, ops_admin, or viewer
3. Click **Create**
4. **Copy the API key immediately** - it won't be shown again!

### Admin Roles

| Role | Description |
|------|-------------|
| `super_admin` | Full access to all features including admin management |
| `ops_admin` | Manage agents, tokens, jobs; cannot manage admins |
| `viewer` | Read-only access to all resources |

### Admin Operations

| Action | Description |
|--------|-------------|
| **Rotate API Key** | Generate new key, invalidate old one |
| **Activate/Deactivate** | Enable or disable admin access |
| **Delete** | Permanently remove admin account |

**To rotate an API key:**
1. Click the **...** menu on the admin row
2. Select **Rotate API Key**
3. **Copy the new API key immediately**
4. Update CLI/scripts with new key

---

## Audit Logs

The audit log provides a complete history of all administrative actions.

### Viewing Logs

Navigate to **Audit Logs** in the sidebar.

**Columns:**
- **Time**: When the action occurred
- **Action**: Type of action performed
- **Actor**: Who performed the action (admin, agent, system)
- **Resource**: Target of the action
- **IP Address**: Source IP
- **Details**: Click to view full details

### Filtering Logs

Click the **Filter** button to open the filter panel:

- **Date Range**: Last 24h, 7d, 30d, 90d, All time
- **Action**: Filter by action type
- **Actor Type**: admin, agent, system
- **Resource Type**: agent, job, token, admin

### Action Categories

| Category | Actions |
|----------|---------|
| **Agent** | register, heartbeat, drain, uncordon, delete |
| **Job** | create, assign, complete, fail, cancel, timeout |
| **Token** | create, use, revoke |
| **Admin** | create, update, delete, login, rotate_key |

### Log Details

Click on a log row to view detailed information:

- **Action**: What was done
- **Actor**: Who did it (with icon by type)
- **Resource**: What was affected
- **Request Metadata**: IP address, user agent
- **Details**: Full JSON payload of the action
- **Log ID**: Unique identifier for reference

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `R` | Refresh current page |
| `G` then `D` | Go to Dashboard |
| `G` then `A` | Go to Agents |
| `G` then `J` | Go to Jobs |
| `G` then `T` | Go to Tokens |
| `/` | Focus search (where available) |

---

## Troubleshooting

### Login Issues

**"Invalid API key" error:**
- Verify the API key is correct (no extra spaces)
- Check if the key has been rotated
- Confirm admin account is active

**Session expired:**
- API keys don't expire, but sessions do
- Re-enter your API key to continue

### Data Not Loading

**Dashboard shows no data:**
- Check network connectivity
- Verify API URL is correct
- Look for errors in browser console

**Agents showing as offline:**
- This may be accurate - check agent health
- Agents are marked offline after missing heartbeats

### Permission Errors

**"Insufficient permissions" error:**
- Verify your role has access to the feature
- Contact a super_admin to adjust your role

---

## Related Documentation

- [Platform Admin CLI](../guides/platform-admin.md) - Command-line administration
- [Running Platform Agents](../guides/running-agents.md) - Agent setup guide
- [Platform Agents Feature](../features/platform-agents.md) - Feature overview
