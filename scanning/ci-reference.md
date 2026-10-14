---
title: Reference
parent: CI/CD integration
grand_parent: Scanning
nav_order: 7
---

# CI/CD reference
{: .no_toc }

1. TOC
{:toc}

## Versions to pin

The current release of `openctemio/ci` is **v0.2.0**. Pin it, or a commit:

| Use | Reference |
|---|---|
| GitHub reusable workflow | `openctemio/ci/.github/workflows/scan.yml@v0.2.0` |
| GitHub action | `openctemio/ci@v0.2.0` |
| GitLab template | `https://raw.githubusercontent.com/openctemio/ci/v0.2.0/gitlab/templates/all.yml` |
| Image (all tools) | `ghcr.io/openctemio/ci:v0.2.0`, or its digest |

Never pin `@main` or `@v1`. The `v1` git tag is an early tag that points at
v0.1.0, and no `v1` image exists. `edge` follows the main branch and changes
without notice. The console's snippets pin the release the platform was
built with.

With v0.2.0, a GitHub job that calls the reusable workflow must grant
`security-events: write` ([why](ci-troubleshooting.md#other-symptoms)).

## Capabilities

| Capability | Does | Tool | Image |
|---|---|---|---|
| `sast` | Static analysis of the code | semgrep | `ghcr.io/openctemio/ci-semgrep` |
| `sca` | Vulnerable dependencies | trivy | `ghcr.io/openctemio/ci-trivy` |
| `secrets` | Committed credentials | betterleaks | `ghcr.io/openctemio/ci-betterleaks` |
| `iac` | Infrastructure-as-code misconfigurations | trivy | `ghcr.io/openctemio/ci-trivy` |
| `container` | Vulnerable packages in an image | trivy | `ghcr.io/openctemio/ci-trivy` |

Images are multi-arch, run as a non-root user, and are signed with cosign. The
GitHub workflow and action resolve the tag to a digest and verify the
signature before running it (`verify-signature`, on by default).

## GitHub reusable workflow inputs

| Input | Default | Meaning |
|---|---|---|
| `capabilities` | `sast,sca,secrets` | Comma separated, or `all` |
| `api-url` | | OpenCTEM URL (https) |
| `tenant-id` | | Organization id: turns on reporting with the job's OIDC identity |
| `oidc-audience` | | Only when the trust uses another audience than `openctem:tenant:<id>` |
| `target` | `.` | Directory to scan |
| `image` | | Image to scan (`container`) |
| `fail-on` | | Local threshold when the platform cannot decide |
| `diff` | `auto` | `auto`: on a pull request, sast reports only findings new since the merge base. `off`: full scan |
| `enforce` | `true` | `false` reports without failing the workflow (a scan error always fails) |
| `upload-sarif` | `false` | Also upload SARIF to GitHub code scanning (needs `security-events: write`) |
| `image-tag`, `scanner-image`, `verify-signature` | | Advanced: the image tag, one image for every capability, signature check |

The action (`openctemio/ci@v0.2.0`) takes the same inputs plus `path`,
`semgrep-config` (default `p/default`), `aggregate`, `skip-gate`, `command`
(`scan` or `gate`) and `status-dir`. Its outputs are `exit-code`, `sarif-dir`
and `status-dir`.

## GitLab template variables

| Variable | Meaning |
|---|---|
| `OPENCTEM_API_URL` | OpenCTEM URL (https) |
| `OPENCTEM_TENANT_ID` | Organization id. Unset: scan only |
| `OPENCTEM_FAIL_ON` | Local threshold when the platform cannot decide |
| `OPENCTEM_ID_TOKEN` | Set by the template's `id_tokens` (audience `openctem:tenant:$OPENCTEM_TENANT_ID`). Override it per job only for another audience |

`all.yml` runs `sast`, `sca`, `secrets` and `iac` in parallel, then an
`openctem-gate` job that judges them once. `sast.yml`, `sca.yml`,
`secrets.yml`, `iac.yml` and `container.yml` run one capability each. Each job
writes the GitLab security report of its capability, so findings also appear
in the merge request security widget.

## Other CI systems

Azure Pipelines, Bitbucket Pipelines, CircleCI and Jenkins (with the OpenID
Connect Provider plugin) report the same way: see
[`examples/`](https://github.com/openctemio/ci/tree/v0.2.0/examples) and
[docs/other-ci.md](https://github.com/openctemio/ci/blob/v0.2.0/docs/other-ci.md).
In the image `ghcr.io/openctemio/ci:v0.2.0`:

```bash
openctem-ci scan --capability sast --aggregate   # one per capability, in parallel
openctem-ci gate --expect sast,sca,secrets       # once, after all of them
```

with `OPENCTEM_API_URL` and `OPENCTEM_TENANT_ID` set. A CI system that issues
no OIDC token is not supported: no stored key is accepted while **Require
OIDC for CI** is on (the default).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | The gate passed |
| `1` | The gate failed |
| `2` | The scan cannot be trusted: a tool, parse, upload or configuration error |

## Platform API

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/v1/ci/oidc/exchange` | the job's OIDC token | Exchange it for a 15-minute run token |
| `POST /api/v1/ci/runs/{id}/results` | run token | Upload one report: CTIS, SARIF 2.1.0, or a format the platform's importers read ([Ingesting results](../api/ingest.md)) |
| `POST /api/v1/ci/runs/{id}/evaluate` | run token | Ask for the verdict (the first verdict is final) |
| `/api/v1/ci/trust-configs`, `/gate-policies`, `/gate-overrides`, `/coverage`, `/pipelines`, `/runs`, `/settings` | console session, `scans:ci:*` | What the console's CI/CD page does |

## Platform settings (operators)

| Variable | Default | Meaning |
|---|---|---|
| `CI_RUNNER_LATEST_VERSION` | the CI release the API was built with | Snippets pin it; an older runner shows an update |
| `CI_RUNNER_MIN_VERSION` | none | An older runner is refused (`RUNNER_OUTDATED`) |
| `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS` | none | Private ranges the API may reach, for example a self-managed GitLab issuer |
| `GITHUB_APP_*` | | The deployment's GitHub App ([GitHub App guide](https://github.com/openctemio/openctem/blob/develop/api/docs/how-to/github-app.md)) |

See [Environment variables](../configuration/environment-variables.md).
