---
layout: default
title: Notification Integrations
parent: Platform Guides
nav_order: 10
---

# Notification Integrations

Configure notification channels to receive security alerts through Slack, Microsoft Teams, Telegram, Email, or custom webhooks.

---

## Overview

OpenCTEM supports real-time notifications for security events. Notifications are triggered **internally by the system** when:

- New findings are discovered (via scans)
- Critical/high severity vulnerabilities are detected
- Scan jobs complete with findings
- Exposures are identified

### How Notifications Work

```
┌──────────────────┐       ┌─────────────────────────┐       ┌──────────────┐
│  Finding Created │──────▶│   IntegrationService    │──────▶│   Providers  │
│  (from scan)     │ async │  - Severity filter      │       │ Slack/Teams  │
└──────────────────┘       │  - Broadcast to all     │       │ Telegram/etc │
                           │  - Record history       │       └──────────────┘
                           └─────────────────────────┘
```

**Key Points:**
- Notifications are triggered automatically when findings are created
- The system broadcasts to all connected channels that match severity settings
- Each notification is recorded in history for audit purposes
- Notifications run asynchronously to avoid blocking scans

### Supported Providers

| Provider | Description | Authentication |
|----------|-------------|----------------|
| **Slack** | Send to Slack channels via webhooks | Webhook URL |
| **Microsoft Teams** | Adaptive Card notifications | Webhook URL |
| **Telegram** | Bot-based notifications | Bot Token + Chat ID |
| **Email** | SMTP-based email alerts | SMTP credentials |
| **Custom Webhook** | Any HTTP endpoint | URL |

---

## Setting Up Notifications

### Via UI

1. Navigate to **Settings > Integrations**
2. Click **Notifications** tab
3. Click **Add Channel**
4. Select your provider
5. Configure the connection:
   - Enter a name for the channel
   - Provide credentials (webhook URL, token, or SMTP config)
   - Set severity filters (Critical, High, Medium, Low)
6. Click **Create Channel**
7. Send a **test notification** to verify

### Via API

```bash
# Create a Slack notification channel
curl -X POST /api/v1/integrations/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Security Alerts",
    "description": "Critical security notifications",
    "provider": "slack",
    "auth_type": "token",
    "credentials": "https://hooks.slack.com/services/T00.../B00.../xxx",
    "channel_name": "#security-alerts",
    "notify_on_critical": true,
    "notify_on_high": true,
    "notify_on_medium": false,
    "notify_on_low": false,
    "min_interval_minutes": 5
  }'
```

---

## Provider-Specific Configuration

### Slack

1. Create a Slack App or use an existing one
2. Enable **Incoming Webhooks** in your app settings
3. Add a new webhook to your desired channel
4. Copy the webhook URL

**Webhook URL format:**
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
```

**Message Format:** Slack Blocks with colored sidebars based on severity.

### Microsoft Teams

1. Open the Teams channel where you want notifications
2. Click **...** > **Connectors**
3. Find **Incoming Webhook** and click **Configure**
4. Name your webhook and copy the URL

**Webhook URL format:**
```
https://outlook.office.com/webhook/GUID.../IncomingWebhook/...
```

**Message Format:** Adaptive Cards with severity-based container styles.

### Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather):
   - Send `/newbot` and follow instructions
   - Save the bot token
2. Add the bot to your group/channel
3. Get the Chat ID:
   - For groups: Use `getUpdates` API or invite [@userinfobot](https://t.me/userinfobot)
   - For channels: Use the channel username prefixed with `@`

**Configuration:**
- **Bot Token:** `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
- **Chat ID:** `-1001234567890` (for groups) or `@channelname`

**Message Format:** Markdown text with inline URL buttons.

### Email (SMTP)

Configure SMTP settings to send email notifications:

**Required fields:**
- SMTP Host (e.g., `smtp.gmail.com`)
- SMTP Port (`587` for STARTTLS, `465` for TLS)
- Username
- Password
- From Email
- To Emails (can be multiple recipients)

**Optional:**
- From Name
- Reply-To address
- TLS/STARTTLS toggle

**Message Format:** HTML email with severity colors and CSS styling.

### Custom Webhook

Send notifications to any HTTP endpoint. The payload format:

