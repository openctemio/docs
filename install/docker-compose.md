---
title: Docker Compose
parent: Install
nav_order: 2
---

# Install with Docker Compose
{: .no_toc }

The production Compose stack runs the gateway, the web console, the platform
console, the API, PostgreSQL and Redis on one host. Only the gateway publishes
ports: one HTTPS port (443) for browsers, sensors and API clients, and the
platform console's own site (port 8443 by default, or its own host name), which
answers only your administrators' networks.

1. TOC
{:toc}

---

## Before you start

- A Linux host sized as in [Sizing](sizing.md).
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
git checkout v0.16.1         # the release you deploy
cd api/deploy
```

| File | Purpose |
|---|---|
| `docker-compose.yml` | The stack. |
| `docker-compose.http-redirect.yml` | Overlay: also publish port 80, redirecting to HTTPS. |
| `docker-compose.plain-http.yml` | Overlay: plain HTTP behind your own TLS proxy (TLS mode `http`). |
| `docker-compose.sensor-passthrough.yml` | Overlay: sensors reach the platform on the same port 443, routed to the API's mutual-TLS listener (see [Transport](../sensors/transport.md)). |
| `docker-compose.sensor.yml` | Overlay: a bundled sensor, enrolled as a shared sensor of the installation (see [Overlays](#overlays)). |
| `docker-compose.clamav.yml` | Overlay: malware scanning of uploaded files (see [File storage](../configuration/file-storage.md)). |
| `docker-compose.job-signer.yml` | Overlay: the optional signed-jobs steps (key set, scope ledger). The signer itself is part of the base file (see [Signed jobs](#signed-jobs)). |
| `setup.sh` | Writes `.env` with generated secrets (see step 2). |
| `.env.example` | Settings template. |
| `backup.sh` | Backup, restore check and restore (see [Backup and restore](../operations/backup-restore.md)). |
| `gateway/` | Gateway configuration (Caddyfile, TLS modes, entrypoint). |
| `postgres/least-privilege-roles.sql` | Creates the database roles the stack uses. |
| `sensor/` | The bundled sensor's local policy and seccomp profile (used by `docker-compose.sensor.yml`). |

## 2. Create `.env`

`./setup.sh ctem.example.com` writes `.env` (mode 600) with the host name and
freshly generated secrets, including `FINGERPRINT_KEY`; add
`--acme you@example.com` for a Let's Encrypt certificate. It never overwrites
an existing `.env`. The platform console's site has its own options
(`--admin-site port|host|off`, `--admin-host`, `--admin-port`,
`--admin-cidrs`); see [Platform console](#platform-console). Run
`./setup.sh --help` for the list.

To do it by hand instead, copy the template and fill in a value for every secret. The commands below
generate them; `.env` does not run commands itself.

```bash
cp .env.example .env
for v in DB_SUPERUSER_PASSWORD DB_MIGRATE_PASSWORD DB_ADMIN_PASSWORD DB_PASSWORD REDIS_PASSWORD; do
  sed -i "s|^$v=.*|$v=$(openssl rand -hex 24)|" .env
done
for v in APP_ENCRYPTION_KEY FINGERPRINT_KEY METRICS_TOKEN; do
  sed -i "s|^$v=.*|$v=$(openssl rand -hex 32)|" .env
