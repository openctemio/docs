---
title: Reference
parent: CI/CD integration
grand_parent: Scanning
nav_order: 8
---

# CI/CD reference
{: .no_toc }

1. TOC
{:toc}

## Versions to pin

The current release of `openctemio/ci` is **v0.3.0** (commit
`c77ac12253277edde4f6947f1d3850ce85b70d44`). Pin it, or that commit:

| Use | Reference |
|---|---|
| GitHub reusable workflow | `openctemio/ci/.github/workflows/scan.yml@v0.3.0` |
| GitHub action | `openctemio/ci@v0.3.0` |
| GitLab template | `https://raw.githubusercontent.com/openctemio/ci/v0.3.0/gitlab/templates/all.yml` |
| Image (all tools) | `ghcr.io/openctemio/ci:v0.3.0`, or its digest |

Platform v0.9.6 and later accept v0.3.0 and later only by default
(`CI_RUNNER_MIN_VERSION`). An older runner is refused with
`403 RUNNER_OUTDATED`, and the message names the exact line to change: the
`uses:` line on GitHub, the `include` URL on GitLab, or the image tag
elsewhere. Older runners read scanner configuration and ignore files from the
scanned tree, which could hide findings.

`openctemio/ci` v0.3.1 is a fix release: the job log shows why the platform
refused a token, and every `openctem-ci` step of a job shares one run token.
The console's snippets of platform v0.10.1 still pin v0.3.0, which stays
accepted. To use v0.3.1, change the version in the pin.

Never pin a branch such as `@main`. `edge` images follow the main branch and
change without notice. The workflow and the action run the images of the
release tag they are pinned to. When you pin a commit instead, set
`image-tag: v0.3.0`, or they run `edge`. The console's snippets pin the
release the platform was built with.