```json
{
  "event_type": "notification",
  "timestamp": "2025-01-22T10:30:00Z",
  "title": "Critical Vulnerability Detected",
  "body": "SQL Injection found in login.php",
  "severity": "critical",
  "url": "https://app.openctem.io/findings/abc123",
  "fields": {
    "asset": "web-app-prod",
    "tool": "semgrep"
  },
  "color": "#dc2626",
  "source": "openctem.io"
}
```

---

## Event Type Filtering

Control which types of events trigger notifications. This allows you to create specialized channels for different purposes.

### Available Event Types

| Event Type | Description | Default |
|------------|-------------|---------|
| **Findings** | New security findings from scans | Enabled |
| **Exposures** | Credential/data exposure alerts | Enabled |
| **Scans** | Scan completion notifications | Disabled |
| **Alerts** | System alerts and warnings | Enabled |

### Via UI

When creating or editing a channel:
1. In the **Event Types** section, check the event types you want
2. Unchecked types will be filtered out
3. If all types are selected, the channel receives all events

### Via API

```bash
# Create channel with specific event types
curl -X POST /api/v1/integrations/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Findings Only",
    "provider": "slack",
    "credentials": "https://hooks.slack.com/...",
    "enabled_event_types": ["findings"],
    "notify_on_critical": true,
    "notify_on_high": true
  }'
```

**Note:** An empty `enabled_event_types` array means all events are enabled (backward compatible).

---

## Severity Filters

Control which severity levels trigger notifications:

| Severity | Color | Default | Recommended For |
|----------|-------|---------|-----------------|
| **Critical** | Red | Enabled | Always - immediate action required |
| **High** | Orange | Enabled | Security teams |
| **Medium** | Yellow | Disabled | Optional - can be noisy |
| **Low** | Blue | Disabled | Review periodically |

**Severity Indicators by Provider:**

| Severity | Slack | Teams | Telegram |
|----------|-------|-------|----------|
| Critical | :rotating_light: Red sidebar | Attention container | Red text |
| High | :warning: Orange sidebar | Warning container | Orange text |
| Medium | :large_yellow_circle: Yellow | Accent container | Yellow text |
| Low | :large_blue_circle: Blue | Good container | Blue text |

---

## Testing Notifications

### Send Test via UI

1. Go to **Settings > Integrations > Notifications**
2. Find your channel in the list
3. Click **...** > **Send Test**
4. Check your notification channel for the test message

**Note:** Test notifications are rate-limited to **30 seconds** between tests per channel.

### Send Test via API

```bash
# Test notification channel
curl -X POST /api/v1/integrations/{integration-id}/test-notification \
  -H "Authorization: Bearer <token>"
```

---

## Notification History

Every notification sent is recorded for audit purposes.

### View History via UI

1. Go to **Settings > Integrations > Notifications**
2. Click on a channel
3. Select **View History** or navigate to the History page
4. View sent notifications with status (success/failed)

### View Events via API

```bash
# Get notification events for a channel
curl /api/v1/integrations/{integration-id}/notification-events?limit=50 \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "data": [
    {
      "id": "evt-123",
      "tenant_id": "tenant-456",
      "event_type": "new_finding",
      "aggregate_type": "finding",
      "title": "New Critical Finding: Semgrep",
      "body": "SQL Injection vulnerability detected",
      "severity": "critical",
      "status": "completed",
      "integrations_total": 2,
      "integrations_matched": 1,
      "integrations_succeeded": 1,
      "integrations_failed": 0,
      "send_results": [
        {
          "integration_id": "int-456",
          "name": "Security Alerts",
          "provider": "slack",
          "status": "success",
          "message_id": "slack-msg-789",
          "sent_at": "2025-01-22T10:30:00Z"
        }
      ],
      "processed_at": "2025-01-22T10:30:00Z"
    }
  ],
  "total": 1
}
```

### Event Status Values

| Status | Description |
|--------|-------------|
| `completed` | At least one integration succeeded |
| `failed` | All integrations failed after retries |
| `skipped` | No integrations matched the event filters |

---

## API Reference

### List Notification Integrations

```http
GET /api/v1/integrations/notifications
```

