---
title: All-in-one image
parent: Install
nav_order: 3
---

# Install the all-in-one image
{: .no_toc }

`ghcr.io/openctemio/openctem` runs the API, the web console and the gateway in
one container. PostgreSQL and Redis are external: bring your own (managed or
self-hosted). Use it when you already operate PostgreSQL and Redis, or want a
single container to manage. For a self-contained stack with bundled datastores,
use [Docker Compose](docker-compose.md).

1. TOC
{:toc}

---

## What is inside

| Process | Listens on | Notes |
|---|---|---|
| Gateway (Caddy) | `443` (`80` in TLS mode `http`) | Same configuration as the Compose gateway: [TLS and the gateway](tls-and-gateway.md). |
| API | `127.0.0.1:8080` | `0.0.0.0:8080` with `GATEWAY=off`. |
| Web console | `127.0.0.1:3000` | `0.0.0.0:3000` with `GATEWAY=off`. |

On start the container applies the database migrations (`MIGRATE_ON_START=true`)
under a PostgreSQL advisory lock, so several replicas never migrate at once, and
then starts the three processes. Each output line is prefixed `[api]`, `[web]`,
`[gateway]`, `[migrate]` or `[supervise]`. If any process exits, the container
stops with that process's exit code, so your restart policy restarts it. The
image's health check passes only when all three answer.

The image is published from v0.9.0, for `linux/amd64` and `linux/arm64`.

## Requirements

- PostgreSQL 17 with the extensions `pgcrypto`, `pg_trgm` and `uuid-ossp`
  available, reachable over TLS.
- Redis 7 with TLS and a password of at least 32 characters.
- A volume for `/data`.

The image runs in production mode unless you say otherwise: an unset `APP_ENV`
means `production`, so a container started without configuration refuses to
start until the production checks pass. In particular it needs:

- `DB_SSLMODE=require` or `verify-full` (the default `disable` is refused);
- `REDIS_PASSWORD` of at least 32 characters and `REDIS_TLS_ENABLED=true`, plus
  `REDIS_TLS_CA_FILE` when the Redis certificate comes from a private CA;
- `AUTH_JWT_SECRET` of at least 64 characters and an `APP_ENCRYPTION_KEY`.

