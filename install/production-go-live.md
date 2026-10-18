---
title: Going live (production runbook)
parent: Install
nav_order: 8
---

# Going live: production runbook
{: .no_toc }

The order of work for a first production deployment, from an empty host to a
monitored installation with a tested restore. Each step links to the page with
the details. Work through it top to bottom; do not skip the checks.

1. TOC
{:toc}

---

## 1. Choose the deployment

| Deployment | Use it for | Page |
|---|---|---|
| Compose (`api/deploy/docker-compose.yml`) | One host, everything included (gateway, web, platform console, API, PostgreSQL, Redis) | [Docker Compose](docker-compose.md) |
| All-in-one image (`ghcr.io/openctemio/openctem`) | One container, with your own PostgreSQL and Redis | [All-in-one](all-in-one.md) |
| Helm chart | Kubernetes | [Kubernetes](kubernetes.md) |
| Ansible kit (`openctem-ansible`) | One hardened Ubuntu VM, with or without Cloudflare | [Install with Ansible](ansible.md) |

Every deployment publishes one HTTPS port for browsers, sensors and API
clients, plus the platform console's own site (a second port or its own host
name, reachable only from your administrators' networks by default). The API,
the web console, PostgreSQL and Redis are never reachable from outside.

## 2. Verify the release

Use a released version, never `latest`. Every image is signed (keyless, GitHub
OIDC) and carries a signed SBOM attestation. Check the image you deploy:

```bash
VERSION=vX.Y.Z
for img in openctem-api openctem-web openctem-console openctem-gateway migrations; do
  cosign verify ghcr.io/openctemio/$img:$VERSION \
    --certificate-identity-regexp '^https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/v' \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com >/dev/null && echo "$img: signature OK"
done
```

Read the release notes and the upgrade notes of the release.

## 3. Prepare the host

- A DNS name for the installation (or a fixed IP address for an internal install).
- Disk: the database grows with findings and audit history; keep at least 20 %
  free and alert on it. A full disk stops PostgreSQL.
- Time synchronised (NTP): tokens, signatures and certificates depend on it.
- Outbound HTTPS for threat-intelligence feeds and, in TLS mode `acme`, Let's Encrypt.

## 4. Configure

1. Copy the example environment file of your deployment (`api/deploy/.env.example`
   for Compose) and set every value marked as required.
