---
title: CI/CD quickstart
parent: Scanning
nav_order: 4.5
---

# CI/CD quickstart: connect a pipeline
{: .no_toc }

This page connects one GitHub Actions or GitLab CI pipeline to OpenCTEM in a
few minutes. The pipeline scans code, dependencies, secrets and
infrastructure-as-code on every push and pull request, reports with its own
short-lived OIDC identity (nothing secret goes into CI), and fails when the
CI gate does. The reference is [CI integration](ci-integration.md).

1. TOC
{:toc}

## What you need

- An OpenCTEM account with `scans:ci:write` (owners and administrators).
- A repository on GitHub or GitLab (gitlab.com or self-managed) where you can
  add a workflow file.
- The platform URL as the CI runners reach it, for example
  `https://openctem.example.com`. The runners need outbound HTTPS to it.

## 1. Open the wizard

Open **Discovery > CI/CD**. On a new organization the **Pipelines** tab is
empty and shows **Connect a pipeline**; otherwise the button is on the
**Trust and gate** tab. The wizard has four steps.

1. **CI system**: pick GitHub Actions or GitLab CI (Azure Pipelines,
   Bitbucket Pipelines, CircleCI and Jenkins are offered too).
2. **Organization**: name the **Organizations or owners** whose pipelines may
   report, comma separated (for GitLab, the top-level group). If the GitHub
   App is installed, pick from **From your GitHub App installations**. You
   can narrow by repository, branch and pipeline definition later.
3. **Pipeline snippet**: **Create trust** saves the trust configuration and
   shows the snippet, with your platform URL and organization id filled in.
4. **First run**: the wizard waits for the pipeline's first run.

## 2. Add the snippet to the repository

### GitHub Actions

Save as `.github/workflows/openctem.yml`:

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
      id-token: write # the job asks GitHub for an OIDC token; no stored secret
```

### GitLab CI

Add to `.gitlab-ci.yml` (the jobs run in the `test` stage):

```yaml
include:
  - remote: https://raw.githubusercontent.com/openctemio/ci/v0.2.0/gitlab/templates/all.yml

variables:
  OPENCTEM_API_URL: https://openctem.example.com
  OPENCTEM_TENANT_ID: <organization id> # jobs use their ID token; no stored secret
```

Pin `v0.2.0` (or a commit) as shown. Never pin `@main` or `@v1`: `v1` is an
early tag that points at v0.1.0.

## 3. Push and check the first run

Push a commit to the default branch, or open a pull request. The wizard shows
**First run received from** your repository; **Open the run** shows the
findings and the gate verdict. Run the pipeline once on the default branch
first: until it has been scanned, every finding on a pull request counts as
new.

If the wizard says **A pipeline was refused**, open **Trust and gate > Recent
refused pipelines**: it names the rule that refused the pipeline and the fix
(for example the repository's owner is not in the trust, or the job lacks
`id-token: write`). See [Refused pipelines](ci-integration.md#refused-pipelines).

## 4. Decide what fails the pipeline

The built-in gate fails on high-severity and known-exploited findings that are
new compared with the target branch, and on any committed secret. To change
it, open **Trust and gate > Gate policy**:

- Start in **Warn** mode to see what would fail without blocking anyone.
- Turn on **Dependency and image vulnerabilities block only when a fix exists**
  to stop blocking on vulnerabilities nobody can fix yet (known-exploited ones
  still fail).

See [The CI gate](ci-integration.md#the-ci-gate).

## 5. Harden it

- **Admit only your central workflow.** In the trust, set **Pipeline
  definitions** so a pull request that edits or adds a workflow cannot report
  for the repository.
- **Leave Admit fork pull requests off.**
- **Show the gate on pull requests.** Install the GitHub App, or connect the
  GitLab group with a group access token, under **Trust and gate > Pull
  request feedback**. Then make **OpenCTEM gate** a required check whose
  expected source is the OpenCTEM app.

Next: [CI integration](ci-integration.md) for every option, other CI systems
and troubleshooting.
