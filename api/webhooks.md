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

## Inbound webhooks

Inbound webhooks are public endpoints (no session, no API key). Each request names the
organization with `?tenant=<organization id>`, and that value is used only to choose which of
that organization's secrets the signature is checked against. An unsigned or badly signed
request is `401`, and nothing is read from it.

| Endpoint | Sender | Signature | Effect |
|---|---|---|---|
| `POST /api/v1/webhooks/incoming/github?tenant=<id>` | GitHub | `X-Hub-Signature-256` (GitHub's scheme) with the organization's GitHub webhook secret | `issues` events (closed, reopened) update the linked finding; `push` events update branch state; other events (including `ping`) are acknowledged |
| `POST /api/v1/webhooks/incoming/jira?tenant=<id>` | Jira, through a signing relay | `X-OpenCTEM-Signature` and `X-OpenCTEM-Timestamp` (below) | issue updates sync the linked finding's status |

Both always answer `200` once the signature is valid, so the sender does not retry on a
processing error; failures are in the API log.

### The `X-OpenCTEM-Signature` scheme (Jira endpoint)

```
X-OpenCTEM-Timestamp: 1791450000
X-OpenCTEM-Signature: sha256=<hex of HMAC-SHA256(secret, timestamp + "." + raw body)>
```

- The timestamp is Unix seconds and must be within 5 minutes of the server clock (replay
  protection). It is part of the signed input, so it cannot be swapped.
- The signature may be bare hex or prefixed with `sha256=`.
- Bodies over 2 MiB are refused.
- The accepted secrets are the webhook secrets of the organization's Jira integrations, plus the
  platform-wide `JIRA_WEBHOOK_SECRET` if the operator set one. With no secret configured the
  endpoint refuses every request.

A sender that cannot compute this signature itself (Jira's built-in webhooks cannot add a
timestamped HMAC) needs a small relay that signs the body and forwards it:

```bash
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -X POST "https://openctem.example.com/api/v1/webhooks/incoming/jira?tenant=$ORG_ID" \
  -H "Content-Type: application/json" \
  -H "X-OpenCTEM-Timestamp: $TS" -H "X-OpenCTEM-Signature: sha256=$SIG" \
  --data-raw "$BODY"
```

The `/api/v1/webhooks/incoming/` prefix is closed to new routes; future inbound webhooks will be
served under `/hooks/{provider}`.

### SIEM and EDR detections (not available)

The former inbound telemetry route was part of the retired sensor protocol v1. Protocol v2 has no
telemetry route yet, so pushing SIEM or EDR detections into OpenCTEM is not available. Outbound
delivery to Splunk HEC (above) is available.
