---
title: Local setup
parent: Developers
nav_order: 1
---

# Local setup

This page runs the API and the web console from a checkout of
[openctemio/openctem](https://github.com/openctemio/openctem), with PostgreSQL and Redis in
containers.

## Prerequisites

| Tool | Version | Used for |
|---|---|---|
| Go | 1.26 (the toolchain pinned in `api/go.mod`) | the API |
| Node.js | 26 (`web/.nvmrc`) | the web console |
| Docker with Compose | recent | PostgreSQL 17, Redis 7, optional containerized API |
| GNU Make, Git | any recent | the root `Makefile` |
| `golang-migrate` CLI | v4 | applying migrations outside a container (`make -C api install-tools`) |

## 1. Clone and install

```bash
git clone https://github.com/openctemio/openctem.git
cd openctem
make setup      # go mod download (api/), npm ci (web/), git hooks, then make generate
```

`make setup` also generates the contract files (OpenAPI spec, web API types) that are not
committed; see [Generated files](generated-files.md). If you only have Docker, run
`make generate-docker` instead of the generate step.

Run Go commands from `api/` with `GOWORK=off`, as CI does, so a `go.work` file in a parent
directory is not picked up.

## 2. Configure the API

```bash
cd api
cp .env.example .env
```

Edit `api/.env`:

- `APP_ENV=development` must stay: an unset `APP_ENV` means `production`, which refuses to start
  without TLS to PostgreSQL and Redis.
- `APP_ENCRYPTION_KEY` and `AUTH_JWT_SECRET` hold public development values that work as they
  are. The API refuses them whenever `APP_ENV` is not `development`; for anything else generate
  your own (`openssl rand -hex 32`, `openssl rand -hex 64`).
- `DB_*` and `REDIS_*` already match the development Compose file (`openctem` / `secret` on
  `localhost`).

## 3. Start PostgreSQL and Redis

```bash
docker compose -f docker-compose.yml up -d postgres redis
```

The base Compose file publishes PostgreSQL on `5432` and Redis on `6379` (change with
`DB_EXTERNAL_PORT` and `REDIS_EXTERNAL_PORT`). These ports are for development only.

## 4. Apply the migrations

```bash
make migrate-up          # needs the migrate CLI; or:
make docker-migrate-up   # runs migrate in a container
```

## 5. Run the API

From the repository root:

```bash
make dev-api             # go run ./cmd/server, on http://localhost:8080
```

or from `api/`, with hot reload:

```bash
make -C api install-tools   # once: air, golangci-lint, migrate, mockgen
make -C api dev             # air
```

Check it: `curl http://localhost:8080/health`.

### Alternative: the API in a container

```bash
cd api
make docker-dev          # postgres, redis and the API with air hot reload
```

The development container applies migrations on start, mounts the source and exposes the API on
`8080` and a Delve debugger on `2345`.

## 6. Run the web console

```bash
cd web
cp .env.example .env.local     # BACKEND_API_URL=http://localhost:8080
cd ..
make dev-web                   # next dev on http://localhost:3000
```

The console calls the API through its own server (`/api/v1/*` is proxied to `BACKEND_API_URL`), so
the browser only talks to `localhost:3000`.

## 7. Create the first users

The seed files create no users or organizations. Create them the way a real installation does,
with `bootstrap-admin`: a platform administrator, and the first organization with you as its
Owner.

```bash
cd api
SMTP_BASE_URL=http://localhost:3000 GOWORK=off go run ./cmd/bootstrap-admin \
  -db "postgres://openctem:secret@localhost:5432/openctem?sslmode=disable" \
  -email admin@example.com -no-backup \
  -org-name "Dev" -org-slug dev -org-owner-email you@example.com
```

Open the printed one-time `/set-password?token=...` link to choose the Owner's password, then sign
in at `http://localhost:3000/login`. The administrator signs in with the printed temporary
password at `/admin`.

## Seed data

`api/migrations/seed/` holds optional data:

| File | What | How |
|---|---|---|
| `seed_required.sql` | data the system needs (currently none; everything is created at run time) | `make -C api seed-required` or `make -C api docker-seed-required` |
| `seed_test.sql` | a placeholder for development data | never in production |

To start again from an empty database: `make -C api db-fresh` (drops the `public` schema, applies
the migrations and the required seed).

## Optional: a sensor

To run scans locally, start a sensor from [openctemio/sensor](https://github.com/openctemio/sensor)
and pair it with your organization: see [Sensors](../sensors/index.md). Point it at
`http://localhost:8080` (development only; real installations use HTTPS).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `APP_ENCRYPTION_KEY has invalid length` | replace the placeholder in `.env` (step 2) |
| "Generated contract files are missing", `api.types` not found | `make generate` (or `make generate-docker`) at the repository root |
| The API refuses to start: schema behind | apply the migrations (step 4) |
| `connection refused` to PostgreSQL | `docker compose -f api/docker-compose.yml ps`; check `DB_HOST`/`DB_PORT` |
| golangci-lint reports issues you did not touch | lint only new code: `make -C api lint-new` |
