---
title: Webhooks and outbound integrations
parent: API
nav_order: 3
---

# Webhooks and outbound integrations

OpenCTEM sends events out through **notification channels**, and accepts a small set of
**inbound webhooks** from ticketing and source-control systems. This page describes what goes over
the wire. How to set up a channel in the console is in
[Notification channels](../configuration/notifications.md).

## Outbound: notification channels

When something happens in an organization (a new finding, a finding fixed or reopened, a priority
escalation, an assignment, an SLA warning or breach, an approval request or decision, a new asset,
a completed scan), the event is written to a transactional outbox in the same database transaction as
the change. A background worker delivers it to every channel of the organization whose event and
severity filters match.

| Channel | What is sent |
|---|---|
| Slack | an incoming-webhook message with blocks |
| Microsoft Teams | an Adaptive Card to an incoming webhook |
| Telegram | a Markdown message through a bot to a chat |
| Email | an HTML message over the organization's SMTP settings |
| Generic webhook | a JSON `POST` to any HTTPS URL (below) |
| Splunk HEC | an event to a Splunk HTTP Event Collector (below) |

Delivery rules that apply to every channel:

- **At least once.** A failed delivery is retried with exponential backoff (3 attempts by default).
  Each delivery carries an `Idempotency-Key` header (`outbox-<event id>`), identical across
  retries, so a receiver can drop duplicates.
- **Outbound address checks.** Webhook and HEC URLs are checked when the channel is saved and again
  when connecting: loopback, link-local, private and cloud-metadata addresses are refused, even if
  DNS changes later.
- **Minimal by default.** A channel whose **Include details in notifications** switch is off (the default for a new
  channel) sends only the event type, severity and a link back to OpenCTEM: no finding title, asset
  name or body. Turn it on per channel to send the full message.
- **Untrusted text is cleaned.** Titles and bodies often contain text a scan target controls.
  Control, bidirectional-control and zero-width characters are removed, lengths are capped (title
  300 characters, field 2,000, body 20,000) and each channel escapes its own markup.
- **History.** Each channel's delivery history is in the console, and through
  `GET /api/v1/integrations/{id}/notification-events` (needs `integrations:manage`). Pending and
  failed entries are under `/api/v1/notification-outbox` (list, stats, `POST .../{id}/retry`,
  `DELETE .../{id}`).
- **Credentials** (bot tokens, HEC tokens, SMTP passwords) are encrypted at rest with
  `APP_ENCRYPTION_KEY`.

### Generic webhook payload

```http
POST /your/endpoint HTTP/1.1
Content-Type: application/json
User-Agent: OpenCTEM-Notification/1.0
Idempotency-Key: outbox-3f0d6c1e-5b8a-4a51-9a59-0c2b7d1e8f42
```

```json
{
  "event_type": "notification",
  "timestamp": "2026-10-08T09:30:00Z",
  "title": "New critical finding: ...",
  "body": "...",
  "severity": "critical",
  "url": "https://openctem.example.com/findings/...",
  "color": "#dc2626",
  "source": "openctem.io"
}
```

