---
title: CI integration
parent: Scanning
nav_order: 5
---

# CI integration

[`openctemio/ci`](https://github.com/openctemio/ci) scans code in your CI
pipelines and reports to OpenCTEM. A CI job proves who it is with the OIDC
token its CI system issues: **no API key or other secret is stored in CI**.
The platform then judges the results with its **CI gate** and the job passes
or fails.

CI pipelines are not sensors. Sensors run long-lived, platform-dispatched
scans in your networks; CI jobs run a one-shot binary in a small image per
tool. Both produce the same CTIS reports.

## What it scans

| Capability | Does | Tool | Image |
|---|---|---|---|
| `sast` | Static analysis of the code | semgrep | `ghcr.io/openctemio/ci-semgrep` |
| `sca` | Vulnerable dependencies | trivy | `ghcr.io/openctemio/ci-trivy` |
| `secrets` | Committed credentials | betterleaks | `ghcr.io/openctemio/ci-betterleaks` |
| `iac` | Infrastructure-as-code misconfigurations | trivy | `ghcr.io/openctemio/ci-trivy` |
| `container` | Vulnerable packages in an image | trivy | `ghcr.io/openctemio/ci-trivy` |

`ghcr.io/openctemio/ci` bundles every tool. Images are multi-arch, run as a
non-root user, and are signed with cosign; the GitHub Action resolves the tag
to a digest and verifies the signature before running it. Tags: `vX.Y.Z` and
`vX` for releases, `edge` for the main branch. Pin a release or a digest.

## 1. Trust your CI system

In OpenCTEM, open **Discovery > CI/CD**, tab **Trust and gate**, then
**Add trust** (also under **Settings > Scanning > CI/CD integration**). You
need `scans:ci:write` (owners and administrators).

- **Provider**: GitHub Actions, GitLab CI, Azure Pipelines, Bitbucket
  Pipelines, CircleCI or Jenkins, with what names your CI organization. For
  self-managed GitLab or Jenkins, enter its issuer URL.
- **Owners** and/or **Repositories**: at least one. `acme` admits every
  repository of `acme`; `acme/api, acme/web` only those; `acme/*` one level,
  `acme/**` any depth.
- Optional: **Branches and tags** (for example `main, release/*`),
  **Environments**, **Events**, **Protected branches and tags only**.
- **Admit fork pull requests**: leave it off.
- **Check a sample token** verifies a token from one of your jobs against the
  draft and shows what it reads, without storing it.

You also need your **organization id** (`OPENCTEM_TENANT_ID`); the trust page
shows the pipeline snippet with it filled in. The token's audience must be
`openctem:tenant:<organization id>` unless the trust says otherwise.

## 2. Add the scan to your pipeline

### GitHub Actions

Reusable workflow, one parallel job per capability, judged once:

```yaml
name: Security
on:
  pull_request:
  push:
    branches: [main]

jobs:
  openctem:
    uses: openctemio/ci/.github/workflows/scan.yml@v1
    with:
      capabilities: sast,sca,secrets,iac
      api-url: https://openctem.example.com
      tenant-id: <organization id>
    permissions:
      contents: read
      id-token: write     # report with the job's OIDC identity
```

Or the action in one job:

```yaml
jobs:
  openctem:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@<commit sha>
        with:
          persist-credentials: false
      - uses: openctemio/ci@v1
        with:
          capabilities: sast,secrets
          api-url: https://openctem.example.com
          tenant-id: <organization id>
```

Useful inputs: `capabilities` (default `sast,sca,secrets`, or `all`),
`target`, `image` (for `container`), `fail-on`, `enforce` (`false` reports
without failing the job), `upload-sarif` (also show findings in GitHub code
scanning; needs `security-events: write`), `semgrep-config` (default
`p/default`). Details: [docs/github.md](https://github.com/openctemio/ci/blob/main/docs/github.md).

### GitLab CI

```yaml
include:
  - remote: https://raw.githubusercontent.com/openctemio/ci/v1/gitlab/templates/all.yml

variables:
  OPENCTEM_API_URL: https://openctem.example.com
  OPENCTEM_TENANT_ID: <organization id>
```

`all.yml` runs `sast`, `sca`, `secrets` and `iac` in parallel and an
`openctem-gate` job that judges them once; `sast.yml`, `sca.yml`,
`secrets.yml`, `iac.yml` and `container.yml` run one each. Each job requests
an ID token with `id_tokens` and writes the GitLab security report of its
capability, so findings also appear in the merge request security widget.
Pin the include to a release tag or a commit, never `main`. Details:
[docs/gitlab.md](https://github.com/openctemio/ci/blob/main/docs/gitlab.md).

### Other CI systems

Azure Pipelines, Bitbucket Pipelines, CircleCI and Jenkins (with the OpenID
Connect Provider plugin) report the same way. Ready-to-use pipelines are in
[`examples/`](https://github.com/openctemio/ci/tree/main/examples) and the
per-system notes in
[docs/other-ci.md](https://github.com/openctemio/ci/blob/main/docs/other-ci.md).
The core command is:

```bash
openctem-ci scan --capability sast --aggregate   # one per capability, in parallel
openctem-ci gate --expect sast,sca,secrets       # once, after all of them
```

with `OPENCTEM_API_URL` and `OPENCTEM_TENANT_ID` set. Without
`OPENCTEM_TENANT_ID`, or for a change from a fork, `openctem-ci` scans only:
it writes SARIF and reports and applies the local `--fail-on` threshold, and
uploads nothing.

Exit codes: `0` pass, `1` the gate failed, `2` the scan cannot be trusted
(a tool, parse, upload or configuration error). A broken scan never exits 0.

## How identity works

1. The job's OIDC token is exchanged once at `POST /api/v1/ci/oidc/exchange`
   for a run token (`octci_`) that lives at most 15 minutes and is bound to
   one run on one repository.
2. The platform takes the repository, branch and commit from the verified
   token, never from the report. Where a token signs no commit (CircleCI,
   Jenkins without a `sha` claim), the run's commit is marked unverified.
3. A report may only describe the job's repository; findings on any other
   asset are dropped.

Organizations created since **Require OIDC for CI** exists have it on: CI
uploads with a stored sensor key are refused. Delete any `API_KEY` secret left
in CI settings.

## The CI gate

After the scans, the platform answers with a verdict
(`POST /api/v1/ci/runs/{id}/evaluate`): pass or fail, each blocking finding
with its file and line, and links to the run.

- **Gate policy** (organization, business unit or repository, under
  **Trust and gate**): severity threshold, CISA KEV, an EPSS threshold, and
  whether only **new** findings count (the default: new compared with the
  default branch). **Warn** mode reports what would fail and passes.
- Committed secrets always fail. Accepted risks, false positives and
  suppressions are always honored. A scanner that fails to run fails the job.
- **Break-glass** lets one commit pass for a limited time, with a reason. It
  is audited, and every owner and administrator is notified when it is
  created and each time it is used.
- When the platform cannot decide (unreachable), the local `fail-on`
  threshold applies.

## Branch findings

A finding seen only on a feature or merge request branch is **branch-only**:
it shows in the CI gate, on the run and on the branch, but not in exposure
views, dashboards, SLA clocks or notifications. It joins the organization's
exposure when the code reaches a branch that counts: the default branch, a
protected branch, or a `main` / `release` branch. In a repository whose
default branch is not known yet, nothing is hidden. Branch-only findings
that no branch reports any longer expire.

## Where pipelines show up

**Discovery > CI/CD**, tab **Pipelines**, lists each workflow file of each
repository that reported, with its runs and the repositories' coverage. A
pipeline shows as Running, Fresh, Stale, Failing, Degraded, or inactive
(Archived, Revoked, Never); it is never "offline". Disabling or deleting a
trust configuration revokes its pipelines and stops the upload tokens of their
running jobs.

## Upload a file you already have

A job that already produces a tool's output can upload it directly with the
run token: `POST /api/v1/ci/runs/{run_id}/results`. The format is detected
from the content: SARIF 2.1.0 from any analyzer, semgrep, trivy, grype,
gitleaks, nuclei and ZAP output, SBOMs, OSV results and the other formats the
platform's importers read. See [Ingesting results](../api/ingest.md).

## Troubleshooting

| Symptom | Cause |
|---|---|
| `The CI token was not accepted` | No trust configuration admits the job, the audience is wrong, or the token was used twice. Owners and administrators see the reason in the audit log (`ci_run.token_refused`). |
| The job scans but never uploads | `OPENCTEM_TENANT_ID` is unset, the change comes from a fork, or (GitHub) the job lacks `id-token: write`. |
| Every finding counts as new | The default branch was never scanned. Run the pipeline on the default branch once. |
| `REPORT_OUT_OF_SCOPE` | The report names an asset other than the job's repository. |
| `401` on upload after a long scan | The 15-minute run token expired. GitHub and Azure jobs renew it; elsewhere, shorten the time between the first upload and the gate. |