done
chmod 600 .env
```

Then edit `.env` and set where clients reach the platform:

```bash
OPENCTEM_HOSTNAME=ctem.example.com          # DNS name or IP clients use
# OPENCTEM_PUBLIC_URL=https://ctem.example.com:8443  # only when browsers use a port other than 443
OPENCTEM_TLS_MODE=internal                  # internal | acme | files | http
```

`OPENCTEM_VERSION` is the release every platform image runs. `./setup.sh`
writes it into `.env`: from `--version vX.Y.Z`, else from the release you
checked out (`api/deploy/VERSION` in a release tag's checkout, else the tag). From
a branch checkout it stops and asks for `--version`. When you write `.env` by
hand, set `OPENCTEM_VERSION=v0.16.1` yourself: since v0.16.0 the compose file
carries no default. The image names default to the current ones
(`ghcr.io/openctemio/openctem-api`, `openctem-web`, `openctem-console`,
`openctem-gateway`, `migrations`). Run the release of the files you checked
out.

{: .note }
Only the **v0.9.0** files defaulted to `v0.8.0` and to the old image names
(`ghcr.io/openctemio/api`, `ghcr.io/openctemio/ui`). If you deploy v0.9.0
itself, set `OPENCTEM_VERSION=v0.9.0`,
`API_IMAGE=ghcr.io/openctemio/openctem-api` and
`UI_IMAGE=ghcr.io/openctemio/openctem-web` in `.env`.

{: .warning }
Back up `.env`. `APP_ENCRYPTION_KEY` encrypts the credentials stored in the
database (integration tokens, SMTP passwords, identity-provider secrets): a
database backup is useless for those without it. `FINGERPRINT_KEY` keys the
identity of every secret finding: changing it makes every known secret open a
second finding, so never rotate it together with `APP_ENCRYPTION_KEY`. (Sessions
are signed with a key derived from `APP_ENCRYPTION_KEY`; an optional
`AUTH_JWT_SECRET` lets you rotate the encryption key without signing everyone
out.)

Choose the TLS mode in [TLS and the gateway](tls-and-gateway.md). `internal`
works for any name or IP address with no further setup.

The template creates four database roles: `DB_SUPERUSER` (`postgres`, used only
to initialise the database and to create the others), `DB_MIGRATE_USER`
(`openctem_migrator`, owns the schema and runs migrations), `DB_USER`
(`openctem_app`, the API: read and write rows only) and `DB_ADMIN_USER`
(`openctem_console`, the only role that writes the platform console's identity
tables: administrators, console sessions and approvals). Leaving
`DB_MIGRATE_USER` unset runs everything as `DB_USER` instead. The `db-roles` job
creates the roles on every `up`, and `db-grants` runs the same script again after
the migrations so a table a release adds gets its grants before the API starts
(see [Upgrading to a new release](#upgrading-to-a-new-release)).

Platform e-mail (SMTP), the legal texts and the CAPTCHA keys are not part of
`.env`: set them in the platform console (**Settings**, **E-mail**, **Legal**,
**CAPTCHA**; see [Console settings](../user-guide/11-platform-administration.md)). The old `SMTP_*` and
`LEGAL_*` variables are gone and the API refuses to start while an `SMTP_*`
server variable is set. The CAPTCHA keys can be pinned from the environment
(`CAPTCHA_TURNSTILE_SITE_KEY` with `CAPTCHA_TURNSTILE_SECRET`, in a
`docker-compose.override.yml`); the console then shows them as locked.

## 3. Start the stack

Check the configuration first. `-check-config` validates the API settings from
`.env` the way the API does at start-up, prints the first problem or a one-line
summary (never a secret value) and exits `0` (valid) or `1`, without connecting
to anything:

```bash
docker compose run --rm --no-deps api -check-config
```

A secret that still holds example text (`openssl rand -hex 32`, `<CHANGE_ME...>`,
`changeme`) is refused with a message naming the variable.

Then start it:

```bash
docker compose up -d
docker compose ps -a
```

The one-shot jobs `datastore-tls`, `db-roles`, `migrate`, `db-grants` and
`gateway-init` run and exit with code 0; `gateway`, `web`, `console`, `api`, `signer`,
`postgres` and `redis` stay up. The first start takes a minute or two while
PostgreSQL initialises and the migrations run.

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
| `gateway-init` | `openctem-gateway` | Gives the gateway's volumes to its user (uid 1000), then exits. |
| `gateway` | `openctem-gateway` | The only published service: TLS and routing on port 443. Caddy with the layer-4 module, non-root. |
| `web` | `openctem-web` | Web console (Next.js), internal port 3000. |
| `console` | `openctem-console` | Platform console (Next.js), internal port 3000: its own app, served by the gateway on its own site. It reaches the API's console listener (internal port 8081). |
| `api` | `openctem-api` | API (Go), internal port 8080. Runs the background jobs too. |
| `signer` | `openctem-api` | Job signer: signs every job before a sensor gets it, no network, internal socket to the API. |
| `migrate` | `migrations` | Applies database migrations, then exits. |
| `bootstrap-admin` | `openctem-api` | One-off (profile `tools`): creates the first administrator and organization; not started by `up`. |
| `db-roles` | `postgres:17` | Creates or repairs the least-privilege roles before the migrations, then exits. |
| `db-grants` | `postgres:17` | The same script again after the migrations, so tables a migration just created get their grants before the API starts, then exits. |
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
| `postgres-data` | The database. | Yes, with `backup.sh` (see [Backup and restore](../operations/backup-restore.md)). |
| `api-data` | Uploaded attachments, finding evidence and the sensor CA that signs sensor gRPC certificates (`/app/data`). | Yes. Losing the sensor CA makes sensors on gRPC stop until they get a certificate from the new one (see [Sensor transport](../sensors/transport.md#platform-side-the-sensor-ca)). |
| `api-tmp` | The API's system temp directory (`/tmp`): uploaded archives and form files are spooled here, and feed bundles are staged here. | No. |
| `gateway-data` | Certificates, the ACME account and the internal CA's private key. | Yes, in TLS mode `internal`: losing it creates a new CA that sensors and browsers do not trust. |
| `gateway-config` | Caddy's runtime configuration. | No. |
| `datastore-tls` | The private CA and certificates of PostgreSQL and Redis. | No (re-issued when missing). |
| `redis-data` | Redis append-only file. | No. |

The bundled shared sensor and the job signer add their own volumes (`sensor-data`;
`signer-keys`, `signer-state`, `signer-socket`), described under
[Overlays](#overlays).

Never run `docker compose down -v`: it deletes the volumes.

## Platform console

Platform administrators work in the platform console, not in the organization
web console. It is its own app on its own site, set by `OPENCTEM_ADMIN_SITE`:

| Value | Where the console is |
|---|---|
| `port` (default) | `https://<OPENCTEM_HOSTNAME>:<OPENCTEM_ADMIN_PORT>/` (8443). Needs no extra DNS name. |
| `host` | `https://<OPENCTEM_ADMIN_HOST>/`, its own DNS name on port 443 (must differ from `OPENCTEM_HOSTNAME`). Recommended for production: the browser then isolates the console from the main site. |
| `off` | No console site. |

