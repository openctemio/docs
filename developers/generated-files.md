---
title: Generated files
parent: Developers
nav_order: 6
---

# Generated files

Two kinds of files in `openctem` are produced by tools. The **contract files** are generated and
never committed. The **registry files** are generated from YAML and committed with it.

## Contract files (not committed)

The web console compiles against types generated from the Go API. None of these files is in git
(they are in the root `.gitignore`), so two pull requests never conflict on them and the merge
queue can test several API changes together.

| File | Generated from | By |
|---|---|---|
| `api/api/openapi/swagger.yaml` | the handler annotations (`// @Router`, `// @Param`, request and response types) | `make -C api swagger` (swag, pinned version) |
| `api/api/openapi/routes.txt` | the router: every registered route | `make -C api contract` |
| `web/src/config/api-route-permissions.json` | the route authorization gates | `make -C api contract` |
| `web/src/lib/api/generated/api.types.ts` | the spec (Swagger 2.0, converted to OpenAPI 3, then to TypeScript) | `npm run generate:api-types` in `web/` |

Generate them after cloning, after every pull, and after changing a handler, a route or its gate:

```bash
make generate          # all four; needs Go and Node (web/node_modules installed)
make generate-api      # the three API files only (Go)
make generate-web      # the web types only (Node), from an existing spec
make generate-docker   # all four in throwaway golang and node containers; needs only Docker
```

`make generate-docker` (`scripts/generate-in-docker.sh`) keeps its caches in named Docker volumes,
so later runs are fast, and hands the written files to the checkout's owner. Use it on hosts that
run the stack from a bind-mounted checkout: the files go stale after `git pull` until you
regenerate.

`npm run dev`, `build`, `type-check`, `lint` and `test` in `web/` refresh the types when the spec is
newer and stop with a hint when a file is missing. Builds of the web image do not generate (the
image context is `web/` only), so run `make generate` before `docker build web`, as
`make allinone` does.

### How CI uses them

- **API CI > OpenAPI Contract** (`api/scripts/check-openapi.sh`) generates the spec and checks it
  against the handlers and the router: every annotation is in the spec, every documented operation
  is routed, every route is documented (or listed in the shrink-only
  `api/api/openapi/undocumented-routes.txt`), and path parameter names agree.
- **Web CI > API contract** generates the files once and hands them to **Web checks**, which
  type-checks, lints and tests the web against them, including a check that the web only calls
  routes that exist. For an API change it also generates the base branch's contract and posts the
  difference on the pull request: removed or added operations, parameters that became required,
  changed schemas, and changed route permissions (review those as authorization changes).

If a merge conflicts on `swagger.yaml`, `api.types.ts` or `api-route-permissions.json`, the
branch predates their removal from git: take the deletion (`git rm` the file) and regenerate.

## Registry files (committed)

Some closed sets are defined once in YAML and generated into Go and TypeScript, so the API and the
console cannot disagree. Edit the YAML, run the generator, and commit the YAML and the generated
files together.

| Source | Generated | Command (from `api/`) |
|---|---|---|
| `configs/asset-types.yaml` (asset types, classes, inventory lenses) | `pkg/domain/asset/registry_generated.go`, `web/src/features/asset-types/registry.generated.ts` | `make generate-asset-types` |
| `configs/relationship-types.yaml` (asset relationship types and constraints) | `pkg/domain/asset/relationship_types_generated.go`, `web/src/features/assets/types/relationship.types.generated.ts` | `make generate-relationships` |

When asset class, lens or alias data changes, also add a migration whose body is the output of
`make asset-types-sql`. `make asset-types-check` (CI: Asset Types Drift) fails when the YAML, the
generated files and the newest registry migration disagree. The details are in
[asset-type-registry.md](https://github.com/openctemio/openctem/blob/develop/api/docs/development/asset-type-registry.md)
and [relationship-types.md](https://github.com/openctemio/openctem/blob/develop/api/docs/development/relationship-types.md).

## Other generators

| What | Command | Output |
|---|---|---|
| Filter parameter annotations of list endpoints, from the field registry (RFC-048) | `GOWORK=off go run ./tools/gen/filterparams` in `api/`, then `make swagger` | the `@Param` lines between `// filterspec-params:` markers in handler files (committed) |
| Test mocks | `make -C api generate` (`go generate ./...`) | mock packages |
| Gateway plane matchers | `UPDATE_GATEWAY_PLANES=1 go test ./internal/infra/http/routes/plane/` in `api/` | `api/deploy/gateway/planes.caddy` (committed; a test fails when it disagrees with the plane table) |
