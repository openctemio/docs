---
layout: default
title: Notification System
parent: Architecture
nav_order: 6
---

# Notification System Architecture

Technical architecture for the real-time notification system in OpenCTEM CTEM Platform.

---

## Overview

The notification system provides real-time alerts when security findings are detected. It supports 5 providers (Slack, Teams, Telegram, Email, Webhook) with async delivery, severity filtering, and full audit history.

### Key Design Goals

- **Non-blocking**: Notifications don't slow down finding creation
- **Reliable**: Full history tracking with success/failure status
- **Secure**: Internal-only triggers, encrypted credentials
- **Extensible**: Easy to add new providers

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          NOTIFICATION SYSTEM FLOW                                │
└─────────────────────────────────────────────────────────────────────────────────┘

TRIGGER SOURCES                     INTEGRATION SERVICE                 PROVIDERS
─────────────────                   ───────────────────                 ─────────

┌──────────────────┐
│ VulnerabilityService │
│ CreateFinding()      │
│   └─ goroutine       │──────┐
└──────────────────────┘      │
                              │     ┌─────────────────────────────┐
┌──────────────────┐          │     │    IntegrationService       │
│ ScanService      │          │     │                             │
│ OnScanComplete() │──────────┼────▶│  NotifyNewFinding()         │     ┌─────────┐
└──────────────────┘          │     │    └─ BroadcastNotification │────▶│  Slack  │
                              │     │         └─ SendNotification │     └─────────┘
┌──────────────────┐          │     │                             │     ┌─────────┐
│ Future Triggers  │          │     │  Rate Limiting (30s)        │────▶│  Teams  │
│ - Exposure alerts│──────────┘     │  Severity Filtering         │     └─────────┘
│ - SLA breaches   │                │  History Recording          │     ┌──────────┐
└──────────────────┘                │                             │────▶│ Telegram │
                                    │  ┌───────────────────────┐  │     └──────────┘
                                    │  │ NotificationHistory   │  │     ┌─────────┐
                                    │  │  - status: pending    │  │────▶│  Email  │
                                    │  │  - status: success    │  │     └─────────┘
                                    │  │  - status: failed     │  │     ┌─────────┐
                                    │  └───────────────────────┘  │────▶│ Webhook │
                                    └─────────────────────────────┘     └─────────┘
```

---

## Core Components

### 1. FindingNotifier Interface

```go
// internal/app/vulnerability_service.go

type FindingNotifier interface {
    NotifyNewFinding(tenantID, title, body, severity, url string)
}
```

This interface decouples notification logic from business services, enabling:
- Easy testing with mocks
- Future notification strategies (queue-based, etc.)
- Clear separation of concerns

### 2. IntegrationService Methods

| Method | Purpose | Execution |
|--------|---------|-----------|
| `NotifyNewFinding()` | Broadcast to all channels | Async (goroutine) |
| `BroadcastNotification()` | Send to all matching channels | Sync |
| `SendNotification()` | Send to specific channel | Sync |
| `TestNotificationIntegration()` | Verify channel connection | Sync + Rate-limited |

### 3. NotificationExtension Settings

```go
// internal/domain/integration/notification_extension.go

type NotificationExtension struct {
    channelID          string       // Provider-specific ID
    channelName        string       // Display name
    notifyOnCritical   bool         // Default: true
    notifyOnHigh       bool         // Default: true
    notifyOnMedium     bool         // Default: false
    notifyOnLow        bool         // Default: false
    enabledEventTypes  []EventType  // Dynamic event routing (JSONB)
    messageTemplate    string       // Custom message format
    includeDetails     bool         // Extended info
    minIntervalMinutes int          // Rate limiting
}

type EventType string

const (
    EventTypeFindings  EventType = "findings"
    EventTypeExposures EventType = "exposures"
    EventTypeScans     EventType = "scans"
    EventTypeAlerts    EventType = "alerts"
)
```

### 4. Event Type Filtering

Event types are stored as a JSONB array in PostgreSQL, allowing dynamic filtering without schema changes:

```sql
-- Storage format in integration_notification_extensions
enabled_event_types JSONB DEFAULT '["findings", "exposures", "alerts"]'

-- Example values
'["findings"]'                           -- Findings only
'["findings", "exposures", "alerts"]'    -- Default: all except scans
'[]'                                     -- Empty = all events (backward compatible)
```

**Benefits:**
- No migration needed to add new event types
- Flexible filtering with any combination
- Backward compatible (empty/null = all events)

---

## Notification Flow

### Step 1: Async Trigger

When a new finding is created:

```go
// internal/app/vulnerability_service.go:CreateFinding()

