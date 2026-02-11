---
layout: default
title: User Notification Inbox
parent: Architecture
nav_order: 26
---

# User Notification Inbox

## Technical Specification Document

**Version:** 1.0
**Status:** Planned
**Author:** Engineering Team
**Created:** 2026-01-24
**Last Updated:** 2026-01-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current State](#2-current-state)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Database Design](#4-database-design)
5. [API Design](#5-api-design)
6. [Backend Implementation](#6-backend-implementation)
7. [Frontend Implementation](#7-frontend-implementation)
8. [Real-time Updates](#8-real-time-updates)
9. [Migration Plan](#9-migration-plan)
10. [Testing Plan](#10-testing-plan)

---

## 1. Overview

### 1.1 Problem Statement

Currently, OpenCTEM has a **tenant-scoped notification outbox** system that sends notifications to external channels (Slack, Email, etc.). However, there is no **user-scoped in-app inbox** where users can:
- See notifications relevant to them
- Track read/unread status
- Manage notification preferences
- Receive real-time updates

### 1.2 Goals

1. **Per-user inbox**: Each user has their own notification inbox
2. **Read/unread tracking**: Users can mark notifications as read
3. **Relevance filtering**: Users only see notifications they should see (based on permissions, groups, assignments)
4. **User preferences**: Users control what notifications they receive
5. **Real-time updates**: Notifications appear instantly without refresh
6. **Header bell icon**: Quick access to recent notifications

### 1.3 Success Metrics

| Metric | Target |
|--------|--------|
| Notification delivery latency | < 2 seconds |
| Inbox load time | < 500ms |
| Unread count accuracy | 100% |
| User preference respect rate | 100% |

---

## 2. Current State

### 2.1 Existing Infrastructure

```
notification_outbox (TENANT-SCOPED)
├── tenant_id         ← Scoped by tenant
├── event_type        ← What triggered it
├── title, body       ← Content
├── severity          ← Priority level
├── status            ← Queue status (pending, completed, etc.)
└── Purpose: Send to external channels (Slack, Email)
```

### 2.2 What's Missing

| Feature | Current | Needed |
|---------|---------|--------|
| User inbox | ❌ None | ✅ Per-user notifications |
| Read tracking | ❌ None | ✅ Per-user read/unread |
| User preferences | ❌ None | ✅ Per-user settings |
| In-app bell icon | ❌ None | ✅ Header notification bell |
| Real-time | ❌ None | ✅ WebSocket/SSE |

---

## 3. Proposed Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Business Event (Finding Created, Scan Completed, etc.)          │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐       │
│  │            Notification Service                       │       │
│  │  1. Determine notification type                       │       │
│  │  2. Find target users (permissions, groups, prefs)    │       │
│  │  3. Fan-out to user inboxes                          │       │
│  │  4. Queue for external channels                       │       │
│  └──────────────────────────────────────────────────────┘       │
│         │                           │                            │
│         ▼                           ▼                            │
│  ┌─────────────┐           ┌─────────────────┐                  │
│  │ User Inbox  │           │ External Queue  │                  │
│  │ (per-user)  │           │ (existing)      │                  │
│  └──────┬──────┘           └────────┬────────┘                  │
│         │                           │                            │
│         ▼                           ▼                            │
│  ┌─────────────┐           ┌─────────────────┐                  │
│  │ In-App UI   │           │ Slack/Email/etc │                  │
│  │ + WebSocket │           │                 │                  │
│  └─────────────┘           └─────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Fan-out Strategy

**Fan-out-on-Write** (recommended for < 1M users):
- When event occurs, immediately write to each target user's inbox
- Fast reads (just query by user_id)
- Trade-off: Higher write volume

```
Event: New Critical Finding
    │
    ▼
Determine target users:
├── Users with `findings:read` permission
├── Users in groups that own the affected asset
├── Users assigned to the finding
└── Filter by user preferences (wants critical findings?)
    │
    ▼
For each target user:
├── INSERT into user_notifications
├── Increment unread_count in cache (Redis)
└── Send WebSocket event
```

---

## 4. Database Design

### 4.1 New Tables

#### user_notifications

```sql
CREATE TABLE user_notifications (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification content
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    severity VARCHAR(20) DEFAULT 'info',
    icon VARCHAR(50),

    -- Source reference (for deep linking)
    resource_type VARCHAR(50),
    resource_id UUID,
    url VARCHAR(500),

    -- Read status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Grouping (for notification aggregation)
    group_key VARCHAR(100),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT chk_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'))
);

-- Indexes for fast queries
CREATE INDEX idx_user_notifications_user_unread
    ON user_notifications(user_id, is_read, created_at DESC)
    WHERE is_read = FALSE;

CREATE INDEX idx_user_notifications_user_created
    ON user_notifications(user_id, created_at DESC);

CREATE INDEX idx_user_notifications_tenant
    ON user_notifications(tenant_id, created_at DESC);

CREATE INDEX idx_user_notifications_group_key
    ON user_notifications(user_id, group_key)
    WHERE group_key IS NOT NULL;

-- Retention: Auto-delete old notifications (90 days)
CREATE INDEX idx_user_notifications_expires
    ON user_notifications(expires_at)
    WHERE expires_at IS NOT NULL;
```

#### user_notification_preferences

```sql
CREATE TABLE user_notification_preferences (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Global channel settings
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_digest_frequency VARCHAR(20) NOT NULL DEFAULT 'realtime',

    -- Per-event-type preferences (flexible JSONB)
    event_preferences JSONB NOT NULL DEFAULT '{}',

    -- Quiet hours
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT user_notification_preferences_unique UNIQUE (user_id, tenant_id),
    CONSTRAINT chk_email_digest_frequency CHECK (
        email_digest_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'never')
    )
);

CREATE INDEX idx_user_notification_preferences_user
    ON user_notification_preferences(user_id);
```

### 4.2 Notification Types

```go
// notification_type values
const (
    // Findings
    NotificationTypeFindingNew        = "finding_new"
    NotificationTypeFindingAssigned   = "finding_assigned"
    NotificationTypeFindingStatusChange = "finding_status_change"
    NotificationTypeFindingComment    = "finding_comment"
    NotificationTypeFindingMention    = "finding_mention"

    // Scans
    NotificationTypeScanStarted   = "scan_started"
    NotificationTypeScanCompleted = "scan_completed"
    NotificationTypeScanFailed    = "scan_failed"

    // Assets
    NotificationTypeAssetNew     = "asset_new"
    NotificationTypeAssetChanged = "asset_changed"

    // Team
    NotificationTypeMemberInvited = "member_invited"
    NotificationTypeMemberJoined  = "member_joined"
    NotificationTypeRoleChanged   = "role_changed"

    // System
    NotificationTypeSystemAlert   = "system_alert"
    NotificationTypeSystemUpdate  = "system_update"
)
```

### 4.3 Event Preferences Schema

```json
{
  "finding_new": {
    "in_app": true,
    "email": true,
    "min_severity": "high"
  },
  "finding_assigned": {
    "in_app": true,
    "email": true
  },
  "scan_completed": {
    "in_app": true,
    "email": false
  },
  "scan_failed": {
    "in_app": true,
    "email": true
  }
}
```

---

## 5. API Design

### 5.1 User Inbox Endpoints

#### List Notifications

```
GET /api/v1/me/notifications
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | int | 1 | Page number |
| per_page | int | 20 | Items per page (max 100) |
| is_read | bool | - | Filter by read status |
| type | string | - | Filter by notification type |
| severity | string | - | Filter by severity |
| since | datetime | - | Notifications after this time |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "notification_type": "finding_new",
      "title": "Critical vulnerability found",
      "body": "SQL Injection in api-server.example.com",
      "severity": "critical",
      "icon": "alert-triangle",
      "resource_type": "finding",
      "resource_id": "uuid",
      "url": "/findings/uuid",
      "is_read": false,
      "created_at": "2026-01-24T10:00:00Z",
      "metadata": {}
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

#### Get Unread Count

```
GET /api/v1/me/notifications/unread-count
```

**Response:**
```json
{
  "count": 5,
  "by_severity": {
    "critical": 1,
    "high": 2,
    "medium": 2
  }
}
```

#### Mark as Read

```
POST /api/v1/me/notifications/mark-read
```

**Request Body:**
```json
{
  "notification_ids": ["uuid1", "uuid2"],
  "mark_all": false
}
```

#### Mark Single as Read

```
PATCH /api/v1/me/notifications/{id}/read
```

#### Delete Notification

```
DELETE /api/v1/me/notifications/{id}
```

### 5.2 User Preferences Endpoints

#### Get Preferences

```
GET /api/v1/me/notification-preferences
```

**Response:**
```json
{
  "in_app_enabled": true,
  "email_enabled": true,
  "email_digest_frequency": "daily",
  "quiet_hours_enabled": true,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "quiet_hours_timezone": "Asia/Ho_Chi_Minh",
  "event_preferences": {
    "finding_new": {
      "in_app": true,
      "email": true,
      "min_severity": "high"
    }
  }
}
```

#### Update Preferences

```
PUT /api/v1/me/notification-preferences
```

---

## 6. Backend Implementation

### 6.1 Domain Layer

#### File: `api/internal/domain/notification/user_notification.go`

```go
package notification

import (
    "time"
    "github.com/google/uuid"
)

type UserNotification struct {
    id               ID
    tenantID         ID
    userID           ID
    notificationType string
    title            string
    body             string
    severity         Severity
    icon             string
    resourceType     string
    resourceID       *ID
    url              string
    isRead           bool
    readAt           *time.Time
    groupKey         string
    metadata         map[string]interface{}
    createdAt        time.Time
    expiresAt        *time.Time
}

type UserNotificationRepository interface {
    Create(ctx context.Context, n *UserNotification) error
    CreateBatch(ctx context.Context, notifications []*UserNotification) error
    GetByID(ctx context.Context, id ID) (*UserNotification, error)
    List(ctx context.Context, filter UserNotificationFilter) ([]*UserNotification, int, error)
    GetUnreadCount(ctx context.Context, tenantID, userID ID) (int, map[Severity]int, error)
    MarkAsRead(ctx context.Context, tenantID, userID ID, notificationIDs []ID) error
    MarkAllAsRead(ctx context.Context, tenantID, userID ID) error
    Delete(ctx context.Context, id ID) error
    DeleteExpired(ctx context.Context) (int, error)
}

type UserNotificationFilter struct {
    TenantID  ID
    UserID    ID
    IsRead    *bool
    Type      string
    Severity  Severity
    Since     *time.Time
    Page      int
    PerPage   int
}
```

### 6.2 Application Layer

#### File: `api/internal/app/user_notification_service.go`

```go
package app

type UserNotificationService struct {
    repo           notification.UserNotificationRepository
    prefRepo       notification.UserPreferencesRepository
    roleService    *RoleService
    groupService   *GroupService
    redisClient    *redis.Client
    logger         *logger.Logger
}

// NotifyUsers sends a notification to relevant users
func (s *UserNotificationService) NotifyUsers(
    ctx context.Context,
    tenantID string,
    event NotificationEvent,
) error {
    // 1. Find target users based on event type and permissions
    targetUsers, err := s.findTargetUsers(ctx, tenantID, event)
    if err != nil {
        return err
    }

    // 2. Filter by user preferences
    filteredUsers := s.filterByPreferences(ctx, targetUsers, event)

    // 3. Create notifications for each user
    notifications := make([]*notification.UserNotification, 0, len(filteredUsers))
    for _, userID := range filteredUsers {
        n := notification.NewUserNotification(
            tenantID,
            userID,
            event.Type,
            event.Title,
            event.Body,
            event.Severity,
            event.ResourceType,
            event.ResourceID,
            event.URL,
        )
        notifications = append(notifications, n)
    }

    // 4. Batch insert
    if err := s.repo.CreateBatch(ctx, notifications); err != nil {
        return err
    }

    // 5. Update unread counts in Redis
    for _, userID := range filteredUsers {
        s.incrementUnreadCount(ctx, tenantID, userID)
    }

    // 6. Send WebSocket events
    for _, userID := range filteredUsers {
        s.broadcastToUser(ctx, tenantID, userID, event)
    }

    return nil
}

func (s *UserNotificationService) findTargetUsers(
    ctx context.Context,
    tenantID string,
    event NotificationEvent,
) ([]string, error) {
    var users []string

    switch event.Type {
    case "finding_new", "finding_status_change":
        // Users with findings:read permission + asset group members
        users = s.getUsersWithPermissionAndAssetAccess(ctx, tenantID, "findings:read", event.ResourceID)

    case "finding_assigned":
        // Only the assigned user
        if event.AssigneeID != "" {
            users = []string{event.AssigneeID}
        }

    case "finding_mention":
        // Only mentioned users
        users = event.MentionedUserIDs

    case "scan_completed", "scan_failed":
        // Users with scans:read permission
        users = s.getUsersWithPermission(ctx, tenantID, "scans:read")

    case "member_joined", "role_changed":
        // Admins and owners
        users = s.getAdminsAndOwners(ctx, tenantID)
    }

    return users, nil
}
```

### 6.3 Handler Layer

#### File: `api/internal/infra/http/handler/user_notification_handler.go`

```go
package handler

type UserNotificationHandler struct {
    service *app.UserNotificationService
    logger  *logger.Logger
}

func (h *UserNotificationHandler) List(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    tenantID := middleware.MustGetTenantID(ctx)
    userID := middleware.MustGetUserID(ctx)

    filter := notification.UserNotificationFilter{
        TenantID: tenantID,
        UserID:   userID,
        Page:     getIntQuery(r, "page", 1),
        PerPage:  getIntQuery(r, "per_page", 20),
    }

    if isRead := r.URL.Query().Get("is_read"); isRead != "" {
        b := isRead == "true"
        filter.IsRead = &b
    }

    notifications, total, err := h.service.List(ctx, filter)
    if err != nil {
        apierror.InternalError(err).WriteJSON(w)
        return
    }

    response.Paginated(w, notifications, filter.Page, filter.PerPage, total)
}

func (h *UserNotificationHandler) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    tenantID := middleware.MustGetTenantID(ctx)
    userID := middleware.MustGetUserID(ctx)

    count, bySeverity, err := h.service.GetUnreadCount(ctx, tenantID, userID)
    if err != nil {
        apierror.InternalError(err).WriteJSON(w)
        return
    }

    response.JSON(w, http.StatusOK, map[string]interface{}{
        "count":       count,
        "by_severity": bySeverity,
    })
}

func (h *UserNotificationHandler) MarkAsRead(w http.ResponseWriter, r *http.Request) {
    // Implementation
}
```

### 6.4 Routes

#### File: `api/internal/infra/http/routes.go` (additions)

```go
// User notifications (inbox)
r.Route("/api/v1/me/notifications", func(r chi.Router) {
    r.Use(authMiddleware)

    r.Get("/", h.userNotificationHandler.List)
    r.Get("/unread-count", h.userNotificationHandler.GetUnreadCount)
    r.Post("/mark-read", h.userNotificationHandler.MarkAsRead)
    r.Patch("/{id}/read", h.userNotificationHandler.MarkSingleAsRead)
    r.Delete("/{id}", h.userNotificationHandler.Delete)
})

// User notification preferences
r.Route("/api/v1/me/notification-preferences", func(r chi.Router) {
    r.Use(authMiddleware)

    r.Get("/", h.userNotificationHandler.GetPreferences)
    r.Put("/", h.userNotificationHandler.UpdatePreferences)
})
```

---

## 7. Frontend Implementation

### 7.1 Types

#### File: `ui/src/features/notifications/types/user-notification.types.ts`

```typescript
export interface UserNotification {
  id: string
  notification_type: NotificationType
  title: string
  body?: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  icon?: string
  resource_type?: string
  resource_id?: string
  url?: string
  is_read: boolean
  read_at?: string
  created_at: string
  metadata?: Record<string, unknown>
}

export type NotificationType =
  | 'finding_new'
  | 'finding_assigned'
  | 'finding_status_change'
  | 'finding_comment'
  | 'finding_mention'
  | 'scan_started'
  | 'scan_completed'
  | 'scan_failed'
  | 'asset_new'
  | 'member_invited'
  | 'member_joined'
  | 'role_changed'
  | 'system_alert'

export interface UnreadCount {
  count: number
  by_severity: {
    critical?: number
    high?: number
    medium?: number
    low?: number
    info?: number
  }
}

export interface UserNotificationPreferences {
  in_app_enabled: boolean
  email_enabled: boolean
  email_digest_frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'never'
  quiet_hours_enabled: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  quiet_hours_timezone?: string
  event_preferences: Record<NotificationType, EventPreference>
}

export interface EventPreference {
  in_app: boolean
  email: boolean
  min_severity?: 'critical' | 'high' | 'medium' | 'low'
}
```

### 7.2 API Hooks

#### File: `ui/src/features/notifications/api/use-user-notifications.ts`

```typescript
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { apiClient } from '@/lib/api/client'

const BASE_URL = '/api/v1/me/notifications'

export function useUserNotifications(params?: {
  page?: number
  per_page?: number
  is_read?: boolean
}) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.per_page) searchParams.set('per_page', params.per_page.toString())
  if (params?.is_read !== undefined) searchParams.set('is_read', params.is_read.toString())

  const url = `${BASE_URL}?${searchParams.toString()}`

  return useSWR<PaginatedResponse<UserNotification>>(url, apiClient.get)
}

export function useUnreadCount() {
  return useSWR<UnreadCount>(
    `${BASE_URL}/unread-count`,
    apiClient.get,
    {
      refreshInterval: 30000, // Poll every 30 seconds
      revalidateOnFocus: true,
    }
  )
}

export function useMarkAsRead() {
  return useSWRMutation(
    `${BASE_URL}/mark-read`,
    async (url, { arg }: { arg: { notification_ids?: string[]; mark_all?: boolean } }) => {
      return apiClient.post(url, arg)
    }
  )
}

export function useMarkSingleAsRead(notificationId: string) {
  return useSWRMutation(
    `${BASE_URL}/${notificationId}/read`,
    async (url) => apiClient.patch(url)
  )
}
```

### 7.3 Components

#### File: `ui/src/components/notification-bell.tsx`

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  useUserNotifications,
  useUnreadCount,
  useMarkAsRead,
} from '@/features/notifications/api/use-user-notifications'
import { NotificationItem } from './notification-item'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: unreadData } = useUnreadCount()
  const { data: notificationsData, mutate } = useUserNotifications({ per_page: 10 })
  const { trigger: markAsRead } = useMarkAsRead()

  const unreadCount = unreadData?.count ?? 0
  const notifications = notificationsData?.data ?? []

  const handleMarkAllAsRead = async () => {
    await markAsRead({ mark_all: true })
    mutate()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <Separator />

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => mutate()}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm"
            asChild
          >
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

#### File: `ui/src/components/notification-item.tsx`

```typescript
'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import {
  AlertTriangle,
  Bug,
  CheckCircle,
  Info,
  Scan,
  User,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserNotification } from '@/features/notifications/types/user-notification.types'
import { useMarkSingleAsRead } from '@/features/notifications/api/use-user-notifications'

const severityColors = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-blue-500',
  info: 'text-gray-500',
}

const typeIcons: Record<string, typeof AlertTriangle> = {
  finding_new: Bug,
  finding_assigned: User,
  finding_status_change: CheckCircle,
  scan_completed: Scan,
  scan_failed: XCircle,
  system_alert: AlertTriangle,
}

interface NotificationItemProps {
  notification: UserNotification
  onRead?: () => void
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const { trigger: markAsRead } = useMarkSingleAsRead(notification.id)
  const Icon = typeIcons[notification.notification_type] || Info

  const handleClick = async () => {
    if (!notification.is_read) {
      await markAsRead()
      onRead?.()
    }
  }

  const content = (
    <div
      className={cn(
        'flex gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors',
        !notification.is_read && 'bg-muted/30'
      )}
      onClick={handleClick}
    >
      <div className={cn('mt-0.5', severityColors[notification.severity])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <p className={cn('text-sm', !notification.is_read && 'font-medium')}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      {!notification.is_read && (
        <div className="mt-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  )

  if (notification.url) {
    return <Link href={notification.url}>{content}</Link>
  }

  return content
}
```

---

## 8. Real-time Updates

### 8.1 WebSocket Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client (Browser)                                                │
│       │                                                          │
│       │ 1. Connect: /ws/notifications?token=<jwt>                │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              WebSocket Server                            │    │
│  │  - Authenticate via JWT                                  │    │
│  │  - Subscribe to Redis channel: user:{tenant}:{user}      │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       │ 2. Subscribe to Redis Pub/Sub                            │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Redis Pub/Sub                               │    │
│  │  Channel: notification:user:{tenant_id}:{user_id}        │    │
│  └─────────────────────────────────────────────────────────┘    │
│       ▲                                                          │
│       │ 3. Publish new notification                              │
│       │                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         Notification Service                             │    │
│  │  - Create notification in DB                             │    │
│  │  - PUBLISH to Redis channel                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Message Format

```json
{
  "type": "notification",
  "action": "new",
  "data": {
    "id": "uuid",
    "notification_type": "finding_new",
    "title": "Critical vulnerability found",
    "severity": "critical",
    "created_at": "2026-01-24T10:00:00Z"
  }
}
```

### 8.3 Frontend WebSocket Hook

```typescript
// ui/src/features/notifications/hooks/use-notification-socket.ts
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { mutate } from 'swr'

export function useNotificationSocket() {
  const { accessToken } = useAuthStore()

  useEffect(() => {
    if (!accessToken) return

    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}/ws/notifications?token=${accessToken}`
    )

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'notification' && message.action === 'new') {
        // Revalidate notification queries
        mutate('/api/v1/me/notifications/unread-count')
        mutate((key) => typeof key === 'string' && key.startsWith('/api/v1/me/notifications'))

        // Show toast for important notifications
        if (['critical', 'high'].includes(message.data.severity)) {
          toast(message.data.title, {
            description: message.data.body,
          })
        }
      }
    }

    return () => ws.close()
  }, [accessToken])
}
```

---

## 9. Migration Plan

### 9.1 Phase 1: Database & Basic API (Day 1-2)

1. Create migration files for new tables
2. Implement domain layer (entities, repository interfaces)
3. Implement PostgreSQL repository
4. Implement basic service layer
5. Add API handlers and routes
6. Write unit tests

### 9.2 Phase 2: Fan-out Integration (Day 3-4)

1. Integrate with existing event system
2. Implement user targeting logic (permissions, groups)
3. Add user preference filtering
4. Implement Redis caching for unread counts
5. Write integration tests

### 9.3 Phase 3: Frontend UI (Day 5-6)

1. Implement notification bell component
2. Implement notification list/item components
3. Add API hooks with SWR
4. Integrate into header layout
5. Add notification preferences page

### 9.4 Phase 4: Real-time (Day 7-8)

1. Set up WebSocket server
2. Implement Redis Pub/Sub integration
3. Add frontend WebSocket hook
4. Test real-time delivery
5. Add reconnection logic

### 9.5 Phase 5: Polish & Testing (Day 9-10)

1. Add notification aggregation
2. Implement retention cleanup job
3. Performance testing
4. Load testing
5. Documentation

---

## 10. Testing Plan

### 10.1 Unit Tests

- Domain entity creation and validation
- Repository CRUD operations
- Service layer business logic
- User targeting logic
- Preference filtering

### 10.2 Integration Tests

- API endpoint responses
- Permission checks
- Fan-out to multiple users
- WebSocket message delivery

### 10.3 Performance Tests

| Scenario | Target |
|----------|--------|
| List 20 notifications | < 100ms |
| Get unread count | < 50ms |
| Mark all as read (100 items) | < 200ms |
| Fan-out to 1000 users | < 5 seconds |

---

## Appendix A: File Structure

```
api/
├── internal/
│   ├── domain/
│   │   └── notification/
│   │       ├── user_notification.go
│   │       ├── user_preferences.go
│   │       └── repository.go
│   ├── app/
│   │   └── user_notification_service.go
│   └── infra/
│       ├── http/
│       │   └── handler/
│       │       └── user_notification_handler.go
│       ├── postgres/
│       │   └── user_notification_repo.go
│       └── ws/
│           └── notification_hub.go
└── migrations/
    ├── 000078_user_notifications.up.sql
    └── 000078_user_notifications.down.sql

ui/
├── src/
│   ├── components/
│   │   ├── notification-bell.tsx
│   │   └── notification-item.tsx
│   ├── features/
│   │   └── notifications/
│   │       ├── api/
│   │       │   └── use-user-notifications.ts
│   │       ├── types/
│   │       │   └── user-notification.types.ts
│   │       └── hooks/
│   │           └── use-notification-socket.ts
│   └── app/
│       └── (dashboard)/
│           └── notifications/
│               └── page.tsx
```

---

**Document End**
