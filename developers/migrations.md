---
title: Database migrations
parent: Developers
nav_order: 5
---

# Database migrations

The schema is managed with [golang-migrate](https://github.com/golang-migrate/migrate). This page
is for people writing migrations. How operators apply them during an upgrade is in
[Upgrading](../operations/upgrade.md).

## Layout

```
api/migrations/
├── 001146_baseline.up.sql      the whole schema up to 001146, plus built-in rows
├── 001146_baseline.down.sql    refuses: the baseline is never reverted
├── 001147_<name>.up.sql        every later change: one numbered pair
├── 001147_<name>.down.sql
├── ...
└── seed/                       optional data (seed_required.sql, seed_test.sql)
```

- Versions are six-digit, sequential numbers. A new migration takes the next number above the
  highest one on `develop` **and** in open pull requests. CI fails when two migrations share a
  version, or when a migration you add is not above the base branch's highest version (golang-migrate
  silently skips a lower version on a database already past it). In the merge queue, a pull request
  whose number was taken by another must renumber to the next free one.
- Every migration has a working `.down.sql`.
- `make -C api migrate-create name=add_widget_table` creates the pair (check the number it picks).

## The baseline

The early chain of migrations was squashed into one baseline file (RFC-053), generated with
`pg_dump` from a database that ran the whole chain. It carries the tables, indexes, constraints,
functions, triggers, comments, the row-level-security policies (defined but not enabled) and the
built-in rows (permission catalogue, system roles, modules, tools), without owners or grants.

- **Never edit the baseline.** Change the schema with a new migration above it.
- A **fresh database** applies the baseline, then each later migration. The baseline refuses to run
  on a database that already has the schema.
- A database **at or past the baseline version** never runs it.
- A database **older than the baseline** cannot be upgraded by a release that ships the baseline:
  golang-migrate refuses it without changing anything, and the migrations image explains what to
  do: back up, deploy the last release before the baseline (git tag `pre-baseline-001146`, which
  still has every old migration), run its migrations, then upgrade.
- The old migration files remain readable at that tag:
  `git show pre-baseline-001146:api/migrations/<file>`.

When the chain grows long again, it is squashed at a release boundary with
`api/scripts/squash-migrations.sh`, which proves the result (schema byte-identical to the chain,
as superuser and as the least-privilege migrator, and identical data once run-time values are
masked) and fails on any difference.

## Writing a migration: expand, then contract

Deployments are rolling: for a while, the previous release's API runs against the new schema. A
destructive change in that window breaks the running pods, and makes rollback unsafe. So every
breaking change is split:

| Step | Release | Example |
|---|---|---|
| Expand | N | add the new shape: a nullable column, a new table, a new index; backfill |
| Switch | N | ship code that reads the new shape and stops depending on the old one |
| Contract | a later release | remove the old shape once nothing running references it |

Renaming `findings.owner` to `findings.owner_email`, safely:

```sql
-- Expand: 001200_add_owner_email.up.sql
ALTER TABLE findings ADD COLUMN owner_email TEXT;
UPDATE findings SET owner_email = owner WHERE owner_email IS NULL;
```

```sql
-- Contract, once no running code reads `owner`: 001230_drop_owner.up.sql
-- expand-contract-ok: contract step; owner unused since the release that added owner_email
ALTER TABLE findings DROP COLUMN owner;
```

Rules of thumb:

- Add columns nullable, or `NOT NULL DEFAULT ...`. Never `ADD COLUMN ... NOT NULL` without a
  default.
- Never rename in place, and never `ALTER COLUMN ... TYPE` on a column in use: add, backfill,
  switch, drop.
- Widening a `CHECK` constraint (new enum values) is safe.
- Create indexes on large tables with `CREATE INDEX CONCURRENTLY`, one per migration file, and put
  the `EXPLAIN` that justifies the index in the pull request.
- Every foreign key to `tenants` or `users` has a deliberate `ON DELETE`: `CASCADE` for rows the
  organization or user owns, `SET NULL` on a nullable column for "who did it" references and for
  audit and history rows. A test reads every such key from `pg_constraint` and fails on one that
  would block deleting an organization or a user.
- Every tenant table has a `tenant_id` and every query filters on it. Isolation is enforced in the
  queries; the row-level-security policies exist in shadow mode and are not enabled.
- Database functions get a `COMMENT ON FUNCTION` and a `verb_noun` name.
- Never change a migration that has been released; write a new one.

### The CI guard

`api/scripts/check-migrations.sh` (the **Migration Safety** step, on pull requests) fails on
`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE`, `RENAME`, `SET NOT NULL`,
`ADD COLUMN ... NOT NULL` without a default, and `TRUNCATE` in new or changed `.up.sql` files.
For a genuine contract step, add a marker line with a reason to the file:

```sql
-- expand-contract-ok: <reason>
```

or label the pull request `allow-destructive-migration`. Run it locally:

```bash
cd api
scripts/check-migrations.sh                              # against the base branch
scripts/check-migrations.sh migrations/001200_*.up.sql   # specific files
```

**SQL Schema Drift** (`api/scripts/check-sql-schema.sh`) also prepares every SQL statement in the
code against a database that only ran the migrations, so a query that names a missing column fails
in CI instead of in production. **Tests (least-privilege DB role)** applies the migrations as the
migrator role and runs the suite as the DML-only application role.

## Commands

From `api/` (they read `DB_*` from `.env`):

| Command | Does |
|---|---|
| `make migrate-up` / `make docker-migrate-up` | apply all pending migrations (local CLI / container) |
| `make migrate-down` / `make docker-migrate-down` | revert the last migration |
| `make migrate-status` / `make docker-migrate-version` | show the current version (and `dirty`) |
| `make docker-migrate-force version=N` | mark version N as applied, after fixing a failed migration by hand |
| `make docker-psql` | a `psql` shell in the development database |
| `make db-fresh` | drop the development schema, migrate, seed the required data |

Test a migration both ways before you open the pull request:

```bash
make docker-migrate-up && make docker-migrate-down && make docker-migrate-up
```

## How migrations run in each environment

- **Development container** (`make docker-dev`): applied on start.
- **Production**: the API does **not** migrate. On start it compares the database version with the
  migrations it ships and refuses to start when the schema is behind or `dirty`
  (`SKIP_SCHEMA_CHECK=true` turns this off; do not in production). Migrations are applied first
  with the same-version image `ghcr.io/openctemio/migrations:<version>`, as the schema-owner role
  (`DB_MIGRATE_USER`); the API runs as a DML-only role. Compose and the Helm chart do this ordering
  for you. See [Upgrading](../operations/upgrade.md).

### A failed migration

golang-migrate runs each migration in a transaction. If one fails, its changes roll back but the
version is marked `dirty`, and both the migrator and the API refuse to continue. Inspect what
happened, fix the cause, then mark the last good version and run again:

```bash
make docker-migrate-version              # prints "<N> (dirty)"
make docker-migrate-force version=<N-1>  # the version before the failed one
make docker-migrate-up
```
