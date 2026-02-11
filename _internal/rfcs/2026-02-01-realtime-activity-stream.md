---
title: Real-time Activity Stream
status: proposed
author: Platform Team
date: 2026-02-01
category: architecture
---

# RFC: Real-time Activity Stream

## Summary

Implement real-time activity updates for the Finding Detail page using **Server-Sent Events (SSE)** with Redis pub/sub backend. This enables users to see activity changes (comments, status changes, AI triage results) instantly without manual refresh.

---

## Problem Statement

Currently, the Activity Panel uses SWR with standard revalidation, which means:
- Users don't see new activities until they refresh or switch tabs
- AI triage completion isn't reflected immediately
- Comments from other team members aren't visible in real-time
- Poor UX for collaborative workflows

---

## Technology Comparison

| Feature | SSE | WebSocket | Polling |
|---------|-----|-----------|---------|
| **Direction** | Server → Client | Bidirectional | Client → Server |
| **Complexity** | Low | High | Very Low |
| **Auto-reconnect** | Built-in | Manual | N/A |
| **HTTP/2 support** | Native | Limited | N/A |
| **Scalability** | Good | Complex | Poor |
| **Browser support** | All modern | All modern | All |
| **Proxy-friendly** | Yes | Sometimes issues | Yes |

### Recommendation: **Server-Sent Events (SSE)**

**Reasons:**
1. Activity feed is **one-way** (server → client only)
2. Built-in **auto-reconnection** with `EventSource` API
3. **Simpler** than WebSocket - no connection management
4. Works seamlessly with **HTTP/2 multiplexing**
5. Already have **Redis pub/sub** infrastructure (JobNotifier)
6. **Proxy-friendly** - works through corporate proxies/load balancers

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              REAL-TIME ACTIVITY FLOW                              │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────────┐                                                              │
│  │ Activity Service │──┐                                                          │
│  │ (RecordActivity) │  │                                                          │
│  └─────────────────┘  │                                                           │
│                       │ Publish                                                   │
│  ┌─────────────────┐  │  ┌─────────────────────────────────┐                     │
│  │ AI Triage       │──┼─▶│        Redis Pub/Sub            │                     │
│  │ (Completed)     │  │  │  Channel: activity:{finding_id} │                     │
│  └─────────────────┘  │  │  Channel: activity:{tenant_id}  │                     │
│                       │  └────────────────┬────────────────┘                     │
│  ┌─────────────────┐  │                   │                                      │
│  │ Comment Service │──┘                   │ Subscribe                            │
│  │ (AddComment)    │                      │                                      │
│  └─────────────────┘                      ▼                                      │
│                            ┌──────────────────────────────┐                      │
│                            │     SSE Handler              │                      │
│                            │  GET /api/v1/findings/{id}/  │                      │
│                            │      activities/stream       │                      │
│                            └──────────────┬───────────────┘                      │
│                                           │                                      │
│                                           │ SSE Stream                           │
│                                           │ Content-Type: text/event-stream      │
│                                           ▼                                      │
│                            ┌──────────────────────────────┐                      │
│                            │     Browser (EventSource)    │                      │
│                            │                              │                      │
│                            │  const es = new EventSource( │                      │
│                            │    '/api/v1/findings/{id}/   │                      │
│                            │     activities/stream'       │                      │
│                            │  )                           │                      │
│                            │  es.onmessage = (e) => {     │                      │
│                            │    addActivity(JSON.parse(   │                      │
│                            │      e.data))                │                      │
│                            │  }                           │                      │
│                            └──────────────────────────────┘                      │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Design

### 1. Redis Pub/Sub Channels

```go
// Channel naming convention
const (
    // Per-finding channel (specific to one finding)
    ActivityChannelPrefix = "activity:finding:"  // activity:finding:{finding_id}

    // Per-tenant channel (all activities in tenant)
    TenantActivityChannelPrefix = "activity:tenant:"  // activity:tenant:{tenant_id}
)

// Example channels:
// activity:finding:db31d60f-9673-45c6-b035-f39004f9f23c
// activity:tenant:7eecd892-969a-42f9-a02a-4ac96dae46aa
```

### 2. Activity Event Structure

