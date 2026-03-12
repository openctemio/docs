# User In-App Notification System

**Created:** 2026-03-12
**Status:** PROPOSED
**Priority:** P0
**Author:** Platform Team
**Last Updated:** 2026-03-12

---

## Summary

Implement a scalable user-facing notification system (bell icon) with fan-out-on-read architecture. Currently the notification bell uses hardcoded mock data. The integration notification system (Slack, Teams, Email, Webhook) is fully functional but the user in-app notification layer does not exist.

---

## Problem Statement

1. **Bell icon shows fake data** — `notification-bell.tsx` has 5 hardcoded mock notifications
2. **No backend for user notifications** — no table, no API, no service
3. **Settings page is fake** — `/settings/notifications` preferences use `setTimeout` mock
4. **Insights page is fake** — `/insights/notifications` dashboard shows mock charts
5. **No tenant-wide notifications** — system can't broadcast to all tenant members
6. **No real-time delivery** — WebSocket exists but isn't wired to notifications

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

## Database Schema

### Table 1: `notifications` (shared, 1 row per event)

```sql
CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Audience scoping
    audience          VARCHAR(10) NOT NULL DEFAULT 'all',
    audience_id       UUID,

    -- Content
    notification_type VARCHAR(50) NOT NULL,
    title             VARCHAR(500) NOT NULL,
    body              TEXT,
    severity          VARCHAR(20) NOT NULL DEFAULT 'info',

    -- Resource link
    resource_type     VARCHAR(50),
    resource_id       UUID,
    url               VARCHAR(1000),

    -- Actor
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

Only stores reads AFTER the user's watermark. Kept small.

### Table 3: `notification_state` (watermark, 1 per user)

```sql
CREATE TABLE notification_state (
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_all_at  TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01',
    PRIMARY KEY (tenant_id, user_id)
);
```

"Mark all as read" = UPDATE this timestamp. Everything before it is considered read.

### Table 4: `notification_preferences` (1 per user)

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

### User's notification feed

```sql
SELECT
    n.id, n.notification_type, n.title, n.body, n.severity,
    n.resource_type, n.resource_id, n.url,
    n.actor_id, n.created_at,
    (nr.notification_id IS NOT NULL
     OR n.created_at <= COALESCE(ns.last_read_all_at, '1970-01-01')
    ) AS is_read
FROM notifications n
LEFT JOIN notification_reads nr
    ON nr.notification_id = n.id AND nr.user_id = $user_id
LEFT JOIN notification_state ns
    ON ns.tenant_id = $tenant_id AND ns.user_id = $user_id
WHERE n.tenant_id = $tenant_id
  AND n.created_at > NOW() - INTERVAL '30 days'
  AND (
      n.audience = 'all'
      OR (n.audience = 'user'  AND n.audience_id = $user_id)
      OR (n.audience = 'group' AND n.audience_id = ANY($group_ids))
  )
ORDER BY n.created_at DESC
LIMIT $limit OFFSET $offset;
```

### Unread count (badge)

```sql
SELECT COUNT(*)
FROM notifications n
LEFT JOIN notification_reads nr
    ON nr.notification_id = n.id AND nr.user_id = $user_id
LEFT JOIN notification_state ns
    ON ns.tenant_id = $tenant_id AND ns.user_id = $user_id
WHERE n.tenant_id = $tenant_id
  AND n.created_at > COALESCE(ns.last_read_all_at, '1970-01-01')
  AND nr.notification_id IS NULL
  AND n.created_at > NOW() - INTERVAL '30 days'
  AND (
      n.audience = 'all'
      OR (n.audience = 'user'  AND n.audience_id = $user_id)
      OR (n.audience = 'group' AND n.audience_id = ANY($group_ids))
  );
```

### Mark all as read (O(1) watermark)

```sql
INSERT INTO notification_state (tenant_id, user_id, last_read_all_at)
VALUES ($tenant_id, $user_id, NOW())
ON CONFLICT (tenant_id, user_id)
DO UPDATE SET last_read_all_at = NOW();
```

### Mark one as read

```sql
INSERT INTO notification_reads (notification_id, user_id)
VALUES ($notification_id, $user_id)
ON CONFLICT DO NOTHING;
```

---

## API Endpoints

```
GET    /api/v1/notifications                   -- Feed (paginated)
       ?severity=critical,high
       ?type=finding_new,scan_completed
       ?is_read=false
       ?limit=20&offset=0