// Fire-and-forget pattern
if s.findingNotifier != nil {
    go s.findingNotifier.NotifyNewFinding(
        input.TenantID,
        fmt.Sprintf("New %s Finding: %s", f.Severity().String(), input.ToolName),
        f.Message(),
        f.Severity().String(),
        fmt.Sprintf("/findings/%s", f.ID().String()),
    )
}
```

**Design Decision**: Using goroutines ensures finding creation is never blocked by notification delivery.

### Step 2: NotifyNewFinding

```go
// internal/app/integration_service.go:NotifyNewFinding()

func (s *IntegrationService) NotifyNewFinding(tenantID, title, body, severity, url string) {
    // Background context with timeout prevents infinite hangs
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    results, err := s.BroadcastNotification(ctx, BroadcastNotificationInput{...})

    // Log results - errors don't propagate (fire-and-forget)
    if err != nil {
        s.logger.Error("failed to broadcast", "error", err)
        return
    }

    // Count successes for metrics
    successCount := 0
    for _, r := range results {
        if r.Success {
            successCount++
        }
    }
    s.logger.Info("notification broadcasted",
        "total", len(results),
        "success", successCount,
    )
}
```

### Step 3: BroadcastNotification

```go
// internal/app/integration_service.go:BroadcastNotification()

func (s *IntegrationService) BroadcastNotification(ctx context.Context, input BroadcastNotificationInput) ([]SendNotificationResult, error) {
    // Get all notification integrations for tenant
    integrations, _ := s.ListNotificationIntegrations(ctx, input.TenantID)

    results := make([]SendNotificationResult, 0, len(integrations))

    for _, iwn := range integrations {
        // Skip non-connected integrations
        if iwn.Status() != integration.StatusConnected {
            continue
        }

        // Check event type filter BEFORE sending
        if iwn.Notification != nil && !iwn.Notification.ShouldNotifyEventType(input.EventType) {
            continue
        }

        // Check severity filter BEFORE sending
        if iwn.Notification != nil && !iwn.Notification.ShouldNotify(input.Severity) {
            continue
        }

        // Send to this integration
        result, _ := s.SendNotification(ctx, SendNotificationInput{
            IntegrationID: iwn.ID().String(),
            TenantID:      input.TenantID,
            Title:         input.Title,
            Body:          input.Body,
            Severity:      input.Severity,
            URL:           input.URL,
        })
        results = append(results, *result)
    }

    return results, nil
}
```

**Event Type Filter Logic:**
```go
// ShouldNotifyEventType checks if the event type should trigger notification
func (e *NotificationExtension) ShouldNotifyEventType(eventType EventType) bool {
    // Empty list = all events enabled (backward compatible)
    if len(e.enabledEventTypes) == 0 {
        return true
    }
    for _, et := range e.enabledEventTypes {
        if et == eventType {
            return true
        }
    }
    return false
}
```

### Step 4: SendNotification (with History)

```go
// internal/app/integration_service.go:SendNotification()

func (s *IntegrationService) SendNotification(ctx context.Context, input SendNotificationInput) (*SendNotificationResult, error) {
    // 1. Create pending history entry
    history := integration.NewNotificationHistory(...)
    history.SetMetadata("provider", intg.Provider().String())
    s.notificationHistoryRepo.Create(ctx, history)

    // 2. Build provider client
    config, _ := s.buildNotificationConfig(intg, notifExt)
    client, _ := s.notificationFactory.CreateClient(config)

    // 3. Send notification
    result, err := client.Send(ctx, msg)

    // 4. Update history based on result
    if result.Success {
        history.MarkSuccess(result.MessageID)
    } else {
        history.MarkFailed(result.Error)
    }
    s.notificationHistoryRepo.Update(ctx, history)

    return &SendNotificationResult{...}, nil
}
```

---

## Provider Implementations

### Provider Factory

```go
// internal/infra/notification/client.go

type Client interface {
    Send(ctx context.Context, msg Message) (*SendResult, error)
    TestConnection(ctx context.Context) (*SendResult, error)
    Provider() string
}