2. Generate every secret; never reuse a value from an example file:

   ```bash
   openssl rand -hex 32   # APP_ENCRYPTION_KEY, FINGERPRINT_KEY, METRICS_TOKEN
   openssl rand -hex 24   # database and Redis passwords
   ```

   `FINGERPRINT_KEY` is required in production and must stay stable for the
   life of the installation: it keys the identity of every secret finding.
   Never rotate it with `APP_ENCRYPTION_KEY`. `AUTH_JWT_SECRET` is optional;
   the session secret (and the platform console's CSRF key) is derived from the
   encryption key, except with `AUTH_PROVIDER=oidc`, where you set it. `setup.sh` generates
   all of these for the Compose stack.

   The API refuses to start with example-file text in a secret.
3. Leave `APP_ENV` unset or set it to `production`. Production mode refuses a
   database or Redis connection without TLS, weak or missing secrets, cookies
   without the Secure flag, disabled rate limits and debug logging.
4. Decide the sign-up ceiling (`SIGNUP_MODE`): `disabled` (default, for a
   self-hosted install), `domain` or `open`. See
   [Sign-up and invitations](../identity/sign-up-and-invitations.md#creating-organizations).
   If you run a hosted multi-tenant service, set `MANAGED_SERVICE=true`: in
   production the API then refuses to start unless `ADMIN_AUDIT_SINK` (an off-box
   copy of the platform administrators' audit log) is set too
   ([Docker Compose](docker-compose.md#hosted-service-and-the-audit-sink)).
   The Ansible kit's preflight stops a managed inventory without one.
   Decide where the platform console lives (`OPENCTEM_ADMIN_SITE`: `port`,
   `host` or `off`) and which networks may reach it
   (`OPENCTEM_ADMIN_ALLOWED_CIDRS`); a host name of its own is recommended.
   Set `ADMIN_PUBLIC_URL` to the console's exact origin, or administrators cannot
   register security keys (a known gap: no deployment sets it for you; see
   [Docker Compose](docker-compose.md#platform-console)).
5. Keep `APP_ENCRYPTION_KEY` and `FINGERPRINT_KEY` in a secret manager as well
   as in the deployment: without the first, the credentials stored in the
   database cannot be decrypted.
6. Check the configuration before starting anything:

   ```bash
   cd api/deploy
   docker compose run --rm --no-deps api -check-config
   ```

   It reads the same environment the API will run with, exits 0 with a
   summary or 1 with the first problem, connects to nothing and prints no
   secret. (All-in-one and Kubernetes: run the API image with the same
   environment and the argument `-check-config`.)

## 5. TLS

Pick the gateway TLS mode ([TLS and the gateway](tls-and-gateway.md)):
`acme` for a public DNS name, `files` for your own certificate, `internal`
for an internal install (sensors then trust the exported root CA). The
gateway sends HSTS and the web console sends a Content-Security-Policy.

## 6. Start

```bash
cd api/deploy
docker compose pull
docker compose up -d
docker compose ps -a     # every service healthy; the one-shot jobs exited 0
```

Migrations run once, before the API starts, as the schema owner; the API
connects with a role that can only read and write rows. The API refuses to
start on an older schema.

## 7. First administrator and organization

Create the platform administrator, a break-glass administrator and the first
organization ([First administrator](first-admin.md)). Sign in to the platform
console, change the temporary password and enroll an authenticator app. Keep at
least two platform administrators.

## 8. Sign-in and identity

- Local accounts: the platform e-mail must work (verification and
  password-reset e-mails): set it in the platform console, **Settings > E-mail**,
  and send a test e-mail.
- Single sign-on: configure the identity provider ([OIDC](../identity/sso-oidc.md),
  [SAML](../identity/sso-saml.md)) and sign in once with a test account.

## 9. Monitoring and alerts

Start the monitoring stack with the overlay for the shipped Compose stack and
configure a Telegram or Slack receiver ([Monitoring](../operations/monitoring.md)).
Then prove an alert arrives: stop the API for three minutes
(`docker compose stop api`), wait for `ApiDown`, start it again.

## 10. Backups and a restore test

Schedule `api/deploy/backup.sh` daily, copy its output off the host encrypted,
and prove a restore before going live ([Backup and restore](../operations/backup-restore.md)):

```bash
./backup.sh            # database, attachments, gateway CA, .env
./backup.sh verify     # restores into a throwaway PostgreSQL and compares row counts
```

The nightly backup loses up to a day of data. On the Ansible kit you can add
continuous WAL archiving to an S3-compatible bucket and restore to a point in
time (about six minutes of data at risk): see
[Install with Ansible](ansible.md#backups-and-the-restore-drill) and
[Backup and restore](../operations/backup-restore.md).

## 11. Sensors

Deploy at least one sensor and pair it ([Sensors](../sensors/index.md)). Run
one small scan on a target you own and check the findings arrive.

## 12. Final checks

| Check | How |
|---|---|
| Only the HTTPS port is reachable | `nmap` the host from outside |
| `/metrics` is not public | `curl -k https://<host>/metrics` answers 404 |
| Security headers | `curl -kI https://<host>/login` shows HSTS, CSP, X-Frame-Options |
| No demo data or test accounts | Platform console > Organizations and Users |
| Backups ran | `openctem_backup_last_success_timestamp_seconds` is recent |
| Alerts delivered | the test alert of step 9 arrived |
| Restore tested | step 10 |

## Rollback

Database migrations are not rolled back in production. To roll back an
upgrade: set `OPENCTEM_VERSION` back to the previous release, then restore the
backup taken before the upgrade (`./backup.sh restore <dir> --yes`; it stops
the gateway, web console, platform console and API (from v0.11.0; the v0.10.1
script leaves the platform console running, so run `docker compose stop console`
first when you restore with it), restores, and starts the stack on that version). Take that backup before every upgrade
([Upgrading](../operations/upgrade.md)).
