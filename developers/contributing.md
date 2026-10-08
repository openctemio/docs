---
title: Contributing
parent: Developers
nav_order: 3
---

# Contributing

Contributions are welcome in every repository of the
[openctemio](https://github.com/openctemio) organization. This page describes the workflow of the
platform repository, [openctemio/openctem](https://github.com/openctemio/openctem). The other
repositories (sensor, sdk-go, ctis, ci, helm-charts, docs) use the same commit and changelog
conventions, but their pull requests target `main`; check their own `CONTRIBUTING.md` where
there is one.

Security issues are not contributions: report them privately to security@openctem.io (see
[Vulnerability disclosure](../security/vulnerability-disclosure.md)).

## Branches

```
main      released code; vX.Y.Z tags are cut here by the release train
develop   integration branch; every pull request targets develop
  feature/..., fix/..., docs/..., chore/...   your branch
```

1. Fork the repository and branch from `develop`.
2. Open the pull request against `develop`. One pull request may change both `api/` and `web/`;
   an API contract change and the web code that uses it belong in the same pull request.
3. When the required checks are green and the change is approved, it goes through the GitHub
   merge queue, which tests it again on top of the current `develop`.

## Before you push

```bash
make setup             # once: dependencies, git hooks, generated files
make lint test check   # what CI gates on, for both components
```

`make setup` enables the repository's git hooks (`.githooks/`):

- `pre-commit` runs `gofmt` on staged Go files, and the TypeScript type check and lint-staged
  when web files are staged;
- `commit-msg` rejects AI-tool attribution lines (`Co-Authored-By:` an AI assistant, "Generated
  with ..." footers, session links). Commits are authored by people.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), scoped by component where useful:

```
feat(api): add per-key rate limit to MCP
fix(web): keep the findings filter when paging
docs: explain the list query contract
ci: pin actionlint
feat(api)!: remove the deprecated bulk triage route
```

The type matters: the release train proposes the next version from the commits since the last tag
(`feat` is a minor bump, a `!` or a `BREAKING CHANGE:` footer is a major bump from 1.0.0 on,
anything else a patch).

## Code style

- **Go:** [Effective Go](https://go.dev/doc/effective_go), `gofmt`, the pinned linters. Domain
  types (`api/pkg/domain`) have no infrastructure dependencies; application services
  (`api/internal/app`) are named `...Service` and built with `New...` constructors; handlers deal
  with HTTP only. Wrap errors with context (`fmt.Errorf("create asset: %w", err)`); return domain
  errors and let the handler map them to the [error envelope](../api/conventions.md#errors).
  Prefer table-driven tests.
- **SQL:** every query on a tenant table filters by `tenant_id`; values are always parameters,
  never concatenated. See [Database migrations](migrations.md) for schema rules.
- **TypeScript:** ESLint and Prettier as configured in `web/`; use the generated API types, never
  hand-written response shapes; reuse the shared components and design tokens.
- **Routes:** follow the [API conventions](../api/conventions.md) and the route-style lint.

## Changelog fragments

A user-visible change adds **one new file** `api/changelog.d/<short-slug>.md` instead of editing
`api/CHANGELOG.md`, so pull requests never conflict on the changelog:

```markdown
### Fixed: deactivated access groups stop granting access at once

- What changed and who it affects, with the migration number if there is one.
- **Upgrade note:** anything an operator must do.
```

The category is one of `Security`, `Behaviour change`, `Removed`, `Deprecated`, `Added`, `Changed`,
`Fixed`. API CI runs `python3 api/scripts/changelog.py check`, which rejects a fragment without a
valid `### <Category>: <title>` heading, an entry written directly under `## Unreleased` in
`CHANGELOG.md`, and committed merge-conflict markers. `changelog.py preview` shows the assembled
section. At release the fragments are folded into `CHANGELOG.md`.

## What review and CI look for

Six checks are required on `main` and `develop`: **API CI OK**, **Web CI OK**, **CodeQL OK**,
**All-in-one OK**, **Secret Scanning** and **Workflow Lint**. Beyond tests, CI enforces:

- **Every new route is documented** (`// @Router` annotation; the OpenAPI contract check fails
  otherwise) and **has an authorization gate** or an allowlist entry with a reason.
- **Route style** (`tools/lint/routestyle`): lowercase kebab-case paths, plural collections,
  `{snake_case}` parameters, the closed verb list for actions, no tenant in the path, no secrets in
  the URL. See [api-conventions.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/api-conventions.md).
- **Migrations are safe**: unique, increasing versions and expand-contract only (see
  [Database migrations](migrations.md)).
- **Lint on new code**: `go vet`, staticcheck and golangci-lint (v1.64.8, pinned) on the lines your
  branch adds (`make -C api lint-ci` locally); ESLint, Prettier and `tsc` for the web.
- **Security gates**: secret scanning of your commits, tenant-scope analysis, govulncheck, Trivy,
  Semgrep, CodeQL.
- **Contract report**: for an API change, CI comments on the pull request with the operations,
  parameters and route permissions that changed. Breaking changes are reported, and a reviewer
  decides whether they are intended.

Reviewers also check that:

- tenant isolation holds (the organization comes from the credential, every query is scoped);
- input from scans, imports and webhooks is treated as untrusted;
- tests cover the change, including the authorization and isolation paths;
- a feature is documented: user-facing behavior in these docs, design decisions in an RFC and an
  architecture note in `api/docs`.

## Licensing

The platform, sensor, SDK and CI repositories are licensed under GPL-3.0; `ctis` and `helm-charts`
under Apache-2.0 (see each repository's `LICENSE`). Contributions are made under the license of
the repository. No DCO sign-off or contributor license agreement is required.