A secret that still holds example text (`openssl rand -hex 32`, `<CHANGE_ME...>`,
`changeme`) is refused in every mode. The full list is in
[Production checks](../configuration/environment-variables.md#production-checks).

{: .note }
For a short, non-production trial without TLS to the datastores, set
`APP_ENV=development` explicitly. Never use it for real data: development mode
skips the checks above, accepts the development secrets published in the
repository and sends no HSTS header.

## 1. Prepare the database roles

Run the least-privilege script from the release once, as a PostgreSQL superuser,
against the OpenCTEM database. It creates `openctem_migrator` (owns the schema,
runs migrations) and `openctem_app` (the API: read and write rows only), and the
extensions:

```bash
git clone https://github.com/openctemio/openctem.git
git -C openctem checkout v0.9.0
export APP_DB_PASSWORD="$(openssl rand -hex 24)"
export MIGRATOR_DB_PASSWORD="$(openssl rand -hex 24)"
psql "postgres://postgres@db.example.com:5432/openctem?sslmode=require" \
  -v ON_ERROR_STOP=1 \
  -v app_password="$APP_DB_PASSWORD" \
  -v migrator_password="$MIGRATOR_DB_PASSWORD" \
  -f openctem/api/deploy/postgres/least-privilege-roles.sql
```

The script is idempotent; re-run it after restoring a dump.

## 2. Write the environment file

The command below writes `openctem.env` and generates the secrets. It uses the
passwords exported in step 1; set `REDIS_PASSWORD` to your Redis password first.
Replace the host names with yours.

```bash
export REDIS_PASSWORD='your-redis-password'
umask 077
cat > openctem.env <<EOF
OPENCTEM_HOSTNAME=ctem.example.com
OPENCTEM_TLS_MODE=internal
CORS_ALLOWED_ORIGINS=https://ctem.example.com
APP_URL=https://ctem.example.com
SMTP_BASE_URL=https://ctem.example.com
OAUTH_FRONTEND_CALLBACK_URL=https://ctem.example.com/auth/callback
SENSOR_CA_CERT_FILE=/data/ca/openctem-root-ca.crt

APP_ENV=production
AUTH_PROVIDER=local
AUTH_JWT_SECRET=$(openssl rand -hex 64)
APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -hex 32)

DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=openctem
DB_SSLMODE=require
DB_USER=openctem_app
DB_PASSWORD=${APP_DB_PASSWORD:?run step 1 first}
DB_MIGRATE_USER=openctem_migrator
DB_MIGRATE_PASSWORD=${MIGRATOR_DB_PASSWORD:?run step 1 first}

REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD:?set REDIS_PASSWORD}
REDIS_TLS_ENABLED=true
EOF
```

`APP_ENV=production` and `AUTH_PROVIDER=local` are also what the API uses when
the variables are unset; the file sets them so the intent is visible.

If the Redis certificate is not publicly trusted, mount its CA certificate
(`-v /etc/openctem/redis-ca.crt:/etc/openctem/redis-ca.crt:ro`) and add
`REDIS_TLS_CA_FILE=/etc/openctem/redis-ca.crt`.

{: .warning }
Back up `openctem.env`. `APP_ENCRYPTION_KEY` is needed to read the credentials
stored in the database, and `AUTH_JWT_SECRET` signs sessions.

## 3. Check the configuration

Validate the env file before the first start. `-check-config` loads the
configuration the way the API does, prints the first problem or a one-line
summary (never a secret value), exits `0` (valid) or `1` (invalid), and connects
to nothing:

```bash
docker run --rm --env-file openctem.env \
  --entrypoint /opt/openctem/api/server \
  ghcr.io/openctemio/openctem:v0.9.0 -check-config
```

```text
configuration valid: APP_ENV=production AUTH_PROVIDER=local TENANT_CREATION_MODE=admin_only SCOPE_ACTIVE_PROOF=off
```

A refusal names the setting, for example
`configuration INVALID: database SSL must be enabled in production (use 'require' or 'verify-full')`.

To verify the image signature before you run it, see
[Verify a release](../operations/versioning.md#verify-a-release).

## 4. Run the container

```bash
docker volume create openctem-data
docker run -d --name openctem --restart unless-stopped \
  -p 443:443 \
  -v openctem-data:/data \
  --env-file openctem.env \
  ghcr.io/openctemio/openctem:v0.9.0
docker logs -f openctem
```

Wait for the API's `application started` line, then check:

```bash
docker cp openctem:/data/ca/openctem-root-ca.crt .
curl --cacert openctem-root-ca.crt https://ctem.example.com/health
```

Next: [create the first administrator](first-admin.md). The `bootstrap-admin`
tool is in the image:

```bash
docker exec openctem /opt/openctem/api/bootstrap-admin \
  -email=admin@example.com -backup-email=breakglass@example.com \
  -org-name="Example Security" -org-owner-email=owner@example.com
```

It reads the database settings from the container's environment.

## The `/data` volume

| Path | Holds |
|---|---|
| `/data/attachments` | Uploaded attachments and finding evidence (`STORAGE_LOCAL_PATH`). |
| `/data/caddy` | Gateway certificates, the ACME account and the internal CA's private key. |
| `/data/ca/openctem-root-ca.crt` | The internal CA's root certificate, for sensors and browsers (TLS mode `internal`). |

Without a volume every restart loses attachments and creates a new CA, and
sensors stop trusting the gateway. Back the volume up with the database.

## TLS modes

`OPENCTEM_TLS_MODE` works as in the Compose stack
([TLS and the gateway](tls-and-gateway.md)):

- `internal` (image default): the gateway's own CA, for a DNS name or an IP
  address.
- `acme`: Let's Encrypt; also set `ACME_EMAIL`. Port 443 must be reachable from
  the internet.
- `files`: your certificate. Mount the directory holding `tls.crt` (full chain)
  and `tls.key` at `/certs`: `-v /etc/openctem/tls:/certs:ro`.
- `http`: plain HTTP on port 80 behind your own TLS proxy. Also set
  `OPENCTEM_ALLOW_PLAIN_HTTP=true` and `OPENCTEM_TRUSTED_PROXIES` (your proxy's
  address), and publish the port only to the proxy:
  `-p 127.0.0.1:8081:80` instead of `-p 443:443`.

## Without the gateway

`GATEWAY=off` serves the API on port 8080 and the web console on port 3000
directly, with no TLS. Your own proxy must then terminate TLS and route exactly
as the gateway does (sensor, SCIM, MCP, webhook, SAML and WebSocket paths, and
API-key requests, to the API; everything else to the console). The routing table
is in [TLS and the gateway](tls-and-gateway.md#routing). Prefer `GATEWAY=on` with
TLS mode `http` behind your proxy: the routing then stays in the image.

## Upgrading

Pull the new tag and recreate the container with the same volume and env file.
Migrations run on start. See [Upgrading](../operations/upgrade.md).

```bash
NEW_VERSION=v0.9.1   # the release you upgrade to
docker pull ghcr.io/openctemio/openctem:$NEW_VERSION
docker run --rm --env-file openctem.env --entrypoint /opt/openctem/api/server \
  ghcr.io/openctemio/openctem:$NEW_VERSION -check-config
docker rm -f openctem
docker run -d --name openctem --restart unless-stopped \
  -p 443:443 -v openctem-data:/data --env-file openctem.env \
  ghcr.io/openctemio/openctem:$NEW_VERSION
```

All environment variables: [Environment variables reference](../configuration/environment-variables.md#all-in-one-image).