A GitHub job that calls the reusable workflow must grant
`security-events: write`, even without `upload-sarif`
([why](ci-troubleshooting.md#other-symptoms)).

## Capabilities

| Capability | Does | Tool | Image |
|---|---|---|---|
| `sast` | Static analysis of the code | opengrep, with the signed OpenCTEM rules pack | `ghcr.io/openctemio/ci-opengrep` |
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
| `upload-sarif` | `false` | Also upload SARIF to GitHub code scanning |
| `image-tag`, `scanner-image`, `verify-signature` | | Advanced: the image tag, one image for every capability, signature check |

The action (`openctemio/ci@v0.3.0`) takes the same inputs plus `path`,
`sast-rules` (default: `openctem`, the signed rules pack in the image; or a
path in the repository, or a registry pack fetched on the runner),
`aggregate`, `skip-gate`, `command` (`scan` or `gate`), `status-dir` and
`ca-bundle` (a PEM file of every CA the scan must trust, for self-hosted
runners behind a private CA). `semgrep-config` is a deprecated name for
`sast-rules`. Its outputs are `exit-code`, `sarif-dir` and `status-dir`.

## What a scan does not read

A pull request must not be able to hide its own findings, so `openctem-ci`:

- does not read scanner configuration or ignore files from the scanned tree
  (`trivy.yaml`, `.trivyignore`, `.gitleaks.toml`, `.betterleaksignore` and
  the like);
- runs SAST with `--disable-nosem` and `--x-ignore-semgrepignore-files`: a
  result under an inline ignore comment (`nosemgrep`, `nosem`, `noopengrep`)
  or a path in `.semgrepignore` is still reported and counted by the gate.

The job sends these comments and patterns as claims. From a default-branch
run of a commit the CI provider signed, each claim becomes a pending
suppression request (90 days) for the security team, when the policy allows
the repository's own file. An approved request then stops the result from
counting. Use an exception in `.openctem.yml` for anything else
([Gate policies](ci-policies.md#a-repositorys-own-file)).

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
[`examples/`](https://github.com/openctemio/ci/tree/v0.3.0/examples) and
[docs/other-ci.md](https://github.com/openctemio/ci/blob/v0.3.0/docs/other-ci.md).
In the image `ghcr.io/openctemio/ci:v0.3.0`:

```bash
openctem-ci scan --capability sast --aggregate   # one per capability, in parallel
openctem-ci gate --expect sast,sca,secrets       # once, after all of them
```

with `OPENCTEM_API_URL` and `OPENCTEM_TENANT_ID` set. A CI system that issues
no OIDC token is not supported: no stored key is accepted while **Require
OIDC for CI** is on (the default for new organizations; an upgraded organization that
kept accepting keys turns it on, see [Require OIDC for CI](ci-integration.md#require-oidc-for-ci)).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | The gate passed |
| `1` | The gate failed |
| `2` | The scan cannot be trusted: a tool, parse, upload or configuration error. For `openctem-ci upload`: a file was not stored in full (unless `--on-upload-error warn`), a file failed the checks (format, size, count), or the run could not be opened |

`openctem-ci upload` exits `0` when every file was stored (and, with
`--gate`, the gate passed) and `1` when `--gate` was asked and the gate
failed ([Upload existing reports](ci-upload.md)).

## Platform API

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/v1/ci/oidc/exchange` | the job's OIDC token | Exchange it for a 15-minute run token |
| `POST /api/v1/ci/runs/{id}/results` | run token | Upload one report: CTIS, SARIF 2.1.0, or a format the platform's importers read ([Ingesting results](../api/ingest.md)). Answers `202` with an `upload_id`; the platform applies the report in the background. `429 INGEST_QUEUE_FULL` and `Retry-After` when the organization's queue is full |
| `GET /api/v1/ci/runs/{id}/results/{report_id}?wait=10` | run token | The upload's outcome: `queued`, `processing`, `applied` (counts and the results already decided, `known`) or `failed` (a fixed `error_code`). `wait` is at most 10 seconds |
| `POST /api/v1/ci/runs/{id}/baseline-diff` | run token | Split a list of fingerprints into new and already open on the repository's default branch (for inline notes on new findings) |
| `POST /api/v1/ci/runs/{id}/evaluate` | run token | Ask for the verdict (the first verdict is final). Waits up to 10 seconds for the run's uploads, then answers `503 INGEST_PENDING` with `Retry-After` while one is still being applied; an upload that could not be applied fails the run (`upload_not_applied`) |
| `/api/v1/ci/trust-configs`, `/gate-policies`, `/gate-overrides`, `/coverage`, `/pipelines`, `/runs`, `/settings` | console session, `scans:ci:*` | What the console's CI/CD page does |

### Waiting for uploads

`openctem-ci` follows the `202` for you: it reads the upload's result until it is applied, and
retries the verdict request on `503 INGEST_PENDING`, honouring `Retry-After`, for up to
`OPENCTEM_GATE_WAIT` (default 10 minutes; a duration such as `90s` or a number of seconds, `0` to
60 minutes; `0` asks once). Use a `openctem-ci` release that includes this; an older one still
works, but its job log shows every result, because the list of results already decided (`known`)
is empty. The verdict is not affected. A pipeline that calls the API directly must read the
`Location` (or the result read above) instead of expecting the counts in the upload's answer.

## Platform settings (operators)

| Variable | Default | Meaning |
|---|---|---|
| `CI_RUNNER_LATEST_VERSION` | v0.3.0 (the CI release the API was built with) | Snippets pin it; an older runner shows an update |
| `CI_RUNNER_MIN_VERSION` | v0.3.0 | An older runner is refused (`RUNNER_OUTDATED`). `none` turns the minimum off |
| `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS` | none | Private ranges the API may reach, for example a self-managed GitLab issuer |
| `GITHUB_APP_*` | | The deployment's GitHub App ([GitHub App guide](https://github.com/openctemio/openctem/blob/develop/api/docs/how-to/github-app.md)) |

See [Environment variables](../configuration/environment-variables.md).
