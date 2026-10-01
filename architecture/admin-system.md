---
layout: default
title: Admin System Architecture
parent: Architecture
nav_order: 16
---

# Admin System Architecture

## Overview

The Admin System provides platform-level administration capabilities for managing OpenCTEM infrastructure. It includes:

- **Admin User Management** - Super admins, ops admins, viewers
- **API Key Authentication** - Secure bcrypt-based authentication
- **Audit Logging** - Immutable trail of all admin actions
- **Bootstrap Process** - Initial super admin creation

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN SYSTEM                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Admin UI (admin-ui)                API Gateway                             │
│   ┌──────────────────┐               ┌──────────────────┐                   │
│   │ /login           │──────────────▶│ X-Admin-API-Key  │                   │
│   │ /admins          │               │ Authentication   │                   │
│   │ /audit-logs      │               └────────┬─────────┘                   │
│   │ /agents          │                        │                             │
│   │ /jobs            │                        ▼                             │
│   │ /tokens          │               ┌──────────────────┐                   │
│   └──────────────────┘               │ Admin Handlers   │                   │
│                                      │ ├─ User CRUD     │                   │
│                                      │ ├─ Audit Logs    │                   │
│                                      │ └─ Auth Validate │                   │
│                                      └────────┬─────────┘                   │
│                                               │                             │
│                                               ▼                             │
│                                      ┌──────────────────┐                   │
│                                      │  PostgreSQL      │                   │
│                                      │  ├─ admin_users  │                   │
│                                      │  └─ audit_logs   │                   │
│                                      └──────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Admin Roles (3-Level RBAC)

| Role | Description | Permissions |
|------|-------------|-------------|
| `super_admin` | Full access | Manage admins, agents, tokens, jobs, view audit |
| `ops_admin` | Operations | Manage agents, tokens, jobs, view audit |
| `viewer` | Read-only | View all resources, no modifications |

### Permission Matrix

| Action | Super Admin | Ops Admin | Viewer |
|--------|:-----------:|:---------:|:------:|
| Create/Delete Admins | ✓ | ✗ | ✗ |
| Update Admin Roles | ✓ | ✗ | ✗ |
| Manage Agents | ✓ | ✓ | ✗ |
| Manage Bootstrap Tokens | ✓ | ✓ | ✗ |
| Cancel Jobs | ✓ | ✓ | ✗ |
| View Audit Logs | ✓ | ✓ | ✓ |
| View All Resources | ✓ | ✓ | ✓ |

---

## API Key Authentication

### Key Format

```
Prefix:  oc-admin-
Length:  64 hex characters (32 bytes = 256 bits entropy)
Example: oc-admin-3c4f5a6b7c8d9e0f1a2b3c4d5e6f7g8h9i0j...
Storage: Bcrypt hash (cost factor 12)
```

### Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Request    │────▶│ Extract Key  │────▶│ Prefix       │
│ X-Admin-Key  │     │ from Header  │     │ Lookup (DB)  │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌──────────────┐     ┌──────▼───────┐
                     │ Set Context  │◀────│ Bcrypt       │
                     │ Allow Access │     │ Verify Hash  │
                     └──────────────┘     └──────────────┘
```

### Security Controls

| Control | Implementation |
|---------|----------------|
| **Hashing** | Bcrypt cost 12 (GPU-resistant) |
| **Entropy** | 256-bit random key |
| **Timing** | Constant-time comparison |
| **Lockout** | 10 failures → 30 min lock |
| **IP Tracking** | Last used IP recorded |

### Lockout Protection

```go
const (
    MaxFailedLoginAttempts = 10
    LockoutDuration        = 30 * time.Minute
)
```

---

## Admin User Entity

```go
type AdminUser struct {
    ID              string
    Email           string       // Unique, lowercase
    Name            string
    APIKeyHash      string       // Bcrypt hash
    APIKeyPrefix    string       // For identification
    Role            AdminRole    // super_admin, ops_admin, viewer
    IsActive        bool

    // Usage tracking
    LastUsedAt      *time.Time
    LastUsedIP      string

    // Lockout tracking
    FailedLoginCount int
    LockedUntil      *time.Time

    // Audit
    CreatedAt       time.Time
    CreatedBy       *string
    UpdatedAt       time.Time
}
```

---

## Audit Logging

### Design Principles

- **Immutable** - Logs cannot be modified or deleted
- **Asynchronous** - Non-blocking, doesn't slow requests
- **Comprehensive** - Captures all admin actions
- **Sanitized** - Secrets automatically redacted

### Audit Log Entity

```go
type AuditLog struct {
    ID              string
    AdminID         *string
    AdminEmail      string           // Preserved if admin deleted
    Action          string           // e.g., "admin.create"
    ResourceType    string           // e.g., "agent"
    ResourceID      *string
    ResourceName    string

    RequestMethod   string
    RequestPath     string
    RequestBody     map[string]any   // Secrets redacted
    ResponseStatus  int
    IPAddress       string
    UserAgent       string

    Success         bool
    ErrorMessage    string
    CreatedAt       time.Time
}
```

### Audit Actions

| Category | Actions |
|----------|---------|
| **Admin** | `admin.create`, `admin.update`, `admin.delete`, `admin.rotate_key` |
| **Agent** | `agent.create`, `agent.update`, `agent.delete`, `agent.enable`, `agent.disable` |
| **Token** | `token.create`, `token.revoke` |
| **Job** | `job.cancel` |
| **Auth** | `auth.success`, `auth.failure` |

### Sensitive Field Redaction

Automatically redacted in logs:
- `password`, `api_key`, `token`, `secret`
- `private_key`, `access_token`, `refresh_token`

---

## API Endpoints

### Authentication

```
GET /api/v1/admin/auth/validate
Header: X-Admin-API-Key: {api_key}