GET    /api/v1/notifications/unread-count      -- Badge number (integer)

PATCH  /api/v1/notifications/{id}/read         -- Mark one read

POST   /api/v1/notifications/read-all          -- Watermark update (mark all read)

GET    /api/v1/notifications/preferences       -- Get user preferences
PUT    /api/v1/notifications/preferences       -- Update preferences
```

**Permissions:**
- All endpoints require authentication (JWT)
- User can only see/manage their own notifications
- No additional RBAC permission needed (personal scope)

---

## Notification Types & Audience Matrix

| Event | Type | Audience | Severity | Triggered by |
|-------|------|----------|----------|-------------|
| Critical/High finding created | `finding_new` | `all` | matches finding | VulnerabilityService.Create |
| Medium/Low finding created | `finding_new` | `group` (asset group) | matches finding | VulnerabilityService.Create |
| Finding assigned | `finding_assigned` | `user` (assignee) | medium | VulnerabilityService.Assign |
| Finding status changed | `finding_status_change` | `user` (assignee) | info | VulnerabilityService.UpdateStatus |
| Scan completed | `scan_completed` | `all` | info | ScanService.Complete |
| Scan failed | `scan_failed` | `user` (creator) | high | ScanService.Fail |
| Asset discovered | `asset_discovered` | `all` | low | AssetService.Create |
| Member joined | `member_joined` | `all` | info | TenantService.AddMember |
| Role changed | `role_changed` | `user` (affected) | info | RoleService.AssignRole |
| SLA breach | `sla_breach` | `all` | critical | SLAService.CheckBreach |
| System alert | `system_alert` | `all` | varies | Various |

---

## WebSocket Real-time Push

When a notification is created, push it via existing WebSocket:

```go
func (s *UserNotificationService) Notify(ctx context.Context, input NotifyInput) error {
    // 1. Check preferences (is this type muted? below min severity?)
    // 2. Insert into notifications table
    // 3. Push via WebSocket based on audience

    notif, err := s.repo.Create(ctx, input)
    if err != nil {
        return err
    }

    switch input.Audience {
    case AudienceAll:
        s.wsHub.BroadcastToChannel(
            fmt.Sprintf("tenant:%s", input.TenantID),
            WSMessage{Type: "notification:new", Data: notif},
        )
    case AudienceUser:
        s.wsHub.SendToUser(input.TenantID, input.AudienceID,
            WSMessage{Type: "notification:new", Data: notif},
        )
    case AudienceGroup:
        s.wsHub.BroadcastToChannel(
            fmt.Sprintf("group:%s", input.AudienceID),
            WSMessage{Type: "notification:new", Data: notif},
        )
    }

    return nil
}
```

Frontend WebSocket handler:

```typescript
// In notification-bell.tsx or a dedicated hook
useTenantChannel<NotificationEvent>(tenantId, {
  onData: (event) => {
    if (event.type === 'notification:new') {
      // Increment badge count
      mutateUnreadCount(prev => prev + 1)
      // Prepend to notification list
      mutateNotifications(prev => [event.data, ...prev])
      // Optional: show toast for critical/high
      if (['critical', 'high'].includes(event.data.severity)) {
        toast(event.data.title)
      }
    }
  }
})
```

---

## Auto-cleanup

Background job (daily via existing controller):

```go
func (s *UserNotificationService) Cleanup(ctx context.Context) error {
    // Delete notifications older than 30 days
    deleted, err := s.repo.DeleteOlderThan(ctx, 30*24*time.Hour)
    // CASCADE deletes notification_reads automatically
    s.logger.Info("notification cleanup", "deleted", deleted)
    return err
}
```

---

## Backend File Structure

```
api/
├── pkg/domain/usernotification/
│   ├── entity.go              # Notification entity + NotificationPreferences
│   ├── notification_type.go   # Type constants (finding_new, scan_completed, etc.)
│   ├── audience.go            # Audience constants (all, group, user)
│   ├── repository.go          # Repository interface
│   └── errors.go              # ErrNotificationNotFound, etc.
│
├── internal/app/
│   └── user_notification_service.go
│       # Notify()          — create + WebSocket push
│       # List()            — paginated feed with read status
│       # UnreadCount()     — badge count
│       # MarkAsRead()      — single notification
│       # MarkAllAsRead()   — watermark update
│       # GetPreferences()  — user preferences
│       # UpdatePreferences() — save preferences
│       # Cleanup()         — delete old notifications
│
├── internal/infra/postgres/
│   └── user_notification_repository.go
│       # Create()
│       # List()            — core feed query with JOINs
│       # UnreadCount()     — count query
│       # MarkAsRead()      — INSERT into notification_reads
│       # MarkAllAsRead()   — UPSERT notification_state
│       # DeleteOlderThan() — cleanup
│       # GetPreferences()
│       # UpsertPreferences()
│
├── internal/infra/http/handler/
│   └── user_notification_handler.go
│       # List()            — GET /notifications
│       # UnreadCount()     — GET /notifications/unread-count
│       # MarkAsRead()      — PATCH /notifications/{id}/read
│       # MarkAllAsRead()   — POST /notifications/read-all
│       # GetPreferences()  — GET /notifications/preferences
│       # UpdatePreferences() — PUT /notifications/preferences
│
├── internal/infra/http/routes/
│   └── notifications.go       # Route registration
│
└── migrations/
    └── 000084_user_notifications.up.sql
    └── 000084_user_notifications.down.sql
