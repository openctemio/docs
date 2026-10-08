---
title: Notification channels
parent: Configuration
nav_order: 3
---

# Notification channels
{: .no_toc }

Notification channels send an organization's events (new findings, SLA
breaches, approvals, offline sensors and more) to Slack, Microsoft Teams,
Telegram, email or any HTTPS endpoint. Channels are configured per organization
in the web console; the operator needs no environment variables for them beyond
a working [encryption key](environment-variables.md#encryption-keys).

Users also get in-app notifications in the console; those need no setup.

1. TOC
{:toc}

---

## Add a channel

1. In the console, open **Settings**, **Integrations**, **Notifications**.
2. Add a channel, pick the provider, and fill in its settings (below).
3. Choose the **event types** and **severities** the channel receives.
4. Use **Send test** to check delivery (tests are limited to one every 30
   seconds per channel).

Managing channels needs the `integrations:manage` permission (organization
owners and administrators have it). Channel credentials (webhook URLs, bot
tokens, SMTP passwords) are stored encrypted with `APP_ENCRYPTION_KEY` and never
shown again; to change one, enter a new value.

| Provider | Settings | Message format |
|---|---|---|
| Slack | Incoming webhook URL | Slack blocks with a colour per severity. |
| Microsoft Teams | Incoming webhook URL | Adaptive card. |
| Telegram | Bot token and chat ID (`-1001234567890` for a group, or `@channelname`) | Markdown with link buttons. |
| Email | SMTP relay, sender and recipients (see [Email](#email)) | HTML email. |
| Webhook | Any HTTPS URL | JSON (see [Webhook payload](#webhook-payload)). |

### Email

An Email channel has its own SMTP settings: host, port, user name and password,
sender address and name, recipients, an optional reply-to address, and the TLS
mode: implicit TLS (usually port 465) or STARTTLS (usually port 587). A
connected Email channel is also used for the organization's account email
(invitations, password resets) instead of the [system SMTP](email.md).

### Webhook payload

A webhook channel receives a `POST` with `Content-Type: application/json`,
`User-Agent: OpenCTEM-Notification/1.0` and, when the event has one, an
`Idempotency-Key` header for de-duplicating retried deliveries:

```json
{
  "event_type": "new_finding",
  "timestamp": "2026-10-08T07:30:00Z",
  "title": "...",
  "body": "...",
  "severity": "high",
  "url": "https://ctem.example.com/...",
  "fields": {"Asset": "..."},
  "source": "openctem.io"
}
```

The request is not signed: use an HTTPS URL that is hard to guess, and treat
the content as untrusted input (titles and bodies can carry text from scanned
targets; control characters are removed and lengths are capped before sending).

## Events

A channel receives only the events of the types it is subscribed to, and, for
finding events, only the severities it selects. The list offered in the console
depends on the modules enabled for the organization.

| Event | Category |
|---|---|
| `new_finding`, `finding_fixed`, `finding_reopened`, `finding_priority_escalated`, `finding_assigned` | Findings |
| `sla_warning`, `sla_breach` | Findings (SLA) |
| `approval_requested`, `approval_approved`, `approval_rejected` | Approvals of finding status changes |
| `new_exposure` | Exposures |
| `new_asset` | Assets |
| `sensor.offline` | Sensors (not enabled by default) |
| `ci.schedule_missed`, `ci.coverage_regression`, `ci.gate_failing`, `ci.runner_outdated`, `ci.break_glass`, `ci.token_refusals` | CI scanning |
| `workflow_notification` | Automations that send a notification without a specific channel |

A channel can also set a minimum interval between messages and a custom message
template.

## Delivery

Events are written to an outbox in the same database transaction as the change
that caused them, then delivered by a background worker every few seconds, with
retries and back-off. **Settings**, **Integrations**, **Notifications** shows the
queue (**Queue**) and each channel's delivery history (**View events**), with the
result per channel.

## Network requirements

The API sends notifications itself, so it needs outbound HTTPS to
`hooks.slack.com`, your Teams webhook host, `api.telegram.org`, your webhook
receivers and SMTP to your relay. URLs and SMTP hosts that resolve to private
addresses are refused unless the operator sets
`OPENCTEM_HTTPSEC_ALLOW_PRIVATE=1`; loopback, link-local and cloud metadata
addresses are always refused.

## Operator alerts

Notification channels are for an organization's data. Alerts about the
platform itself (API down, disk full, failed backups) come from the monitoring
stack's Alertmanager: see [Monitoring](../operations/monitoring.md).
