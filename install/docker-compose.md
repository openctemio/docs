---
title: Docker Compose
parent: Install
nav_order: 2
---

# Install with Docker Compose
{: .no_toc }

The production Compose stack runs the gateway, the web console, the API,
PostgreSQL and Redis on one host. Only the gateway publishes a port: one HTTPS
port (443) for browsers, sensors and API clients.

1. TOC
{:toc}

---

## Before you start

- A Linux host sized as in [Requirements and sizing](index.md).
- Docker Engine with the Compose plugin, version 2.24 or later
  (`docker compose version`).
- Port 443 free on the host, and the DNS name or IP address clients will use.
- `git` and `openssl`.

## 1. Get the deployment files

The files live in `api/deploy/` of the
[openctem repository](https://github.com/openctemio/openctem/tree/develop/api/deploy).
Check out the release you deploy, so the files match the images:

```bash
git clone https://github.com/openctemio/openctem.git
cd openctem
git checkout v0.9.0
cd api/deploy
```

| File | Purpose |
|---|---|
| `docker-compose.yml` | The stack. |
| `docker-compose.http-redirect.yml` | Overlay: also publish port 80, redirecting to HTTPS. |
| `docker-compose.plain-http.yml` | Overlay: plain HTTP behind your own TLS proxy (TLS mode `http`). |
| `.env.example` | Settings template. |
| `gateway/` | Gateway configuration (Caddyfile, TLS modes, entrypoint). |
| `postgres/least-privilege-roles.sql` | Creates the database roles the stack uses. |

## 2. Create `.env`

Copy the template and fill in a value for every secret. The commands below
generate them; `.env` does not run commands itself.

```bash
cp .env.example .env
for v in DB_SUPERUSER_PASSWORD DB_MIGRATE_PASSWORD DB_PASSWORD REDIS_PASSWORD; do
  sed -i "s|^$v=.*|$v=$(openssl rand -hex 24)|" .env
done
sed -i "s|^AUTH_JWT_SECRET=.*|AUTH_JWT_SECRET=$(openssl rand -hex 64)|" .env
sed -i "s|^APP_ENCRYPTION_KEY=.*|APP_ENCRYPTION_KEY=$(openssl rand -hex 32)|" .env
sed -i "s|^CSRF_SECRET=.*|CSRF_SECRET=$(openssl rand -hex 32)|" .env
chmod 600 .env
```

Then edit `.env` and set where clients reach the platform and which release runs:

```bash
OPENCTEM_VERSION=v0.9.0
API_IMAGE=ghcr.io/openctemio/openctem-api
UI_IMAGE=ghcr.io/openctemio/openctem-web

OPENCTEM_HOSTNAME=ctem.example.com          # DNS name or IP clients use
OPENCTEM_PUBLIC_URL=https://ctem.example.com  # add :port when it is not 443
OPENCTEM_TLS_MODE=internal                  # internal | acme | files | http
```

{: .note }
The Compose file still defaults to the image names used up to v0.8.0
(`ghcr.io/openctemio/api`, `ghcr.io/openctemio/ui`), which receive identical
copies of each release for a transition period. Set `API_IMAGE` and `UI_IMAGE` as
above to use the current names.

{: .warning }
Back up `.env`. `APP_ENCRYPTION_KEY` encrypts the credentials stored in the
database (integration tokens, SMTP passwords, identity-provider secrets): a
database backup is useless for those without it. `AUTH_JWT_SECRET` signs
sessions; changing it signs everyone out.

Choose the TLS mode in [TLS and the gateway](tls-and-gateway.md). `internal`
works for any name or IP address with no further setup.

The template creates three database roles: `DB_SUPERUSER` (`postgres`, used only
to initialise the database and to create the other two), `DB_MIGRATE_USER`
(`openctem_migrator`, owns the schema and runs migrations) and `DB_USER`
(`openctem_app`, the API: read and write rows only). Leaving `DB_MIGRATE_USER`
unset runs everything as `DB_USER` instead.

## 3. Start the stack

```bash
docker compose up -d
docker compose ps
```

The one-shot jobs `datastore-tls`, `db-roles` and `migrate` run first and exit
with code 0; `gateway`, `web`, `api`, `postgres` and `redis` stay up. The first
start takes a minute or two while PostgreSQL initialises and the migrations run.

Check the platform from the host:

```bash
curl --cacert ca/openctem-root-ca.crt https://ctem.example.com/health
```

(With `acme` or `files` and a publicly trusted certificate, drop `--cacert`.)
`/health` answers `200` once the API is up.

Next: [create the first administrator and organization](first-admin.md).

## What runs

| Service | Image | Role |
|---|---|---|
| `gateway` | `caddy:2.11.4-alpine` | The only published service: TLS and routing on port 443. |
| `web` | `openctem-web` | Web console (Next.js), internal port 3000. |
| `api` | `openctem-api` | API (Go), internal port 8080. Runs the background jobs too. |
| `migrate` | `migrations` | Applies database migrations, then exits. |
| `db-roles` | `postgres:17` | Creates or repairs the least-privilege roles, then exits. |
| `datastore-tls` | `postgres:17` | Issues a private CA and server certificates for PostgreSQL and Redis, renews them when they are within 30 days of expiry, then exits. |
| `postgres` | `postgres:17` | Database, TLS on. |
| `redis` | `redis:7-alpine` | Cache, queues and rate-limit state; TLS only, password required. |

The API runs with `APP_ENV=production`, which refuses a database or Redis
connection without TLS; the `datastore-tls` job is what makes the bundled
datastores satisfy that. All containers log to Docker's `json-file` driver,
rotated at 50 MB with 5 files kept.

### Volumes

| Volume | Holds | Back up |
|---|---|---|
| `postgres-data` | The database. | Yes, with `pg_dump` (see [Backup and restore](../operations/backup-restore.md)). |
| `api-data` | Uploaded attachments and finding evidence (`/app/data`). | Yes. |
| `gateway-data` | Certificates, the ACME account and the internal CA's private key. | Yes, in TLS mode `internal`: losing it creates a new CA that sensors and browsers do not trust. |
| `gateway-config` | Caddy's runtime configuration. | No. |
| `datastore-tls` | The private CA and certificates of PostgreSQL and Redis. | No (re-issued when missing). |
| `redis-data` | Redis append-only file. | No. |

Never run `docker compose down -v`: it deletes the volumes.

## Setting other variables

The `api` service passes a fixed list of variables from `.env` to the API:
`APP_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
`DB_SSLMODE`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD`,
`REDIS_TLS_ENABLED`, `REDIS_TLS_CA_FILE`, `LOG_LEVEL`, `LOG_FORMAT`,
`AUTH_PROVIDER`, `AUTH_JWT_SECRET`, `AUTH_ALLOW_REGISTRATION`,
`APP_ENCRYPTION_KEY`, `APP_ENCRYPTION_KEY_PREVIOUS`, `APP_TEMPLATE_SIGNING_KEY`,
`TENANT_CREATION_MODE`, `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, `SMTP_FROM` and the `SENSOR_*VERSION` variables. It derives
`CORS_ALLOWED_ORIGINS`, `APP_URL` and `SMTP_BASE_URL` from `OPENCTEM_PUBLIC_URL`.

Any other [API variable](../configuration/environment-variables.md) goes in a
`docker-compose.override.yml` next to `docker-compose.yml`, which Compose reads
automatically. For example, to enable the metrics endpoint and name the email
sender:

```yaml
services:
  api:
    environment:
      METRICS_TOKEN: ${METRICS_TOKEN:?set METRICS_TOKEN in .env}
      SMTP_FROM_NAME: "Example Security"
```

Put the values in `.env` (`METRICS_TOKEN=` plus `openssl rand -hex 32`), then
apply with `docker compose up -d`.

## Managed PostgreSQL or Redis

To use a managed PostgreSQL 17 or Redis 7 instead of the bundled ones:

1. Set `DB_HOST` (and `DB_PORT`, `DB_NAME`, `DB_SSLMODE`) or `REDIS_HOST` (and
   `REDIS_PORT`, `REDIS_TLS_CA_FILE` when the server's CA is not publicly
   trusted) in `.env`.
2. For PostgreSQL, run `postgres/least-privilege-roles.sql` once as a superuser
   against the database, or keep the `db-roles` job and point `DB_SUPERUSER` at an
   administrative role. The database needs the extensions `pgcrypto`, `pg_trgm`
   and `uuid-ossp`.
3. Remove the bundled `postgres`, `redis` and `datastore-tls` services, and the
   `depends_on` entries that name them, from your copy of the Compose file.

Redis must accept TLS and a password of at least 32 characters.

## Overlays

```bash
# Also publish port 80: http:// redirects to https:// (and ACME HTTP-01)
docker compose -f docker-compose.yml -f docker-compose.http-redirect.yml up -d

# TLS mode http, behind your own TLS proxy
docker compose -f docker-compose.yml -f docker-compose.plain-http.yml up -d
```

Use the same `-f` list for every later `docker compose` command.

## Next steps

- [Create the first administrator](first-admin.md).
- [Configure email](../configuration/email.md) so invitations and password
  resets are delivered.
- [Set up backups](../operations/backup-restore.md) and
  [monitoring](../operations/monitoring.md).
- Connect a sensor: see [Sensors](../sensors/index.md).