```go
// ActivityEvent represents a real-time activity notification
type ActivityEvent struct {
    Type      string                 `json:"type"`       // "activity_created", "activity_updated"
    Activity  ActivityPayload        `json:"activity"`
    Timestamp int64                  `json:"timestamp"`  // Unix ms
}

type ActivityPayload struct {
    ID           string                 `json:"id"`
    FindingID    string                 `json:"finding_id"`
    ActivityType string                 `json:"activity_type"`
    ActorID      *string                `json:"actor_id,omitempty"`
    ActorType    string                 `json:"actor_type"`
    ActorName    string                 `json:"actor_name,omitempty"`
    Changes      map[string]interface{} `json:"changes"`
    CreatedAt    string                 `json:"created_at"`
}
```

### 3. Backend Components

#### 3.1 ActivityNotifier (Redis Pub/Sub)

```go
// internal/infra/redis/activity_notifier.go

package redis

type ActivityNotifier struct {
    client *Client
    logger *logger.Logger
}

func NewActivityNotifier(client *Client, log *logger.Logger) *ActivityNotifier {
    return &ActivityNotifier{client: client, logger: log}
}

// PublishActivity publishes an activity event to Redis
func (n *ActivityNotifier) PublishActivity(ctx context.Context, event *ActivityEvent) error {
    data, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("marshal activity event: %w", err)
    }

    // Publish to finding-specific channel
    findingChannel := ActivityChannelPrefix + event.Activity.FindingID
    if err := n.client.Client().Publish(ctx, findingChannel, data).Err(); err != nil {
        return fmt.Errorf("publish to finding channel: %w", err)
    }

    n.logger.Debug("published activity event",
        "activity_id", event.Activity.ID,
        "finding_id", event.Activity.FindingID,
        "type", event.Activity.ActivityType,
    )

    return nil
}

// SubscribeToFinding creates a subscription for a finding's activities
func (n *ActivityNotifier) SubscribeToFinding(ctx context.Context, findingID string) (<-chan *ActivityEvent, func()) {
    channel := ActivityChannelPrefix + findingID
    pubsub := n.client.Client().Subscribe(ctx, channel)

    events := make(chan *ActivityEvent, 10)

    go func() {
        defer close(events)
        ch := pubsub.Channel()

        for {
            select {
            case <-ctx.Done():
                return
            case msg, ok := <-ch:
                if !ok {
                    return
                }
                var event ActivityEvent
                if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
                    n.logger.Error("unmarshal activity event", "error", err)
                    continue
                }
                select {
                case events <- &event:
                default:
                    n.logger.Warn("activity event channel full")
                }
            }
        }
    }()

    cleanup := func() {
        pubsub.Close()
    }

    return events, cleanup
}
```

#### 3.2 SSE Handler

```go
// internal/infra/http/handler/activity_stream_handler.go

package handler

type ActivityStreamHandler struct {
    notifier    *redis.ActivityNotifier
    findingRepo vulnerability.Repository
    logger      *logger.Logger
}

// StreamActivities handles SSE connections for real-time activity updates
// GET /api/v1/findings/{findingID}/activities/stream
func (h *ActivityStreamHandler) StreamActivities(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    findingID := chi.URLParam(r, "findingID")

    // Verify user has access to this finding
    tenantID := middleware.GetTenantID(ctx)
    if _, err := h.findingRepo.GetByID(ctx, tenantID, findingID); err != nil {
        apierror.NotFound("finding not found").WriteJSON(w)
        return
    }

    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

    // Flush headers immediately
    if f, ok := w.(http.Flusher); ok {
        f.Flush()
    }

    // Subscribe to finding's activity channel
    events, cleanup := h.notifier.SubscribeToFinding(ctx, findingID)
    defer cleanup()

    // Send initial "connected" event
    h.writeSSE(w, "connected", map[string]string{"finding_id": findingID})

    // Heartbeat ticker (keep connection alive)
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            h.logger.Debug("SSE connection closed", "finding_id", findingID)
            return

        case <-ticker.C:
            // Send heartbeat to keep connection alive
            h.writeSSE(w, "heartbeat", map[string]int64{"timestamp": time.Now().Unix()})

        case event, ok := <-events:
            if !ok {
                return
            }
            h.writeSSE(w, "activity", event)
        }
    }
}

func (h *ActivityStreamHandler) writeSSE(w http.ResponseWriter, eventType string, data interface{}) {
    jsonData, _ := json.Marshal(data)
    fmt.Fprintf(w, "event: %s\n", eventType)
    fmt.Fprintf(w, "data: %s\n\n", jsonData)

    if f, ok := w.(http.Flusher); ok {
        f.Flush()
    }
}
```

#### 3.3 Integration with Activity Service

