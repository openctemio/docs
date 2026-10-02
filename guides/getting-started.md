# Getting Started Guide

Complete guide to deploy and configure OpenCTEM for first-time use.

## Table of Contents

1. [Deployment](#1-deployment)
2. [First-Time Setup](#2-first-time-setup)
3. [Add More Organizations](#3-add-more-organizations)
4. [Add Users](#4-add-users)
5. [Configure Integrations](#5-configure-integrations)
6. [Add Your First Assets](#6-add-your-first-assets)
7. [Run Your First Scan](#7-run-your-first-scan)
8. [Daily Operations](#8-daily-operations)

---

## 1. Deployment

### Option A: Docker Compose (Recommended for getting started)

The production compose stack lives in the `deploy/` directory of the
[api repository](https://github.com/openctemio/api/tree/develop/deploy). It
publishes a single HTTPS port through the built-in gateway.

```bash
git clone https://github.com/openctemio/api.git
cd api/deploy
cp .env.example .env
# Edit .env: OPENCTEM_VERSION, OPENCTEM_HOSTNAME, OPENCTEM_PUBLIC_URL,
# OPENCTEM_TLS_MODE and the generated secrets (see the guide linked below)

docker compose up -d
```

See [Exposing OpenCTEM: one HTTPS port](../operations/single-https-port.md#quick-start-docker-compose)
for every setting and the TLS modes.

**URLs after startup:**
- UI and API: `https://<OPENCTEM_HOSTNAME>` (one origin; the API is under `/api/v1`)
- Health: `https://<OPENCTEM_HOSTNAME>/health`

### Option B: Kubernetes (Helm)

```bash
helm repo add openctem https://openctemio.github.io/helm-charts
helm repo update

# Copy the chart's values-production.yaml, fill every <PLACEHOLDER>
# (including api.bootstrapAdmin, see "First-Time Setup" below), then:
helm upgrade --install openctem openctem/openctem \
  --namespace openctem --create-namespace \
  -f values-production.yaml
```

See the [chart README](https://github.com/openctemio/helm-charts/tree/main/charts/openctem#readme)
and the [Kubernetes deployment guide](kubernetes-deployment.md) for secrets,
datastores and ingress.

### Verify deployment

```bash
# Docker Compose (from api/deploy; add --cacert ca/openctem-root-ca.crt with the internal CA)
curl https://ctem.example.com/health
docker compose ps -a        # migrate and datastore-tls exited 0, the rest up

# Kubernetes
kubectl exec -n openctem deploy/openctem-api -- wget -qO- http://localhost:8080/health
```

---

## 2. First-Time Setup

A new install has no accounts and no organizations: there is no default login
and no default organization. You create them once, with the `bootstrap-admin`
command that ships in the API image (`/app/bootstrap-admin`).

You need three different email addresses:

| Identity | What it does |
|----------|--------------|
| **Platform administrator** | Runs the installation in the admin console (`/admin`): creates organizations, sets up per-organization SSO, manages administrators. It belongs to no organization and does not see organization data. |
| **Break-glass administrator** | A local backup super admin for when the identity provider or the primary administrator is unavailable. Every sign-in with it is audited and alerted. |
| **Organization owner** | Owns the first organization and runs it day to day: users, roles, assets, scans, findings. A platform administrator cannot be an organization member, so this must be a different address. |

By default only the platform administrator creates organizations
(`TENANT_CREATION_MODE=admin_only`); see
[Self-service organizations](#self-service-organizations-saas-and-trial-installs)
for the opt-in alternative.

### Step 1: Run the database migrations

Both deployment methods run them for you:

- **Docker Compose:** the one-shot `migrate` service runs `migrate up` on every
  `docker compose up`, and the API starts only after it exits successfully.
  `docker compose ps -a migrate` shows `Exited (0)`.
- **Helm:** the migration Job runs as a post-install hook (and pre-upgrade on
  upgrades), before the bootstrap Job.

### Step 2: Create the administrators and the first organization

**Docker Compose** (from `api/deploy`, after `docker compose up -d`):

```bash
docker compose exec api /app/bootstrap-admin \
  -email=admin@yourcompany.com \
  -backup-email=breakglass@yourcompany.com \
  -org-name="Your Company" \
  -org-owner-email=owner@yourcompany.com
```

The command uses the API container's database settings, so it needs no
connection flags.

| Flag | Environment variable | Required | Meaning |
|------|----------------------|----------|---------|
| `-email` | `ADMIN_EMAIL` | Yes | Platform administrator. |
| `-name` | `ADMIN_NAME` | No | Display name (default: the part of the email before `@`). |
| `-role` | | No | `super_admin` (default), `ops_admin` or `readonly`. |
| `-backup-email` | `ADMIN_BACKUP_EMAIL` | Yes, unless `-no-backup` | Break-glass backup super admin. |
| `-backup-name` | `ADMIN_BACKUP_NAME` | No | Its display name. |
| `-no-backup` | | No | Skip the break-glass administrator (not recommended). |
| `-org-name` | `ORG_NAME` | With `-org-owner-email` | Name of the first organization. |
| `-org-slug` | `ORG_SLUG` | No | URL slug (default: derived from the name). |
| `-org-owner-email` | `ORG_OWNER_EMAIL` | With `-org-name` | The organization owner. Must not be an administrator's address. |
| `-org-owner-name` | `ORG_OWNER_NAME` | No | The owner's display name. |

The command prints, **once**:

- a temporary password for each administrator, and
- the organization owner's one-time set-password link (valid for 24 hours),
  unless SMTP is configured (`SMTP_ENABLED=true` and the other `SMTP_*`
  settings), in which case the link is emailed to the owner instead.

Copy them now; they are not shown again. Store the break-glass credentials
offline (for example in a sealed password-manager vault).

Running the command again is safe: administrators that already exist and an
organization with the same slug are skipped. The organization is created
through the normal, audited organization service, so it appears in the audit
log like one created in the console.

**Kubernetes (Helm):** set the values before `helm install`:

```yaml
api:
  tenantCreationMode: admin_only        # the default
  bootstrapAdmin:
    enabled: true
    email: admin@yourcompany.com
    name: Platform Admin                # optional
    backupEmail: breakglass@yourcompany.com
    backupName: Break-glass Admin       # optional
    org:
      name: Your Company
      slug: your-company                # optional, derived from the name
      ownerEmail: owner@yourcompany.com
      ownerName: Jane Doe               # optional
```

The chart runs `/app/bootstrap-admin` with these values in a Job, as a
post-install hook after the migrations. If the Job fails, the install fails;
its log says why. The Job gets the API's `api.extraEnv` and `api.extraEnvFrom`,
so `SMTP_*` settings there let it email the owner's link.

The completed Job is **kept** so you can read the one-time credentials. Read
them, store them, then delete the Job:

```bash
kubectl logs -n openctem job/openctem-api-bootstrap-admin
kubectl delete -n openctem job/openctem-api-bootstrap-admin
```

The Job is named `<fullname>-api-bootstrap-admin`. `<fullname>` is the release
name when it contains `openctem` (release `openctem` gives
`openctem-api-bootstrap-admin`), otherwise `<release>-openctem`. `helm install`
prints the exact commands.

The Job runs on `helm install` only, not on `helm upgrade`. To bootstrap an
existing release, run the command in the API pod:

```bash
kubectl exec -n openctem deploy/openctem-api -- /app/bootstrap-admin \
  -email=admin@yourcompany.com -backup-email=breakglass@yourcompany.com \
  -org-name="Your Company" -org-owner-email=owner@yourcompany.com
```

{: .note }
The `bootstrap-tenant` command and the chart's `api.bootstrapTenant` values are
removed. The chart refuses to render when `api.bootstrapTenant.enabled=true`;
use `api.bootstrapAdmin.org.*` instead.

### Step 3: The administrator signs in

1. Open `https://<your-host>/login` and sign in as `admin@yourcompany.com`
   with the temporary password.
2. Set a new password when asked (required before anything else), then sign
   in again with it.
3. You are taken to the admin console at `/admin`. Scan the QR code with an
   authenticator app and enter the code (TOTP); the console asks for a code at
   every sign-in.
4. Sign in once with the break-glass account the same way (new password,
   authenticator), then store its password and authenticator offline. Test it
   at least every 90 days.

### Step 4: The organization owner sets a password

The owner opens the one-time set-password link (from the email, or from the
administrator who copied it from the command output) and chooses a password.
The link works once and expires after 24 hours.

### Step 5: The owner signs in and brings in the team

The owner signs in at `https://<your-host>/login` and lands in the
organization as its **Owner**. From there:

- **Add people:** [Settings → Members](#4-add-users): **Add user** creates an
  account and gives a one-time set-password link; **Invite user** emails an
  invitation.
- **Single sign-on:** per-organization SSO (OIDC or SAML, verified domains,
  enforcement) is set up by the platform administrator in the console:
  **Organizations** → the organization → **Single sign-on**. With
  just-in-time provisioning turned on, users from a verified domain are added
  to the organization on their first SSO sign-in. SCIM provisioning stays with the organization's owner and
  admins. See the [SSO guide](sso-setup.md).
- **More organizations** are created by the platform administrator; see
  [Add More Organizations](#3-add-more-organizations).

### Without the organization flags

`-org-name` and `-org-owner-email` are optional. Without them the command only
creates the administrators, and the platform administrator creates the first
organization in the console after Step 3, as described in the next section.

### Self-service organizations (SaaS and trial installs)

`TENANT_CREATION_MODE=self_service` (Helm: `api.tenantCreationMode=self_service`)
lets any signed-in user create organizations. A user who belongs to no
organization is sent to a **Create Team** page and becomes the Owner of the
team they create. Use it only for SaaS or trial installs. Existing organizations
are not affected by either mode.

Self-registration is a separate setting, `AUTH_ALLOW_REGISTRATION`, and is off
by default. Do not turn it on to create the first account: under the default
`admin_only` mode a self-registered user belongs to no organization and cannot
create one, and a registered account is never a platform administrator. Use
`bootstrap-admin` as described above.

---

## 3. Add More Organizations

In the admin console (`/admin`), as an administrator with the `ops_admin` or
`super_admin` role:

1. Go to **Organizations** → **Create**.
2. Enter the organization name and the owner's email.
3. If the owner has no account yet, one is created with a one-time
   set-password link: emailed when SMTP is configured, otherwise shown once in
   the console for you to pass on.

The owner then signs in and adds users as in [Add Users](#4-add-users). The
owner's address must not be a platform administrator's.

---

## 4. Add Users

New users join an organization by invitation, by an account the owner or an
admin creates, by SSO, or by SCIM. Public self-registration is off by default
(`AUTH_ALLOW_REGISTRATION=false`); keep it off in production.

### Create or invite users

1. Go to **Settings** → **Members**
2. Click **Add user** (creates the account; the user gets a one-time
   set-password link) or **Invite user** (sends an invitation email)
3. Enter:
   - **Email**: user@yourcompany.com
   - **Role**: Select a role
4. Confirm

**Available roles:**

| Role | Access |
|---|---|
| **Admin** | Full access except team deletion |
| **Member** | Read/write access to assets, findings, scans |
| **Viewer** | Read-only access |

The invited user will:
1. Receive an email with invitation link
2. Click link → create account (or login if account exists)
3. Automatically join your team with the assigned role

### SSO Login (optional)

To let users sign in with Microsoft Entra ID, Okta, Google Workspace or another
OIDC or SAML provider, ask the platform administrator to configure SSO for the
organization in the admin console (**Organizations** → the organization →
**Single sign-on**). See the [SSO Guide](sso-setup.md) and the
[Entra ID guide](sso-entra-id.md) for provider setup.

---

## 5. Configure Integrations

### Email (SMTP)

Required for sending invitations and notifications.

**System-wide (env vars):**
```env
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourcompany.com
SMTP_PASSWORD=app-password
SMTP_FROM=noreply@yourcompany.com
```

**Per-tenant (via UI):**
Settings → Integrations → Notifications → Add → Email

See [SMTP Guide](smtp-configuration.md) for details.

### Notifications (optional)

1. Go to **Settings** → **Integrations** → **Notifications**
2. Add channels:
   - **Slack**: Webhook URL
   - **Microsoft Teams**: Webhook URL
   - **Telegram**: Bot token + chat ID
   - **Email**: SMTP settings
   - **Webhook**: Custom HTTP endpoint

### Source Code (optional)

1. Go to **Settings** → **Integrations** → **SCM**
2. Add provider:
   - **GitHub**: Personal access token or OAuth app
   - **GitLab**: Access token
3. Repositories will be synced as assets automatically

### Ticketing (optional)

1. Go to **Settings** → **Integrations** → **Ticketing**
2. Add provider:
   - **Jira**: API token + project key
   - **Linear**: API key
   - **Asana**: OAuth

---

## 6. Add Your First Assets

### Manual creation

1. Go to **Discovery** → **Assets** → select asset type (e.g., Domains)
2. Click **Add Asset**
3. Enter:
   - **Name**: e.g., `example.com`
   - **Criticality**: Critical / High / Medium / Low
4. Click **Create**

### Supported asset types (35+)

| Category | Types |
|---|---|
| External | Domains, Certificates, IP Addresses |
| Applications | Websites, APIs, Mobile Apps |
| Cloud | Cloud Accounts, Compute, Storage, Serverless |
| Infrastructure | Hosts, Containers, Databases, Networks, Kubernetes |
| Identity | IAM Users, IAM Roles, Service Accounts |
| Code | Repositories |

### Bulk import

Upload assets via the ingest API:

```bash
curl -X POST https://api.yourdomain.com/api/v1/ingest/ctis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assets": [
      {"name": "example.com", "type": "domain", "criticality": "high"},
      {"name": "api.example.com", "type": "domain", "criticality": "medium"}
    ]
  }'
```

### Asset Groups

Organize assets by environment or business unit:

1. Go to **Scoping** → **Asset Groups**
2. Click **Create Group**
3. Set name, environment (Production/Staging/Dev), criticality
4. Add assets to the group

---

## 7. Run Your First Scan

### Prerequisites

- At least one asset created
- Scan agent running (platform agent or tenant agent)

### Create a scan

1. Go to **Discovery** → **Scans**
2. Click **New Scan**
3. Select:
   - **Target**: Choose assets or asset groups
   - **Scan Profile**: Select tools (Nuclei, Trivy, Semgrep, etc.)
   - **Agent**: Auto / Platform / Tenant
4. Click **Start Scan**

### View results

1. Scan results appear in **Findings** page
2. Each finding shows:
   - Severity (Critical/High/Medium/Low/Info)
   - CVSS score
   - Affected asset
   - Remediation guidance

---

## 8. Daily Operations

### Dashboard

The CTEM Dashboard (home page) shows:
- Total assets and high-risk count
- Open findings by severity
- Scan activity
- Risk score trends

### Finding management

1. **Triage**: Review new findings, assign severity
2. **Assign**: Assign findings to team members
3. **Fix**: Mark as fix applied when patched
4. **Verify**: Security team verifies the fix
5. **Resolve**: Close the finding

### Monitoring

- **Health**: `GET /health` — liveness check
- **Ready**: `GET /ready` — database + Redis status
- **Metrics**: `GET /metrics` — Prometheus metrics

### Backup

**Database backup (Docker Compose):**
```bash
docker compose exec -T postgres pg_dump -U openctem -d openctem -Fc > backup.dump
```

**Database backup (Kubernetes):**
```bash
kubectl exec -it statefulset/openctem-postgres -n openctem -- \
  pg_dump -U openctem -d openctem -Fc > backup.dump
```

### Migration rollback

If a migration fails:

```bash
# Docker Compose
docker run --rm --network openctemio_openctem-network \
  openctemio/migrations:latest \
  -path=/migrations \
  -database "postgres://openctem:PASSWORD@postgres:5432/openctem?sslmode=disable" \
  force <previous-version>

# Kubernetes
kubectl run migrate-fix --rm -it --restart=Never -n openctem \
  --image=openctemio/migrations:latest -- \
  -path=/migrations \
  -database "postgresql://openctem:PASSWORD@openctem-postgres:5432/openctem?sslmode=disable" \
  force <previous-version>
```

---

## Quick Reference

| Action | Where |
|---|---|
| Login | https://yourdomain.com/login |
| View assets | Discovery → Assets |
| View findings | Findings |
| Run scan | Discovery → Scans → New Scan |
| Invite user | Settings → Users → Invite |
| Add integration | Settings → Integrations |
| Configure SSO | Settings → Identity Providers |
| View audit log | Settings → Audit Log |
| API docs | https://api.yourdomain.com/docs |

## Guides

- [SSO with Entra ID](sso-entra-id.md)
- [SMTP Configuration](smtp-configuration.md)
- [Deployment Guide](../guides/getting-started.md)
