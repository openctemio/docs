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
| Platform SMTP | A platform administrator, in the admin console: **System > E-mail** | Account email (invitations, welcome, email verification, password reset, set-password links) for every organization without its own relay, and the set-password link `bootstrap-admin` sends. |
| Organization SMTP | An organization administrator, as an **Email** notification channel (see [Notification channels](notifications.md#email)) | That organization's account email and its email notifications. |

For account email, an organization's connected Email channel wins; otherwise
the platform SMTP is used; with neither, the email is skipped and a warning is
logged.

## Configure platform SMTP

Open the admin console (`/admin`) as a platform administrator, go to
**System > E-mail**, enter the relay (host, port, user, password, sender
address and name, STARTTLS) and save. Saving needs a super administrator and a
fresh authenticator code. **Send test** sends a message to your own address.
The setting applies to the next message, without a restart. The password is
stored encrypted with `APP_ENCRYPTION_KEY`.

The connection uses TLS 1.2 or later and always verifies the relay's
certificate.

{: .warning }
The `SMTP_*` environment variables of earlier releases (`SMTP_ENABLED`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`,
`SMTP_FROM_NAME`, `SMTP_TLS`, `SMTP_SKIP_VERIFY`, `SMTP_TIMEOUT`) are gone. The
API refuses to start while one of them is set, and says so: remove them from
`.env`, `docker-compose.override.yml`, the all-in-one env file or the Helm
values, and enter the relay in the console instead.

### Headless installs

To have email working before anyone signs in, pass the relay to
`bootstrap-admin` (see [First administrator](../install/first-admin.md)). It
stores these as the platform setting when none is stored yet. Change them later
in the console.

| Variable | Meaning |
|---|---|
| `BOOTSTRAP_SMTP_HOST` | Relay host name. |
| `BOOTSTRAP_SMTP_PORT` | Relay port (default 587). |
| `BOOTSTRAP_SMTP_USER` / `BOOTSTRAP_SMTP_PASSWORD` | Credentials, if the relay requires authentication. |
| `BOOTSTRAP_SMTP_FROM` | Sender address, for example `openctem@example.com`. |
| `BOOTSTRAP_SMTP_FROM_NAME` | Sender display name (default `OpenCTEM`). |
| `BOOTSTRAP_SMTP_STARTTLS` | `false` turns STARTTLS off (default on). |

Links in email use the platform's public origin (`APP_URL`, which the Compose
stack sets from `OPENCTEM_PUBLIC_URL`). Set `SMTP_BASE_URL` only when the
console is served at a different origin.

## Relays on a private network

The API refuses to connect to an SMTP host that resolves to a private address
(RFC 1918 or IPv6 ULA) unless that range is listed in
`OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS`, and never connects to loopback or
link-local addresses. For a relay on a private address, list the smallest range
that holds it, for example `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS=10.20.30.0/24`.
The list applies to every outbound connection of the API, for every
organization: webhook and integration URLs in that range become reachable too. A relay on the Docker host itself must be reached through
an address other than `127.0.0.1`.

## Check that it works

Use **Send test** on **System > E-mail**. To check account email end to end,
invite a user to an organization (or use **Forgot password** on the sign-in
page) and watch the API log:

```bash
docker compose logs -f api | grep -i -E "email|smtp"
```

## Troubleshooting

| The API log contains | Cause |
|---|---|
| `email service not configured, skipping ...` | No platform SMTP is saved in **System > E-mail** and the organization has no Email channel. |
| `smtp host rejected: ...` | The host resolves to a private, loopback or link-local address. See [Relays on a private network](#relays-on-a-private-network). |
| `failed to connect: ...` | Wrong host or port, or outbound SMTP blocked by a firewall. |
| `failed to start TLS: ...` | The relay does not offer STARTTLS on that port, or its certificate does not match the host name. |

If links in email show `localhost`, set `OPENCTEM_PUBLIC_URL` (Compose) or
`APP_URL` to the public origin.
