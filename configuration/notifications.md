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

1. In the console, open **Settings**, **Integrations**, **Notification channels**.
2. Add a channel, pick the provider, and fill in its settings (below).
3. Choose the **event types** and **severities** the channel receives, and decide whether to turn on **Include details in notifications** (see [Minimal messages by default](#minimal-messages-by-default)).
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
(invitations, password resets) instead of the [platform SMTP](email.md).

### Minimal messages by default

A new channel is created with **Include details in notifications** off. A
message then carries only the event type, the severity and a link back to the
object in the console, with no finding title or description and no asset name,
so Slack, Teams, Telegram, the mail provider or a webhook receiver learns
nothing about the finding. Turn the option on, per channel, to send finding
titles and descriptions as well. The setting is applied before the channel's
message template, so a template can only use what the channel may send. The
API field is `include_details`. Channels created before this default keep
the value they had; open the channel and check it.

### Webhook payload

A webhook channel receives a `POST` with `Content-Type: application/json`,
`User-Agent: OpenCTEM-Notification/1.0`, an `Idempotency-Key` header for
de-duplicating retried deliveries, and the signature headers `webhook-id`,
`webhook-timestamp` and `webhook-signature`:

```json
{
  "event_type": "new_finding",
  "event_version": 1,
  "idempotency_key": "outbox-...",
  "occurred_at": "2026-10-08T07:29:58Z",
  "timestamp": "2026-10-08T07:30:00Z",
  "title": "...",
  "body": "...",
  "severity": "high",
  "url": "https://ctem.example.com/...",
  "fields": {"Asset": "..."},
  "source": "openctem.io"
}
```

Deliveries are signed with the channel's own secret once one is generated:
see [Verifying generic webhooks](../api/webhooks.md#verifying-generic-webhooks)
for the secret, its rotation and receiver code. Use HTTPS, and treat the content
as untrusted input (titles and bodies can carry text from scanned targets;
control characters are removed and lengths are capped before sending).

## Events

A channel receives only the events of the types it is subscribed to, and, for
finding events, only the severities it selects. The list offered in the console
depends on the modules enabled for the organization.

| Event | Category |
|---|---|
| `new_finding`, `finding_fixed`, `finding_reopened`, `finding_priority_escalated`, `finding_assigned` | Findings |
| `sla_warning`, `sla_breach` | Findings (SLA) |
| `approval_requested`, `approval_approved`, `approval_rejected` | Approvals of finding status changes |
| `scoring_change_applied` | Findings (one summary when scoring or SLA settings changed open findings) |
| `new_exposure` | Exposures |
| `attack_surface_digest` | Exposures (weekly summary of external attack surface changes) |
| `new_asset` | Assets |
| `coverage_gap` | Assets (a capability an asset type needs is missing or failing) |
| `remediation_suggestions_digest` | Remediation (daily summary of suggestions to review) |
| `sensor.offline` | Sensors (not enabled by default) |
| `ci.schedule_missed`, `ci.coverage_regression`, `ci.gate_failing`, `ci.runner_outdated`, `ci.break_glass`, `ci.token_refusals`, `ci.ungated_merge` | CI scanning |
| `workflow_notification` | Automations that send a notification without a specific channel |

A channel can also set a minimum interval between messages (5 to 60 minutes) and
a custom message template. Events about assets that only private bug-bounty
programs list go only to the channels attached to those programs.

## Delivery

Events are written to an outbox in the same database transaction as the change
that caused them, then delivered by a background worker every few seconds. Each
channel is retried on its own (after 1 min, 5 min, 30 min, 2 h, 6 h, 12 h and
24 h), so one failing channel does not affect the others, and a channel that got
the event is not sent it again. A delivery can be sent again from its history
(`POST /api/v1/integrations/{id}/deliveries/{delivery_id}/redeliver`). **Settings**, **Integrations**, **Notification channels** shows the
queue (**Queue**) and each channel's delivery history (**View events**), with the
result per channel.

## Network requirements

The API sends notifications itself, so it needs outbound HTTPS to
`hooks.slack.com`, your Teams webhook host, `api.telegram.org`, your webhook
receivers and SMTP to your relay. URLs and SMTP hosts that resolve to private
addresses are refused unless the operator lists their private range in
`OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS` (for example `10.20.0.0/16`); loopback,
link-local and cloud metadata addresses are always refused. See
[Environment variables](environment-variables.md#integrations).

## Operator alerts

Notification channels are for an organization's data. Alerts about the
platform itself reach the platform administrators by e-mail and through an optional HTTPS
webhook set in the platform console (**Settings > Alerts**): low disk, stale backups, expiring
certificates, setting changes and sign-up bursts. Prometheus alerts (API down, error bursts,
stuck queues) come from the monitoring stack's Alertmanager. See
[Monitoring](../operations/monitoring.md).
