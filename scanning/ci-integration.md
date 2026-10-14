---
title: CI/CD integration
parent: Scanning
nav_order: 5
has_children: true
---

# CI/CD integration
{: .no_toc }

[`openctemio/ci`](https://github.com/openctemio/ci) scans code in your CI
pipelines and reports to OpenCTEM. A CI job proves who it is with the OIDC
token its CI system issues, so **no API key or other secret is stored in CI**.
The platform judges the results with its **CI gate**. The job passes or fails,
and the pull request shows one **OpenCTEM gate** check.

CI pipelines are not sensors. Sensors run long-lived scans, dispatched by the
platform, inside your networks. A CI job runs a one-shot binary in a small
image per tool. Both produce the same CTIS reports.

1. TOC
{:toc}

## Pick your job

| I want to… | Read | Who |
|---|---|---|
| Connect a first pipeline in five minutes | [Quickstart](ci-quickstart.md) | AppSec admin |
| Find out why my pull request was blocked, and fix it or ask for an exception | [Understand a blocked pull request](ci-blocked-pr.md) | Developer |
| Decide what fails a pipeline, safely | [Gate policies](ci-policies.md) | AppSec admin |
| Let one urgent commit through | [Break-glass](ci-break-glass.md) | AppSec admin, owner |
| Roll out to every repository of an organization | [Organization rollout](ci-rollout.md) | AppSec admin, CISO |
| Fix a refused pipeline or a failing upload | [Troubleshooting](ci-troubleshooting.md) | Everyone |
| Look up an input, a variable, an exit code or a version pin | [Reference](ci-reference.md) | Everyone |

## Who sees what

```mermaid
flowchart LR
  dev["Developer<br/>(member, scans:ci:read)"]
  sec["AppSec admin<br/>(admin, scans:ci:write + override)"]
  ciso["CISO / owner"]
  pr["Pull request:<br/>OpenCTEM gate check + comment"]
  runs["CI/CD › Runs<br/>run detail: why blocked"]
  setup["CI/CD › Trust and gate<br/>trust · policy · break-glass · PR feedback"]
  cov["CI/CD › Pipelines and Coverage<br/>freshness, gaps, failing gates"]
  dev --> pr
  dev -->|repositories in their access| runs
  sec --> setup
  sec --> runs
  sec --> cov
  ciso --> cov
```

- **Developers** work from the pull request: the check and the comment list
  what blocked it. **Details** opens the run in the console. A developer sees
  the runs of the repositories in their access. Anyone else sees "This run is
  not available to you", and an administrator can grant access to the
  repository.
- **AppSec admins** (`scans:ci:write`) set up trust, gate policies and pull
  request feedback. They see refused pipelines. Break-glass also needs
  `scans:ci:override`.
- **CISOs and owners** read the pipelines' freshness, failing default-branch
  gates and repository coverage.

| Permission | Allows |
|---|---|
| `scans:ci:read` | Pipelines, runs, coverage, trust configurations and gate policies (read) |
| `scans:ci:write` | Create and change trust, gate policies, coverage expectations and code host connections; see refused pipelines |
| `scans:ci:override` | Create and revoke break-glass overrides |

Creating or changing a trust configuration, changing the CI settings,
loosening a gate policy, connecting a code host and creating a break-glass
all ask for a recent sign-in (step-up).

## How a pull request is gated

```mermaid
sequenceDiagram
  autonumber
  participant Job as CI job (openctemio/ci)
  participant IdP as CI provider OIDC issuer
  participant API as OpenCTEM API
  participant Host as GitHub / GitLab
  Job->>IdP: request ID token (audience openctem:tenant:<id>)
  IdP-->>Job: signed token (repository, ref, commit, workflow)
  Note over Job: scan: sast, sca, secrets, iac (one job each)
  Job->>API: POST /ci/oidc/exchange {tenant_id, id_token}
  API->>API: verify signature, issuer, audience, expiry
  API->>API: trust rules, repository and owner binding, runner version, single use
  API-->>Job: run token (15 min, this run only)
  Job->>API: POST /ci/runs/{id}/results (one report per capability)
  Job->>API: POST /ci/runs/{id}/evaluate
  API->>API: gate policy, new vs base branch, expected capabilities, break-glass
  API-->>Job: verdict: pass or fail, with each blocking finding
  API->>Host: "OpenCTEM gate" check or status + one comment
  Note over Host: branch protection requires the check (source: the OpenCTEM app)
```

- The job exchanges its token at its first upload, not at the start, so a
  long scan does not use up the run token's 15 minutes. GitHub and Azure jobs
  renew it.
- The platform takes the repository, branch and commit from the **verified
  token**, never from the report. A report can describe only the job's own
  repository.
- The first verdict of a run is final. The check on a commit takes the
  **strictest** latest verdict of every pipeline on that commit, so a second
  workflow cannot turn a failing check green.
- When the platform cannot be reached, the local `fail-on` threshold applies.
  A broken scan never exits 0.

## Connect GitHub and GitLab

Trust and the gate work without a code host connection. The connection lets
the platform post the **OpenCTEM gate** check and the comment on the pull or
merge request. Open **Discovery › CI/CD › Trust and gate › Pull request
feedback**.

![The Pull request feedback tab: the GitHub App with the example-org installation and a GitLab group connection]({{ site.baseurl }}/assets/images/scanning/ci/ci-pr-feedback.png)
*Figure: Pull request feedback, with the GitHub App installed on example-org and one GitLab group.*

```mermaid
flowchart TD
  start([AppSec admin opens Pull request feedback])
  start --> gh{GitHub or GitLab?}
  gh -->|GitHub| inst[Install on GitHub:<br/>pick the organization and repositories]
  inst --> back[GitHub returns to the console]
  back --> bind{Signed-in GitHub user<br/>is an owner of the organization?}
  bind -->|no| refused[Binding refused]
  bind -->|yes| stepgh[Step-up: second factor]
  stepgh --> bound[Installation bound to this organization]
  gh -->|GitLab| tok[Create a group access token:<br/>Developer role, api scope]
  tok --> conn[Connect GitLab group:<br/>host, group path, token]
  conn --> stepgl[Step-up: second factor]
  stepgl --> check{GitLab confirms the token<br/>is a group or project token of that group?}
  check -->|no, e.g. a personal token| refused2[Refused]
  check -->|yes| stored[Token stored encrypted, never shown again]
  bound --> req[Make OpenCTEM gate a required check,<br/>expected source: the OpenCTEM app]
  stored --> req2[Protect the branch: the pipeline must succeed]
```

### GitHub App permissions

An operator registers the GitHub App once per deployment
([GitHub App guide](https://github.com/openctemio/openctem/blob/develop/api/docs/how-to/github-app.md)).
Each organization then installs it from **Pull request feedback**.

| Permission | Access | Why |
|---|---|---|
| Checks | Read and write | Post the gate's check on the commit. |
| Pull requests | Read and write | The summary comment; find the pull request of a commit. |
| Metadata | Read | Required by GitHub for every app. |
| Members (organization) | Read | **Required.** Binding an installation checks that the person is an owner of the GitHub organization. Without it, no organization installation can be bound. |
| Contents | Read (optional) | Only to read a merge commit's parents, so the check still lands when the pull request's base moved. Without it such a check is skipped, and the next run posts it. |

Installation tokens are narrowed to one repository, and to checks, pull
requests and metadata.

### GitLab connection

**Connect GitLab group** takes a **group access token** (Developer role, `api`
scope). A project access token also works. A personal access token is
refused, so the status is never posted as a person and does not depend on
anyone's membership. A connection made earlier with a personal token keeps
working until it is removed; reconnect it with a group access token.

![The Connect GitLab group dialog: host, group path and group access token]({{ site.baseurl }}/assets/images/scanning/ci/ci-gitlab-connect.png)

## Where pipelines show up

**Discovery › CI/CD › Pipelines** lists each workflow file of each repository
that reported. A pipeline is Running, Fresh, Stale, Failing or Degraded, or
inactive (Archived, Revoked, Never). It is never "offline". **Runs** lists
every run with its verdict. **Coverage** shows, per repository, which
capabilities ran recently.

![The Pipelines view: five pipelines of example-org and the platform group with status, last run, default-branch gate and runner version]({{ site.baseurl }}/assets/images/scanning/ci/ci-pipelines.png)
*Figure: Pipelines.*

![The Coverage view: repositories by SAST, SCA, secrets and IaC freshness, with Expect buttons]({{ site.baseurl }}/assets/images/scanning/ci/ci-coverage.png)
*Figure: Coverage. **Expect** marks the capabilities a repository must report.*

Disabling or deleting a trust configuration revokes its pipelines and stops
the upload tokens of their running jobs.

## Branch findings

A finding seen only on a feature or merge request branch is **branch-only**.
It shows in the CI gate, on the run and on the branch. It does not show in
exposure views, dashboards, SLA clocks or notifications. It joins the
organization's exposure when the code reaches a branch that counts: the
default branch, a protected branch, or a `main` or `release` branch. In a
repository whose default branch is not known yet, nothing is hidden.
Branch-only findings that no branch reports any longer expire.

## Platform code scanning (planned)

The API already stores code scanning settings: the protected branches,
capabilities and a weekly rescan per repository. These are
`GET`/`PUT /api/v1/ci/code-scanning/settings`, per repository, plus a
re-baseline call. The scans themselves do not run yet, the console has no
page for them, and the CI gate does not read this baseline yet. The planned
flow:

```mermaid
flowchart LR
  conn[Code host connected] --> base["Full baseline of each protected branch<br/>(platform sensor, short-lived clone token)"]
  base --> pr[Pull requests judged against the baseline]
  base --> re["Weekly re-review and rule-pack or feed updates<br/>(no commit needed)"]
  classDef planned stroke-dasharray: 5 5
  class base,pr,re planned
```
