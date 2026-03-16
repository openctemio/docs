# User In-App Notification System

**Created:** 2026-03-12
**Status:** COMPLETED
**Author:** Platform Team
**Migration:** 000084

---

## Overview

Scalable user-facing notification system (bell icon) with fan-out-on-read architecture. Supports tenant-wide, group-scoped, and user-targeted notifications with real-time WebSocket delivery and SWR polling fallback.

**Two independent notification systems coexist:**

```
                    Event occurs
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
    pkg/domain/outbox/          pkg/domain/notification/
    (Slack, Teams, Email)       (In-app bell icon)
         │                            │
         ▼                            ▼
    ┌─────────┐               ┌──────────────┐
    │ Workers │               │ WebSocket    │
    │ process │               │ push to      │
    │ queue   │               │ browser      │
    └────┬────┘               └──────────────┘
         │
    ┌────┴────┐
    │ Slack   │
    │ Teams   │
    │ Email   │
    │ Webhook │
    └─────────┘
```

**Package Rename:** The original `notification` package (outbox dispatch) was renamed to `outbox` (`pkg/domain/outbox/`, `internal/app/outbox_service.go`). The new user notification system took the `notification` name.

---

## Architecture: Fan-out on Read + Watermark

### Why NOT fan-out on write

Fan-out on write (1 row per user per event) causes:
- 50 users × 200 events/day = 10,000 rows/day per tenant
- 100 tenants = 1M rows/day, 30M/month
- "Mark all as read" inserts N rows

### Fan-out on read (chosen approach)

- **1 row per event** in `notifications` table (shared)
- **Audience scope** determines who sees it at query time
- **Watermark** for "mark all as read" — 1 UPDATE instead of N INSERTs
- **Sparse reads table** — only stores individual read actions

**Data volume comparison (100 tenants × 50 users × 200 events/day):**

| | Fan-out write | Fan-out read |
|---|---|---|
| notifications rows/day | — | 20,000 |
| user_notifications rows/day | 1,000,000 | — |
| notification_reads rows/day | — | ~100,000 |
| **Total/day** | **1,000,000** | **120,000** |
| **30-day retention** | 30M | 3.6M |
| Mark all as read | Insert N rows | **Update 1 row** |

---

## Database Schema (migration 000084)

### Table 1: `notifications` (shared, 1 row per event)

```sql
CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    audience          VARCHAR(10) NOT NULL DEFAULT 'all',
    audience_id       UUID,                          -- NOTE: UUID type, never cast to ::text
    notification_type VARCHAR(50) NOT NULL,
    title             VARCHAR(500) NOT NULL,
    body              TEXT,
    severity          VARCHAR(20) NOT NULL DEFAULT 'info',
    resource_type     VARCHAR(50),
    resource_id       UUID,
    url               VARCHAR(1000),                 -- Relative paths only (open redirect prevention)
    actor_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notification_audience
        CHECK (audience IN ('all', 'group', 'user')),
    CONSTRAINT chk_notification_severity
        CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    CONSTRAINT chk_notification_audience_id
        CHECK (
            (audience = 'all' AND audience_id IS NULL) OR
            (audience IN ('group', 'user') AND audience_id IS NOT NULL)
        )
);

CREATE INDEX idx_notifications_tenant_feed
    ON notifications (tenant_id, created_at DESC);
CREATE INDEX idx_notifications_audience
    ON notifications (tenant_id, audience, audience_id, created_at DESC)
    WHERE audience != 'all';
CREATE INDEX idx_notifications_cleanup
    ON notifications (created_at)
    WHERE created_at < NOW() - INTERVAL '30 days';
```

**Audience values:**
- `all` — all tenant members see this (audience_id = NULL)
- `group` — only members of group audience_id
- `user` — only user audience_id

### Table 2: `notification_reads` (sparse)

```sql
CREATE TABLE notification_reads (
    notification_id   UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
);
```

### Table 3: `notification_state` (watermark, 1 per user per tenant)

```sql
CREATE TABLE notification_state (
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_all_at  TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01',
    PRIMARY KEY (tenant_id, user_id)
);
```

### Table 4: `notification_preferences` (1 per user per tenant)

```sql
CREATE TABLE notification_preferences (
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    in_app_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    email_digest      VARCHAR(20) NOT NULL DEFAULT 'none',
    muted_types       JSONB,
    min_severity      VARCHAR(20),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, user_id)
);
```

---

## Core Queries

### User's notification feed (single query with COUNT(*) OVER())

