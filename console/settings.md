---
title: Settings
parent: Platform console
nav_order: 3
---

# Console settings
{: .no_toc }

The **Settings** group of the [platform console](index.md): instance-wide behaviour
that applies to every organization. Settings made here apply at once, on every API
replica, without a restart.

Common rules:

- Reading needs any console role; changing a setting needs a **super admin**
  (acting as one, see [Roles and elevation](index.md#roles-and-elevation)), a fresh
  confirmation and, for most settings, a reason.
- Every change writes a row in the admin activity log (never a secret) and is
  emailed to the other administrators.
- Secrets (SMTP password, CAPTCHA secret, webhook secret, AI key) are write-only:
  encrypted with `APP_ENCRYPTION_KEY` and never shown again; the page shows only
  whether one is set.
- Where an environment variable still sets a value, the console shows the setting
  as **Locked by the server**: change it on the server and restart, or remove the
  variable to manage it here.

1. TOC
{:toc}

---

## Configuration

**Configuration** lists every operator setting of the installation in groups
(Instance, Sign-up and sign-in, E-mail, Scanning, Storage, AI, Platform console,
Audit, Alerts, Software updates). For each one it shows:

- where it is managed: **In this console** (applied at once) or **On the server**
  (**Restart to change**);
- where the value comes from: **Set in this console**, **Set on the server** or
  **Default**, and who last changed a console setting;
- **Change**, a link to the page that changes it.

Secrets show only **Set** or **Not set**. Filter with **All**, **In this console**,
**On the server**, **Needs a restart** and **Moving to the console**.

![The Configuration page: the Deployment region card above the setting list, with each setting's source and whether a restart is needed]({{ site.baseurl }}/assets/images/console/configuration.png)
*Figure: Settings, Configuration.*

**Deployment region** (top of the page) is the data region every new organization
is stamped with and shown to its people. It can be set **once, while no
organization exists**, and never changes afterwards; set it before you create the
first organization if you run in more than one region. `DEPLOYMENT_REGION` on the
server locks it.

## Sign-up

**Sign-up** decides who may create an account and an organization. It applies to
email sign-up, Google, Microsoft and GitHub sign-in and creating a team; signing in
to an existing organization through its single sign-on is not affected.

- **Who can create an account?**: **Nobody by public sign-up**, **People on an
  organization's verified domain** (they join that organization and never create
  one) or **Anyone** (disposable addresses are refused; every address is verified
  by email).
- **Who can create an organization?**: **Only platform administrators** or
  **Anyone who signs up** (needs **Anyone** above).
- **Let people request access**: when only administrators create organizations,
  people who cannot sign in may ask for one ([Access requests](organizations-and-users.md#access-requests)).

![The Sign-up page with the server setting SIGNUP_MODE disabled, the account and organization choices locked above it, and the request-access switch]({{ site.baseurl }}/assets/images/identity/admin-system-signup.png)
*Figure: Settings, Sign-up, on a server with `SIGNUP_MODE=disabled`.*

The server's `SIGNUP_MODE` (`disabled` by default, `domain` or `open`) is a ceiling:
the console can stay at or below it, and options above it are locked. `domain` and
`open` need the platform e-mail. Open sign-up stays closed until a CAPTCHA is set
up ([CAPTCHA](#captcha)), unless the server sets `SIGNUP_CAPTCHA=off-i-understand`.
Opening sign-up needs a second super admin's approval
([Approvals](security.md#approvals)). Existing organizations, users and sessions are
not changed. Organizations created by self-service sign-up start with the
[Limits](#limits) below.

## Limits

**Limits** sets the limits a self-service organization starts with: seats, assets,
findings, sensors, API keys, organizations per person, platform scans and more.
Leave a value empty for no limit. Existing organizations and organizations created
in the console are not changed; one organization's limits are set on its
[Limits tab](organizations-and-users.md#one-organization). Saving needs a fresh
code.

![The Limits page with the starting limits for self-service organizations and the default storage quota]({{ site.baseurl }}/assets/images/console/limits.png)
*Figure: Settings, Limits.*

**Default storage quota** is how much uploaded evidence and attachments one
organization may keep, in MiB (`0` means no quota). An organization's own storage
limit (`storage_mb` on its Limits tab) wins. Until a value is saved here,
`STORAGE_TENANT_QUOTA_MB` on the server is the default.

`SELF_SERVICE_START_LIMITS` on the server (a JSON object of limit keys, or
`unlimited`) applies until limits are saved here. Self-service sign-up stays
refused until starting limits exist in one of the two places.

## CAPTCHA

**CAPTCHA** holds the Cloudflare Turnstile **Site key (public)** and **Secret key**.
One CAPTCHA protects registration, the request-access form and every sign-in after
repeated failures, on the organization site and in this console. Without keys only
the rate limits apply. **Check the secret key** asks Turnstile whether it knows the
key. Set both keys, or clear both to turn the CAPTCHA off. Changing it needs a
reason.

`CAPTCHA_TURNSTILE_SITE_KEY` and `CAPTCHA_TURNSTILE_SECRET` on the server lock the
setting.

## E-mail

**E-mail** is the platform SMTP server for sign-up, invitation, verification,
password and administrator e-mails: **Send e-mail**, **SMTP server**, **Port**,
**User name**, **Password**, **Sender address**, **Sender name** and **Use
STARTTLS** (TLS 1.2 or later). With **Send e-mail** off, no e-mail is sent and
set-password links are shown to the administrator instead. **Send a test e-mail**
sends to your own address only. An organization with its own e-mail integration
sends through that instead. See [Email](../configuration/email.md).

The `SMTP_*` environment variables were removed in v0.9.0 (except `SMTP_BASE_URL`);
a headless install stores the first setting with `bootstrap-admin` and
`BOOTSTRAP_SMTP_*`.

## Legal

**Legal** sets what visitors see before they sign in: the terms and privacy links
of the sign-in and sign-up pages, whether the built-in legal pages are served and
their values (organization, service, contact, address, jurisdiction, effective
date), and the `/.well-known/security.txt` contact and policy. Empty fields use the
defaults and the `BRAND_*` settings. Changes show within a minute.

## Announcements

**Announcements** publishes a one-line notice (**Information**, **Maintenance** or
**Warning**, with an optional start and end) that every signed-in user sees as a
banner while it is active. Publishing or ending one needs an operations admin, a
confirmation and a reason.

## Alerts

**Alerts** sends the alerts administrators get by e-mail to a chat or paging tool
too: low disk space, stale backups, expiring certificates and changes to these
settings.

![The Alerts page with the Alert webhook card: the switch, the webhook address and the optional signing secret]({{ site.baseurl }}/assets/images/console/alerts.png)
*Figure: Settings, Alerts.*

- **Send alerts to the webhook** and **Webhook address (https)**: the address is
  write-only (such addresses often carry a token); internal addresses are refused.
- **Signing secret (optional)**: each request then carries `X-OpenCTEM-Timestamp`
  and `X-OpenCTEM-Signature`, a SHA-256 HMAC of the timestamp, a dot and the body.
  Verify it and reject old timestamps.
- **Send a test alert** checks that the receiver accepts it.

Changing the receiver needs a reason; the previous receiver is told first. Checks
that must run while the API is down (the API itself not answering, the database
down) belong in your server monitoring: see [Monitoring](../operations/monitoring.md).

## AI provider

**AI provider** is the platform AI provider for organizations that use AI triage
in platform mode, without their own provider. It is a cost and a processor of their
data, so it is off by default.

- **Offer platform AI** (off: organizations in platform mode cannot run AI triage);
- **Provider** (Anthropic Claude, OpenAI, Google Gemini or an **OpenAI-compatible
  server**), **Model** and **API key**. An OpenAI-compatible server (Azure OpenAI,
  vLLM, Ollama, LM Studio, LiteLLM, OpenRouter or a gateway) takes a **Base URL**
  and its key is optional;
- **Allow private addresses** lets the base URL sit on a private network (10.x,
  172.16-31.x, 192.168.x) and use http, for a self-hosted model. Loopback,
  link-local and cloud-metadata addresses stay refused, and the toggle never
  applies to an organization's own provider;
- a **model allow-list** limits the platform model;
- **Test the key** asks the provider whether it accepts the key.

**Allow organizations to use their own provider** (on by default) is a policy of
its own: organizations may send their findings to their own AI provider with their
own key (**Settings › Security › AI**, see
[AI](../user-guide/10-settings-and-integrations.md#ai)). Turning it off stops every
own provider at its next call; none falls back to the platform key.

Changing the provider, the private-address toggle or the policy needs a reason and
a fresh step-up, and is recorded as a critical audit event.
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` on the server lock the
setting. See [AI triage](../api/ai-triage.md).

## AI applications

**AI applications** lists every MCP client known to the platform (published
metadata, registered by an organization, or self-registered and unverified) with
its active connections and the number of organizations using it, counts only. An
operations admin can **block** an application everywhere (with a confirmation):
it can no longer be authorized and its tokens stop working. See
[Connect an AI assistant](../user-guide/12-connect-an-ai-assistant.md).
