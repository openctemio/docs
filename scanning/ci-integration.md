---
title: CI integration
parent: Scanning
nav_order: 5
---

# CI integration
{: .no_toc }

[`openctemio/ci`](https://github.com/openctemio/ci) scans code in your CI
pipelines and reports to OpenCTEM. A CI job proves who it is with the OIDC
token its CI system issues: **no API key or other secret is stored in CI**.
The platform then judges the results with its **CI gate** and the job passes
or fails.

To connect a first pipeline in a few minutes, follow the
[CI/CD quickstart](ci-quickstart.md). This page is the reference.

CI pipelines are not sensors. Sensors run long-lived, platform-dispatched
scans in your networks; CI jobs run a one-shot binary in a small image per
tool. Both produce the same CTIS reports.

1. TOC
{:toc}

## Versions to pin

The current release of `openctemio/ci` is **v0.2.0**. Pin it, or a commit:

| Use | Reference |
|---|---|
| GitHub reusable workflow | `openctemio/ci/.github/workflows/scan.yml@v0.2.0` |
| GitHub action | `openctemio/ci@v0.2.0` |
| GitLab template | `https://raw.githubusercontent.com/openctemio/ci/v0.2.0/gitlab/templates/all.yml` |
| Image | `ghcr.io/openctemio/ci:v0.2.0` (or its digest) |

Never pin `@main` or `@v1`. The `v1` tag is an early tag that points at
v0.1.0, and no `v1` images exist. The console's pipeline snippets pin the
release the platform was built with.

## What it scans

| Capability | Does | Tool | Image |
|---|---|---|---|
| `sast` | Static analysis of the code | semgrep | `ghcr.io/openctemio/ci-semgrep` |
| `sca` | Vulnerable dependencies | trivy | `ghcr.io/openctemio/ci-trivy` |
| `secrets` | Committed credentials | betterleaks | `ghcr.io/openctemio/ci-betterleaks` |
| `iac` | Infrastructure-as-code misconfigurations | trivy | `ghcr.io/openctemio/ci-trivy` |
| `container` | Vulnerable packages in an image | trivy | `ghcr.io/openctemio/ci-trivy` |

`ghcr.io/openctemio/ci` bundles every tool. Images are multi-arch, run as a
non-root user, and are signed with cosign; the GitHub workflow and action
resolve the tag to a digest and verify the signature before running it
(`verify-signature`, on by default). Each release publishes `vX.Y.Z`; `edge`
follows the main branch. Pin a release or a digest.

## 1. Trust your CI system

The quickest way is **Connect a pipeline** on **Discovery > CI/CD** (see the
[quickstart](ci-quickstart.md)). To do it by hand, open **Discovery > CI/CD**,
tab **Trust and gate**, then **Add trust**. You need `scans:ci:write` (owners
and administrators).

![The CI/CD integration page with a GitHub Actions trust configuration]({{ site.baseurl }}/assets/images/scanning/ci-trust.png)
*Figure: A trust configuration for GitHub Actions.*

A pipeline is admitted when every rule you fill in matches its token:

- **Provider**: GitHub Actions, GitLab CI, Azure Pipelines, Bitbucket
  Pipelines, CircleCI or Jenkins, with what names your CI organization. For
  self-managed GitLab or Jenkins, enter its issuer URL.
- **Owners** and/or **Repositories**: at least one. `acme` admits every
  repository of `acme`; `acme/api, acme/web` only those; `acme/*` one level,
  `acme/**` any depth.
- Optional: **Branches and tags** (for example `main, release/*`; for a pull
  request, its source branch), **Environments** and **Events**.
- **Pipeline definitions** (GitHub and GitLab only, at most 20): admit only
  jobs that run your central workflow. On GitHub write
  `owner/repo/.github/workflows/<file>@<ref>` (the token's `job_workflow_ref`;
  `*` is allowed in the ref); on GitLab `<host>/<project>//<file>@<ref>` (the
  token's `ci_config_ref_uri`). A pull request that edits or adds a workflow
  is then refused (`workflow_not_allowed`). Azure Pipelines, Bitbucket,
  CircleCI and Jenkins tokens do not name the definition, so the rule cannot
  be saved for them.
- **Protected branches and tags only**: GitHub tokens do not say whether a ref
  is protected, so on GitHub list the deployment environments whose deployment
  branch rules admit only protected refs; only jobs running in one of them are
  admitted. Saving the switch without environments is refused.
- **Admit fork pull requests**: leave it off. Events such as
  `pull_request_target` run code from a fork with your repository's identity.
- **Check a sample token** verifies a token from one of your jobs against the
  draft and shows what it reads, without storing it.

You also need your **organization id** (`OPENCTEM_TENANT_ID`); the trust page
shows the pipeline snippet with it filled in. The token's audience must be
`openctem:tenant:<organization id>` unless the trust says otherwise (Azure
Pipelines has one fixed audience).

### Refused pipelines

**Trust and gate > Recent refused pipelines** lists the latest pipelines whose
identity no trust configuration admitted, with the rule that refused each one
(the latest 50, from the audit log, tokens that verified only):

| Reason | Fix |
|---|---|
| No trust configuration exists for this CI provider or issuer. | Create a trust configuration for this provider (Connect a pipeline). |
| The token lacks the repository, commit, ref or id. | Run the scan in a pipeline job of the repository, not a manual or detached job. |
| The repository's organization is not in the trust configuration. | Add the organization to Owners, or check the spelling. |
| The repository is not in the trust configuration's repositories. | Add the repository (or a pattern that covers it). |
| The branch or tag is not in the allowed refs. | Add the branch, or leave Branches and tags empty to allow every branch. |
| The configuration requires a protected branch and this one is not. | Protect the branch in the code host, or turn off the protected-branch rule. |
| The job's deployment environment is not allowed. | Add the environment, or run the scan in an allowed one. |
| The pipeline event (push, pull request, schedule) is not allowed. | Add the event to Events, or leave Events empty. |
| The run comes from a pull request from a fork. | Fork runs are refused by design; they scan without reporting. |
| The pipeline definition is not one of the allowed central workflows. | Use the organization's central workflow, or add its path and ref to Pipeline definitions. |
| The token's organization is not the configured one. | Check the organization id or workspace in the trust configuration. |
| The organization name now belongs to a different organization than the one first trusted. | If the organization was really recreated, re-pin it in the trust configuration. |
| The repository name is bound to a different repository that reported first. | If the repository was recreated, retire its old pipeline first. |
| The job is a re-run with SSH access. | Re-run the job without SSH. |
| The same token was used twice. | Each job must exchange its own fresh token. |
| The CI scanner is older than the minimum version. | Update the OpenCTEM CI workflow, action or template to the current release. |
| The organization reached its number of pipelines. | Retire unused pipelines. |
| This pipeline started too many runs in a short time. | Wait and retry; check for a loop in the pipeline. |

## 2. Add the scan to your pipeline

### GitHub Actions

Reusable workflow, one parallel job per capability, judged once:

```yaml
name: OpenCTEM
on:
  pull_request:
  push:
    branches: [main]

jobs:
  openctem:
    uses: openctemio/ci/.github/workflows/scan.yml@v0.2.0
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
      - uses: openctemio/ci@v0.2.0
        with:
          capabilities: sast,secrets
          api-url: https://openctem.example.com
          tenant-id: <organization id>
```

Useful inputs: `capabilities` (default `sast,sca,secrets`, or `all`),
`target`, `image` (for `container`), `fail-on`, `diff` (`auto`: on a pull
request, `sast` reports only findings new since the merge base; `off` scans
in full), `enforce` (`false`
reports without failing the job), `upload-sarif` (also show findings in
GitHub code scanning; needs `security-events: write`), `oidc-audience` (only
when the trust uses another audience). The action also takes
`semgrep-config` (default `p/default`). Details:
[docs/github.md](https://github.com/openctemio/ci/blob/v0.2.0/docs/github.md).

### GitLab CI

```yaml
include:
  - remote: https://raw.githubusercontent.com/openctemio/ci/v0.2.0/gitlab/templates/all.yml

variables:
  OPENCTEM_API_URL: https://openctem.example.com
  OPENCTEM_TENANT_ID: <organization id>
```

`all.yml` runs `sast`, `sca`, `secrets` and `iac` in parallel and an
`openctem-gate` job that judges them once; `sast.yml`, `sca.yml`,
`secrets.yml`, `iac.yml` and `container.yml` run one each. Each job requests
an ID token with `id_tokens` and writes the GitLab security report of its
capability, so findings also appear in the merge request security widget.
The template's images are pinned by digest. Pin the include to a release tag
or a commit, never `main`. Details:
[docs/gitlab.md](https://github.com/openctemio/ci/blob/v0.2.0/docs/gitlab.md).

### Other CI systems

Azure Pipelines, Bitbucket Pipelines, CircleCI and Jenkins (with the OpenID
Connect Provider plugin) report the same way. Ready-to-use pipelines are in
[`examples/`](https://github.com/openctemio/ci/tree/v0.2.0/examples) and the
per-system notes in
[docs/other-ci.md](https://github.com/openctemio/ci/blob/v0.2.0/docs/other-ci.md).
Use the image `ghcr.io/openctemio/ci:v0.2.0`; the core command is:

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

### A repository's own gate settings

A repository can make the gate **stricter** for itself, and request
exceptions, with a `.openctem.yml` file at its root (a `gate` section:
`fail_on_severity`, `new_findings_only`, `fail_on_kev`, `epss_threshold`,
`block_rules`, `exceptions`). A value applies only when it is stricter than the
organization's policy; the file can never make a finding pass. An exception
becomes a pending suppression request that an administrator approves. A gate
policy can forbid repository files. See
[docs/repository-file.md](https://github.com/openctemio/ci/blob/v0.2.0/docs/repository-file.md).

## How identity works

1. The job's OIDC token is exchanged once at `POST /api/v1/ci/oidc/exchange`
   for a run token (`octci_`) that lives at most 15 minutes and is bound to
   one run on one repository.
2. The platform takes the repository, branch and commit from the verified
   token, never from the report. Where a token signs no commit (CircleCI,
   Jenkins without a `sha` claim), the run's commit is marked unverified.
3. A report may only describe the job's repository; findings on any other
   asset are dropped.
4. A job whose CI scanner is below the platform's minimum supported version
   is refused with `403 RUNNER_OUTDATED`. Update the pinned release.

Organizations created since **Require OIDC for CI** exists have it on: CI
uploads with a stored sensor key are refused. Delete any `API_KEY` secret left
in CI settings.

### Fork pull requests

- A run from a fork pull request is refused unless the trust admits forks; the
  job then scans without reporting.
- A run triggered by a fork event (`pull_request_target`, `workflow_run`, a
  GitLab external pull request) carries the base branch's ref and commit, but
  is never counted as a default-branch run: its findings go to a `fork/...`
  branch that does not count as exposure, and no check is posted on the base
  commit.

## The CI gate

After the scans, the platform answers with a verdict
(`POST /api/v1/ci/runs/{id}/evaluate`): pass or fail, each blocking finding
with its file and line, and links to the run.

- **Gate policy** (organization, business unit or repository, under
  **Trust and gate**): **Enforce** or **Warn** (reports what would fail and
  passes), the severity threshold, CISA KEV, an EPSS threshold, and whether
  only **new** findings count (the default). A repository uses its own policy,
  else the strictest of its business units', else the organization's.
- **New compared with what.** A pull request into a release line (the default
  branch, a protected branch, or a `main` or `release` branch that the
  repository has scanned) is compared with that branch; anything else with the
  default branch.
- **Fixable only.** With **Dependency and image vulnerabilities block only
  when a fix exists** on (off by default), a dependency or image vulnerability
  without a fixed version is listed as "no fixed version yet" and does not
  block. A known-exploited (KEV) vulnerability still fails, and code, secret
  and IaC findings are not affected. Turning it on loosens the gate, so it
  needs re-authentication and administrators are notified.
- **Secrets.** A run that adds a committed secret always fails, and so does
  every default-branch run while a secret is open. A secret that is already
  open on the default branch is a non-blocking note on pull request runs, so
  one old secret does not block every pull request until it is triaged.
- Accepted risks, false positives and suppressions are always honored. A
  scanner that fails to run fails the job.
- **Break-glass** lets one commit of one repository pass for 1 to 168 hours,
  with a reason. It needs the **full** commit id and covers exactly that
  commit. It is audited, and every owner and administrator is notified when it
  is created and each time it is used.
- When the platform cannot decide (unreachable), the local `fail-on`
  threshold applies.

### The check on the pull request

With the GitHub App or a GitLab connection (**Trust and gate > Pull request
feedback**), the verdict is posted as the **OpenCTEM gate** check (GitHub) or
commit status (GitLab), with a summary comment on the pull request.

- The check takes the **strictest** of the latest verdicts of every pipeline on
  the commit. A second workflow, for example one added by the pull request,
  cannot turn a failing check green; a re-run of the same pipeline replaces its
  own earlier verdict.
- To make the gate required, add **OpenCTEM gate** as a required status check
  in the branch protection rules, and set its expected source to the OpenCTEM
  app, so a workflow's own token cannot post a check with the same name.

### GitHub App permissions

An operator registers the GitHub App once per deployment
([GitHub App guide](https://github.com/openctemio/openctem/blob/develop/api/docs/how-to/github-app.md));
each organization installs it from **Pull request feedback**.

| Permission | Access | Why |
|---|---|---|
| Checks | Read and write | Post the gate's check on the commit. |
| Pull requests | Read and write | The summary and inline comments; find the pull request of a commit. |
| Metadata | Read | Required by GitHub for every app. |
| Members (organization) | Read | **Required.** Binding an installation checks that the person is an owner of the GitHub organization; without it no organization installation can be bound. |
| Contents | Read (optional) | Only to read a merge commit's parents, so the check still lands when the pull request's base moved. Without it such a check is skipped and the next run posts it. |

Installation tokens are narrowed to one repository and to checks, pull
requests and metadata.

### GitLab connection

**Connect GitLab group** takes a **group access token** (Developer role, `api`
scope); a project access token also works. A personal access token is
refused, so the status is never posted as a person and does not depend on
someone's membership. A connection made earlier with a personal token keeps
working until it is removed; reconnect it with a group access token.

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

![The CI/CD page listing two pipelines with their freshness and default-branch gate]({{ site.baseurl }}/assets/images/scanning/ci-pipelines.png)
*Figure: CI pipelines.*

## Upload a file you already have

A job that already produces a tool's output can upload it directly with the
run token: `POST /api/v1/ci/runs/{run_id}/results`. The format is detected
from the content: SARIF 2.1.0 from any analyzer, semgrep, trivy, grype,
gitleaks, nuclei and ZAP output, SBOMs, OSV results and the other formats the
platform's importers read. See [Ingesting results](../api/ingest.md).

## Code scanning settings

The API has settings for full code scanning of repositories
(`GET`/`PUT /api/v1/ci/code-scanning/settings`, per repository, and a
re-baseline call): which branches count as protected, the capabilities and a
weekly rescan. The scans themselves are not run yet and the console has no
page for them; the CI gate does not read this baseline yet.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `The CI token was not accepted` | No trust configuration admits the job, the audience is wrong, or the token was used twice. **Trust and gate > Recent refused pipelines** names the rule; owners and administrators also see it in the audit log (`ci_run.token_refused`). |
| `403 RUNNER_OUTDATED` | The pinned CI release is older than the platform's minimum. Pin the current release. |
| The job scans but never uploads | `OPENCTEM_TENANT_ID` is unset, the change comes from a fork, or (GitHub) the job lacks `id-token: write`. |
| Every finding counts as new | The default branch (or the release branch the pull request targets) was never scanned. Run the pipeline on it once. |
| A break-glass override does not apply | It was saved with an abbreviated commit id. Create it again with the full id. |
| `REPORT_OUT_OF_SCOPE` | The report names an asset other than the job's repository. |
| `401` on upload after a long scan | The 15-minute run token expired. GitHub and Azure jobs renew it; elsewhere, shorten the time between the first upload and the gate. |
