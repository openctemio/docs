---
title: Security
nav_order: 7
has_children: true
permalink: /security/
---

# Security model

OpenCTEM holds a map of an organization's attack surface and its weaknesses, and it can direct sensors
to probe networks. This page describes how the platform protects that data and that capability: who
can sign in, what they can do, how organizations are kept apart, what may be scanned, how sensors and
the platform limit each other, how secrets are stored, and how actions are recorded.

Related pages:

- [Production hardening](hardening.md): the checklist for operators.
- [Vulnerability disclosure](vulnerability-disclosure.md): how to report a security issue.
- [Acknowledgements](acknowledgements.md): the people who reported vulnerabilities to us.
- [Data handling and privacy](data-handling.md): what is stored, for how long, and how it is deleted.
- [Audit log](audit-log.md): what is recorded and how tampering is detected.
- [Identity and access](../identity/index.md): configuring sign-in, SSO, SCIM and roles.

## Components and trust boundaries

```mermaid
flowchart LR
  B[Browser] -->|HTTPS| G[Gateway]
  S[Sensor] -->|HTTPS signed requests, or mTLS gRPC| G
  I[Identity provider] -.->|OIDC / SAML / SCIM| G
  G --> W[Web console]
  G --> A[API]
  G --> C[Platform console]
  C --> A
  W --> A
  A --> P[(PostgreSQL)]
  A --> R[(Redis)]
  A --> F[(File storage)]
```

- The **gateway** terminates TLS and is the only published service in the production deployment. It
  serves the web console, the API and, on its own site (a separate port or host name, limited to
  private networks by default), the platform console.
- The **API** makes every authorization decision. The web console and the platform console hold no
  authority of their own. The platform console's API is served by a separate internal listener
  (`ADMIN_LISTEN_ADDR`), and the main API listener answers `404` for it.
- Sensors that use protocol v3 reach the API's mTLS listener (`SENSOR_MTLS_LISTEN_ADDR`, `:9443`),
  either through the gateway on the main HTTPS port (the gateway passes connections that offer the
  sensor ALPN id through) or directly.
- **Sensors** run in the networks they scan and only make outbound connections to the platform.
- PostgreSQL, Redis and file storage are reached only by the API.

## Authentication

| Principal | Credential | Notes |
|---|---|---|
| Person | Session from email and password (with optional TOTP 2FA), organization SSO (OIDC, SAML), or social sign-in | Short-lived access tokens, rotating refresh tokens |
| Automation | Organization API key `oct_...` | Read-only on the REST API, acts as its creator with a subset of their permissions |
| Identity provider (provisioning) | SCIM token `oct_scim_...` | One organization per token |
| Sensor | A client certificate from the platform's sensor CA (protocol v3, mTLS), an Ed25519 key-bound identity (paired sensors), or a sensor key | Accepted only on sensor routes |
| Platform administrator | Separate console session with a second factor (authenticator code or a security key or passkey) | Accepted only on admin routes; the same account cannot sign in on the organization site |

Each credential works only on its own set of routes: a sensor key is refused on user routes, an
organization token on admin routes, and so on.

### Sessions and tokens

- Sign-in creates a **session** for the account. The session yields a refresh token (cookie
  `refresh_token`, `HttpOnly`) and, per organization, a short-lived **access token** (a signed JWT,
  `AUTH_ACCESS_TOKEN_DURATION`, default 15 minutes).
- Refresh tokens (`AUTH_REFRESH_TOKEN_DURATION`, default 7 days) **rotate** on every use. Presenting a
  refresh token that was already used revokes the whole token family. A session ends after
  `AUTH_SESSION_DURATION` (default 30 days) regardless of activity.
- A user can have at most `AUTH_MAX_ACTIVE_SESSIONS` (default 10) sessions; the oldest is revoked
  beyond that. Users see and revoke their sessions under **My account > Security**.
- Sign-out, password change, enabling 2FA, suspension and back-channel logout from an identity
  provider revoke sessions **immediately**: revoked session ids are checked on every request (through
  Redis; without Redis, access tokens stay valid until they expire).