```go
// internal/app/finding_activity_service.go

// Modify RecordActivity to publish events
func (s *FindingActivityService) RecordActivity(ctx context.Context, input RecordActivityInput) (*ActivityOutput, error) {
    // ... existing code to create activity ...

    activity, err := s.repo.Create(ctx, activityEntity)
    if err != nil {
        return nil, err
    }

    // NEW: Publish activity event for real-time updates
    if s.activityNotifier != nil {
        event := &redis.ActivityEvent{
            Type:      "activity_created",
            Timestamp: time.Now().UnixMilli(),
            Activity: redis.ActivityPayload{
                ID:           activity.ID().String(),
                FindingID:    activity.FindingID().String(),
                ActivityType: string(activity.ActivityType()),
                ActorType:    string(activity.ActorType()),
                ActorName:    activity.ActorName(),
                Changes:      activity.Changes(),
                CreatedAt:    activity.CreatedAt().Format(time.RFC3339),
            },
        }
        if err := s.activityNotifier.PublishActivity(ctx, event); err != nil {
            s.logger.Warn("failed to publish activity event", "error", err)
            // Don't fail the request, just log warning
        }
    }

    return mapToOutput(activity), nil
}
```

### 4. Frontend Components

#### 4.1 Custom Hook: useActivityStream

```typescript
// ui/src/features/findings/hooks/use-activity-stream.ts

import { useEffect, useCallback, useRef } from 'react'
import type { Activity } from '../types'

interface UseActivityStreamOptions {
  findingId: string | null
  onActivity: (activity: Activity) => void
  onConnected?: () => void
  onDisconnected?: () => void
  enabled?: boolean
}

export function useActivityStream({
  findingId,
  onActivity,
  onConnected,
  onDisconnected,
  enabled = true,
}: UseActivityStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (!findingId || !enabled) return

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `/api/v1/findings/${findingId}/activities/stream`
    const eventSource = new EventSource(url, { withCredentials: true })
    eventSourceRef.current = eventSource

    eventSource.addEventListener('connected', () => {
      console.log('[SSE] Connected to activity stream')
      onConnected?.()
    })

    eventSource.addEventListener('activity', (e) => {
      try {
        const event = JSON.parse(e.data)
        const activity = mapEventToActivity(event.activity)
        onActivity(activity)
      } catch (err) {
        console.error('[SSE] Failed to parse activity event', err)
      }
    })

    eventSource.addEventListener('heartbeat', () => {
      // Connection is alive
    })

    eventSource.onerror = () => {
      console.log('[SSE] Connection error, will auto-reconnect')
      onDisconnected?.()
      // EventSource auto-reconnects, but we can add custom logic if needed
    }

    return () => {
      eventSource.close()
    }
  }, [findingId, enabled, onActivity, onConnected, onDisconnected])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  return { disconnect }
}

// Helper to map SSE event to Activity type
function mapEventToActivity(payload: any): Activity {
  return {
    id: payload.id,
    type: payload.activity_type,
    actor: payload.actor_type === 'system'
      ? 'system'
      : payload.actor_type === 'ai'
        ? 'ai'
        : {
            id: payload.actor_id || 'unknown',
            name: payload.actor_name || 'Unknown',
            email: '',
            role: 'analyst',
          },
    content: payload.changes?.content,
    metadata: payload.changes,
    createdAt: payload.created_at,
  }
}
```

#### 4.2 Integration with Activity Panel

```typescript
// ui/src/features/findings/components/detail/activity-panel.tsx

export function ActivityPanel({ findingId, activities: initialActivities, ... }) {
  const [activities, setActivities] = useState(initialActivities)
  const [isConnected, setIsConnected] = useState(false)

  // Real-time activity stream
  useActivityStream({
    findingId,
    enabled: !!findingId,
    onActivity: useCallback((newActivity) => {
      setActivities((prev) => {
        // Check if activity already exists (dedup)
        if (prev.some((a) => a.id === newActivity.id)) {
          return prev
        }
        // Add new activity at the beginning (most recent first)
        return [newActivity, ...prev]
      })
    }, []),
    onConnected: () => setIsConnected(true),
    onDisconnected: () => setIsConnected(false),
  })

  // Show connection status indicator
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
        <span className="text-xs text-muted-foreground">
          {isConnected ? 'Live' : 'Connecting...'}
        </span>
      </div>
      {/* ... rest of activity panel */}
    </div>
  )
}
```

---

## API Endpoints