**Response:**
```json
{
  "data": [
    {
      "id": "int-123",
      "name": "Security Alerts",
      "provider": "slack",
      "status": "connected",
      "notification_extension": {
        "enabled_severities": ["critical", "high"],
        "enabled_event_types": ["findings", "exposures", "alerts"],
        "min_interval_minutes": 5
      },
      "metadata": {
        "channel_name": "#security-alerts"
      }
    }
  ]
}
```

### Create Notification Integration

```http
POST /api/v1/integrations/notifications
```

**Request Body:**
```json
{
  "name": "Security Alerts",
  "description": "Optional description",
  "provider": "slack|teams|telegram|email|webhook",
  "auth_type": "token",
  "credentials": "webhook-url-or-token-or-smtp-json",
  "channel_id": "optional-for-telegram",
  "channel_name": "optional-display-name",
  "notify_on_critical": true,
  "notify_on_high": true,
  "notify_on_medium": false,
  "notify_on_low": false,
  "enabled_event_types": ["findings", "exposures", "alerts"],
  "message_template": "optional-custom-template",
  "include_details": true,
  "min_interval_minutes": 5
}
```

### Update Notification Integration

```http
PUT /api/v1/integrations/{id}/notification
```

### Test Notification

```http
POST /api/v1/integrations/{id}/test-notification
```

Sends a test notification to verify the channel is working. Rate-limited to 30 seconds between tests.

### Get Notification Events

```http
GET /api/v1/integrations/{id}/notification-events?limit=50&offset=0
```

### Delete Integration

```http
DELETE /api/v1/integrations/{id}
```

---

## Advanced Settings

### Message Templates

Customize notification messages using template variables:

| Variable | Description |
|----------|-------------|
| `{title}` | Notification title |
| `{body}` | Message body |
| `{severity}` | Severity level |
| `{url}` | Link to finding/resource |
| `{timestamp}` | Event timestamp |

### Rate Limiting

- **Test notifications:** 30 seconds between tests per channel
- **General notifications:** Configurable via `min_interval_minutes` (default: 5 minutes)

### Include Details

When `include_details` is enabled, notifications include additional context like:
- Asset information
- Tool that detected the finding
- CVE references (if applicable)

---

## Security Considerations

### Credential Storage

All notification credentials (webhook URLs, tokens, SMTP passwords) are:
- **Encrypted at rest** using AES-256-GCM
- **Never exposed** in API responses
- **Decrypted only** when sending notifications

### Internal-Only Triggers

For security, notifications can only be triggered by the system internally:
- When scans detect new findings
- When the system detects exposures
- Via the Test Notification button (rate-limited)

There is no public API to send arbitrary notifications to prevent abuse.

---

## Best Practices

1. **Use severity filters** - Avoid alert fatigue by only enabling Critical/High for most channels
2. **Use event type filters** - Create specialized channels (e.g., "Findings Only" for security team, "Scans" for DevOps)
3. **Create dedicated channels** - Separate notification channels for different purposes (security vs dev team)
4. **Test before relying** - Always send a test notification after setup
5. **Set rate limits** - Use `min_interval_minutes` to prevent spam during high-volume scans
6. **Monitor history** - Check notification history to verify delivery
7. **Use multiple channels** - Critical alerts should go to multiple channels (e.g., Slack + Email)

---

## Troubleshooting

### Notifications not arriving

1. Check the integration status in **Settings > Integrations > Notifications**
2. Look for error messages in notification history
3. Verify credentials are correct
4. Send a test notification

### Slack webhook returning 404

- The webhook URL may have been revoked
- Regenerate the webhook in Slack app settings

### Telegram bot not responding

- Ensure the bot is added to the group/channel
- Verify the Chat ID is correct (groups use negative IDs)
- Check the bot token hasn't been regenerated

### Email not sending

- Verify SMTP credentials
- Check if your email provider requires app-specific passwords (Gmail, Outlook)
- Ensure TLS/STARTTLS is configured correctly for your port

### Rate limiting errors

- Test notifications have a 30-second cooldown
- Wait and try again
- For production notifications, increase `min_interval_minutes` if too frequent

---

## Related Documentation

- [Notification System Architecture](../architecture/notification-system.md)
- [End-to-End Workflow](./END_TO_END_WORKFLOW.md)
- [Scan Management](./scan-management.md)
- [Authentication](./authentication.md)
