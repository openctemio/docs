---
layout: default
title: WebSocket Setup
parent: Guides
nav_order: 15
---

# WebSocket Setup Guide

This guide covers how to configure WebSocket for real-time features in OpenCTEM.

---

## Overview

OpenCTEM uses WebSocket for real-time updates including:

- **Finding Activities** - Live activity stream updates
- **Scan Progress** - Real-time scan status updates
- **AI Triage** - Instant triage completion notifications
- **Notifications** - Push notifications delivery

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (UI)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  WebSocketProvider                                       │    │
│  │  - Global singleton connection                          │    │
│  │  - Auto-reconnect with exponential backoff              │    │
│  │  - Token-based authentication                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Channel Hooks                                           │    │
│  │  - useFindingChannel (activity updates)                 │    │
│  │  - useScanChannel (scan progress)                       │    │
│  │  - useTriageChannel (AI triage updates)                 │    │
│  │  - useTenantChannel (notifications)                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ ws://host/api/v1/ws?token=xxx
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend (Go)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  WebSocket Handler                                       │    │
│  │  - Upgrade HTTP → WebSocket                             │    │
│  │  - JWT token authentication                             │    │
│  │  - Tenant isolation                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  WebSocket Hub (singleton)                              │    │
│  │  - Manage all active connections                        │    │
│  │  - Handle subscribe/unsubscribe                         │    │
│  │  - Route messages to subscribed clients                 │    │
│  │  - Tenant isolation (clients only see their data)       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Channel Convention

WebSocket channels follow the format: `{type}:{id}`

| Channel Pattern | Description | Example |
|-----------------|-------------|---------|
| `finding:{id}` | Activity updates for a finding | `finding:abc-123` |
| `scan:{id}` | Scan progress updates | `scan:def-456` |
| `triage:{finding_id}` | AI triage status updates | `triage:abc-123` |
| `tenant:{id}` | Tenant-wide notifications | `tenant:xyz-789` |
| `notification:{tenant_id}` | Notification delivery | `notification:xyz-789` |

---

## Message Protocol

### Client → Server

```json
// Subscribe to channel
{
  "type": "subscribe",
  "channel": "finding:abc-123",
  "request_id": "req-1"
}

// Unsubscribe from channel
{
  "type": "unsubscribe",
  "channel": "finding:abc-123",
  "request_id": "req-2"
}

// Ping (keep-alive)
{
  "type": "ping"
}
```

### Server → Client

```json
// Subscribed confirmation
{
  "type": "subscribed",
  "channel": "finding:abc-123",
  "request_id": "req-1",
  "timestamp": 1706812345678
}

// Event data
{
  "type": "event",
  "channel": "finding:abc-123",
  "data": { "activity": {...} },
  "timestamp": 1706812345678
}

// Error
{
  "type": "error",
  "data": { "code": "FORBIDDEN", "message": "Access denied" },
  "timestamp": 1706812345678
}

// Pong (keep-alive response)
{
  "type": "pong",
  "timestamp": 1706812345678
}
```

---

## Nginx Configuration

WebSocket requires special nginx configuration for the upgrade handshake.

### Basic Configuration

```nginx
upstream api_backend {
    server localhost:8080;
    keepalive 64;
}

server {
    listen 80;
    server_name openctem.local;

    # WebSocket endpoint
    location /api/v1/ws {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;

        # Required for WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for persistent connections
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;

        # Disable buffering for real-time
        proxy_buffering off;
    }

    # Regular API requests
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### HTTPS/WSS Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name openctem.example.com;

    ssl_certificate /etc/ssl/certs/openctem.crt;
    ssl_certificate_key /etc/ssl/private/openctem.key;

    # WebSocket over TLS (wss://)
    location /api/v1/ws {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }

    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### Common Nginx Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing `Upgrade` header | 400 Bad Request | Add `proxy_set_header Upgrade $http_upgrade;` |
| Missing `Connection "upgrade"` | Connection closes immediately | Add `proxy_set_header Connection "upgrade";` |
| HTTP 1.0 | WebSocket fails | Use `proxy_http_version 1.1;` |
| Short timeout | Connection drops after 60s | Set `proxy_read_timeout 86400;` |
| Buffering enabled | Messages delayed | Add `proxy_buffering off;` |

---

## Docker Compose Setup

```yaml
version: '3.8'

services:
  api:
    image: openctem/api:latest
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/openctem
      - REDIS_URL=redis://redis:6379
    ports:
      - "8080:8080"
    depends_on:
      - db
      - redis

  ui:
    image: openctem/ui:latest
    environment:
      - BACKEND_API_URL=http://api:8080
      # Leave empty for same-origin WebSocket
      - NEXT_PUBLIC_SSE_BASE_URL=
    ports:
      - "3000:3000"
    depends_on:
      - api

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
      - ui

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=openctem
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## Frontend Configuration

