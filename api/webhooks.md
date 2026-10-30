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

- **At least once, per channel.** Each channel an event goes to is delivered and retried on its
  own: a failure on one channel never stops the retries of another, and a channel that got the
  event is not sent it again. A failed channel is retried after 1 minute, 5 minutes, 30 minutes,
  2 hours, 6 hours, 12 hours and 24 hours (8 attempts, about 45 hours), then given up.
  Each delivery carries an `Idempotency-Key` header (`outbox-<event id>`), identical across
  retries and redeliveries, so a receiver can drop duplicates.
- **No redirects.** A `3xx` answer is a failed delivery: the body is never forwarded to another
  host.
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
  `GET /api/v1/integrations/{id}/notification-events` (needs `integrations:manage`), with each
  channel's result and number of attempts. Pending and failed entries are under
  `/api/v1/notification-outbox` (list, stats, `POST .../{id}/retry`, `DELETE .../{id}`).
- **Redelivery.** `POST /api/v1/integrations/{id}/deliveries/{delivery_id}/redeliver` (needs
  `integrations:manage`, 30 a minute per organization, audited) sends an event from the history
  (`delivery_id` is its `id`) again to that channel only. It keeps the original `webhook-id` and
  `Idempotency-Key`, and is retried like any delivery. An event that never went to that channel
  answers `404`.
- **Credentials** (bot tokens, HEC tokens, SMTP passwords) are encrypted at rest with
  `APP_ENCRYPTION_KEY`.
- **Email on a hosted service** (`MANAGED_SERVICE=true`): the email channel refuses port 25 and any
  relay without a user name and password or without TLS or STARTTLS, when it is saved, tested and
  before every send. A channel that does not meet the rule stops sending and shows
  `INTEGRATION_EMAIL_RELAY_POLICY` with the reason, and each owner is told in the app and by email.
  Use port 465, 587 or 2525 with a login and TLS, then test the channel. Self-managed installs are
  not affected.