```sql
SELECT
    n.id, n.tenant_id, n.audience, n.audience_id,
    n.notification_type, n.title, n.body, n.severity,
    n.resource_type, n.resource_id, n.url,
    n.actor_id, n.created_at,
    (nr.notification_id IS NOT NULL
     OR n.created_at <= COALESCE(ns.last_read_all_at, '1970-01-01'::timestamptz)
    ) AS is_read,
    COUNT(*) OVER() AS total_count
FROM notifications n
LEFT JOIN notification_reads nr
    ON nr.notification_id = n.id AND nr.user_id = $2
LEFT JOIN notification_state ns
    ON ns.tenant_id = $1 AND ns.user_id = $2
WHERE n.tenant_id = $1
  AND n.created_at > NOW() - INTERVAL '30 days'
  AND (
      n.audience = 'all'
      OR (n.audience = 'user'  AND n.audience_id = $2)
      OR (n.audience = 'group' AND n.audience_id IN (
          SELECT g.id FROM groups g
          INNER JOIN group_members gm ON gm.group_id = g.id
          WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.is_active = true
      ))
  )
ORDER BY n.created_at DESC
LIMIT $3 OFFSET $4;
```

**Key optimizations:**
- `COUNT(*) OVER()` window function returns total count in same query (no separate COUNT query)
- Group membership resolved via SQL subquery (no separate DB roundtrip to fetch group IDs)
- 30-day sliding window keeps query fast

### Unread count (badge)

```sql
SELECT COUNT(*)
FROM notifications n
LEFT JOIN notification_reads nr
    ON nr.notification_id = n.id AND nr.user_id = $2
LEFT JOIN notification_state ns
    ON ns.tenant_id = $1 AND ns.user_id = $2
WHERE n.tenant_id = $1
  AND n.created_at > COALESCE(ns.last_read_all_at, '1970-01-01'::timestamptz)
  AND nr.notification_id IS NULL
  AND n.created_at > NOW() - INTERVAL '30 days'
  AND (
      n.audience = 'all'
      OR (n.audience = 'user'  AND n.audience_id = $2)
      OR (n.audience = 'group' AND n.audience_id IN (
          SELECT g.id FROM groups g
          INNER JOIN group_members gm ON gm.group_id = g.id
          WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.is_active = true
      ))
  );
```

### Mark all as read (O(1) watermark)

```sql
INSERT INTO notification_state (tenant_id, user_id, last_read_all_at)
VALUES ($1, $2, NOW())
ON CONFLICT (tenant_id, user_id)
DO UPDATE SET last_read_all_at = NOW();
```

### Mark one as read (tenant-isolated)

```sql
INSERT INTO notification_reads (notification_id, user_id)
SELECT $1, $2
FROM notifications
WHERE id = $1 AND tenant_id = $3
ON CONFLICT DO NOTHING;
```

---

## API Endpoints

```
GET    /api/v1/notifications              — Feed (page, per_page, severity, type, is_read)
GET    /api/v1/notifications/unread-count — Badge count ({ count: N })
PATCH  /api/v1/notifications/{id}/read   — Mark one read (tenant-isolated)
POST   /api/v1/notifications/read-all    — Watermark update (mark all read)
GET    /api/v1/notifications/preferences — Get user preferences
PUT    /api/v1/notifications/preferences — Update preferences (64KB body limit)
```

**Permissions:** All endpoints require JWT authentication. User can only see/manage their own notifications. No additional RBAC permission needed (personal scope).

**Security:**
- `http.MaxBytesReader(64KB)` on preferences update to prevent memory exhaustion
- URL field must be relative path (starts with `/`) — prevents open redirect
- MarkAsRead verifies tenant ownership via subquery
- SWR cache invalidation scoped to exclude `/integrations/` path

---

## Notification Types & Audience Matrix

| Event | Type | Audience | Severity | Triggered by |
|-------|------|----------|----------|-------------|
| Critical/High finding created | `finding_new` | `all` | matches finding | VulnerabilityService.Create |
| Medium/Low finding created | `finding_new` | `group` (asset group) | matches finding | VulnerabilityService.Create |
| Finding assigned | `finding_assigned` | `user` (assignee) | medium | *Future* |
| Finding status changed | `finding_status_change` | `user` (assignee) | info | *Future* |
| Scan completed | `scan_completed` | `all` | info | *Future* |
| Scan failed | `scan_failed` | `user` (creator) | high | *Future* |
| Asset discovered | `asset_discovered` | `all` | low | *Future* |
| Member joined | `member_joined` | `all` | info | *Future* |
| Role changed | `role_changed` | `user` (affected) | info | *Future* |
| SLA breach | `sla_breach` | `all` | critical | *Future* |
| System alert | `system_alert` | `all` | varies | *Future* |

Currently only `finding_new` is wired via `VulnerabilityService.SetUserNotificationService()`.

---

## WebSocket Real-time Push

Backend broadcasts to tenant channel on notification creation. Frontend bell component subscribes and revalidates SWR cache:

```typescript
useTenantChannel(currentTenant?.id ?? null, {
  onData: useCallback((data: Record<string, unknown>) => {
    if (data?.type === 'notification') {
      mutateNotifications()
      mutateUnreadCount()
    }
  }, [mutateNotifications, mutateUnreadCount]),
})
```