### Environment Variables

```bash
# ui/.env.local

# Backend API URL (server-side rendering)
BACKEND_API_URL=http://api:8080

# WebSocket base URL (client-side)
# Leave empty for same-origin (recommended when nginx proxies /api/v1/ws)
NEXT_PUBLIC_WS_BASE_URL=

# Or specify for cross-origin/direct connection setup
# Example: When running UI on port 80 and API on port 8080 without nginx
# NEXT_PUBLIC_WS_BASE_URL=http://localhost:8080
```

> **Note**: `NEXT_PUBLIC_SSE_BASE_URL` is also supported for backward compatibility.

### Content Security Policy

Update CSP to allow WebSocket connections:

```typescript
// next.config.ts
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    // ... other directives
    // Allow WebSocket connections
    "connect-src 'self' ws://localhost:* wss://localhost:* wss://*.openctem.io",
  ].join('; '),
}
```

### Provider Setup

The `WebSocketProvider` is automatically included in the dashboard layout:

```tsx
// components/layout/dashboard-providers.tsx
export function DashboardProviders({ children }: Props) {
  return (
    <TenantProvider>
      <BootstrapProvider>
        <PermissionProvider>
          <WebSocketProvider>{children}</WebSocketProvider>
        </PermissionProvider>
      </BootstrapProvider>
    </TenantProvider>
  )
}
```

---

## Troubleshooting

### Connection Fails Immediately

**Symptom:** `[WebSocket] Error: WebSocket error` in browser console

**Possible Causes:**

1. **Nginx not configured for WebSocket**
   - Check nginx has `Upgrade` and `Connection` headers
   - Verify `proxy_http_version 1.1;`

2. **CSP blocking WebSocket**
   - Check browser console for CSP errors
   - Add `ws://` and `wss://` to `connect-src`

3. **Backend not running**
   - Check `curl http://localhost:8080/health`
   - Verify API container is healthy

4. **Token invalid/expired**
   - Check browser network tab for 401 response
   - Verify JWT token is valid

### Connection Drops After ~60 Seconds

**Symptom:** WebSocket connects but disconnects after a minute

**Fix:** Increase nginx timeout:

```nginx
proxy_read_timeout 86400;
proxy_send_timeout 86400;
```

### Messages Not Received

**Symptom:** Subscribed but no events arrive

**Check:**

1. Backend is publishing events:
   ```go
   hub.BroadcastEvent("finding:abc-123", data, tenantID)
   ```

2. Correct channel format:
   ```typescript
   // Correct
   useFindingChannel(findingId, ...)

   // Wrong - missing prefix
   useChannel(findingId, ...)
   ```

3. Tenant isolation:
   - Events are filtered by tenant ID
   - User must have access to the finding/scan

### Debug Commands

```bash
# Test WebSocket connection manually
# Install: npm install -g wscat
wscat -c "ws://localhost:8080/api/v1/ws?token=YOUR_JWT_TOKEN"

# Send subscribe message
{"type":"subscribe","channel":"finding:abc-123","request_id":"1"}

# Check nginx configuration
nginx -t

# Check nginx WebSocket logs
tail -f /var/log/nginx/access.log | grep "api/v1/ws"

# Check backend WebSocket connections
curl http://localhost:8080/debug/ws-stats
```

### Browser Compatibility

WebSocket is supported in all modern browsers:

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 16+ |
| Firefox | 11+ |
| Safari | 6+ |
| Edge | 12+ |
| Opera | 12.1+ |

**Note:** Some corporate proxies block WebSocket. The frontend automatically falls back to polling when WebSocket is unavailable.

---

## Security Considerations

1. **Authentication**: JWT token is required for WebSocket connection
2. **Tenant Isolation**: Clients can only subscribe to their tenant's channels
3. **Rate Limiting**: Connection attempts are rate-limited per IP
4. **Origin Check**: In production, configure `CheckOrigin` to verify request origin

```go
// websocket/handler.go
var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        origin := r.Header.Get("Origin")
        // Allow trusted origins only
        return origin == "https://app.openctem.io" ||
               strings.HasSuffix(origin, ".openctem.io")
    },
}
```

---

## Related Documentation

- [AI Triage](../features/ai-triage.md) - Real-time triage updates
- [Docker Deployment](docker-deployment.md) - Complete deployment guide
- [Authentication](authentication.md) - JWT token configuration