### New Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/findings/{id}/activities/stream` | SSE stream for real-time activities |

### SSE Event Types

| Event | Description | Data |
|-------|-------------|------|
| `connected` | Initial connection established | `{ finding_id: string }` |
| `activity` | New activity created | `ActivityEvent` |
| `heartbeat` | Keep-alive ping (every 30s) | `{ timestamp: number }` |

---

## Configuration

### Environment Variables

```bash
# SSE Configuration
SSE_HEARTBEAT_INTERVAL=30s          # Heartbeat interval to keep connection alive
SSE_MAX_CONNECTIONS_PER_USER=10     # Max concurrent SSE connections per user
SSE_CONNECTION_TIMEOUT=5m           # Max connection duration (reconnect after)
```

### Redis Configuration

No additional Redis configuration needed - uses existing pub/sub infrastructure.

---

## Scaling Considerations

### Horizontal Scaling

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  API Pod 1  │     │  API Pod 2  │     │  API Pod 3  │
│             │     │             │     │             │
│ SSE Handler │     │ SSE Handler │     │ SSE Handler │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │   Pub/Sub   │
                    └─────────────┘
```

- Each API pod subscribes to Redis for relevant channels
- Redis pub/sub distributes events to all subscribers
- No sticky sessions required
- Scales horizontally with API pods

### Connection Limits

- **Per-user limit**: 10 concurrent SSE connections
- **Heartbeat**: 30 seconds to prevent proxy/LB timeouts
- **Reconnection**: EventSource auto-reconnects with exponential backoff

---

## Security Considerations

1. **Authentication**: SSE endpoint requires valid JWT token
2. **Authorization**: Verify user has access to the finding before streaming
3. **Tenant Isolation**: Users can only subscribe to their tenant's findings
4. **Rate Limiting**: Limit SSE connections per user
5. **Connection Cleanup**: Proper cleanup on disconnect to prevent resource leaks

---

## Implementation Phases

### Phase 1: Backend Infrastructure (2-3 days)
- [ ] Create `ActivityNotifier` in `internal/infra/redis/`
- [ ] Create `ActivityStreamHandler` in `internal/infra/http/handler/`
- [ ] Integrate with `FindingActivityService`
- [ ] Add SSE route to router
- [ ] Add configuration options

### Phase 2: Frontend Integration (1-2 days)
- [ ] Create `useActivityStream` hook
- [ ] Update `ActivityPanel` to use real-time stream
- [ ] Add connection status indicator
- [ ] Handle deduplication and ordering

### Phase 3: Testing & Optimization (1 day)
- [ ] Unit tests for ActivityNotifier
- [ ] Integration tests for SSE endpoint
- [ ] Load testing with multiple connections
- [ ] Verify proper cleanup on disconnect

### Phase 4: Monitoring & Observability (0.5 day)
- [ ] Add metrics for active SSE connections
- [ ] Add metrics for events published/delivered
- [ ] Add logging for connection lifecycle

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `api/internal/infra/redis/activity_notifier.go` | Redis pub/sub for activities |
| `api/internal/infra/http/handler/activity_stream_handler.go` | SSE handler |
| `ui/src/features/findings/hooks/use-activity-stream.ts` | React hook for SSE |

### Modified Files

| File | Changes |
|------|---------|
| `api/internal/app/finding_activity_service.go` | Publish events on activity creation |
| `api/internal/infra/http/routes/routes.go` | Add SSE route |
| `api/cmd/server/services.go` | Wire up ActivityNotifier |
| `ui/src/features/findings/components/detail/activity-panel.tsx` | Integrate real-time updates |

---

## Alternatives Considered

### WebSocket
- **Rejected**: Overkill for one-way communication
- More complex connection management
- Requires separate WebSocket server or upgrade handling

### Long Polling
- **Rejected**: Less efficient than SSE
- Higher latency
- More server load

### Polling (SWR refreshInterval)
- **Good for short-term**: Simple to implement
- **Not chosen for long-term**: Not truly real-time, wastes bandwidth

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Activity delivery latency | < 500ms |
| SSE connection uptime | > 99.9% |
| Memory usage per connection | < 1MB |
| CPU overhead | < 5% increase |

---

## Rollback Plan

If issues arise:
1. Disable SSE endpoint via feature flag
2. Fall back to SWR polling (add `refreshInterval: 10000`)
3. Activities continue working via regular API

---

## References

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Existing JobNotifier Implementation](../../../api/internal/infra/redis/job_notifier.go)