func (f *ClientFactory) CreateClient(config Config) (Client, error) {
    switch config.Provider {
    case ProviderSlack:
        return NewSlackClient(config)
    case ProviderTeams:
        return NewTeamsClient(config)
    case ProviderTelegram:
        return NewTelegramClient(config)
    case ProviderEmail:
        return NewEmailClient(config)
    case ProviderWebhook:
        return NewWebhookClient(config)
    }
}
```

### Provider Comparison

| Provider | Config | Message Format | HTTP Timeout |
|----------|--------|----------------|--------------|
| **Slack** | Webhook URL | Blocks + Attachments | 30s |
| **Teams** | Webhook URL | Adaptive Cards | 30s |
| **Telegram** | Bot Token + Chat ID | Markdown + Buttons | 30s |
| **Email** | SMTP config | HTML + CSS | 30s |
| **Webhook** | Custom URL | JSON payload | 30s |

### Severity Indicators

| Severity | Color Code | Slack Emoji | Teams Style |
|----------|------------|-------------|-------------|
| Critical | `#dc2626` | :rotating_light: | attention |
| High | `#ea580c` | :warning: | warning |
| Medium | `#ca8a04` | :large_yellow_circle: | accent |
| Low | `#2563eb` | :large_blue_circle: | good |

---

## Security

### Credentials Encryption

All credentials are encrypted at rest:

```go
// internal/app/integration_service.go

func (s *IntegrationService) decryptCredentials(intg *integration.Integration) string {
    encrypted := intg.CredentialsEncrypted()
    decrypted, err := s.encryptor.DecryptString(encrypted)
    if err != nil {
        // Fallback: backward compatibility with plaintext
        return encrypted
    }
    return decrypted
}
```

**Encryption**: AES-256-GCM with configurable key format (hex/base64/raw)

**Environment Variable**: `APP_ENCRYPTION_KEY`

### Rate Limiting

```go
// internal/app/integration_service.go

const testNotificationRateLimit = 30 * time.Second

type IntegrationService struct {
    testRateLimitMu  sync.RWMutex
    testRateLimitMap map[string]time.Time  // integration ID -> last test time
}

func (s *IntegrationService) checkTestRateLimit(integrationID string) error {
    s.testRateLimitMu.RLock()
    lastTest, exists := s.testRateLimitMap[integrationID]
    s.testRateLimitMu.RUnlock()

    if exists && time.Since(lastTest) < testNotificationRateLimit {
        remaining := testNotificationRateLimit - time.Since(lastTest)
        return fmt.Errorf("rate limit exceeded, wait %d seconds", int(remaining.Seconds()))
    }

    s.testRateLimitMu.Lock()
    s.testRateLimitMap[integrationID] = time.Now()
    s.testRateLimitMu.Unlock()

    return nil
}
```

### Internal-Only Triggers

For security, there is no public `/send` API. Notifications are triggered only:
- Internally by VulnerabilityService when findings are created
- Via Test Notification button (rate-limited)
- Future: ExposureService, SLAService, etc.

---

## Database Schema

### integration_notification_extensions Table

```sql
CREATE TABLE integration_notification_extensions (
    integration_id UUID PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
    channel_id VARCHAR(255),
    channel_name VARCHAR(255),
    notify_on_critical BOOLEAN DEFAULT TRUE,
    notify_on_high BOOLEAN DEFAULT TRUE,
    notify_on_medium BOOLEAN DEFAULT FALSE,
    notify_on_low BOOLEAN DEFAULT FALSE,
    enabled_event_types JSONB DEFAULT '["findings", "exposures", "alerts"]',
    message_template TEXT,
    include_details BOOLEAN DEFAULT TRUE,
    min_interval_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN index for efficient JSONB containment queries
CREATE INDEX idx_notification_extensions_event_types
ON integration_notification_extensions USING GIN (enabled_event_types);
```

### notification_events Table (Replaces notification_history)

> **Note:** The `notification_history` table has been removed in migration `000075`. Use `notification_events` instead.

```sql
CREATE TABLE notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID,
    title VARCHAR(500) NOT NULL,
    body TEXT,
    severity VARCHAR(20) NOT NULL,
    url VARCHAR(2000),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL,  -- completed, failed, skipped
    integrations_total INT NOT NULL DEFAULT 0,
    integrations_matched INT NOT NULL DEFAULT 0,
    integrations_succeeded INT NOT NULL DEFAULT 0,
    integrations_failed INT NOT NULL DEFAULT 0,
    send_results JSONB DEFAULT '[]',  -- Array of {integration_id, name, provider, status, error, sent_at}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_events_tenant ON notification_events(tenant_id);
CREATE INDEX idx_notification_events_processed_at ON notification_events(processed_at DESC);
CREATE INDEX idx_notification_events_status ON notification_events(status);
```