- Cookies are `Secure` (required in production) and `SameSite=Lax` by default. Cookie-authenticated
  requests need a double-submit CSRF token.
- The web console checks every state-changing request it answers, signed in or not (sign-in,
  registration, password reset, invitations, MFA, team selection, SSO start): the request must
  come from the console's own origin (`Sec-Fetch-Site`, `Origin` or `Referer`), and the
  `X-CSRF-Token` header must equal the `csrf_token` cookie, which the console sets on every page.
  Anything else is `403` before the API is called. The API's own sign-in and other pre-session
  `POST`s also refuse writes a browser sent for another site, for installations where browsers
  can reach the API directly. Together these stop login CSRF (a foreign page signing
  a visitor into an attacker's account).
- Session tokens, refresh tokens and reset, verification and invitation tokens are stored only as
  hashes.

### Passwords and 2FA

- Passwords: at least 12 characters by default, composition rules, refused if on a list of about 47,000
  commonly breached passwords; stored with bcrypt (cost 12).
- Wrong passwords or codes lock the account after 5 attempts for 15 minutes. Sign-in endpoints have
  per-IP rate limits shared across API replicas, and do not reveal whether an account exists.
- TOTP 2FA with single-use codes and 10 recovery codes; organizations can require it. See
  [Two-factor authentication](../identity/two-factor.md).

### Organization SSO

OIDC (Entra ID, Okta, Google Workspace) and SAML 2.0 per organization. Every ID token is verified
(signature against the provider's keys, issuer, audience, expiry, nonce; PKCE always on). Accounts are
bound to the provider's immutable user id, and a federated sign-in never takes over a password
account. Just-in-time provisioning admits new people only from email domains the organization has
proven with DNS, and never as admin or owner. Organization SSO is configured by the platform
administrator and each change must be approved by an organization owner. An organization can enforce
SSO; its owner keeps password access so the organization cannot be locked out. See
[Identity and access](../identity/index.md).

A sign-in through organization A's identity provider counts as SSO **only for A**. Exchanged for an
access token in another organization, it is treated like a password session, so it cannot skip that
organization's SSO enforcement or 2FA requirement.

### Step-up re-authentication

Actions that create long-lived credentials, change who can sign in, widen scan scope, or delete the
organization or a person's data require a proof of identity from the last 10 minutes in the same
session (a TOTP code, a password, or a fresh sign-in at the identity provider). See
[Step-up re-authentication](../identity/two-factor.md#step-up-re-authentication).

## Authorization

Three layers apply to every organization request:

1. **Roles and permissions**: built-in roles (owner, admin, member, viewer) and custom roles made of
   about 180 permissions. Custom roles cannot hold more than their creator holds. The permissions that
   hand out or change sensor credentials, scan zones and CI trust configurations are reserved for the
   built-in owner and admin roles, and the owner role is never assigned through the Roles API: a
   system role reaches a person only through their membership. The audit log needs a role with full
   data access.
2. **Data scope**: members and viewers see only the assets assigned to their teams or granted to them
   directly, and the findings and other records linked to those assets. With no assignment they see
   nothing. Out-of-scope records answer `404`. Dashboards and suppressions follow the same scope.
3. **Modules**: a disabled module answers `403 MODULE_NOT_ENABLED`. Modules are a product switch, not
   a security boundary.

Permissions are re-read on each request, so a revoked permission takes effect at once. Organization
API keys are read-only and never get the owner/admin bypass or full data access.

See [Roles, groups and permissions](../identity/roles-and-permissions.md). The route-by-route matrix is
[authorization-matrix.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/authorization-matrix.md).

## Organization isolation

Organizations (tenants) share one database. Isolation is enforced in the API:

- Every organization-owned table has a `tenant_id`, and every query filters on it.
- The organization is taken from the authenticated credential (access token, API key, SCIM token,
  sensor identity), never from the request body. A record of another organization answers `404`.
- Per-organization configuration (SSO, integrations, credentials, storage settings) is stored per
  organization, and integrations use that organization's credentials only.
- Automated tests check cross-organization access on the API routes.

**Database row-level security** policies exist for the organization-owned tables, but they are **not
enabled**: isolation relies on the application's queries, not on PostgreSQL. Enabling row-level
security table by table is planned. Running the API with the least-privilege database role is a
prerequisite and is recommended now (see [Hardening](hardening.md#use-least-privilege-database-roles)).

## Authorization to scan

Scanning other people's systems without permission is the main abuse risk of a platform like this.
Every path that makes a sensor send traffic to a target passes one fail-closed gate before a job
exists:

- **Scope entries.** A full active scan needs an active, unexpired scope entry of the organization.
  `*.example.com` covers `example.com` and every name below it. Creating, extending or raising the
  tier of an entry is **widening**: it needs the scope write permission and step-up, and is audited
  and notified to owners and admins. Narrowing is always one click. A second person's approval is
  opt-in: under the organization's **Strict** scan approval (or a platform policy that forces it), a
  widening waits for another approver and members can only request one-off entries.
- **Scan approval.** An organization (or the platform administrator for it) can require approval for
  scans: **On** applies approval rules (for example intrusive scans, or active scans of production
  assets); **Strict** asks two distinct approvers and a justification for every scan a rule catches.
  The approval covers the scan definition, so a later change needs a new approval. Off by default.
- **Unclassified assets.** An inventory asset that no entry covers, and that nobody excluded or
  marked not ours, gets low-impact checks by default (a short list of common ports at a low rate, the
  home page and `/.well-known/`, informational nuclei templates; never intrusive). The organization
  can set this to Off or Full; Strict scan approval forces Off. Platform guardrails keep such an
  asset passive in every mode when its address is on a CDN, shared-hosting or cloud network, nothing
  is known about its network, names of three or more domains point at it, or a name is under none of
  the organization's domains; a failed lookup holds everything (fail closed).
- **Exclusions** win over every entry and setting. They are checked when the job is created, again
  when a sensor claims it, carried in the signed job so the sensor cuts its ranges around them, kept
  in the job signer's own ledger, enforced per request by the confined sensor's forwarder for web
  paths, and applied again at ingest, where results outside a job's addresses are dropped. See
  [How scope and exclusions reach sensors](../scanning/scope-to-sensors.md).
- **Ownership.** An asset marked not ours (and every name below it), a dependency, a monitor-only
  name, or a name that resolves only through a wildcard DNS record is not probed.
- **Domain proof.** An organization proves a domain with a DNS TXT record. A platform setting,
  **Require a verified domain before platform sensors scan a target** (off by default; a super
  administrator changes it with a fresh authenticator code and a reason), makes jobs on shared platform
  sensors and intrusive (tier T2) probes need every target at or under a verified domain. A public
  multi-tenant service should turn it on.
- **Platform guardrails** set by the operator: no public suffixes, government or military names,
  `0.0.0.0/0`, link-local or cloud metadata addresses, nothing in `SCOPE_DENY_EXTRA`, and public ranges
  no larger than `SCOPE_MAX_PUBLIC_CIDR_V4` (default `/16`) and `SCOPE_MAX_PUBLIC_CIDR_V6` (default
  `/32`).
- **Tier ceilings.** Under Strict scan approval, each scope entry authorizes probes up to a maximum
  tier; a tool whose checks are more intrusive is refused for that target.
- **Private addresses** are allowed only inside the organization's scan zones.

See [Scope and authorization to scan](../scanning/scope.md).

## Sensor and platform trust

The design goal is mutual distrust: a compromised sensor must not be able to attack the platform, and
a compromised platform must not be able to turn sensors into weapons. The current controls:

**Outbound-only.** Sensors never accept inbound connections. A sensor connects out to the platform and
receives all its work and control over that connection: polling, the control stream, pairing. It
opens no port on its host, and its health and diagnostics stay local. This is a fixed rule of the
design, for three reasons:

- it works behind NAT and default-deny firewalls;
- the platform never holds a way to dial into customer networks;
- whatever the platform sends is checked by the sensor before anything runs.

**Identity.** A paired sensor holds an Ed25519 private key that never leaves its host; every request is
signed (HTTP Message Signatures, RFC 9421) with a nonce and a body digest. Pairing is approved by an
organization admin with step-up after comparing a short code. An organization can require key-bound
identity and refuse bearer-key sensors. Revoking or disabling a sensor takes effect on its next request
and takes back its queued work. See [Pairing and enrollment](../sensors/pairing.md).

**Grants.** Each sensor has a grant (what job types, tools and tiers it may run). Polls and claims are
checked against it, and a missing grant withholds every job. Widening a grant needs step-up and is
notified to admins.

**Hostile input.** Everything a sensor sends is treated as untrusted:

- Size, nesting depth and item counts are checked before a body is decoded.
- The sensor endpoints are rate-limited per address, per sensor and per organization, before
  authentication as well as after it.
- Report data that will never be applied (abandoned, expired or failed uploads) is purged on a schedule.

**Results.** The organization always comes from the sensor's identity. A report is bound to a job when
it names a job assigned to that sensor, and a bound report can change only the existing assets its
job covers. Unsolicited reports are accepted from collector and CI roles; from other sensors they are
quarantined for review (the default for new organizations) or applied with limits and audited, by
organization policy. Unsolicited reports never reopen findings a person resolved and never close
findings. A scan closes findings by coverage only on the assets its job covered. Sensor-supplied text is
length-capped, and it is rendered as text in the console, in exports, in tickets (including ticket
comments) and in notifications.

**Sensor-local policy.** The owner of the scanned network installs a read-only policy file on the
sensor host that lists allowed and denied ranges, ports, tools, job types and switches for custom
templates and out-of-band callbacks, plus a kill switch. The sensor refuses any job outside it, even
one the platform sends, and the platform cannot change it. The sensor always refuses loopback,
link-local and cloud metadata addresses, and private ranges unless explicitly allowed. An organization
can require an enforced local policy before private targets are dispatched.

A sensor paired by sensor v0.12.0 or later fails closed without a policy: it refuses network jobs
until a policy file (or an allowed-ranges setting) is in place. Sensors paired earlier, and API-key
sensors, run any target outside the built-in deny list; the Sensors page flags every sensor without a
local policy so its owner can add one. See the sensor's
[local policy reference](https://github.com/openctemio/sensor/blob/main/docs/LOCAL_POLICY.md).

**Platform identity on the sensor.** A sensor should trust only the platform it was paired with.
Pairing records the platform's TLS identity, and the sensor then refuses a platform certificate from
another CA; `SENSOR_CA_FINGERPRINT` pins it explicitly. The Sensors page flags a sensor whose platform
CA is not pinned.

**Declarative jobs.** Jobs name a registered tool and its targets; there is no job type that runs a
shell command, and dangerous tool flags are refused. Custom scanner templates sent by the platform are
signed per command (Ed25519, DSSE envelope, one-hour expiry) and verified by the sensor against the
organization key its operator pinned.

**Signed jobs.** A separate signing process (`openctem-signer`, its own container, reached only over
a Unix socket) can sign every job when a sensor claims it, and signs only targets inside the scope
recorded in its own hash-chained ledger. It is built and **off by default** (`SIGNER_SOCKET`); a
sensor that pinned the platform's job-signing keys at pairing runs only signed jobs.

**Limits.** A separate sensor gateway process is **planned** (RFC-040). Today the API process that
serves sensors also serves users; where job signing is off, a sensor's local policy and its pinned
platform identity are what stop a compromised platform from directing it. The engineering status is in
[sensor-platform-trust.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/sensor-platform-trust.md).

## Secrets

- **`FINGERPRINT_KEY`** (at least 32 characters, required outside development) keys the fingerprint
  of every reported secret finding, so a leaked value is never stored as a plain hash. Do not rotate
  it with `APP_ENCRYPTION_KEY`: changing it changes every secret finding's identity.
- **`APP_ENCRYPTION_KEY`** (32 bytes, required outside development) encrypts stored secrets with
  AES-256-GCM: integration credentials and webhook secrets, SSO client secrets, user and admin TOTP
  secrets, file-storage credentials, bring-your-own AI keys, the secret store, and leaked-credential
  values captured as evidence. The API refuses to start in production without it.
- API keys, SCIM tokens and sensor keys are stored only as HMAC-SHA256 hashes keyed with a pepper
  derived from the same key. Their plaintext is shown once at creation.
- **Rotation** is supported: `cmd/rekey` re-encrypts every stored secret in one transaction, and
  `APP_ENCRYPTION_KEY_PREVIOUS` keeps old tokens working while they are re-hashed on use. See
  [Hardening](hardening.md#protect-and-rotate-the-encryption-key).
- Scanner credentials live on the sensor host by design (local configuration or environment). Avoid
  typing secrets into scan configuration fields: they are stored and sent to sensors as given.
- Logs redact fields named like passwords, tokens, secrets, cookies and email addresses.

## Audit log

Security-relevant actions are written to a per-organization audit log, linked into a SHA-256 hash
chain that is verified hourly, and owners and administrators can export it (CSV or JSON lines, up to
50,000 rows, itself audited). Platform administrator actions have their own append-only log, which
can be copied off the box. See [Audit log](audit-log.md).

## Platform administration

Platform administrators use a separate platform console: its own app (`openctem-console`) on its
own site (a separate port or host name; `OPENCTEM_ADMIN_SITE`), with its own API listener. Only the
networks in `OPENCTEM_ADMIN_ALLOWED_CIDRS` reach it (private networks by default); the main site
answers `404` for the console API. The controls:

- **Sign-in.** Its own sessions (8 hours absolute, 15 minutes idle, at most three per administrator),
  a second factor at every sign-in (authenticator code, or security keys and passkeys with a
  console policy that can require them), and three roles (`super_admin`, `ops_admin`, `readonly`).
  Organization SSO can never authenticate a platform administrator, and an administrator's account
  cannot sign in on the organization site at all.
- **Browser isolation.** Strict headers (nonce CSP with no third-party script, `frame-ancestors
  'none'`, same-origin opener and resource policies, `no-store`), HSTS on the console site, and a
  CSRF token bound to the console session, so a script on a tenant page of the same host can
  neither read nor forge it.
- **Protected actions.** The riskiest actions need a fresh code or security-key confirmation, and
  some also need a second super admin's approval (`428 SECOND_APPROVAL_REQUIRED`): making or
  removing a super admin, turning off the security-key requirement, relaxing the administrators'
  identity provider, opening sign-up, re-signing an audit chain, deleting an organization at once.
- **Records.** A super administrator's write is logged before it runs (and refused with `503
  AUDIT_UNAVAILABLE` if the log cannot be written). The administrators' audit log is append-only
  and hash-chained, and can be streamed to a destination outside the database. A hosted service
  (`MANAGED_SERVICE=true`) must have that destination. Roster changes are e-mailed to every other
  administrator. Actions inside an organization are also written to that organization's log.
- **Limits on reach.** The console's identity tables can be written by a separate database role
  (`DB_ADMIN_USER`), so a SQL injection in tenant-facing code cannot add an administrator. Public
  sign-up is bounded by the deployment's `SIGNUP_MODE` (`disabled` by default), which no console
  setting can exceed. Secrets (CAPTCHA, AI and alert-webhook credentials) are write-only in the
  console, and the console cannot read database credentials, encryption keys or its own allowed
  networks.
- **Kill switches.** A platform administrator can suspend an organization or block an account
  without deleting anything; an organization an owner deletes waits 14 days before its data is
  purged.

See [Production hardening](hardening.md#platform-console) for the settings and the
[Audit log](audit-log.md#the-administrators-audit-log-and-its-off-box-copy) page for the log.

## Secure development

The repositories run static analysis (CodeQL, gosec), dependency and image vulnerability scanning
(govulncheck, Trivy), secret detection and automated dependency updates in CI. Container images are
signed with cosign. Security fixes are published as GitHub security advisories; see
[Vulnerability disclosure](vulnerability-disclosure.md).