SWR polling (30s) serves as fallback when WebSocket is disconnected.

---

## Auto-cleanup

Background ticker in `cmd/server/workers.go`:
- Runs daily
- Deletes notifications older than **90 days** (queries limited to 30-day sliding window)
- 5-minute timeout per run
- CASCADE deletes `notification_reads` automatically

---

## Backend File Structure

```
api/
├── pkg/domain/notification/
│   ├── entity.go              # Notification entity + Preferences + Reconstitute()
│   ├── repository.go          # Repository interface
│   └── errors.go              # ErrNotificationNotFound, etc.
│
├── internal/app/
│   └── notification_service.go
│       # Notify()            — create + WebSocket push + URL sanitization
│       # ListNotifications() — paginated feed with read status
│       # GetUnreadCount()    — badge count
│       # MarkAsRead()        — single notification (tenant-isolated)
│       # MarkAllAsRead()     — watermark update
│       # GetPreferences()    — user preferences (defaults if no row)
│       # UpdatePreferences() — validate + delegate
│       # CleanupOld()        — delete notifications older than N days
│
├── internal/infra/postgres/
│   └── notification_repository.go
│       # Create(), List() (COUNT(*) OVER()), UnreadCount()
│       # MarkAsRead() (tenant ownership check), MarkAllAsRead()
│       # DeleteOlderThan(), GetPreferences(), UpsertPreferences()
│
├── internal/infra/http/handler/
│   └── notification_handler.go    # 6 endpoints, 64KB body limit
│
├── cmd/server/
│   ├── services.go                # NotificationService wiring
│   └── workers.go                 # NotificationCleanupTicker (daily, 90-day)
│
└── migrations/
    ├── 000084_user_notifications.up.sql
    └── 000084_user_notifications.down.sql
```

## Frontend File Structure

```
ui/src/
├── features/notifications/
│   └── api/
│       └── use-notification-api.ts    # All hooks, mutations, cache utils, types
│
├── components/
│   └── notification-bell.tsx          # Real API + WebSocket + mark-as-read
│
├── lib/api/
│   └── endpoints.ts                   # notificationEndpoints
│
└── app/(dashboard)/
    ├── notifications/page.tsx         # Full inbox: pagination, severity/read filters
    └── settings/notifications/page.tsx # Preferences wired to real API
```

---

## JSON Response Format

Backend `NotificationResponse` uses these field names (matching frontend `UserNotification` type):

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "audience": "all",
  "audience_id": "uuid",
  "notification_type": "finding_new",
  "title": "Critical finding: SQL Injection",
  "body": "Found in login endpoint",
  "severity": "critical",
  "resource_type": "finding",
  "resource_id": "uuid",
  "url": "/findings/uuid",
  "actor_id": "uuid",
  "is_read": false,
  "created_at": "2026-03-12T10:00:00Z"
}
```

**Important:** Fields are `notification_type` (not `type`) and `url` (not `link`).

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Query performance with large feed | Slow page load | 30-day sliding window + indexes + LIMIT + COUNT(*) OVER() |
| Notification flood from bulk operations | 1000 findings = 1000 notifications | *Future: dedup max 1 per type/resource/5min* |
| WebSocket not connected | User misses real-time updates | SWR polling as fallback (30s interval) |
| User in many groups → large IN clause | Slow audience matching | Subquery resolved in SQL, no separate roundtrip |
| Clock skew with watermark | Read/unread inconsistency | Use database NOW(), not app time |

---

## Tests

- **47 unit tests**: `api/tests/unit/notification_service_test.go`
  - 9 domain entity tests (validation, reconstitute, defaults)
  - 27 service tests (all audience types, CRUD, preferences, cleanup, URL sanitization)
  - 3 validation tests (severity, audience, preferences)
- **16-case bash API test script**: `api/tests/scripts/test_notification_api.sh`
  - All 6 endpoints + auth, validation, pagination, edge cases

---

## Known Bug Fixes

1. **UUID type mismatch**: `audience_id` column is UUID — never cast to `::text` in SQL comparisons
2. **JSON field name mismatch**: Backend used `"type"`/`"link"` but frontend expected `"notification_type"`/`"url"`
3. **SWR cache over-invalidation**: Cache invalidation scoped to exclude `/integrations/` path

---

## Future Work

- Server-side preferences enforcement (filter by muted_types, min_severity in List/UnreadCount)
- Additional event hooks (scan_completed, member_joined, role_changed, sla_breach)
- Notification dedup/rate limiting (max 1 per type/resource/5min)
- Actor enrichment (LEFT JOIN users on actor_id for name/avatar)
- Toast for critical/high severity notifications
- Email digest delivery (daily/weekly summary emails)
- Browser push notifications (Web Push API)
- Notification grouping/batching
- Mobile push notifications
