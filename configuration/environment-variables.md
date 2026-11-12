---
title: Environment variables reference
parent: Configuration
nav_order: 1
---

# Environment variables reference
{: .no_toc }

Every environment variable the OpenCTEM API reads, plus the variables of the web
console, the gateway, the Compose stack and the all-in-one image, for release
{{ site.data.versions.platform }}. The tables below are copied, when this site is built,
from the reference the release generates from the registry in its code (`make env-docs`),
which a test keeps equal to what the code reads, so a variable that is not on this page
is not read by that release. Variables the release refuses (removed or renamed) are listed
at the end, with what to set instead.

Settings an administrator changes at run time (sign-up policy, plans, scan
approval, AI applications, ...) are not environment variables: they live in the
admin console and the organization settings.

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
- A value that does not parse as its type (for example `SERVER_PORT=abc`,
  `SENSOR_KEY_TTL=30d`, `RATE_LIMIT_ENABLED=yes`) stops start-up with a message
  that names the variable, never the value. So do invalid enumerations.
- A variable under one of the API's prefixes (`APP_`, `AUTH_`, `SMTP_`,
  `SENSOR_`, ...) that is not listed here but is close to a listed name stops
  start-up with a "did you mean" hint (for example `SMTP_PASWORD`). Other unlisted
  names under those prefixes are logged as warnings. Kubernetes service-link
  variables are ignored.

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
- `RATE_LIMIT_ENABLED=true`, `LOG_LEVEL` is not `debug`.
- Redis: `REDIS_PASSWORD` of at least 32 characters, `REDIS_TLS_ENABLED=true`,
  `REDIS_TLS_SKIP_VERIFY=false`, `REDIS_POOL_SIZE` 10 to 500, dial, read and write
  timeouts of at least `1s`, `REDIS_MAX_RETRIES` 1 to 10.
- With `AUTH_PROVIDER=local` or `hybrid`: `AUTH_JWT_SECRET` of at least 64
  characters (unset, it is derived from `APP_ENCRYPTION_KEY`), `AUTH_PASSWORD_MIN_LENGTH` of at least 8,
  `AUTH_REQUIRE_EMAIL_VERIFICATION=true`, `AUTH_COOKIE_SAMESITE` one of `strict`,
  `lax`, `none`.
- With `SIGNUP_MODE=open`: the Turnstile keys (`CAPTCHA_TURNSTILE_SECRET` and
  `CAPTCHA_TURNSTILE_SITE_KEY`), or `SIGNUP_CAPTCHA=off-i-understand`. With
  `SIGNUP_MODE=domain` or `open` the platform e-mail must be set up (Console > Settings >
  E-mail).
- With `AUTH_PROVIDER=oidc` or `hybrid`: `KEYCLOAK_BASE_URL` set to an `https://`
  URL other than the default, and `KEYCLOAK_REALM` set to a value other than the
  default.

In every environment other than `development` the API also refuses to start
without `APP_ENCRYPTION_KEY` and without `FINGERPRINT_KEY` (at least 32
characters; on an existing install set it to the current `APP_ENCRYPTION_KEY`
value so stored secret fingerprints stay valid), and refuses the development defaults published in
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
docker run --rm --env-file api.env ghcr.io/openctemio/openctem-api:{{ site.data.versions.platform }} -check-config
# Docker Compose, in {{ site.data.versions.backend_dir }}/deploy
docker compose run --rm --no-deps api -check-config
# All-in-one image
docker run --rm --env-file openctem.env --entrypoint /opt/openctem/api/server \
  ghcr.io/openctemio/openctem:{{ site.data.versions.platform }} -check-config
```

```text
configuration valid: APP_ENV=production AUTH_PROVIDER=local SIGNUP_MODE=disabled
set from the environment (21; every other variable has its default): APP_ENCRYPTION_KEY APP_ENV APP_URL ...
```

It lists the API variables that are set (names only) and any warnings.

With `APP_ENV=development` it adds a note that the production checks were
skipped.

{% include generated/env-reference.md %}
