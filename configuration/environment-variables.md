---
title: Environment variables reference
parent: Configuration
nav_order: 1
---

# Environment variables reference
{: .no_toc }

Every environment variable the OpenCTEM API reads, plus the variables of the web
console, the gateway, the Compose stack and the all-in-one image. The API list is
generated from the configuration code (`api/internal/config/config.go` and the few
other places that read the environment), so a variable that is not on this page
is not read.

1. TOC
{:toc}

---

## How to read the tables

- **Default** is the value used when the variable is unset or empty. Durations use
  Go syntax (`30s`, `5m`, `24h`). Lists are comma-separated.
- **Required**: `yes` means the API does not work without it; `production` means
  `APP_ENV=production` refuses to start without a valid value (see
  [Production checks](#production-checks)).
- **Secret**: keep the value out of version control and logs, and inject it from a
  secret store (a Compose `.env` file readable only by root, a Kubernetes Secret).
- A value that does not parse (for example `SERVER_PORT=abc`) is ignored and the
  default is used. Invalid enumerations (`LOG_LEVEL`, `TENANT_CREATION_MODE`,
  `STORAGE_PROVIDER`, `SCOPE_ACTIVE_PROOF`, `AUTH_PROVIDER`) stop start-up with a
  message that names the variable.

## Where to set them

| Deployment | API variables | Web console variables |
|---|---|---|
| [Docker Compose](../install/docker-compose.md) | The `api` service sets a fixed list from `.env`. Anything else goes in a `docker-compose.override.yml` (see [Setting other variables](../install/docker-compose.md#setting-other-variables)). | The `web` service. |
| [All-in-one image](../install/all-in-one.md) | `docker run -e` / `--env-file`: every variable reaches the API process. | Same container. |
| [Kubernetes (Helm)](../install/kubernetes.md) | Chart values, plus `api.extraEnv` / `api.extraEnvFrom` for anything the chart has no value for. | `ui.extraEnv` / `ui.extraEnvFrom`. |

## Production checks

With `APP_ENV=production`, which is also what an unset `APP_ENV` means, the API
refuses to start unless all of the following hold. The error names the variable.
A container or binary started without configuration therefore refuses to start;
set `APP_ENV=development` explicitly only for a local or trial setup.

- `AUTH_COOKIE_SECURE=true`.
- `CORS_ALLOWED_ORIGINS` does not contain `*`.
- `DB_SSLMODE` is not `disable`.
- `RATE_LIMIT_ENABLED=true`, `APP_DEBUG=false`, `LOG_LEVEL` is not `debug`.
- Redis: `REDIS_PASSWORD` of at least 32 characters, `REDIS_TLS_ENABLED=true`,
  `REDIS_TLS_SKIP_VERIFY=false`, `REDIS_POOL_SIZE` 10 to 500, dial, read and write
  timeouts of at least `1s`, `REDIS_MAX_RETRIES` 1 to 10.
- With `AUTH_PROVIDER=local` or `hybrid`: `AUTH_JWT_SECRET` of at least 64
  characters, `AUTH_PASSWORD_MIN_LENGTH` of at least 8,
  `AUTH_REQUIRE_EMAIL_VERIFICATION=true`, `AUTH_COOKIE_SAMESITE` one of `strict`,
  `lax`, `none`.
- With `AUTH_PROVIDER=oidc` or `hybrid`: `KEYCLOAK_BASE_URL` set to an `https://`
  URL other than the default, and `KEYCLOAK_REALM` set to a value other than the
  default.
- `OAUTH_STATE_SECRET` set when a social-login provider is enabled.
- No connected Jira integration lacks a webhook secret (see `JIRA_WEBHOOK_SECRET`).

In every environment other than `development` the API also refuses to start
without `APP_ENCRYPTION_KEY`, and refuses the development defaults published in
the repository for `AUTH_JWT_SECRET` and `APP_ENCRYPTION_KEY`, and
`OPENCTEM_HTTPSEC_ALLOW_PRIVATE=1` (list ranges in
`OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS` instead).

In every environment, `development` included, the API refuses a secret that still
holds the placeholder text of an example file: a value in angle brackets
(`<CHANGE_ME...>`) or one containing `openssl rand`, `changeme`, `change_me`,
`replace-me`, `replace_me` or `your-super-secret`. This applies to
`APP_ENCRYPTION_KEY` (and each `APP_ENCRYPTION_KEY_PREVIOUS` entry),
`APP_TEMPLATE_SIGNING_KEY`, `AUTH_JWT_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD`,
`OAUTH_STATE_SECRET`, `SENSOR_KEY_PEPPER` and `METRICS_TOKEN`. The message names
the variable and never prints the value.

On every start the API also checks that the database schema matches the binary: it refuses to start
when the schema is behind, dirty, or older than the migration baseline (see
[Upgrading](../operations/upgrade.md)).

### Check the configuration without starting

`server -check-config` loads and validates the configuration from the
environment exactly as a start would, then exits: `0` with a one-line summary when
it is valid, `1` with the first problem when it is not. It connects to nothing and
never prints a secret value. Run it before a deploy or as an init step:

```bash
# API image (the entrypoint is the server binary)
docker run --rm --env-file api.env ghcr.io/openctemio/openctem-api:v0.9.0 -check-config
# Docker Compose, in api/deploy
docker compose run --rm --no-deps api -check-config
# All-in-one image
docker run --rm --env-file openctem.env --entrypoint /opt/openctem/api/server \
  ghcr.io/openctemio/openctem:v0.9.0 -check-config
```

```text
configuration valid: APP_ENV=production AUTH_PROVIDER=local TENANT_CREATION_MODE=admin_only SCOPE_ACTIVE_PROOF=off
```

With `APP_ENV=development` it adds a note that the production checks were
skipped.

## API server

### Application

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `APP_ENV` | `production` |  |  | Environment name. `production` (also when unset) turns on the production checks listed under [Production checks](#production-checks). Any value other than `development` requires `APP_ENCRYPTION_KEY`, refuses the published development secrets and defaults `AUTH_COOKIE_SECURE` to `true`. Set `development` explicitly for a local or trial setup without TLS to the datastores. Up to v0.8.0 an unset value meant `development`. |
| `APP_NAME` | `openctem` |  |  | Application name used in logs and in email templates. |
| `APP_DEBUG` | `false` |  |  | Debug mode. Must be `false` in production. |
| `APP_URL` | empty | production |  | Public origin of the platform (`https://ctem.example.com`). SAML service-provider URLs and sensor install snippets are built from it. The Compose stack sets it to `OPENCTEM_PUBLIC_URL`. |

### HTTP server

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `SERVER_HOST` | `0.0.0.0` |  |  | Listen address of the API. |
| `SERVER_PORT` | `8080` |  |  | Listen port of the API (REST, WebSocket, `/health`, `/ready`, `/metrics`). |
| `SERVER_READ_TIMEOUT` | `15s` |  |  | HTTP server read timeout (Go duration). |
| `SERVER_WRITE_TIMEOUT` | `15s` |  |  | HTTP server write timeout. |
| `SERVER_REQUEST_TIMEOUT` | `30s` |  |  | Per-request handler timeout. |
| `SERVER_SHUTDOWN_TIMEOUT` | `30s` |  |  | Grace period for in-flight requests on shutdown. |
| `SERVER_MAX_BODY_SIZE` | `10485760` (10 MiB) |  |  | Default request body limit in bytes. Some routes (for example asset import) set their own, larger limit. |
| `SERVER_TRUSTED_PROXIES` | empty |  |  | Comma-separated CIDRs or IPs of proxies whose `X-Real-IP` / `X-Forwarded-For` the API believes (audit log, rate limits, IP allowlists). Empty: the API treats every peer as the client. The Compose stack lists the gateway and the web console. |
| `SESSION_TIMEOUT_MINUTES` | `30` |  |  | Maximum age, in minutes, of an access token (from its issued-at time) before the API answers `401 Session has expired`. `0` turns the check off. |
| `MAX_CONCURRENT_REQUESTS` | `1000` |  |  | Maximum number of requests the API handles at once; further requests are refused. |
| `GRPC_PORT` | `9090` |  |  | Read but not used: the API runs no gRPC server. Nothing listens on this port. |

### Database (PostgreSQL)

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `DB_HOST` | `localhost` | yes |  | PostgreSQL host. |
| `DB_PORT` | `5432` |  |  | PostgreSQL port. |
| `DB_USER` | `openctem` | yes |  | Role the API connects as. With the least-privilege layout this is the DML-only role (`openctem_app`). |
| `DB_PASSWORD` | `secret` | yes | yes | Password of `DB_USER`. Always set it; the default exists for local development only. |
| `DB_NAME` | `openctem` |  |  | Database name. |
| `DB_SSLMODE` | `disable` | production |  | libpq `sslmode`. Production refuses `disable`: use `require`, `verify-ca` or `verify-full`. |
| `DB_MAX_OPEN_CONNS` | `25` |  |  | Maximum open connections in the API's pool. |
| `DB_MAX_IDLE_CONNS` | `5` |  |  | Maximum idle connections kept in the pool. |
| `DB_CONN_MAX_LIFETIME` | `5m` |  |  | Maximum lifetime of a pooled connection. |
| `DB_JIT_ENABLED` | `false` |  |  | PostgreSQL JIT for the API's sessions. Off by default because request-path queries pay the JIT compile cost without benefiting from it. |
| `MIGRATIONS_DIR` | `migrations` |  |  | Directory the start-up schema check reads the shipped migrations from. The images set the right path; change it only for a custom layout. |
| `SKIP_SCHEMA_CHECK` | unset |  |  | `true` skips the start-up check that refuses to start when the database schema is behind the binary or dirty. Keep it unset in production. |

### Redis

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `REDIS_HOST` | `localhost` | yes |  | Redis host. |
| `REDIS_PORT` | `6379` |  |  | Redis port. |
| `REDIS_PASSWORD` | empty | production | yes | Redis password. Production requires at least 32 characters. |
| `REDIS_DB` | `0` |  |  | Redis database number. |
| `REDIS_POOL_SIZE` | `10` |  |  | Connection pool size. Production requires 10 to 500. |
| `REDIS_MIN_IDLE_CONNS` | `2` |  |  | Minimum idle connections. |
| `REDIS_DIAL_TIMEOUT` | `5s` |  |  | Connect timeout. Production requires at least `1s`. |
| `REDIS_READ_TIMEOUT` | `3s` |  |  | Read timeout. Production requires at least `1s`. |
| `REDIS_WRITE_TIMEOUT` | `3s` |  |  | Write timeout. Production requires at least `1s`. |
| `REDIS_TLS_ENABLED` | `false` | production |  | Connect to Redis over TLS. Required in production. |
| `REDIS_TLS_SKIP_VERIFY` | `false` |  |  | Skip certificate verification. Production refuses `true`. |
| `REDIS_TLS_CA_FILE` | empty |  |  | CA certificate (PEM) to verify Redis with, when its certificate is not publicly trusted. |
| `REDIS_TLS_CERT_FILE` | empty |  |  | Client certificate (PEM) for mutual TLS. |
| `REDIS_TLS_KEY_FILE` | empty |  | yes | Client private key (PEM) for mutual TLS. |
| `REDIS_MAX_RETRIES` | `3` |  |  | Retries per command. Production requires 1 to 10. |
| `REDIS_MIN_RETRY_DELAY` | `100ms` |  |  | Minimum back-off between retries. |
| `REDIS_MAX_RETRY_DELAY` | `3s` |  |  | Maximum back-off between retries. |

### Logging

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `LOG_LEVEL` | `info` (`debug` when `APP_ENV=development`) |  |  | `debug`, `info`, `warn` or `error`. Production refuses `debug`. |
| `LOG_FORMAT` | `json` (`text` when `APP_ENV=development`) |  |  | `json` or `text`. |
| `LOG_SAMPLING_ENABLED` | `false` |  |  | Sample repeated log records (same level and message) to bound log volume. |
| `LOG_SAMPLING_THRESHOLD` | `100` |  |  | Identical records per second always written before sampling starts. |
| `LOG_SAMPLING_RATE` | `0.1` |  |  | Fraction (0.0 to 1.0) of records kept above the threshold. |
| `LOG_ERROR_SAMPLING_RATE` | `1.0` |  |  | Fraction (0.0 to 1.0) of error records kept above the threshold. |
| `LOG_SLOW_REQUEST_SECONDS` | `5` |  |  | A request slower than this is logged at WARN as `slow http request`. `0` turns it off. |
| `LOG_SKIP_HEALTH` | `true` |  |  | Read but not used: health, readiness and metrics requests are never written to the request log. |

### Encryption keys

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `APP_ENCRYPTION_KEY` | empty | yes | yes | AES-256-GCM key for stored credentials (integration tokens, SMTP passwords, identity-provider secrets). 32 raw, 64 hex or 44 base64 characters: `openssl rand -hex 32`. Required unless `APP_ENV=development`. Back it up with the database: without it the stored credentials cannot be decrypted. |
| `APP_ENCRYPTION_KEY_FORMAT` | auto-detected |  |  | `raw`, `hex` or `base64`. Detected from the key length when unset. |
| `APP_ENCRYPTION_KEY_PREVIOUS` | empty |  | yes | Comma-separated earlier keys, only while a key rotation is in progress. Values encrypted under them stay readable. Remove them when the rotation is finished. |
| `APP_ALLOW_PLAINTEXT_CREDENTIALS` | `false` |  |  | Only with `APP_ENV=development`: `true` lets the API start without `APP_ENCRYPTION_KEY` and store credentials in plaintext. Never use it for real data; every other environment refuses to start without a key. |
| `APP_TEMPLATE_SIGNING_KEY` | empty (derived from `APP_ENCRYPTION_KEY`) |  | yes | Master secret the per-organization signing keys of custom scanner templates are derived from. Same formats as `APP_ENCRYPTION_KEY` and must differ from it. Set it to rotate template keys independently of the encryption key. |

### Authentication

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `AUTH_PROVIDER` | `local` |  |  | `local` (built-in email and password), `oidc` (an external Keycloak realm) or `hybrid` (both). Up to v0.8.0 the default was `oidc`: an installation that relied on that must now set `AUTH_PROVIDER=oidc`. |
| `AUTH_JWT_SECRET` | empty | yes | yes | HMAC secret that signs session tokens. Required with `local` or `hybrid`; at least 32 characters, 64 in production: `openssl rand -hex 64`. Changing it signs every user out. |
| `AUTH_JWT_ISSUER` | `api` |  |  | `iss` claim of issued tokens. |
| `AUTH_ACCESS_TOKEN_DURATION` | `15m` |  |  | Access token lifetime. |
| `AUTH_REFRESH_TOKEN_DURATION` | `168h` |  |  | Refresh token lifetime (7 days). |
| `AUTH_SESSION_DURATION` | `720h` |  |  | Session lifetime (30 days). |
| `AUTH_PASSWORD_MIN_LENGTH` | `12` |  |  | Minimum password length. At least 6; at least 8 in production. |
| `AUTH_PASSWORD_REQUIRE_UPPERCASE` | `true` |  |  | Require an uppercase letter. |
| `AUTH_PASSWORD_REQUIRE_LOWERCASE` | `true` |  |  | Require a lowercase letter. |
| `AUTH_PASSWORD_REQUIRE_NUMBER` | `true` |  |  | Require a digit. |
| `AUTH_PASSWORD_REQUIRE_SPECIAL` | `false` |  |  | Require a special character. |
| `AUTH_MAX_LOGIN_ATTEMPTS` | `5` |  |  | Failed sign-ins before the account is locked. |
| `AUTH_LOCKOUT_DURATION` | `15m` |  |  | How long a locked account stays locked. |
| `AUTH_MAX_ACTIVE_SESSIONS` | `10` |  |  | Concurrent sessions per user. |
| `AUTH_ALLOW_REGISTRATION` | `false` |  |  | Deprecated, being retired. `true` lets anyone create an account on the sign-up page. Accounts normally come from an administrator, an invitation or SSO. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `true` |  |  | Require a verified email address. Production refuses `false` with `local` or `hybrid`. |
| `AUTH_EMAIL_VERIFICATION_DURATION` | `24h` |  |  | Lifetime of an email verification link. |
| `AUTH_PASSWORD_RESET_DURATION` | `1h` |  |  | Lifetime of a password reset link. |
| `AUTH_COOKIE_SECURE` | `true` (`false` when `APP_ENV=development`) | production |  | `Secure` flag on session cookies. Must be `true` in production. |
| `AUTH_COOKIE_DOMAIN` | empty (current host) |  |  | `Domain` attribute of session cookies. |
| `AUTH_COOKIE_SAMESITE` | `lax` |  |  | `strict`, `lax` or `none` (`none` needs `AUTH_COOKIE_SECURE=true`). |
| `AUTH_ACCESS_TOKEN_COOKIE_NAME` | `auth_token` |  |  | Name of the access-token cookie. The gateway's routing rule and the web console expect `auth_token`; change all three together or not at all. |
| `AUTH_REFRESH_TOKEN_COOKIE_NAME` | `refresh_token` |  |  | Name of the refresh-token cookie. |
| `AUTH_TENANT_COOKIE_NAME` | `app_tenant` |  |  | Name of the cookie holding the selected organization. |

### Organizations and scope guardrails

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `TENANT_CREATION_MODE` | `admin_only` |  |  | `admin_only`: only a platform administrator creates organizations (admin console or `bootstrap-admin`). `self_service`: any signed-in user may create organizations. Any other value stops start-up. |
| `SCOPE_ACTIVE_PROOF` | `off` (`platform_sensors` with `TENANT_CREATION_MODE=self_service`) |  |  | When an active probe needs a verified domain of the organization: `off`, `platform_sensors` (jobs on shared platform sensors) or `all`. Intrusive probes always need one. |
| `SCOPE_MAX_PUBLIC_CIDR_V4` | `16` |  |  | Largest public IPv4 range (prefix length) one scope entry may cover. Private ranges are not capped. |
| `SCOPE_MAX_PUBLIC_CIDR_V6` | `32` |  |  | Largest public IPv6 range one scope entry may cover. |
| `SCOPE_DENY_EXTRA` | empty |  |  | Comma-separated domains and CIDRs that no organization may target, in addition to the built-in deny list (for example the platform's own names and ranges). |

### Single sign-on and social login

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `OAUTH_ENABLED` | `true` |  |  | Master switch for social login (Google, GitHub, Microsoft). A provider is offered only when its own `*_ENABLED`, client ID and secret are set. |
| `OAUTH_FRONTEND_CALLBACK_URL` | `http://localhost:3000/auth/callback` |  |  | Web console URL the social-login flow returns to: `https://<host>/auth/callback`. |
| `OAUTH_STATE_SECRET` | empty | production | yes | Secret that signs the OAuth `state` parameter. Required in production when a social-login provider is enabled. |
| `OAUTH_STATE_DURATION` | `10m` |  |  | Lifetime of an OAuth `state` token. |
| `OAUTH_GOOGLE_ENABLED` | `false` |  |  | Offer Google sign-in. |
| `OAUTH_GOOGLE_CLIENT_ID` | empty |  |  | Google OAuth client ID. |
| `OAUTH_GOOGLE_CLIENT_SECRET` | empty |  | yes | Google OAuth client secret. |
| `OAUTH_GOOGLE_SCOPES` | `openid,email,profile` |  |  | Requested scopes. |
| `OAUTH_GITHUB_ENABLED` | `false` |  |  | Offer GitHub sign-in. |
| `OAUTH_GITHUB_CLIENT_ID` | empty |  |  | GitHub OAuth client ID. |
| `OAUTH_GITHUB_CLIENT_SECRET` | empty |  | yes | GitHub OAuth client secret. |
| `OAUTH_GITHUB_SCOPES` | `read:user,user:email` |  |  | Requested scopes. |
| `OAUTH_MICROSOFT_ENABLED` | `false` |  |  | Offer Microsoft sign-in. |
| `OAUTH_MICROSOFT_CLIENT_ID` | empty |  |  | Microsoft OAuth client ID. |
| `OAUTH_MICROSOFT_CLIENT_SECRET` | empty |  | yes | Microsoft OAuth client secret. |
| `OAUTH_MICROSOFT_SCOPES` | `openid,email,profile,User.Read` |  |  | Requested scopes. |
| `SSO_ALLOWED_REDIRECT_URIS` | derived |  |  | Comma-separated exact-match allow-list for the `redirect_uri` of the per-organization SSO flow: origins (`https://ctem.example.com`) or origin-plus-path prefixes ending in `/`. Unset: derived from `CORS_ALLOWED_ORIGINS`, `OAUTH_FRONTEND_CALLBACK_URL` and `SMTP_BASE_URL`. |
| `SSO_ENTRA_ENABLED` | `false` |  |  | Platform-wide Microsoft Entra ID fallback, used by an organization that has no Entra ID provider of its own and is listed in `SSO_ENTRA_ALLOWED_TENANTS`. Organization SSO is normally configured per organization in the console. |
| `SSO_ENTRA_CLIENT_ID` | empty |  |  | Application (client) ID of the fallback app registration. |
| `SSO_ENTRA_CLIENT_SECRET` | empty |  | yes | Client secret of the fallback app registration. |
| `SSO_ENTRA_TENANT_ID` | `common` |  |  | Entra directory ID of the fallback. |
| `SSO_ENTRA_ALLOWED_DOMAINS` | empty (any) |  |  | Comma-separated email domains the fallback accepts. |
| `SSO_ENTRA_DEFAULT_ROLE` | `viewer` |  |  | Role given to users the fallback provisions. |
| `SSO_ENTRA_AUTO_PROVISION` | `true` |  |  | Create accounts on first sign-in through the fallback. |
| `SSO_ENTRA_DISPLAY_NAME` | `Microsoft Entra ID` |  |  | Button label of the fallback. |
| `SSO_ENTRA_ALLOWED_TENANTS` | empty (none) |  |  | Comma-separated organization slugs allowed to use the fallback. Empty disables it for every organization. |
| `KEYCLOAK_BASE_URL` | `http://localhost:8080` |  |  | Keycloak server for `AUTH_PROVIDER=oidc` or `hybrid`. In production it must be set, use HTTPS and differ from the default. |
| `KEYCLOAK_REALM` | `openctem` |  |  | Keycloak realm. In production with `oidc` or `hybrid` it must be set to a value other than the default. |
| `KEYCLOAK_CLIENT_ID` | empty |  |  | Expected audience of Keycloak tokens (optional). |
| `KEYCLOAK_JWKS_REFRESH_INTERVAL` | `1h` |  |  | How often Keycloak's signing keys are refreshed. |
| `KEYCLOAK_HTTP_TIMEOUT` | `10s` |  |  | Timeout of requests to Keycloak. |

### CORS and rate limiting

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | production |  | Comma-separated browser origins. Set it to the public origin (`https://ctem.example.com`): the API also checks the WebSocket `Origin` against it. Production refuses `*`. |
| `CORS_ALLOWED_METHODS` | `GET,POST,PUT,DELETE,OPTIONS,PATCH` |  |  | Allowed methods. |
| `CORS_ALLOWED_HEADERS` | `Accept,Authorization,Content-Type,X-Request-ID` |  |  | Allowed request headers. |
| `CORS_MAX_AGE` | `86400` |  |  | Preflight cache lifetime in seconds. |
| `RATE_LIMIT_ENABLED` | `true` |  |  | Global per-client rate limiter. Production refuses `false`. |
| `RATE_LIMIT_RPS` | `100` |  |  | Requests per second per client. |
| `RATE_LIMIT_BURST` | `200` |  |  | Burst size per client. |
| `RATE_LIMIT_CLEANUP` | `1m` |  |  | How often idle limiter entries are removed. |
| `RATE_LIMIT_READ_PER_MIN` | `120` |  |  | Per-user budget (and burst) for authenticated `GET` requests. Values of 0 or less fall back to the default. |

### Email (SMTP)

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `SMTP_ENABLED` | `false` |  |  | Send system email (invitations, verification, password reset, set-password links). See [Email (SMTP)](email.md). |
| `SMTP_HOST` | empty |  |  | SMTP server. |
| `SMTP_PORT` | `587` |  |  | SMTP port. |
| `SMTP_USER` | empty |  |  | SMTP user name. |
| `SMTP_PASSWORD` | empty |  | yes | SMTP password. |
| `SMTP_FROM` | empty |  |  | Sender address. Email is sent only when `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT` and `SMTP_FROM` are all set. |
| `SMTP_FROM_NAME` | `OpenCTEM` |  |  | Sender display name. |
| `SMTP_TLS` | `true` |  |  | Use TLS. |
| `SMTP_SKIP_VERIFY` | `false` |  |  | Skip verification of the SMTP server's certificate. |
| `SMTP_BASE_URL` | `http://localhost:3000` | production |  | Public origin used for links in email. The Compose stack sets it to `OPENCTEM_PUBLIC_URL`. |
| `SMTP_TIMEOUT` | `30s` |  |  | Timeout of an SMTP delivery. |

### Attachment storage

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `STORAGE_PROVIDER` | `local` |  |  | `local`, `s3` or `minio`. Any other value stops start-up. |
| `STORAGE_LOCAL_PATH` | `./data/attachments` |  |  | Directory for `local` storage, relative to the working directory (`/app` in the API image, so `/app/data/attachments`). Put it on a persistent volume and back it up. |
| `STORAGE_BUCKET` | empty |  |  | Bucket for `s3` / `minio`. Required with those providers. |
| `STORAGE_REGION` | empty |  |  | Bucket region. |
| `STORAGE_ENDPOINT` | empty (AWS S3) |  |  | Endpoint of an S3-compatible store, for example MinIO. |
| `STORAGE_ACCESS_KEY` | empty |  | yes | Access key. Required with `s3` / `minio`. |
| `STORAGE_SECRET_KEY` | empty |  | yes | Secret key. Required with `s3` / `minio`. |

### Sensors

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `SENSOR_PUBLIC_API_URL` | empty (`APP_URL`) |  |  | URL sensors connect to, embedded in the install snippets and configuration templates. |
| `SENSOR_CONFIG_TEMPLATES_DIR` | `configs/sensor-templates` |  |  | Directory of the sensor configuration templates shown in the console. |
| `SENSOR_IMAGE` | `ghcr.io/openctemio/sensor` |  |  | Sensor image the install snippets run. The tag is `SENSOR_LATEST_VERSION`, never `latest`. |
| `SENSOR_CA_CERT_FILE` | empty |  |  | Private CA certificate (PEM) the install snippets install on the sensor host. Set it with the gateway in TLS mode `internal` (the Compose stack points it at the exported root CA). |
| `SENSOR_LATEST_VERSION` | the sensor release in `versions.yaml` when the API was built |  |  | Newest sensor release: older sensors show "update available" and the install snippets pin this tag. `none` or `off` turns the comparison off. |
| `SENSOR_MIN_VERSION` | the minimum in `versions.yaml` when the API was built (`v0.9.0`) |  |  | Oldest supported sensor release; a heartbeating sensor below it is shown as degraded. `none` or `off` turns the check off. |
| `SENSOR_SDK_LATEST_VERSION` | the SDK release in `versions.yaml` when the API was built |  |  | Newest SDK release; sensors built with an older SDK are shown as outdated. `none` or `off` turns it off. |
| `SENSOR_SDK_MIN_VERSION` | empty (no minimum) |  |  | Oldest supported SDK; sensors built with an older one are shown as degraded. |
| `SENSOR_KEY_TTL` | `2160h` (90 days) |  |  | Validity of a sensor API key renewed by the sensor itself. `0`: renewed keys never expire. Keys created or regenerated by an administrator never expire. |
| `SENSOR_KEY_RENEW_GRACE` | `15m` |  |  | How long the key a sensor renewed with keeps working after the renewal. `0` retires it at once. |
| `SENSOR_KEY_RENEW_BEFORE` | half of `SENSOR_KEY_TTL` (24h without a TTL) |  |  | How long before expiry the heartbeat asks the sensor to rotate its key. |
| `SENSOR_KEY_PEPPER` | empty (derived from `APP_ENCRYPTION_KEY`) |  | yes | Secret the sensor API-key hashes are keyed with. At least 32 characters when set. |
| `SENSOR_KEY_PEPPER_PREVIOUS` | empty |  | yes | Comma-separated earlier peppers, kept while keys move to a new `SENSOR_KEY_PEPPER`. |
| `SENSOR_SLIM_HEARTBEAT` | `true` |  |  | Let sensors with an acknowledged manifest leave their tool inventory out of heartbeats. `false` asks every sensor for full heartbeats. |
| `SENSOR_HEARTBEAT_INTERVAL` | `30s` |  |  | Heartbeat interval advised to an idle sensor. |
| `SENSOR_HEARTBEAT_BUSY_INTERVAL` | `5s` |  |  | Interval advised while work is waiting for the sensor. |
| `SENSOR_HEARTBEAT_LOADED_INTERVAL` | `2m` |  |  | Interval advised while the platform is under load. |
| `SENSOR_HEARTBEAT_MIN_INTERVAL` | `5s` |  |  | Lower clamp of every advised interval. |
| `SENSOR_HEARTBEAT_MAX_INTERVAL` | `5m` |  |  | Upper clamp of every advised interval (also capped at half of `WORKER_HEARTBEAT_TIMEOUT`). |
| `SENSOR_HEARTBEAT_SLOW_QUERY` | `250ms` |  |  | Heartbeat query latency that counts as "platform under load". |
| `SENSOR_COMMAND_LEASE` | `3m` (clamped to 1m to 30m) |  |  | How long a sensor holds a claimed task without renewing it; an expired lease puts the task back in the queue. |
| `SENSOR_HEALTH_SLOW_HEARTBEAT` | `2s` |  |  | Heartbeat handling p95 that counts as slow. While the platform is slow, no sensor is marked offline. |
| `SENSOR_HEALTH_STARTUP_GRACE` | `0` (4 minutes) |  |  | Time after API start during which no sensor is marked offline. |
| `SENSOR_LB_JOB_WEIGHT` | `0.30` |  |  | Weight of the job load in the sensor load score used to place work (weights should sum to 1.0). |
| `SENSOR_LB_CPU_WEIGHT` | `0.40` |  |  | Weight of CPU usage. |
| `SENSOR_LB_MEMORY_WEIGHT` | `0.15` |  |  | Weight of memory usage. |
| `SENSOR_LB_DISK_IO_WEIGHT` | `0.10` |  |  | Weight of disk I/O. |
| `SENSOR_LB_NETWORK_WEIGHT` | `0.05` |  |  | Weight of network I/O. |
| `SENSOR_LB_MAX_DISK_THROUGHPUT_MBPS` | `500` |  |  | Disk throughput (MB/s) that counts as 100% disk load. |
| `SENSOR_LB_MAX_NETWORK_THROUGHPUT_MBPS` | `1000` |  |  | Network throughput (MB/s) that counts as 100% network load. |
| `WORKER_HEARTBEAT_TIMEOUT` | `5m` |  |  | No heartbeat for this long marks a sensor inactive. Advised heartbeat intervals stay below half of it. |
| `WORKER_HEALTH_CHECK_ENABLED` | `false` |  |  | Legacy sensor health checker. Keep it off: the sensor health controller owns liveness and the legacy checker marks every sensor offline right after an API restart. |
| `WORKER_HEALTH_CHECK_INTERVAL` | `1m` |  |  | Interval of the legacy checker. |

### Ingest

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `INGEST_MODE` | `sync` |  |  | `sync`: scan results are processed in the request. `async`: results are stored, answered with `202` and processed by the ingest worker. |
| `INGEST_MAX_PENDING_PER_TENANT` | `100` |  |  | Queue depth per organization in `async` mode; further submissions get `429` with `Retry-After`. `0` turns the check off. |
| `SENSOR_PROTOCOL_V2_RESULTS` | `true` |  |  | Serve sensor protocol v2 results at `/api/v2/sensor`. Sensors need it; keep it on. |
| `SENSOR_V2_BLINDING_RATIO` | `0.5` |  |  | Blinding guard: an auto-resolve that would close more than this fraction of a tool's open findings on the report's assets is held for review. |
| `SENSOR_V2_BLINDING_MIN_FINDINGS` | `100` |  |  | The guard applies only when more than this many findings would close. |
| `INGEST_COVERAGE_AUTO_RESOLVE` | `dry_run` |  |  | Coverage-scoped auto-resolve of non-repository findings: `off`, `dry_run` (log, metric and audit entry only) or `enforce`. |
| `INGEST_SOURCE_RESOLVE` | `dry_run` |  |  | Resolve a finding when a connector source reports it mitigated: `off`, `dry_run` or `enforce`. |
| `INGEST_VEX` | `dry_run` |  |  | How a VEX `not_affected` statement acts on the matching open finding: `off`, `dry_run` or `enforce` (the finding becomes a false positive with the justification). |

### Discovery feeds and background jobs

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `CERT_MONITOR_ENABLED` | `true` |  |  | Certificate Transparency discovery sweep (passive, public data). `false` stops all outbound CT-log queries. |
| `CERT_MONITOR_FEED_URL` | `https://crt.sh` |  |  | CT-log search service queried per organization domain. |
| `CERT_MONITOR_CERTSPOTTER_URL` | `https://api.certspotter.com` |  |  | Fallback CT search service when the primary fails. `off` disables the fallback. |
| `CERT_MONITOR_INTERVAL` | `24h` |  |  | How often the CT sweep runs. |
| `CERT_MONITOR_MAX_DOMAINS_PER_RUN` | `50` |  |  | Domains of one organization queried per sweep; the rest rotate in on later runs. |
| `EASM_DNS_CHECKS_ENABLED` | `true` |  |  | Daily DNS-only checks of each organization's own names (dangling CNAME/NS, email posture). `false` turns them off platform-wide. |
| `EASM_DNS_RESOLVER` | empty (first nameserver in `/etc/resolv.conf`) |  |  | Recursive resolver (`host[:port]`) the DNS checks use. |
| `EASM_DNS_QPS` | `20` |  |  | DNS queries per second across all organizations. |
| `EASM_DNS_CHECK_INTERVAL` | `24h` |  |  | How often the DNS checks run. |
| `EASM_DNS_MAX_NAMES_PER_RUN` | `500` |  |  | Names checked per organization per run. |
| `CTEM_ID_FEED_URL` | `https://ctem.org/source.json` |  |  | CTEM-ID catalog feed mirrored daily. |
| `SCM_SYNC_INTERVAL` | `0` (off) |  |  | Interval of the scheduled repository and branch sync of SCM integrations (for example `6h`). Off: repositories are imported on demand only. |

### Integrations

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `JIRA_WEBHOOK_SECRET` | empty |  | yes | Platform-wide fallback HMAC secret for inbound Jira webhooks. Organizations normally have their own secret. In production the API refuses to start when a connected Jira integration has neither. |
| `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS` | empty |  |  | Comma-separated private ranges that outbound calls of the API (webhook and notification channels, self-hosted Jira or GitLab, an SMTP relay) may reach, for example `10.20.0.0/16`. Each entry must be a CIDR inside `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` or `fc00::/7`, otherwise the API refuses to start. The list applies to every organization, so name only the subnets of your own services. Loopback, link-local, CGNAT and cloud metadata addresses stay blocked whatever the list says. |
| `OPENCTEM_HTTPSEC_ALLOW_PRIVATE` | unset |  |  | `1` opens every private range. Honored only with `APP_ENV=development`: with any other `APP_ENV` (or none) the API refuses to start, because it would open the platform's own network to every organization. Use `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS` instead. Any value other than empty, `0` or `1` is refused. |

### Metrics

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `METRICS_TOKEN` | empty |  | yes | Bearer token required on `GET /metrics` (`Authorization: Bearer <token>` or `X-Metrics-Token`). Empty and `METRICS_PUBLIC=false`: `/metrics` answers 404. |
| `METRICS_PUBLIC` | `false` |  |  | `true` serves `/metrics` without a token. Use it only when the port is reachable from a private scrape network alone. |

### Audit log retention

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `AUDIT_RETENTION_DAYS` | `365` (minimum 365) |  |  | Organization audit entries older than this are archived and deleted, keeping the hash chain verifiable. |
| `AUDIT_ARCHIVE_DIR` | empty (retention off) |  |  | Directory for the gzip JSONL archives. Empty: nothing is deleted. Back it up like the database. |
| `ADMIN_AUDIT_RETENTION_ENABLED` | `true` |  |  | Run the platform admin audit-log retention controller. |
| `ADMIN_AUDIT_RETENTION_DRY_RUN` | `true` |  |  | Report what would be deleted instead of deleting. Set `false` to enforce retention (irreversible). |
| `ADMIN_AUDIT_RETENTION_DAYS` | `365` |  |  | Age threshold. At least 30 when deletion is enabled. |
| `ADMIN_AUDIT_RETENTION_INTERVAL` | `24h` |  |  | How often the controller runs. |
| `ADMIN_AUDIT_RETENTION_BATCH_SIZE` | `10000` |  |  | Rows per delete transaction. |

### AI triage

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | empty |  | yes | Platform key for the `claude` provider. AI triage is available when at least one provider key is set and the AI triage module is enabled for the organization. |
| `OPENAI_API_KEY` | empty |  | yes | Platform key for the `openai` provider. |
| `GEMINI_API_KEY` | empty |  | yes | Platform key for the `gemini` provider. |
| `AI_PLATFORM_PROVIDER` | `claude` |  |  | Provider used for organizations in platform mode: `claude`, `openai` or `gemini`. |
| `AI_PLATFORM_MODEL` | `claude-sonnet-4-20250514` |  |  | Model name passed to the provider. |
| `AI_MAX_CONCURRENT_JOBS` | `10` |  |  | Concurrent triage jobs. |
| `AI_RATE_LIMIT_RPM` | `60` |  |  | Completions per minute per API key. `0` or less turns the cap off. |
| `AI_TIMEOUT_SECONDS` | `30` |  |  | Timeout of one provider call. |
| `AI_MAX_TOKENS` | `4096` |  |  | Maximum tokens per request. |
| `AI_TEMPERATURE` | `0.1` |  |  | Sampling temperature (0.0 to 1.0). |
| `AI_AUTO_TRIAGE_DEFAULT_ENABLED` | `false` |  |  | Platform default for automatic triage of new findings; an organization's own setting wins. |
| `AI_AUTO_TRIAGE_DEFAULT_SEVERITIES` | `critical,high` |  |  | Platform default severities for automatic triage. |
| `AI_AUTO_TRIAGE_DELAY` | `60s` |  |  | Delay before an automatic triage job runs. |
| `AI_TRIAGE_RECOVERY_ENABLED` | `true` |  |  | Requeue triage jobs stuck in processing. |
| `AI_TRIAGE_RECOVERY_INTERVAL` | `5m` |  |  | How often stuck jobs are looked for. |
| `AI_TRIAGE_RECOVERY_STUCK_DURATION` | `15m` |  |  | Age after which a processing job counts as stuck. |
| `AI_TRIAGE_RECOVERY_BATCH_SIZE` | `50` |  |  | Jobs recovered per run. |
| `AI_TRIAGE_BUDGET_ENABLED` | `false` |  |  | Enforce the per-organization monthly token budget. |
| `AI_TRIAGE_BUDGET_STRICT` | `false` |  |  | With the budget on: refuse triage when the budget store cannot be read (otherwise log and continue). |
| `AI_TRIAGE_BUDGET_DEFAULT_TOKENS` | `0` (unlimited) |  |  | Monthly token budget of an organization without its own. |
| `AI_TRIAGE_ENABLED` | `false` |  |  | Deprecated and ignored: availability follows the provider keys and the AI triage module. |

### CTEM cycles

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `CTEM_ENFORCE_COVERAGE_SLO` | unset |  |  | `true` refuses to close a CTEM cycle whose validation coverage misses its targets. Unset: the miss is only logged. |

### Retired names

The API refuses to start while one of these pre-sensor names is set, and names
its replacement: `AGENT_CONFIG_TEMPLATES_DIR`, `AGENT_PUBLIC_API_URL`,
`AGENT_KEY_TTL`, `AGENT_LB_JOB_WEIGHT`, `AGENT_LB_CPU_WEIGHT`,
`AGENT_LB_MEMORY_WEIGHT`, `AGENT_LB_DISK_IO_WEIGHT`, `AGENT_LB_NETWORK_WEIGHT`,
`AGENT_LB_MAX_DISK_THROUGHPUT_MBPS`, `AGENT_LB_MAX_NETWORK_THROUGHPUT_MBPS`.
Rename each `AGENT_` prefix to `SENSOR_`.

### Administration tools

The command-line tools shipped next to the server read a few variables of their
own:

| Tool | Variables |
|---|---|
| `bootstrap-admin` (creates the first platform administrators and organization, see [First administrator](../install/first-admin.md)) | `DATABASE_URL` (or `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`), `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_BACKUP_EMAIL`, `ADMIN_BACKUP_NAME`, `ORG_NAME`, `ORG_SLUG`, `ORG_OWNER_EMAIL`, `ORG_OWNER_NAME`, the `SMTP_*` variables, `SMTP_BASE_URL` or `APP_URL`, `APP_NAME` |
| `rekey` (re-encrypts stored secrets during an `APP_ENCRYPTION_KEY` rotation) | `REKEY_OLD_KEY`, `REKEY_OLD_KEY_FORMAT`, `REKEY_NEW_KEY`, `REKEY_NEW_KEY_FORMAT`, `APP_ENCRYPTION_KEY`, `SENSOR_KEY_PEPPER`, `DATABASE_URL` or `DB_*` |

The rotation procedure is in
[encryption-key-rotation.md](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/encryption-key-rotation.md).

---

## Web console

The web console (`ghcr.io/openctemio/openctem-web`) is a Next.js server. It
reads these variables at run time:

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `BACKEND_API_URL` | `http://localhost:8080` | yes | | Internal URL of the API. The console proxies the browser's `/api/v1` calls and the WebSocket upgrade to it. Compose: `http://api:8080`. |
| `CSRF_SECRET` | empty | yes | yes | Required by the Compose file and the Helm chart; the console warns at start when it is missing or shorter than 32 characters. Generate it once: `openssl rand -hex 32`. |
| `SECURE_COOKIES` | `true` | | | `Secure` flag on the cookies the console sets. Only `false` turns it off (local `http://` development). |
| `TRUST_PROXY_HEADERS` | `false` | | | Forward `X-Real-IP` / `X-Forwarded-For` to the API. Set `true` only when a proxy in front of the console overwrites those headers (the gateway does), otherwise a browser could choose its own address. |
| `COOKIE_MAX_AGE` | `604800` | | | Lifetime in seconds of the session cookies the console sets. |
| `NODE_ENV` | `production` in the image | | | Node.js environment. |
| `PORT` / `HOSTNAME` | `3000` / `0.0.0.0` in the image | | | Listen port and address of the console. |

`NEXT_PUBLIC_*` variables (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WS_BASE_URL`,
`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_TERMS_URL`, `NEXT_PUBLIC_PRIVACY_URL`, the
cookie-name variables and others) are compiled into the browser code when the
image is built. Setting them on a published image has no effect on the browser;
build the web image yourself to change them. The defaults suit the single-origin
gateway setup: the browser opens the WebSocket on its own origin, and the console
proxies it to `BACKEND_API_URL`.

---

## Gateway

The gateway container (Caddy, files in
[`api/deploy/gateway/`](https://github.com/openctemio/openctem/tree/develop/api/deploy/gateway))
reads these variables. The same files run inside the all-in-one image. See
[TLS and the gateway](../install/tls-and-gateway.md).

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `OPENCTEM_TLS_MODE` | none in the entrypoint (`internal` in Compose and the all-in-one image) | yes | | `internal`, `acme`, `files` or `http`. |
| `OPENCTEM_HOSTNAME` | none | yes (except `http`) | | DNS name or IP address clients use. The certificate is issued for it. |
| `ACME_EMAIL` | empty | with `acme` | | Let's Encrypt account contact. |
| `ACME_CA` | Let's Encrypt production directory | | | ACME directory URL, for example a staging or private ACME CA. |
| `TLS_CERT_FILE` / `TLS_KEY_FILE` | `tls.crt` / `tls.key` | with `files` | | File names of the certificate (full chain, PEM) and key inside `OPENCTEM_CERT_DIR`. |
| `OPENCTEM_CERT_DIR` | `/certs` | | | Directory holding the certificate in mode `files`. |
| `OPENCTEM_ALLOW_PLAIN_HTTP` | `false` | with `http` | | Must be `true` for mode `http`, which serves plain HTTP behind your own TLS proxy. |
| `OPENCTEM_TRUSTED_PROXIES` | `127.0.0.1/32` | | | Space-separated CIDRs of proxies in front of the gateway whose `X-Forwarded-For` it believes. |
| `GATEWAY_MAX_BODY_SIZE` | `256MB` | | | Largest request body the gateway accepts. The API enforces the per-route limits. |
| `AUTH_COOKIE_NAME` | `auth_token` | | | Session cookie name used by the routing rule that sends token clients to the API. |
| `OPENCTEM_CA_EXPORT_DIR` | `/ca` (`/data/ca` in the all-in-one image) | | | Where the internal CA's root certificate is copied, as `openctem-root-ca.crt`. Skipped when the directory does not exist. |
| `OPENCTEM_GATEWAY_DIR` | `/etc/caddy` | | | Directory with `Caddyfile`, `planes.caddy` and `modes/`. |
| `XDG_DATA_HOME` | `/data` | | | Caddy storage: certificates, ACME account, internal CA. Keep it on a volume. |
| `OPENCTEM_API_UPSTREAM` / `OPENCTEM_WEB_UPSTREAM` | `api:8080` / `web:3000` | | | Addresses of the API and the web console. |

---

## Docker Compose stack

`api/deploy/docker-compose.yml` reads these from `.env` (in addition to the API
variables it passes through, listed in [Docker Compose](../install/docker-compose.md)):

| Variable | Default | Required | Secret | Description |
|---|---|---|---|---|
| `OPENCTEM_VERSION` | none | yes | | Release tag of the API, web and migrations images, for example `v0.9.0`. |
| `OPENCTEM_PUBLIC_URL` | none | yes | | Exact origin browsers use, with the port when it is not 443. Sets the API's `CORS_ALLOWED_ORIGINS`, `APP_URL`, `SMTP_BASE_URL` and `OAUTH_FRONTEND_CALLBACK_URL` (`<OPENCTEM_PUBLIC_URL>/auth/callback`). |
| `OPENCTEM_HOSTNAME` | none | yes | | See [Gateway](#gateway). |
| `API_IMAGE` / `UI_IMAGE` / `MIGRATIONS_IMAGE` | `ghcr.io/openctemio/api` / `ghcr.io/openctemio/ui` / `ghcr.io/openctemio/migrations` | | | Image repositories. Set `API_IMAGE=ghcr.io/openctemio/openctem-api` and `UI_IMAGE=ghcr.io/openctemio/openctem-web` for v0.9.0 and later. |
| `API_VERSION` / `UI_VERSION` | `OPENCTEM_VERSION` | | | Per-image tag override. Leave unset. |
| `GATEWAY_BIND` | `0.0.0.0` | | | Host interface the gateway port is published on. |
| `GATEWAY_HTTPS_PORT` | `443` | | | Published HTTPS port. |
| `GATEWAY_HTTP_PORT` | `80` (redirect overlay), `8081` (plain-HTTP overlay) | | | Port published by the overlays. |
| `TLS_CERT_DIR` | `./certs` | | | Host directory mounted at `/certs` (mode `files`). |
| `OPENCTEM_CA_EXPORT_DIR` | `./ca` | | | Host directory the internal root CA is exported to. |
| `OPENCTEM_NET_PREFIX` | `172.30.80` | | | First three octets of the internal `/24`. The gateway is `.10`, the web console `.11`. |
| `CADDY_VERSION` / `POSTGRES_VERSION` / `REDIS_VERSION` | `2.11.4-alpine` / `17` / `7-alpine` | | | Image tags of the bundled gateway, PostgreSQL and Redis. |
| `DB_SUPERUSER` / `DB_SUPERUSER_PASSWORD` | `DB_USER` / `DB_PASSWORD` | | yes | PostgreSQL superuser, used only by `initdb` and the `db-roles` job. |
| `DB_MIGRATE_USER` / `DB_MIGRATE_PASSWORD` | unset | | yes | Schema-owner role the migrations run as. Set to turn on the least-privilege layout. |
| `CSRF_SECRET` | none | yes | yes | See [Web console](#web-console). |
| `API_MEMORY_LIMIT` / `WEB_MEMORY_LIMIT` / `GATEWAY_MEMORY_LIMIT` | `2g` / `1g` / `512m` | | | Memory limits of the `api`, `web` and `gateway` containers. |

---

## All-in-one image

`ghcr.io/openctemio/openctem` reads every API, web console and gateway variable
above, plus:

| Variable | Default | Description |
|---|---|---|
| `GATEWAY` | `on` | `on`: only the gateway listens on a routable address (port 443); the API and console bind to `127.0.0.1`. `off`: the API listens on 8080 and the console on 3000, without the gateway. |
| `MIGRATE_ON_START` | `true` | Apply database migrations before starting, under a PostgreSQL advisory lock so several replicas do not migrate at once. |
| `DATABASE_URL` | built from `DB_*` | Connection URL the start-up migrations use when `DATABASE_MIGRATE_URL` and `DB_MIGRATE_USER` are unset. |
| `DATABASE_MIGRATE_URL` | built from `DB_MIGRATE_USER` / `DB_MIGRATE_PASSWORD` | Connection URL of the schema owner for the start-up migrations. |
| `WEB_HOSTNAME` | `127.0.0.1` (`GATEWAY=on`), `0.0.0.0` (`GATEWAY=off`) | Listen address of the web console. |

With `GATEWAY=on` the image also defaults `SERVER_HOST=127.0.0.1`,
`SERVER_TRUSTED_PROXIES=127.0.0.1/32`, `TRUST_PROXY_HEADERS=true`,
`SECURE_COOKIES=true` and `AUTH_COOKIE_SECURE=true`. Other image defaults:
`STORAGE_LOCAL_PATH=/data/attachments`, `BACKEND_API_URL=http://127.0.0.1:8080`,
`OPENCTEM_TLS_MODE=internal`.