- **Organization mail through the email channel.** An owner or administrator can tick **Also send my
  organization's business mail through this server** on an email channel: invitation notices,
  member notices and scheduled reports then go through it, as far as the platform setting allows
  (`off`, `verified_sender` or `on`; see [E-mail](../console/settings.md#e-mail)). Account security
  mail never does. Off by default, also for existing channels.

### Generic webhook payload

```http
POST /your/endpoint HTTP/1.1
Content-Type: application/json
User-Agent: OpenCTEM-Notification/1.0
Idempotency-Key: outbox-3f0d6c1e-5b8a-4a51-9a59-0c2b7d1e8f42
webhook-id: outbox-3f0d6c1e-5b8a-4a51-9a59-0c2b7d1e8f42
webhook-timestamp: 1791451800
webhook-signature: v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4=
```

```json
{
  "event_type": "new_finding",
  "event_version": 1,
  "idempotency_key": "outbox-3f0d6c1e-5b8a-4a51-9a59-0c2b7d1e8f42",
  "occurred_at": "2026-10-08T09:29:58Z",
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
| `event_type` | the event type, for example `new_finding`, `sensor.offline` or `ci.gate_failing` (list in [Notification channels](../configuration/notifications.md#events)); `test` for a test delivery |
| `event_version` | version of this event type's payload (`1` today); an incompatible change to a type raises it and is announced in the changelog |
| `idempotency_key` | the same value as the `Idempotency-Key` and `webhook-id` headers |
| `occurred_at` | when the event happened, RFC 3339 UTC |
| `timestamp` | when this attempt was sent, RFC 3339 UTC |
| `title`, `body` | the rendered message (a channel's message template, if set, is applied) |
| `severity` | `critical`, `high`, `medium`, `low` or `info` |
| `url` | link to the object in the console, when there is one |
| `color` | the severity color |
| `fields`, `footer_text`, `attachments` | optional extra content |
| `source` | always `openctem.io` |

Any `2xx` answer is success; anything else, or no answer within 30 seconds, is a failure and is
retried. Only the first 1 MiB of a response body is read.

Older releases sent `"event_type": "notification"` for every event; match the event types instead.

### Verifying generic webhooks

Deliveries are signed in the [Standard Webhooks](https://www.standardwebhooks.com/) format, so any
library for that format verifies them:

| Header | Value |
|---|---|
| `webhook-id` | `outbox-<event id>`, the same on every retry and redelivery of the event (`msg_<random>` for a test delivery) |
| `webhook-timestamp` | Unix seconds when this attempt was sent |
| `webhook-signature` | `v1,<base64 HMAC-SHA256>` over `<webhook-id>.<webhook-timestamp>.<raw body>`; two space-separated signatures while a rotated secret overlaps |

**The secret.** Each webhook channel has its own secret, `whsec_` followed by base64. Generate it
(the first time) or rotate it with `POST /api/v1/integrations/{id}/signing-secret/rotate`
(`integrations:manage` and [step-up](../identity/two-factor.md#step-up-re-authentication)); the
response shows the secret **once**. It is stored encrypted and never shown again;
`GET /api/v1/integrations/{id}/signing-secret` only says whether one is set and when it was
rotated. After a rotation the previous secret keeps signing for 24 hours, so deliveries carry both
signatures until the receiver uses the new secret. A channel without a secret sends unsigned
deliveries (still with `webhook-id` and `webhook-timestamp`): generate one and turn verification
on in the receiver. A test delivery (**Send test**) is signed too.

**The receiver** must:

1. take the key: the secret without `whsec_`, base64-decoded;
2. compute HMAC-SHA256 with that key over `webhook-id`, `.`, `webhook-timestamp`, `.` and the raw
   request body, exactly as received (before any JSON parsing), and base64-encode it;
3. accept the delivery if it equals any `v1,` signature in `webhook-signature`, compared in
   constant time;
4. refuse a `webhook-timestamp` more than 5 minutes away from its own clock (replay);
5. drop a `webhook-id` it has already processed (retries and redeliveries reuse it).

Python:

```python
import base64, hashlib, hmac, time

def verify(secret: str, headers, body: bytes, tolerance: int = 300) -> bool:
    msg_id = headers["webhook-id"]
    ts = headers["webhook-timestamp"]
    if abs(time.time() - int(ts)) > tolerance:
        return False
    key = base64.b64decode(secret.removeprefix("whsec_"))
    signed = msg_id.encode() + b"." + ts.encode() + b"." + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    for part in headers["webhook-signature"].split():
        version, _, sig = part.partition(",")
        if version == "v1" and hmac.compare_digest(sig, expected):
            return True
    return False
```

Node.js:

```js
const crypto = require('node:crypto')

function verify(secret, headers, rawBody, toleranceSeconds = 300) {
  const id = headers['webhook-id']
  const ts = headers['webhook-timestamp']
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSeconds) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${ts}.`)
    .update(rawBody) // a Buffer with the exact bytes received
    .digest()
  return headers['webhook-signature'].split(' ').some((part) => {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) return false
    const got = Buffer.from(sig, 'base64')
    return got.length === expected.length && crypto.timingSafeEqual(got, expected)
  })
}
```

Go:

```go
func verify(secret string, h http.Header, body []byte, now time.Time) bool {
	id, ts := h.Get("webhook-id"), h.Get("webhook-timestamp")
	sec, err := strconv.ParseInt(ts, 10, 64)
	if err != nil || math.Abs(now.Sub(time.Unix(sec, 0)).Seconds()) > 300 {
		return false
	}
	key, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_"))
	if err != nil {
		return false
	}
	m := hmac.New(sha256.New, key)
	m.Write([]byte(id + "." + ts + "."))
	m.Write(body)
	want := base64.StdEncoding.EncodeToString(m.Sum(nil))
	for _, part := range strings.Fields(h.Get("webhook-signature")) {
		if v, sig, ok := strings.Cut(part, ","); ok && v == "v1" && hmac.Equal([]byte(sig), []byte(want)) {
			return true
		}
	}
	return false
}
```

Still accept only HTTPS and treat titles and bodies as untrusted text: a valid signature proves
the delivery came from your OpenCTEM, not that text quoted from a scan target is safe.

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
    "event_type": "new_finding",
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

An organization with several Jira integrations names one with `integration_id` in the body of
`POST /api/v1/findings/{id}/create-ticket`, `POST /api/v1/findings/{id}/ticket-links` and
`POST /api/v1/remediation/tasks/{task_id}/ticket-links`; without it the newest connected Jira
integration is used. Later status pushes and comments go to the integration that owns the issue.
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
| `POST /hooks/github-integrations/{integration_id}` | GitHub | `X-Hub-Signature-256` (GitHub's scheme) under that GitHub integration's own secret | `issues` events (closed, reopened) move the linked findings; `push` events update branch state; other events (including `ping`) are acknowledged |

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
- A delivery acts only on the integration in its URL. With several Jira integrations (two sites,
  or Cloud and Data Center), a change to `SEC-1` on one site never moves what is linked to `SEC-1`
  on another. Issues are matched by their Jira id first, so an issue moved to another project
  (new key) stays linked.
- Every delivery, with or without a status change, records the issue's Jira assignee (account id and
  display name), status category and change time on the linked tickets. Ticket links return them as
  `external_assignee`, `external_status_category` and `external_updated_at`. The assignee is a label
  only: it is never an OpenCTEM assignee and gives no access; unlinking the issue clears it.

API for the console dialog (`integrations:manage`; changing the secret needs a recent sign-in):
`GET /api/v1/integrations/{id}/jira-webhook`, `POST /api/v1/integrations/{id}/jira-webhook/secret/rotate`
and `PUT /api/v1/integrations/{id}/jira-webhook/secret`.

### GitHub

Each GitHub integration has its own webhook URL,
`https://openctem.example.com/hooks/github-integrations/{integration_id}`, so no organization id is
sent and one integration's secret never authenticates another's events. Create the repository or
organization webhook in GitHub with that URL, content type `application/json`, the integration's
secret, and the `issues` and `push` events. Get the URL with
`GET /api/v1/integrations/{id}/github-webhook` (`integrations:manage`) and generate the secret with
`POST /api/v1/integrations/{id}/github-webhook/secret/rotate` (`integrations:manage`,
`integrations:scm:write` and a recent sign-in). The secret is shown once, stored encrypted and never
returned; generating a new one stops the old one at once and is recorded as a critical audit event.

- Replays are refused for 24 hours by the body hash and by the `X-GitHub-Delivery` header (required):
  the same signed body sent again with a new delivery id is acknowledged and ignored.
- A `push` or `issues` event must name its repository. When the integration is bound to a GitHub
  organization, an event for a repository outside it is `403`.
- Bodies over 5 MiB are `400`. The route is rate limited per client address and per integration.
- A valid delivery answers `200`. A delivery that fails to process answers `5xx` and is forgotten, so
  a redelivery from GitHub is processed.

What an issue event does to the findings linked to the issue (every linked finding of the
organization):

| Issue event | Linked findings |
|---|---|
| Closed as completed | The fix is claimed (the findings move to fix applied) and a verification (retest or covered scan) is requested. A ticket never closes a finding. |
| Closed as not planned | A risk acceptance request is opened for each finding and waits for an approver. No fix is claimed. |
| Closed as duplicate | Nothing changes. |
| Reopened | The findings go back to in progress. |

Findings already closed and pentest findings are never moved by an issue.

The `/api/v1/webhooks/incoming/` prefix is closed to new routes; inbound webhooks are served under
`/hooks/{provider}`.

### SIEM and EDR detections (not available)

The former inbound telemetry route was part of the retired sensor protocol v1. Protocol v2 has no
telemetry route yet, so pushing SIEM or EDR detections into OpenCTEM is not available. Outbound
delivery to Splunk HEC (above) is available.
