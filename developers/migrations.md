---
title: Database migrations
parent: Developers
nav_order: 5
---

# Database migrations

The schema is applied by `openctem-migrate` (`api/cmd/openctem-migrate`), which records every
applied migration in `schema_migrations_applied` and applies every shipped migration a database
lacks, lowest version first. It replaced golang-migrate in v0.16.0. This page is for people
writing migrations. How operators apply them during an upgrade is in
[Upgrading](../operations/upgrade.md).

## Layout

```
api/migrations/
├── 001146_baseline.up.sql      the whole schema up to 001146, plus built-in rows
├── 001146_baseline.down.sql    refuses: the baseline is never reverted
├── 001147_<name>.up.sql        legacy six-digit versions (no new ones)
├── 001147_<name>.down.sql
├── ...
├── 20261030064455_<name>.up.sql   every new change: a UTC timestamp version
├── 20261030064455_<name>.down.sql
├── released.json               the migrations of each release (used by the first run after golang-migrate)
└── seed/                       optional data (seed_required.sql, seed_test.sql, seed_components_demo.sql)
```

- **Versions only have to be unique.** A migration merged after a higher-numbered one is applied
  on the next run, not skipped: after the others on a running install, before them on a fresh one.
  CI proves both orders give the same schema; when they do not, the later migration depends on the
  others and needs a version above them.
- **Nobody picks a version by hand.** `make -C api migration-new name=add_widget_table` creates
  `migrations/<UTC now>_add_widget_table.{up,down}.sql`. `make -C api migration-renumber` gives
  this branch's added migrations new timestamp versions when a version clashes with `develop` or
  an open pull request. Never write a version number into a test: find a migration by name with
  `testdb.MigrationVersion(t, dir, name)`.
- **A merged migration never changes.** Databases that applied it never run it again, so an edit,
  a removal or a rename would only reach fresh installs. The **Migration Versions** check refuses
  a changed, removed or renamed merged `.up.sql` file. Fix a merged migration with a new one.
- Every migration has a working `.down.sql`.

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
  the runner refuses it without changing anything, and the migrations image explains what to
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
| `make migration-new name=x` | create a migration pair with a UTC timestamp version |
| `make migration-renumber` | give this branch's clashing migrations new versions (staged) |
| `make migrate-up` | apply every migration the local database has not applied |
| `make migrate-down` | roll back the most recently applied migration |
| `make migrate-status` | show the applied version and the pending migrations |
| `make migrate-force version=V` | clear the dirty flag and record V as applied (`-1`: only clear the flag) |
| `make docker-psql` | a `psql` shell in the development database |
| `make db-fresh` | drop the development schema, migrate, seed the required data |

`make migrate-up` runs this tree's runner with `go run`; nothing to install. Test a migration both
ways before you open the pull request:

```bash
make migrate-up && make migrate-down && make migrate-up
```

## How migrations run in each environment

- **Development container** (`make docker-dev`): applied on start.
- **Production**: the API does **not** migrate. On start it checks that every migration it ships
  is applied and refuses to start when one is missing or the database is `dirty`
  (`SKIP_SCHEMA_CHECK=true` turns this off; do not in production). Migrations are applied first
  with the same-version image `ghcr.io/openctemio/migrations:<version>`, as the schema-owner role
  (`DB_MIGRATE_USER`); the API runs as a DML-only role. Compose and the Helm chart do this ordering
  for you. See [Upgrading](../operations/upgrade.md).

### A failed migration

Each migration runs in a transaction (unless it manages its own, as `CREATE INDEX CONCURRENTLY`
does). If one fails, its changes roll back but the database is marked `dirty` at that version, and
both the runner and the API refuse to continue. Inspect what happened, fix the cause, then:

```bash
make migrate-status              # shows the dirty version V
make migrate-force version=-1    # V applied nothing (or you undid it): clear the flag, up runs V again
# make migrate-force version=V   # V is in fact complete (you finished it by hand): record it
make migrate-up
```

`force` never runs SQL. Record a migration only when its changes are really in the database.