```

## Frontend File Structure

```
ui/src/
├── features/notifications/
│   ├── api/
│   │   ├── use-user-notifications.ts      # useNotifications(), useUnreadCount()
│   │   ├── use-notification-actions.ts    # useMarkAsRead(), useMarkAllAsRead()
│   │   └── use-notification-preferences.ts # useNotificationPrefs(), useUpdatePrefs()
│   ├── types/
│   │   └── user-notification.types.ts     # Notification, Preferences interfaces
│   └── components/
│       └── notification-list.tsx          # Full-page notification list (shared)
│
├── components/
│   └── notification-bell.tsx              # REWRITE: remove mock, wire to API + WebSocket
│
└── app/(dashboard)/
    ├── insights/notifications/page.tsx    # REWRITE: wire to real API
    └── settings/notifications/page.tsx    # REWRITE: wire to real preferences API
```

---

## Implementation Plan

### Phase 1: Database + Backend Core (Day 1)

**Goal:** Working API endpoints for notification CRUD.

#### Task 1.1: Migration
- [ ] Create `000084_user_notifications.up.sql` with 4 tables + indexes
- [ ] Create `000084_user_notifications.down.sql`
- [ ] Test migration up/down

#### Task 1.2: Domain Layer
- [ ] Create `pkg/domain/usernotification/entity.go`
  - Notification struct (id, tenant_id, audience, type, title, body, severity, resource, actor, created_at)
  - NotificationPreferences struct
  - NotificationState struct
  - Audience constants (All, Group, User)
- [ ] Create `pkg/domain/usernotification/notification_type.go`
  - All type constants (finding_new, scan_completed, etc.)
  - AllNotificationTypes() for validation
- [ ] Create `pkg/domain/usernotification/repository.go`
  - Repository interface with all methods
- [ ] Create `pkg/domain/usernotification/errors.go`

#### Task 1.3: Repository
- [ ] Create `internal/infra/postgres/user_notification_repository.go`
  - Create() — insert into notifications
  - List() — feed query with audience filtering + read status (LEFT JOINs)
  - UnreadCount() — count query with watermark
  - MarkAsRead() — INSERT INTO notification_reads ON CONFLICT DO NOTHING
  - MarkAllAsRead() — UPSERT notification_state watermark
  - DeleteOlderThan() — cleanup
  - GetPreferences() — SELECT from notification_preferences
  - UpsertPreferences() — INSERT ON CONFLICT UPDATE

#### Task 1.4: Service
- [ ] Create `internal/app/user_notification_service.go`
  - Notify() — create notification + WebSocket push
  - List() — delegate to repo with user's group IDs
  - UnreadCount() — delegate to repo
  - MarkAsRead() — validate notification exists + audience match
  - MarkAllAsRead() — delegate to repo
  - GetPreferences() — delegate (return defaults if no row)
  - UpdatePreferences() — validate + delegate
  - Cleanup() — called by controller scheduler

#### Task 1.5: Handler + Routes
- [ ] Create `internal/infra/http/handler/user_notification_handler.go`
  - GET /notifications — List with pagination + filters (severity, type, is_read)
  - GET /notifications/unread-count — return { count: N }
  - PATCH /notifications/{id}/read — mark one
  - POST /notifications/read-all — watermark
  - GET /notifications/preferences — get
  - PUT /notifications/preferences — update
- [ ] Create `internal/infra/http/routes/notifications.go`
  - Register routes under authenticated tenant middleware
- [ ] Wire in `routes.go` and `handlers.go`

#### Task 1.6: Wiring
- [ ] Add UserNotification to Repositories struct in `cmd/server/repositories.go`
- [ ] Add UserNotificationService to Services struct in `cmd/server/services.go`
- [ ] Add UserNotification handler to Handlers in `cmd/server/handlers.go`
- [ ] Register routes in `routes.go`

### Phase 2: Event Hooks (Day 2)

**Goal:** Real events create real notifications.

#### Task 2.1: Hook into existing services
- [ ] `vulnerability_service.go` — Create() → notify finding_new (audience based on severity)
- [ ] `vulnerability_service.go` — Assign() → notify finding_assigned (audience=user)
- [ ] `scan_service.go` or scan completion handler → notify scan_completed/scan_failed
- [ ] `tenant_service.go` — AddMember() → notify member_joined

#### Task 2.2: WebSocket integration
- [ ] Add `SendToUser()` method to WebSocket Hub (if not exists)
- [ ] Wire Notify() to push via WebSocket after DB insert
- [ ] Test: create finding → see notification appear in another browser tab

#### Task 2.3: Cleanup controller
- [ ] Add notification cleanup to existing controller scheduler
- [ ] Run daily, delete notifications > 30 days
- [ ] Log deleted count

### Phase 3: Frontend — Bell Component (Day 3)

**Goal:** Real data in notification bell.

#### Task 3.1: API Hooks
- [ ] Create `features/notifications/api/use-user-notifications.ts`
  - useNotifications(params) — SWR hook for GET /notifications
  - useUnreadCount() — SWR hook for GET /notifications/unread-count (auto-refresh 60s)
- [ ] Create `features/notifications/api/use-notification-actions.ts`
  - useMarkAsRead() — PATCH mutation
  - useMarkAllAsRead() — POST mutation + mutate unread count to 0
- [ ] Create `features/notifications/types/user-notification.types.ts`
  - UserNotification interface (matching backend response)
  - NotificationPreferences interface

#### Task 3.2: Rewrite notification-bell.tsx
- [ ] Remove all mock data (lines 40-91)
- [ ] Wire to useNotifications({ limit: 5 }) for popover list
- [ ] Wire to useUnreadCount() for badge
- [ ] Wire "Mark all as read" button to useMarkAllAsRead()
- [ ] Wire individual click to useMarkAsRead()
- [ ] Add WebSocket listener for real-time badge increment
  - Subscribe to `tenant:{id}` channel
  - On `notification:new` event: increment count + prepend to list
  - Show toast for critical/high severity

#### Task 3.3: Test bell component
- [ ] Verify: no notifications → empty state
- [ ] Verify: mark as read → count decrements
- [ ] Verify: mark all as read → count goes to 0
- [ ] Verify: new finding created → notification appears in bell (WebSocket)

### Phase 4: Frontend — Settings & Insights Pages (Day 4)

**Goal:** Real preferences and dashboard.

#### Task 4.1: Preferences page
- [ ] Create `features/notifications/api/use-notification-preferences.ts`
  - useNotificationPreferences() — SWR hook for GET /notifications/preferences
  - useUpdateNotificationPreferences() — PUT mutation
- [ ] Rewrite `/settings/notifications/page.tsx`
  - Remove setTimeout mock
  - Wire toggles to real API
  - Wire email digest selector to real API
  - Wire notification type muting to real API
  - Show loading state while fetching
  - Show success toast on save

#### Task 4.2: Insights page
- [ ] Rewrite `/insights/notifications/page.tsx`
  - Replace mock stats with real unread count + total count
  - Replace mock charts with data from GET /notifications?severity=...
  - Show recent notifications list (paginated)
  - Add severity distribution from real data
  - Add filters (date range, type, severity)

### Phase 5: Polish & Edge Cases (Day 5)

#### Task 5.1: Preferences filtering
- [ ] Backend: filter notifications by user preferences in List() and UnreadCount()
  - Skip muted_types
  - Skip below min_severity
  - Skip if in_app_enabled = false
- [ ] Frontend: respect preferences in notification display

#### Task 5.2: Rate limiting
- [ ] Prevent notification flood: max 1 notification per type per resource per 5 minutes
  - Example: don't send finding_status_change for same finding 10 times in a minute
  - Implement in Notify() with simple dedup check

#### Task 5.3: Actor enrichment
- [ ] Include actor name/avatar in notification response
  - LEFT JOIN users on actor_id
  - Frontend: show "John created a critical finding" vs just "Critical finding created"

#### Task 5.4: Backend tests
- [ ] Unit tests for user_notification_service.go
  - Test Notify() with all audience types
  - Test List() with audience filtering
  - Test UnreadCount() with watermark
  - Test MarkAllAsRead() watermark behavior
  - Test preferences filtering
  - Test cleanup
- [ ] Repository tests if applicable

#### Task 5.5: Frontend tests
- [ ] Test notification-bell.tsx rendering with API data
- [ ] Test mark as read interaction
- [ ] Test empty state
- [ ] Test preferences page save/load

---

## Integration with Existing Notification System

```
                    Event occurs
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
    notification_outbox          notifications
    (existing)                   (NEW - this RFC)
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

