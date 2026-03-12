---
layout: default
title: Real-Time WebSocket
parent: Features
nav_order: 24
---

# Real-Time WebSocket Communication

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03

## Overview

WebSocket-based real-time communication system that pushes live updates to the UI for scan progress, finding activities, AI triage results, and tenant-wide notifications. Replaces the previous SSE (Server-Sent Events) implementation with full-duplex communication.

## Architecture

```
┌─────────┐     WebSocket (cookie auth)    ┌──────────────┐
│ Browser  │◀══════════════════════════════▶│ API Server   │
│          │   ws://host:8080/api/v1/ws    │              │
│ React    │                                │ WebSocket Hub│
│ Provider │   Subscribe: "scan:abc123"     │   ├── Client │
│          │   Data: { status: "running" }  │   ├── Client │
└─────────┘                                 │   └── Client │
                                            └──────┬───────┘
                                                   │
                                            ┌──────▼───────┐
                                            │ Hub.Broadcast │
                                            │ per-channel   │
                                            └──────────────┘
```

## Authentication

WebSocket uses **httpOnly cookie authentication** — the same `auth_token` cookie used by all API calls. No separate token endpoint or query parameter needed.

**How it works:**

1. Browser connects to `ws://{hostname}:8080/api/v1/ws`
2. Browser automatically sends `auth_token` cookie in WebSocket handshake (same domain, `SameSite=Lax`)
3. API `extractToken()` reads cookie and validates JWT
4. WebSocket upgrade proceeds with authenticated user context

**Why cookies work cross-port:**

- Cookies are scoped by **domain**, not port
- `auth_token` is set for domain `192.168.8.204` with `path=/`
- WebSocket to `192.168.8.204:8080` receives the same cookie
- `SameSite=Lax` permits this (same-site, different port)

## Channel System

Clients subscribe to typed channels for targeted updates:

| Channel Format | Purpose | Example |
|----------------|---------|---------|
| `finding:{id}` | Activity updates for a finding | `finding:abc-123` |
| `scan:{id}` | Scan progress and status | `scan:def-456` |
| `tenant:{id}` | Tenant-wide notifications | `tenant:ghi-789` |
| `notification:{id}` | Notification delivery status | `notification:jkl-012` |
| `triage:{finding_id}` | AI triage progress | `triage:abc-123` |

## Backend Implementation

### Key Files

| File | Purpose |
|------|---------|
| `api/internal/infra/websocket/handler.go` | HTTP upgrade handler, auth check |
| `api/internal/infra/websocket/client.go` | Per-connection client with read/write pumps |
| `api/internal/infra/websocket/hub.go` | Central hub managing all clients and broadcasts |
| `api/internal/infra/websocket/types.go` | Message types and channel definitions |

### Hub Pattern

```go
// Hub manages all WebSocket clients
type Hub struct {
    clients    map[*Client]bool
    channels   map[string]map[*Client]bool
    broadcast  chan BroadcastMessage
    register   chan *Client
    unregister chan *Client
}

// Broadcasting to a channel
hub.BroadcastToChannel("scan:abc123", ScanProgressEvent{
    Status:   "running",
    Progress: 75,
})
```

### API Endpoint

```
GET /api/v1/ws
```

- Auth: JWT via cookie (UnifiedAuth middleware)
- Upgrade: HTTP → WebSocket via gorilla/websocket
- Route: `api/internal/infra/http/routes/misc.go`

## Frontend Implementation

### Key Files

| File | Purpose |
|------|---------|
| `ui/src/context/websocket-provider.tsx` | Global WebSocket connection provider |
| `ui/src/lib/websocket/client.ts` | WebSocket client with reconnection logic |
| `ui/src/hooks/use-websocket.ts` | React hooks for channel subscriptions |

### Provider

The `WebSocketProvider` wraps the dashboard layout and establishes a single connection:

```tsx
// Automatic connection on mount, no token management needed
export function WebSocketProvider({ children }) {
  // Connects to ws://{hostname}:8080/api/v1/ws
  // Browser sends auth_token cookie automatically
}
```

### URL Resolution

```typescript
function buildWsUrl(): string {
  // Priority 1: Explicit URL from env
  const explicitUrl = process.env.NEXT_PUBLIC_WS_BASE_URL
  if (explicitUrl) return deriveWsUrl(explicitUrl)

  // Priority 2: Auto-derive from browser hostname + API port
  const apiPort = process.env.NEXT_PUBLIC_API_PORT || '8080'
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${wsProtocol}://${window.location.hostname}:${apiPort}/api/v1/ws`
}
```

### Subscription Hooks

```tsx
// Subscribe to finding activity updates
const { data, isSubscribed } = useFindingChannel<ActivityEvent>(findingId, {
  onData: (event) => {
    // Refresh activity list
    mutateActivities()
  }
})

// Subscribe to scan progress
const { data } = useScanChannel<ScanProgress>(scanId, {
  onData: (progress) => {
    setProgress(progress.percent)
  }
})

// Subscribe to AI triage updates
const { data } = useTriageChannel<TriageResult>(findingId)
```

## Reconnection

The client implements exponential backoff reconnection:

- Initial delay: 1 second
- Max delay: 30 seconds
- Backoff multiplier: 2x
- Automatic resubscription to channels after reconnect

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_WS_BASE_URL` | _(empty)_ | Explicit WebSocket URL. Leave empty for auto-detect |
| `NEXT_PUBLIC_API_PORT` | `8080` | API server port for auto-detect mode |

**Production with nginx:** Leave `NEXT_PUBLIC_WS_BASE_URL` empty. Configure nginx to proxy `/api/v1/ws` to the backend:

```nginx
location /api/v1/ws {
    proxy_pass http://api:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Related Documentation

- [Observability & Monitoring](observability.md) — `websocket_connections_active` metric
- [Notification System](../architecture/notification-system.md) — Real-time notification delivery
