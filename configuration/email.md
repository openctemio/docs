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
| Platform SMTP | A platform administrator, in the platform console: **Settings > E-mail** | All account security email (account setup and set-password links, first owner and owner recovery links, email verification, password reset, two-factor and sign-in notices), the set-password link `bootstrap-admin` sends, and every organization's business mail unless its own relay carries it. |
| Organization SMTP | An organization administrator, as an **Email** notification channel (see [Notification channels](notifications.md#email)) | That organization's email notifications, and its business mail (invitation notices, member notices, scheduled reports) when **Also send my organization's business mail through this server** is ticked and the platform allows it. |

Account security email always goes through the platform SMTP, never through an
organization's relay. Without a platform SMTP it is skipped and a warning is
logged.

### Organization relays: platform setting

Whether an organization's relay may carry its business mail is the platform
setting `email.tenant_relay` (console API `/api/v1/admin/settings/email-relay`;
changing it needs a super administrator, a fresh step-up and a reason, and is
audited as critical):

| Value | Meaning |
|---|---|
| `off` | Organization relays carry only the organization's notifications. |
| `verified_sender` | Business mail may use the organization's relay when its sender address is on a DNS-verified domain of the organization. Default with `MANAGED_SERVICE=true`. |
| `on` | Business mail may use the organization's relay. Default on a self-managed install. |

Until a super administrator stores a value, `ORG_EMAIL_RELAY_MODE` sets the
default. The tick box is off on every channel until an owner or administrator
ticks it. When an organization's relay cannot be used, invitation notices fall
back to the platform SMTP and scheduled reports are not sent.

On a hosted service (`MANAGED_SERVICE=true`) an organization's relay must use
port 465, 587 or 2525 with a username, a password and TLS or STARTTLS; port 25 is
refused when the channel is saved, tested and before every send. A channel that
breaks the rule shows `INTEGRATION_EMAIL_RELAY_POLICY` with the reason and stops
sending; its owners get a notice. Self-managed installs are not affected.

## Configure platform SMTP

Open the platform console (its own address, not a path of the main application) as a platform administrator, go to
**Settings > E-mail**, enter the relay (host, port, user, password, sender
address and name, STARTTLS) and save. Saving needs a super administrator and a
fresh authenticator code. Pointing platform email at another relay (a different
host, port, connection security or SMTP username) also needs a second super
administrator's approval, because the relay receives every set-password and
password-reset link; rotating the password of the same login, changing the sender,
sending a test and turning email off do not. **Send a test e-mail** sends a message to your own address.
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
in the console. With the Helm chart (0.22.0 and later), set them in
`api.bootstrapAdmin.extraEnv` (see [Kubernetes](../install/kubernetes.md)).

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

Use **Send a test e-mail** on **Settings > E-mail**. To check account email end to end,
invite a user to an organization (or use **Forgot password** on the sign-in
page) and watch the API log:

```bash
docker compose logs -f api | grep -i -E "email|smtp"
```

## Troubleshooting

| The API log contains | Cause |
|---|---|
| `email service not configured, skipping ...` | No platform SMTP is saved in **Settings > E-mail** and the organization has no Email channel. |
| `smtp host rejected: ...` | The host resolves to a private, loopback or link-local address. See [Relays on a private network](#relays-on-a-private-network). |
| `failed to connect: ...` | Wrong host or port, or outbound SMTP blocked by a firewall. |
| `failed to start TLS: ...` | The relay does not offer STARTTLS on that port, or its certificate does not match the host name. |

If links in email show `localhost`, set `OPENCTEM_PUBLIC_URL` (Compose) or
`APP_URL` to the public origin.
