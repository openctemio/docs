---
title: Upload existing reports
parent: CI/CD integration
grand_parent: Scanning
nav_order: 6
---

# Upload reports your pipeline already has
{: .no_toc }

`openctem-ci upload` sends scanner reports that a pipeline already produces
(SARIF from any tool, trivy, grype, osv-scanner, ZAP, nuclei, an SBOM, ...)
to the job's OpenCTEM CI run. Nothing is converted on the runner: OpenCTEM
detects each file's format and reads it with the same importers as the
finding import ([Ingesting results](../api/ingest.md)). The run's gate judges the uploaded
findings with everything else in the run.

```sh
openctem-ci upload [flags] <file or directory>...
openctem-ci upload --gate trivy.json zap.xml
```

Needs `openctem-ci` from the first release after v0.3.1 and OpenCTEM v0.11.0
or later.

1. TOC
{:toc}

## Identity

`upload` authenticates like `scan`: the job's OIDC token is exchanged for a
run token that lives at most 15 minutes and is bound to one run on one
repository. The repository, branch and commit come from the verified token,
never from the files or from a flag. No API key is stored in CI. The same
variables apply (`OPENCTEM_API_URL`, `OPENCTEM_TENANT_ID`, and on GitLab,
CircleCI and Jenkins the job's token in `OPENCTEM_ID_TOKEN`); see
[Reference: other CI systems](ci-reference.md#other-ci-systems) for each CI system.

- `OPENCTEM_TENANT_ID` is required: without it there is nothing to upload
  to, and the command fails with exit 2.
- A fork's pull request uploads nothing and uses no credential; the job
  passes with a warning.
- A job that sets `OPENCTEM_TENANT_ID` but has no OIDC token fails with
  exit 2 and the fix (`OPENCTEM_ENFORCE=false` turns that into a warning).
- A refused token fails with exit 2 before any file is sent.

## Files and formats

Arguments are files or directories. A directory uploads its regular files,
sorted by name; subdirectories and symbolic links in it are skipped.

The formats are those of the importers: `csaf`, `cyclonedx`, `defectdojo`,
`grype`, `nessus`, `nuclei`, `opengrep`, `openvex`, `osv`, `qualys`,
`sarif`, `semgrep`, `spdx`, `trivy`, `vuls`, `zap`, and a ZIP of such files
(a Qualys detection file with its KnowledgeBase goes in one ZIP).
`openctem-ci upload -h` prints the list of the release you run.

| Flag | Default | Meaning |
|---|---|---|
| `--format` | `auto` | the format every file must have; `auto` detects each file. A file of another format fails the command (catches a wrong path before it reaches OpenCTEM). `mapping:<name>[@<version>]` reads every file through a saved [import mapping](../user-guide/import-mappings.md) (CSV, JSON or XML the formats above do not cover; one file at a time, never a ZIP; always partial) |
| `--gate` | `false` | ask the platform's gate for the run's verdict after the upload |
| `--aggregate` | `false` | upload into the run shared by all jobs of the pipeline; the pipeline's final `openctem-ci gate` job judges everything in it. Not with `--gate` |
| `--receipt` | | write the receipt as JSON to this file |
| `--on-upload-error` | `$OPENCTEM_ON_UPLOAD_ERROR`, else `fail` | `fail` (exit 2) or `warn` (exit 0 with a warning) when a file is not stored in full |

Every file is checked before anything is sent: an unknown format, a file
over the size limit or too many files fail the command and upload nothing.

**Secret scanner reports are refused.** A gitleaks or betterleaks report
holds the raw value of every secret it found, and `openctem-ci` never sends
a raw secret. Run `openctem-ci scan --capability secrets` instead: it sends
each secret masked and identified by a keyed hash. Do not upload SARIF from
a secret scanner for the same reason.

## Limits

| Limit | Value | Why |
|---|---|---|
| One file | 50 MiB | the platform's limit on a CI results request |
| Files per command | 50 | |
| Reports per run | 200 | the platform's limit, counted over every job of the run |
| One ZIP | 50 files, 100 MiB per file, 400 MiB in all, 200:1 compression | the importers' archive limits |

The file is streamed from disk with its length; it is never held in memory.
A larger report is split by the tool (one file per target or per scan).

## The platform applies the upload in the background

The platform stores each file and answers `202` with an upload id; its ingest
worker applies the report. `openctem-ci upload` then reads the upload's result
(`GET /api/v1/ci/runs/{id}/results/{upload_id}?wait=10`) until it is applied
or failed, and prints the counts below. A failed upload names the platform's
fixed error code. If the result cannot be read in time (the command's
`OPENCTEM_UPLOAD_TIMEOUT`), the file counts as stored with zero counts; with
`--gate` the verdict still judges everything, and waits for the run's uploads
(see [Reference](ci-reference.md#waiting-for-uploads)).

When the organization has too many unfinished uploads, the platform answers
`429` with `Retry-After`. The command waits (honouring `Retry-After`, at most
2 minutes each time) and retries, up to `OPENCTEM_RETRIES` times.

## Retries never import twice

Each file goes up with an `Idempotency-Key` derived from the run id and the
file's SHA-256. The platform keeps the first answer for a key for 24 hours
and replays it for a request with the same key and content. The same body
sent to a run is one upload even without the key. So:

- a request repeated after a network error, 429, 5xx, or a 409 while the
  first request is still being imported (honouring `Retry-After`) is
  answered from the first import;
- running `upload` again with the same file in the same run (a repeated
  step, or a retried job that joins the same aggregate run) imports nothing
  again; the receipt says "already uploaded to this run";
- the same content named twice on one command line is sent once.

Retries: `OPENCTEM_RETRIES` (default 3) and `OPENCTEM_UPLOAD_TIMEOUT`
(default 5 minutes per request) as for `scan`. With `--gate` the verdict
request is retried while the platform answers `503 INGEST_PENDING`, for up to
`OPENCTEM_GATE_WAIT` (default 10 minutes).

## Uploads are partial

An upload never closes findings. A finding that a file no longer lists stays
open: one report from one tool is not proof that the rest of the repository
was scanned. Findings are resolved by the platform's own coverage rules and
by people, never by the absence of a result in an uploaded file.

## Receipt and exit codes

The command prints one line per file and a total:

```text
FILE        FORMAT  NEW  STILL DETECTED  RESOLVED  REOPENED  SKIPPED  FAILED  NOTE
trivy.json  trivy   3    12              -         -         0        0
zap.xml     zap     1    4               -         -         2        0       2 dropped (not on the run's repository)
TOTAL               4    16              -         -         2        0       0 file(s) not stored in full
```

- **new**: findings created; **still detected**: findings seen again.
- **resolved** and **reopened** show `-` when the platform does not report
  them; an upload never resolves anything.
- **skipped**: findings not stored (an excluded asset, a duplicate), and
  findings on an asset other than the run's repository, which the platform
  drops and counts.
- **failed**: findings that could not be stored, and files of a ZIP the
  platform could not read.

| Exit | Meaning |
|---|---|
| `0` | every file was stored (and, with `--gate`, the gate passed) |
| `1` | `--gate`: the gate failed |
| `2` | a file was not stored in full (unless `--on-upload-error warn`), a file failed the checks, or the run could not be opened |

With `--gate`, a file that was not stored counts as a failed scan, so the
verdict fails rather than passing on results that never arrived.

## Examples

Each example runs `openctem-ci` from a release image, pinned by digest
(`ghcr.io/openctemio/ci:<release>@sha256:<digest>`; the digests are listed in
`images.lock` of the [openctemio/ci](https://github.com/openctemio/ci)
release), after the job's own scanner wrote its report to `reports/`.

### GitHub Actions

```yaml
jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # the job's OIDC token
    env:
      OPENCTEM_API_URL: https://openctem.example.com
      OPENCTEM_TENANT_ID: <organization id>
      OPENCTEM_IMAGE: ghcr.io/openctemio/ci:<release>@sha256:<digest>
    steps:
      - uses: actions/checkout@<sha>
        with:
          persist-credentials: false
      # ... your scanners write reports/trivy.json and reports/zap.xml ...
      - name: Upload to OpenCTEM
        run: |
          docker run --rm --read-only --tmpfs /tmp --user "$(id -u):$(id -g)" --cap-drop ALL \
            --security-opt no-new-privileges \
            -v "$PWD/reports:/reports:ro" -v "$GITHUB_EVENT_PATH:/github/event.json:ro" \
            -e GITHUB_ACTIONS -e GITHUB_REPOSITORY -e GITHUB_SHA -e GITHUB_REF -e GITHUB_HEAD_REF \
            -e GITHUB_BASE_REF -e GITHUB_EVENT_NAME -e GITHUB_SERVER_URL -e GITHUB_EVENT_PATH=/github/event.json \
            -e ACTIONS_ID_TOKEN_REQUEST_URL -e ACTIONS_ID_TOKEN_REQUEST_TOKEN \
            -e OPENCTEM_API_URL -e OPENCTEM_TENANT_ID \
            "$OPENCTEM_IMAGE" upload --gate /reports/trivy.json /reports/zap.xml
```

### GitLab CI

```yaml
openctem-upload:
  image:
    name: ghcr.io/openctemio/ci:<release>@sha256:<digest>
    entrypoint: [""]
  needs: [trivy, zap]          # the jobs whose artifacts hold the reports
  id_tokens:
    OPENCTEM_ID_TOKEN:
      aud: openctem:tenant:<organization id>
  variables:
    OPENCTEM_API_URL: https://openctem.example.com
    OPENCTEM_TENANT_ID: <organization id>
  script:
    - openctem-ci upload --gate reports/trivy.json reports/zap.xml
```

With several upload or scan jobs in one pipeline, pass `--aggregate` to each
and judge once in a final job (`openctem-ci gate`, stage `.post`).

### Jenkins

```groovy
// The OpenID Connect Provider plugin's credential "openctem-oidc"
// (see the reference page), bound for this step only.
withCredentials([string(credentialsId: 'openctem-oidc', variable: 'OPENCTEM_ID_TOKEN')]) {
    sh '''
      docker run --rm --read-only --tmpfs /tmp --user "$(id -u):$(id -g)" --cap-drop ALL \
        --security-opt no-new-privileges -v "$WORKSPACE/reports:/reports:ro" \
        -e OPENCTEM_ID_TOKEN -e OPENCTEM_API_URL -e OPENCTEM_TENANT_ID \
        -e JENKINS_URL -e GIT_URL -e GIT_COMMIT -e GIT_BRANCH -e BRANCH_NAME \
        -e CHANGE_ID -e CHANGE_BRANCH -e CHANGE_TARGET -e CHANGE_FORK \
        ghcr.io/openctemio/ci:<release>@sha256:<digest> upload --gate /reports/trivy.json /reports/zap.xml
    '''
}
```

### Azure Pipelines

```yaml
- bash: |
    set -euo pipefail
    docker run --rm --read-only --tmpfs /tmp --user "$(id -u):$(id -g)" --cap-drop ALL \
      --security-opt no-new-privileges -v "$BUILD_SOURCESDIRECTORY/reports:/reports:ro" \
      -e TF_BUILD -e SYSTEM_OIDCREQUESTURI -e SYSTEM_ACCESSTOKEN \
      -e OPENCTEM_API_URL -e OPENCTEM_TENANT_ID \
      -e BUILD_REPOSITORY_URI -e BUILD_SOURCEVERSION -e BUILD_SOURCEBRANCH -e BUILD_REASON \
      -e SYSTEM_PULLREQUEST_PULLREQUESTID -e SYSTEM_PULLREQUEST_SOURCEBRANCH \
      -e SYSTEM_PULLREQUEST_TARGETBRANCH -e SYSTEM_PULLREQUEST_ISFORK \
      ghcr.io/openctemio/ci:<release>@sha256:<digest> upload --gate /reports/trivy.json /reports/zap.xml
  displayName: Upload to OpenCTEM
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)   # only to request the job's OIDC token
    OPENCTEM_API_URL: https://openctem.example.com
    OPENCTEM_TENANT_ID: <organization id>
```

## Security

- **Identity from the token.** The run's repository, branch and commit are
  the verified token's. A file that names another repository has those
  findings dropped and counted by the platform; VCS fields in a file are
  ignored.
- **No stored secret.** As for `scan`: the run token is never printed or
  logged, and redirects are refused, so the token never reaches another host.
- **No raw secrets.** Secret scanner reports are refused (above).
- **Fail closed.** A file that was not stored fails the job (exit 2) and,
  with `--gate`, fails the verdict.
- **Bounded.** Size and count are checked before anything is sent; the
  reply is read up to 1 MiB, and every string from the platform is
  sanitized before it reaches the log.
