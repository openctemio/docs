---
title: Testing
parent: Developers
nav_order: 4
---

# Testing

## Quick reference

From the repository root of `openctem`:

```bash
make test        # generate, then go test ./... (api) and vitest (web)
make lint        # api: go vet, staticcheck, golangci-lint on new code; web: eslint + tsc
make check       # the contract checks: OpenAPI spec vs routes, then tsc against the spec
```

## API (Go)

Tests live next to the code (`*_test.go`) and in `api/tests/`:

| Where | What |
|---|---|
| `internal/...`, `pkg/...` | unit tests beside the code, and `*_db_test.go` files that need a database |
| `api/tests/unit/` | cross-cutting unit tests, for example "every route has an authorization gate" |
| `api/tests/integration/` | multi-service scenarios against a real database |
| `api/tests/load/` | load tests for the platform queue (`make -C api test-load`) |
| `api/tools/lint/` | the route-style and OpenAPI contract linters, with their tests |

```bash
cd api
make test                        # go test -race -cover ./... ; DB-backed tests skip
GOWORK=off go test ./internal/app/...   # one area
make test-coverage               # writes coverage.html
```

Tests use the standard library `testing` package with table-driven cases. Mocks are generated with
`mockgen` (`go generate ./...` or `make -C api generate`).

### Database-backed tests

Many tests need PostgreSQL, because tenant isolation, data scope and SQL correctness can only be
proven against a real schema. They get their connection from `internal/testdb`, never from
`DATABASE_URL` directly, and refuse to run against a database that does not look like a test
database:

| `DATABASE_URL` | `OPENCTEM_TEST_DB_REQUIRED` | Result |
|---|---|---|
| unset | unset | DB-backed tests skip (`make test`) |
| unset | `1` | panic: the DB tests were requested but have no database |
| a database whose name ends in `_test` or `_compat` | any | DB-backed tests run; with `1` they fail instead of skipping |
| any other database (for example your development `openctem`) | any | panic: the tests never touch it |

`OPENCTEM_TEST_DB_ALLOW=<name>` accepts one exactly named database that does not follow the rule.

Run them against a throwaway database:

```bash
docker run -d --name pg-test -p 127.0.0.1:55432:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=app_test postgres:17-alpine
cd api
migrate -path migrations -database "postgres://postgres@localhost:55432/app_test?sslmode=disable" up
make test-db TEST_DATABASE_URL="postgres://postgres@localhost:55432/app_test?sslmode=disable"
```

`make test-db` sets `OPENCTEM_TEST_DB_REQUIRED=1`, so nothing skips silently. Remove the container
when you are done (`docker rm -f pg-test`).

Write new DB-backed tests the same way:

```go
dsn := testdb.URL()
if dsn == "" {
    t.Skip("DATABASE_URL not set; skipping DB-backed test")
}
db, err := sql.Open("postgres", dsn)
if err != nil {
    t.Fatal(err)
}
if err := db.Ping(); err != nil {
    testdb.Skipf(t, "cannot reach DATABASE_URL: %v", err)
}
```

Tests that reason about a whole table use `testdb.PrivateDatabase`; tests that run DDL use
`testdb.LockForDDL`.

### What every change should test

- **Authorization**: the route refuses a caller without the permission, and a key or session of
  another organization gets `404`, not the object.
- **Data scope**: a restricted member sees only their assets and findings.
- **Hostile input**: oversize bodies, malformed files, injection in filter values.

## Web (TypeScript)

```bash
cd web
npm test              # vitest (unit and component tests)
npm run test:coverage
npm run type-check    # tsc against the generated API types
npm run lint
npm run e2e           # Playwright end-to-end tests (npm run e2e:install once)
```

`npm test`, `npm run dev`, `type-check` and `lint` regenerate the API types first when the spec is
newer, and stop with a hint when the generated files are missing.

## Tools and SDK

Tool authors test with the conformance kit (`openctem tool test`); see
[Writing a tool](tool-authoring.md). The SDK has `pkg/testkit` to run a Go tool
in-process with the runtime's rules and compare its output with golden CTIS.

## What CI runs

On every pull request that touches the API:

- **API static checks**: migration safety, migration version order, SQL schema drift (every SQL
  statement is prepared against a migrated database), security gates, the OpenAPI contract,
  gateway routing, lint on new code.
- **Tests (Postgres + Redis)**: the whole Go suite with `-race` against PostgreSQL 17 and Redis 7,
  with `OPENCTEM_TEST_DB_REQUIRED=1`; the job fails if any test skipped for want of a database.
- **Tests (least-privilege DB role)**: migrations applied as the migrator role, then the
  DB-backed suite run as the DML-only application role, so a migration that needs a superuser or
  code that needs more than DML fails.

For web changes, **Web checks** (type check against the generated contract, ESLint, Prettier,
Vitest). In the merge queue, release binaries are built and the all-in-one image is built and
started against PostgreSQL and Redis. A nightly job fuzzes the sensor results decoder.
