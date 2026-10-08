---
title: Email (SMTP)
parent: Configuration
nav_order: 2
---

# Email (SMTP)
{: .no_toc }

OpenCTEM sends email through an SMTP relay you provide. Without one, the
platform works, but invitations, email verification, password resets and
set-password links are not delivered.

1. TOC
{:toc}

---

## Two levels of SMTP

| Level | Configured by | Used for |
|---|---|---|
| System SMTP | The operator, with `SMTP_*` environment variables | Account email (invitations, welcome, email verification, password reset, set-password links) for every organization without its own relay, and the set-password link `bootstrap-admin` sends. |
| Organization SMTP | An organization administrator, as an **Email** notification channel (see [Notification channels](notifications.md#email)) | That organization's account email and its email notifications. |

For account email, an organization's connected Email channel wins; otherwise
the system SMTP is used; with neither, the email is skipped and a warning is
logged.

## Configure system SMTP

| Variable | Default | Meaning |
|---|---|---|
| `SMTP_ENABLED` | `false` | Turn sending on. |
| `SMTP_HOST` | empty | Relay host name. |
| `SMTP_PORT` | `587` | Relay port. |
| `SMTP_USER` / `SMTP_PASSWORD` | empty | Credentials, if the relay requires authentication. |
| `SMTP_FROM` | empty | Sender address, for example `openctem@example.com`. |
| `SMTP_FROM_NAME` | `OpenCTEM` | Sender display name. |
| `SMTP_TLS` | `true` | Upgrade the connection with STARTTLS. |
| `SMTP_SKIP_VERIFY` | `false` | Skip verification of the relay's certificate. Avoid. |
| `SMTP_TIMEOUT` | `30s` | Time allowed for one delivery. |
| `SMTP_BASE_URL` | `http://localhost:3000` | Public origin used in links, for example `https://ctem.example.com`. |

Email is sent only when `SMTP_ENABLED=true` and `SMTP_HOST`, `SMTP_PORT` and
`SMTP_FROM` are all set. The system relay connects in plain SMTP and then
upgrades with STARTTLS (`SMTP_TLS=true`), the usual mode on port 587. A relay
that only offers implicit TLS (port 465) is not supported at the system level;
an organization Email channel supports both.

### Docker Compose

The Compose `api` service passes `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` from `.env`, and sets
`SMTP_BASE_URL` to `OPENCTEM_PUBLIC_URL`. In `.env`:

```bash
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=openctem@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=openctem@example.com
```

Then `docker compose up -d`. `SMTP_FROM_NAME`, `SMTP_TLS`, `SMTP_SKIP_VERIFY`
and `SMTP_TIMEOUT` go in `docker-compose.override.yml` (see
[Setting other variables](../install/docker-compose.md#setting-other-variables)).

### All-in-one and Helm

Add the variables to the env file (all-in-one) or to `api.extraEnv` /
`api.extraEnvFrom` (Helm; keep `SMTP_PASSWORD` in a Secret). The chart's
gateway settings set `SMTP_BASE_URL` for you.

## Relays on a private network

The API refuses to connect to an SMTP host that resolves to a private address
(RFC 1918 or IPv6 ULA) unless `OPENCTEM_HTTPSEC_ALLOW_PRIVATE=1` is set, and
never connects to loopback or link-local addresses. For a relay on a private
address, set that variable (it also allows private addresses for webhook
and integration URLs). A relay on the Docker host itself must be reached through
an address other than `127.0.0.1`.

## Check that it works

At start the API logs `email service not configured - email features will be
disabled` when system SMTP is off or incomplete; the line is absent when it is
configured. To send a real message, invite a user to an organization (or use
**Forgot password** on the sign-in page) and watch the API log:

```bash
docker compose logs -f api | grep -i -E "email|smtp"
```

## Troubleshooting

| The API log contains | Cause |
|---|---|
| `email service not configured - email features will be disabled` | `SMTP_ENABLED` is not `true`, or `SMTP_HOST`, `SMTP_PORT` or `SMTP_FROM` is empty. |
| `smtp host rejected: ...` | The host resolves to a private, loopback or link-local address. See [Relays on a private network](#relays-on-a-private-network). |
| `failed to connect: ...` | Wrong host or port, or outbound SMTP blocked by a firewall. |
| `failed to start TLS: ...` | The relay does not offer STARTTLS on that port, or its certificate does not match the host name. |

Links in email point at `SMTP_BASE_URL`: if they show `localhost`, set it to the
public origin.