Response: { "admin": {...}, "role": "super_admin" }
```

### Admin Management

```
GET    /api/v1/admin/admins              # List (paginated)
GET    /api/v1/admin/admins/{id}         # Get details
POST   /api/v1/admin/admins              # Create (super_admin)
PATCH  /api/v1/admin/admins/{id}         # Update
DELETE /api/v1/admin/admins/{id}         # Delete (super_admin)
POST   /api/v1/admin/admins/{id}/rotate-key  # Rotate API key
```

### Audit Logs

```
GET /api/v1/admin/audit-logs             # List (filtered)
GET /api/v1/admin/audit-logs/{id}        # Get details
GET /api/v1/admin/audit-logs/stats       # Statistics

Query Parameters:
  - page, per_page                       # Pagination
  - admin_email, admin_id                # Filter by actor
  - action, resource_type                # Filter by type
  - success (true/false)                 # Filter by result
  - from, to (RFC3339)                   # Time range
```

---

## Admin UI

### Routes

| Route | Purpose |
|-------|---------|
| `/(auth)/login` | API key authentication |
| `/(dashboard)` | Main dashboard |
| `/(dashboard)/admins` | Admin user management |
| `/(dashboard)/audit-logs` | Audit log viewer |
| `/(dashboard)/agents` | Platform agents |
| `/(dashboard)/jobs` | Platform jobs |
| `/(dashboard)/tokens` | Bootstrap tokens |

### Features

**Admin Management:**
- Create/edit/delete admins (super_admin only)
- Rotate API keys
- Activate/deactivate accounts
- Role assignment

**Audit Log Viewer:**
- Filter by date range, action, actor, resource
- Search across logs
- View detailed request/response info
- Export capabilities

---

## Bootstrap Process

### CLI Tool

```bash
# Create first super admin
./bootstrap-admin \
  -db=postgres://user:pass@localhost.openctem \
  -email=admin@example.com \
  -role=super_admin

# With specific API key
./bootstrap-admin \
  -db=$DATABASE_URL \
  -email=admin@example.com \
  -api-key=$BOOTSTRAP_ADMIN_KEY

# Environment variables
DATABASE_URL=postgres://... \
ADMIN_EMAIL=admin@example.com \
./bootstrap-admin
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-db` | Database URL | `$DATABASE_URL` |
| `-email` | Admin email | `$ADMIN_EMAIL` (required) |
| `-name` | Display name | Email prefix |
| `-api-key` | Specific key | Random generated |
| `-role` | Admin role | `super_admin` |
| `-force` | Overwrite existing | `false` |

---

## Database Schema

### admin_users

```sql
CREATE TABLE admin_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    api_key_hash TEXT NOT NULL,
    api_key_prefix VARCHAR(32) NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    last_used_at TIMESTAMP,
    last_used_ip VARCHAR(45),
    failed_login_count INTEGER DEFAULT 0,
    locked_until TIMESTAMP,

    created_at TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_admin_users_api_key_prefix ON admin_users(api_key_prefix);
```

### admin_audit_logs

```sql
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY,
    admin_id UUID,
    admin_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    resource_name VARCHAR(255),

    request_method VARCHAR(10),
    request_path VARCHAR(500),
    request_body JSONB,
    response_status INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,

    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON admin_audit_logs(action);
```

---

## Security Best Practices

### Self-Modification Protections

Admins cannot:
- Delete their own account
- Deactivate their own account
- Demote themselves (change own role)

### IP Address Handling

```go
// Always use RemoteAddr as authoritative source
// Cannot be spoofed by client
ip := r.RemoteAddr

// X-Forwarded-For only trusted from configured proxy IPs
```

### Error Messages

Generic messages prevent information leakage:
```go
// BAD: Reveals admin exists
"Admin with this email is inactive"

// GOOD: Generic
"Invalid API key"
```

---

## Related Documentation

- [Access Control](access-control-flows-and-data.md)
- [Production Deployment](../operations/PRODUCTION_DEPLOYMENT.md)