Only the networks in `OPENCTEM_ADMIN_ALLOWED_CIDRS` reach it (loopback and
private networks by default); set `0.0.0.0/0 ::/0` only behind an access
gateway. In port mode `OPENCTEM_ADMIN_BIND` publishes the console port on one
interface (a private or VPN address): a published port is not filtered by the
host firewall, so prefer that, or an SSH tunnel
(`ssh -L 8443:127.0.0.1:8443 you@<host>`), over a public interface.
`setup.sh` prints the address it configured. What the console offers is
described in [the console guide](../user-guide/11-platform-administration.md). The port is not a security
control; the controls are the separate origin, the network list, the console's
own sign-in with a second factor, step-up and its audit log.

{: .warning }
**Known gap: security keys need `ADMIN_PUBLIC_URL`.** The API defaults it to the
origin of `APP_URL` (`https://<host>`), but the console is on another origin, so
registering a security key or passkey fails ("The security key response was not
accepted"; the API log says `Error validating origin`). Set it to the console's
exact origin and apply it. The stack does not pass it
yet, so use `docker-compose.override.yml` (host mode: `https://<OPENCTEM_ADMIN_HOST>`):

```yaml
services:
  api:
    environment:
      ADMIN_PUBLIC_URL: https://ctem.example.com:8443
```

Then `docker compose up -d api`. Changing it later makes registered keys unusable.

## Setting other variables

The `api` service passes a fixed list of variables from `.env` to the API:
`APP_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_ADMIN_USER`,
`DB_ADMIN_PASSWORD`, `DB_NAME`, `DB_SSLMODE`, `REDIS_HOST`, `REDIS_PORT`,
`REDIS_DB`, `REDIS_PASSWORD`, `REDIS_TLS_ENABLED`, `REDIS_TLS_CA_FILE`,
`LOG_LEVEL`, `LOG_FORMAT`, `AUTH_PROVIDER`, `AUTH_JWT_SECRET`,
`APP_ENCRYPTION_KEY`, `APP_ENCRYPTION_KEY_PREVIOUS`, `FINGERPRINT_KEY`,
`APP_TEMPLATE_SIGNING_KEY`, `APP_CONTENT_SIGNING_KEY`, `SIGNUP_MODE`,
`SELF_SERVICE_START_LIMITS`, `VERSION_CHECK_ENABLED`, `VERSION_CHECK_URL` and
`METRICS_TOKEN` (empty: `/metrics` off). `AUTH_JWT_SECRET` is optional: unset,
the session secret (and the platform console's CSRF key) is derived from
`APP_ENCRYPTION_KEY`. The API in production refuses to start without one of
the two; with `AUTH_PROVIDER=oidc` set `AUTH_JWT_SECRET` yourself. Platform
email (SMTP) is not an environment variable: set it in the platform console,
**Settings > E-mail** (see [Email](../configuration/email.md)). It passes the public origin to the API as `APP_URL`
(`OPENCTEM_PUBLIC_URL`, else `https://<OPENCTEM_HOSTNAME>`), and the API derives
`CORS_ALLOWED_ORIGINS`, `SMTP_BASE_URL` and `OAUTH_FRONTEND_CALLBACK_URL`
(`<APP_URL>/auth/callback`, where SSO sign-ins land) from it.

Any other [API variable](../configuration/environment-variables.md) goes in a
`docker-compose.override.yml` next to `docker-compose.yml`, which Compose reads
automatically. For example, to require email verification at sign-up:

```yaml
services:
  api:
    environment:
      AUTH_REQUIRE_EMAIL_VERIFICATION: "true"
```

Then apply with `docker compose up -d`.

### Hosted service and the audit sink

`MANAGED_SERVICE=true` is for an operator who runs OpenCTEM as a hosted,
multi-tenant service for organizations it does not control; leave it unset on a
self-managed install. It changes defaults only (for example, platform sensors
need a verified domain before they scan a target). In production
(`APP_ENV=production`) the API **refuses to start** with `MANAGED_SERVICE=true`
unless `ADMIN_AUDIT_SINK` is set: an off-box copy of the platform
administrators' hash-chained audit log, so someone who controls the database
cannot rewrite its history unnoticed. The stack does not pass either variable
by default; add them in `docker-compose.override.yml`:

```yaml
services:
  api:
    environment:
      MANAGED_SERVICE: "true"
      ADMIN_AUDIT_SINK: https://audit.example.com/ingest
      ADMIN_AUDIT_SINK_SECRET: ${ADMIN_AUDIT_SINK_SECRET:?set it in .env}
```

`ADMIN_AUDIT_SINK` accepts `https://…` (a signed POST per batch; the receiver
verifies `X-OpenCTEM-Signature` with `ADMIN_AUDIT_SINK_SECRET`, at least 32
bytes, required for https), `syslog+tls://host:6514` (optionally mutual TLS, with
`ADMIN_AUDIT_SINK_SYSLOG_CA_FILE`, `_CLIENT_CERT` and `_CLIENT_KEY` mounted into
the container) or `file:///path` (one JSON batch per line; the directory must be
a writable bind mount owned by the API's user, because the root filesystem is
read-only). A file on the same host only protects against rewrites inside the
database; an https receiver run by someone else is the real off-box copy.
Plaintext `syslog+tcp://` and `syslog+udp://` are not supported, and a
destination that cannot be used stops the start-up. The chain head is also sent
every `ADMIN_AUDIT_SINK_HEAD_INTERVAL` (15 minutes by default).

Memory limits default to 2 GB for the API, 1 GB for the web console, 512 MB
for the platform console and 512 MB for the gateway; change them with
`API_MEMORY_LIMIT`, `WEB_MEMORY_LIMIT`, `CONSOLE_MEMORY_LIMIT` and
`GATEWAY_MEMORY_LIMIT` in `.env`. The bundled PostgreSQL's memory settings follow the
`PG_*` variables in `.env.example`. [Sizing](sizing.md#docker-compose) has
values for each installation size. `PG_TOAST_COMPRESSION` (default `lz4`, or
`pglz`) sets the compression of large `jsonb` and `text` values in the bundled
PostgreSQL.

`backup.sh` writes a status file that the console's Health page reads to show
the last backup. It goes to `./backup-status` next to `docker-compose.yml`, and
the stack mounts the same directory read-only into the API. To keep it
elsewhere, set `BACKUP_STATUS_DIR` in `.env` (and in the environment of
`backup.sh`, for example in the cron entry) to the same path.

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

# Sensors on the same port 443 (the published gateway image already carries the
# layer-4 module: nothing to build)
docker compose -f docker-compose.yml -f docker-compose.sensor-passthrough.yml up -d

# A bundled sensor, enrolled as a shared sensor of the installation
docker compose -f docker-compose.yml -f docker-compose.sensor.yml up -d

# Malware scanning of uploaded files with ClamAV (about 1.5 GB of memory)
docker compose -f docker-compose.yml -f docker-compose.clamav.yml up -d
```

File storage (a local volume or an S3-compatible bucket), retention and
malware scanning are described in [File storage](../configuration/file-storage.md).

The sensor passthrough overlay is described in
[Sensor transport](../sensors/transport.md#grpc-on-port-443-docker-compose).

### The bundled shared sensor

`docker-compose.sensor.yml` adds a sensor that belongs to the installation, not
to an organization, so a platform administrator can offer scanning to
organizations without anyone installing a sensor. It adds two services:

- `sensor-enrollment`, a one-shot job that runs after the migrations and
  registers the single-use `SENSOR_INSTANCE_ENROLLMENT_TOKEN` (valid for one
  hour, audited in the console). `setup.sh` writes a token into `.env`; to
  enroll again, put a new value there (`octe_` and 49 letters or digits) and
  run the `up` again.
- `sensor`, which enrolls with that token on its first start and keeps its
  identity in the `sensor-data` volume (back it up like a credential). It runs
  in shared mode: every tool sandboxed and network-confined, a fresh task
  directory per job, and a local policy in `sensor/sensor-policy.yaml`
  (`setup.sh` copies it from `sensor/sensor-policy.example.yaml`; public
  targets only by default). It refuses to start if the host cannot confine
  tools (unprivileged user namespaces must be allowed).

It takes no organization's work until a super administrator turns shared
sensors on (platform console, **Scanning > Platform scanning**). Shared mode
needs a sensor release built with the shared-mode SDK: the overlay's default
`SENSOR_VERSION` is v0.23.2, which has it. A sensor without it (v0.23.0 and
older) enrolls but receives no shared job, because the platform sends shared
jobs only to a sensor that reports shared-mode isolation. See
[Shared sensors](../sensors/shared-sensors.md) for the settings, the fleet page
and what organizations see.

The sensor container is bounded to 2 GB of memory, 2 CPUs and 512 processes;
change them with `SENSOR_MEMORY_LIMIT`, `SENSOR_CPUS` and `SENSOR_PIDS_LIMIT` in
`.env`.

Use the same `-f` list for every later `docker compose` command.

### Signed jobs

The default Compose file runs the `signer` container, from the API image, with no
network and its own key volume that is never mounted into the API. The API reaches it
only through a Unix socket (`SIGNER_SOCKET`), and a command the signer does not sign is
not handed to a sensor, so keep it up. The signer creates its key on first start
(`SIGNER_GENERATE_KEY`) and logs the key id; the bundled sensor pins the public key from
the `signer-pub` volume, which the API cannot write. A production API refuses to start
without `SIGNER_SOCKET` unless `SIGNER_DANGEROUS_ALLOW_UNSIGNED_JOBS=true`.

The API logs "sensor jobs are signed by the job signer" and
`GET /api/v2/sensor/hello` lists the `signed_jobs` feature. Back up the `signer-keys`
volume offline; `signer-state` holds the sequence numbers and the signing log.

`docker-compose.job-signer.yml` is kept as an overlay for the optional steps its
comments describe: creating the key by hand (`run --rm signer keygen -out
/var/lib/openctem-signer/keys/signer.pem`), a key set signed by an offline root key, and
the scope ledger bootstrap on an install that already has scopes (or
`SIGNER_LEDGER=audit` in `.env` until it is done).

## Upgrading to a new release

Check out the new release, read its upgrade notes, and run
`docker compose pull && docker compose up -d` (see [Upgrading](../operations/upgrade.md)).
The `db-roles` and `db-grants` jobs re-apply
`postgres/least-privilege-roles.sql` on every `up` using `DB_SUPERUSER`, so new
tables get their grants without a manual step. This includes the console's new
tables in v0.11.0 (`admin_approvals`) when `DB_ADMIN_USER` is set. If you run
your own PostgreSQL and the `db-roles` job does not connect as a superuser, run
the script yourself after every upgrade, with the `admin_user` and
`admin_password` variables when you use `DB_ADMIN_USER`:

```bash
psql "$SUPERUSER_URL" -v ON_ERROR_STOP=1 \
  -v app_user="$DB_USER" -v app_password="$DB_PASSWORD" \
  -v migrator_user="$DB_MIGRATE_USER" -v migrator_password="$DB_MIGRATE_PASSWORD" \
  -v admin_user="$DB_ADMIN_USER" -v admin_password="$DB_ADMIN_PASSWORD" \
  -f postgres/least-privilege-roles.sql
```

## Next steps

- [Create the first administrator](first-admin.md).
- [Configure email](../configuration/email.md) so invitations and password
  resets are delivered.
- [Set up backups](../operations/backup-restore.md) and
  [monitoring](../operations/monitoring.md).
- Connect a sensor: see the [sensor quickstart](../sensors/index.md#quickstart-a-working-sensor-in-five-minutes).