Both systems are triggered by the same events but serve different purposes:
- **notification_outbox** → External delivery (Slack, Email, etc.)
- **notifications** → In-app user notifications (bell icon)

They are **independent** — no dependency between them. A service can call both:

```go
// In vulnerability_service.go Create()
// 1. Notify in-app users
s.userNotifSvc.Notify(ctx, usernotification.NotifyInput{
    TenantID: tenantID,
    Type:     usernotification.TypeFindingNew,
    Audience: usernotification.AudienceAll,
    Title:    fmt.Sprintf("Critical finding: %s", finding.Title),
    Severity: finding.Severity,
    ResourceType: "finding",
    ResourceID:   finding.ID,
    URL:     fmt.Sprintf("/findings/%s", finding.ID),
})

// 2. Notify external channels (existing)
s.notifSvc.BroadcastNotification(ctx, app.BroadcastNotificationInput{
    TenantID:  tenantID,
    EventType: integration.EventTypeFindings,
    Title:     finding.Title,
    Severity:  finding.Severity,
})
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Query performance with large feed | Slow page load | 30-day retention + proper indexes + LIMIT |
| Notification flood from bulk operations | 1000 findings = 1000 notifications | Dedup: max 1 per type/resource/5min |
| WebSocket not connected | User misses real-time updates | SWR polling as fallback (60s interval) |
| User in many groups → large IN clause | Slow audience matching | Cap at 50 groups, use subquery if more |
| Clock skew with watermark | Read/unread inconsistency | Use database NOW(), not app time |

---

## Success Metrics

- [ ] Bell icon shows real notifications from actual events
- [ ] Unread count updates in real-time via WebSocket
- [ ] "Mark all as read" completes in < 50ms (watermark O(1))
- [ ] Notification feed loads in < 200ms (indexed query)
- [ ] Settings page saves/loads real preferences
- [ ] 30-day auto-cleanup keeps table size bounded
- [ ] 0 mock data remaining in notification components

---

## Out of Scope (Future)

- Email digest delivery (daily/weekly summary emails)
- Browser push notifications (Web Push API)
- Notification grouping/batching ("5 new findings in last hour")
- Custom notification rules per user
- Notification templates customization
- Mobile push notifications