| Field | Meaning |
|---|---|
| `event_type` | always `notification` |
| `timestamp` | when the delivery was built, RFC 3339 UTC |
| `title`, `body` | the rendered message (a channel's message template, if set, is applied) |
| `severity` | `critical`, `high`, `medium`, `low` or `info` |
| `url` | link to the object in the console, when there is one |
| `color` | the severity color |
| `fields`, `footer_text`, `attachments` | optional extra content |
| `source` | always `openctem.io` |

Any `2xx` answer is success; anything else, or no answer within 30 seconds, is a failure and is
retried. Only the first 1 MiB of a response body is read.

{: .warning }
Generic webhook deliveries are **not signed**. Treat the endpoint URL as a secret (use a long,
random path), accept only HTTPS, and validate the content before acting on it. If you need a
verifiable sender, put the endpoint behind a proxy that checks a secret you include in the URL.

### Splunk HEC

The Splunk channel posts to `<endpoint>/services/collector/event` with
`Authorization: Splunk <HEC token>` and the same `Idempotency-Key` header. The HEC envelope:

```json
{
  "time": 1791450000,
  "sourcetype": "openctem:notification",
  "index": "security",
  "source": "openctem.io",
  "event": {
    "event_type": "notification",
    "title": "...",
    "body": "...",
    "severity": "high",
    "url": "https://openctem.example.com/findings/...",
    "source": "openctem.io"
  }
}
```

`index` is sent only when configured; `sourcetype` defaults to `openctem:notification`.

## Outbound: ticketing

Jira and GitHub Issues integrations create tickets from findings and remediation campaigns with the
organization's own credentials (console: **Settings > Integrations > Ticketing**). Status changes
come back through the inbound webhooks below.

A retried create never opens a second issue: each Jira issue OpenCTEM creates carries the issue
property `openctem` and the label `openctem-ref-<object id>`, and each GitHub issue ends with a
hidden `<!-- openctem:... -->` line. Before creating, OpenCTEM looks for that marker and reuses the
issue it finds (for example after a timeout where Jira created the issue but the reply was lost).
Keep the label and the hidden line on the issue.

## Inbound webhooks

Inbound webhooks are public endpoints (no session, no API key). Each is checked against the secret
of the organization it belongs to, so a sender can never choose another organization's data. An
unsigned or badly signed request is `401`, and nothing is read from it.

| Endpoint | Sender | Signature | Effect |
|---|---|---|---|
| `POST /hooks/jira-integrations/{integration_id}` | Jira | `X-Hub-Signature` (`sha256=` and the hex HMAC-SHA256 of the raw body, the header Jira sends for a webhook with a secret) under that Jira integration's own secret | issue updates sync the linked finding's status |
| `POST /api/v1/webhooks/incoming/github?tenant=<organization id>` | GitHub | `X-Hub-Signature-256` (GitHub's scheme) with the organization's GitHub webhook secret | `issues` events (closed, reopened) update the linked finding; `push` events update branch state; other events (including `ping`) are acknowledged |

### Jira

Each Jira integration has its own webhook URL, so no organization id is sent and there is no
platform-wide secret. In the console open **Settings > Integrations > Ticketing**, choose the Jira
integration and **Inbound webhook**: the dialog shows the URL and lets you generate a secret
(shown once) or enter the one you set in Jira. The secret is stored encrypted and never returned.
In Jira, create a webhook with that URL and secret for issue updates.

- Replays are refused: by delivery id (`X-Atlassian-Webhook-Identifier`, or the body hash when
  absent) for 24 hours, and by the payload timestamp (at most one hour old).
- Bodies over 2 MiB are `400`. The route is rate limited per client address and per integration.
- A valid delivery answers `200`. A delivery that fails to process answers `5xx` and is forgotten, so
  Jira's retry is processed.
- With no secret configured the endpoint refuses every request.

API for the console dialog (`integrations:manage`; changing the secret needs a recent sign-in):
`GET /api/v1/integrations/{id}/jira-webhook`, `POST /api/v1/integrations/{id}/jira-webhook/secret/rotate`
and `PUT /api/v1/integrations/{id}/jira-webhook/secret`.

### GitHub

Point a repository or organization webhook at
`https://openctem.example.com/api/v1/webhooks/incoming/github?tenant=<organization id>` with content
type `application/json`, and the organization's webhook secret (read it with
`GET /api/v1/integrations/github/webhook-secret` and change it with
`POST /api/v1/integrations/github/webhook-secret/rotate`; both need `integrations:manage` and a
recent sign-in).
The `tenant` value only selects which of that organization's secrets the signature is checked
against. Each delivery needs its `X-GitHub-Delivery` header (a replayed delivery id is acknowledged
and ignored for 24 hours) and a body of at most 5 MiB. Valid deliveries answer `200`.

The `/api/v1/webhooks/incoming/` prefix is closed to new routes; inbound webhooks are served under
`/hooks/{provider}`.

### SIEM and EDR detections (not available)

The former inbound telemetry route was part of the retired sensor protocol v1. Protocol v2 has no
telemetry route yet, so pushing SIEM or EDR detections into OpenCTEM is not available. Outbound
delivery to Splunk HEC (above) is available.