### Status Transitions

```
┌─────────┐
│ pending │────────────┬────────────────┐
└─────────┘            │                │
                       ▼                ▼
               ┌───────────┐    ┌────────────┐
               │  success  │    │   failed   │
               └───────────┘    └────────────┘
```

---

## Wiring (Dependency Injection)

```go
// cmd/server/main.go

// Initialize repositories
integrationNotificationExtRepo := postgres.NewIntegrationNotificationExtensionRepository(db, integrationRepo)
notificationHistoryRepo := postgres.NewNotificationHistoryRepository(db)

// Initialize IntegrationService
integrationService := app.NewIntegrationService(
    integrationRepo,
    integrationSCMExtRepo,
    credentialsEncryptor,
    log,
)
integrationService.SetNotificationExtensionRepository(integrationNotificationExtRepo)
integrationService.SetNotificationHistoryRepository(notificationHistoryRepo)

// Wire VulnerabilityService to IntegrationService for notifications
vulnerabilityService.SetFindingNotifier(integrationService)
log.Info("finding notifier configured")
```

---

## Adding a New Provider

### 1. Create Client Implementation

```go
// internal/infra/notification/discord.go

type DiscordClient struct {
    webhookURL string
    httpClient *http.Client
}

func NewDiscordClient(config Config) (*DiscordClient, error) {
    return &DiscordClient{
        webhookURL: config.WebhookURL,
        httpClient: &http.Client{Timeout: 30 * time.Second},
    }, nil
}

func (c *DiscordClient) Send(ctx context.Context, msg Message) (*SendResult, error) {
    // Format message for Discord embed
    // POST to webhook URL
    // Return result
}

func (c *DiscordClient) TestConnection(ctx context.Context) (*SendResult, error) {
    return c.Send(ctx, testMessage)
}

func (c *DiscordClient) Provider() string {
    return "discord"
}
```

### 2. Register in Factory

```go
// internal/infra/notification/client.go

case ProviderDiscord:
    return NewDiscordClient(config)
```

### 3. Add Provider Constant

```go
// internal/domain/integration/provider.go

ProviderDiscord Provider = "discord"
```

---

## Adding a New Trigger Source

### 1. Add Notifier Interface

```go
// internal/app/exposure_service.go

type ExposureNotifier interface {
    NotifyNewExposure(tenantID, title, body, severity, url string)
}

type ExposureService struct {
    exposureNotifier ExposureNotifier
}

func (s *ExposureService) SetExposureNotifier(notifier ExposureNotifier) {
    s.exposureNotifier = notifier
}
```

### 2. Trigger Async Notification

```go
func (s *ExposureService) CreateExposure(ctx context.Context, input CreateExposureInput) (*Exposure, error) {
    // Create exposure...

    // Fire-and-forget notification
    if s.exposureNotifier != nil {
        go s.exposureNotifier.NotifyNewExposure(
            input.TenantID,
            "New Credential Exposure Detected",
            exposure.Source,
            "high",
            fmt.Sprintf("/exposures/%s", exposure.ID),
        )
    }

    return exposure, nil
}
```

### 3. Wire in Main

```go
// cmd/server/main.go

exposureService.SetExposureNotifier(integrationService)
```

---

## Best Practices

### 1. Async Pattern
- Always use goroutines for notification triggers
- Use `context.WithTimeout` for bounded execution (30s)
- Log errors but don't fail the primary operation

### 2. Event Type Filtering
- Check event type BEFORE severity filtering
- Use JSONB for flexible, schema-less storage
- Empty array = all events (backward compatible)
- Add new event types without migrations

### 3. Severity Filtering
- Check severity BEFORE attempting send
- Skip early to avoid unnecessary processing
- Default: Critical and High enabled

### 4. History Recording
- Create history entry BEFORE sending (status: pending)
- Update status AFTER send attempt (success/failed)
- Store provider-specific message IDs

### 5. Error Handling
- Fire-and-forget for internal triggers
- Return errors for explicit API calls (Test Notification)
- Always log notification failures with context

### 6. Testing
- Rate limit test notifications (30s)
- Test notifications record in history
- Verify provider connectivity before enabling in production

---

## Related Documentation

- [Notification Integrations Guide](../guides/notification-integrations.md)
- [Clean Architecture](./clean-arch.md)
- [Scan Pipeline Design](./scan-pipeline-design.md)
