---
title: Import results from your own tools
parent: User guide
nav_order: 5.6
---

# Import results from your own tools

See how it works: [Finding import](../how-it-works/integrations/finding-import.md).

Your sensors run the tools OpenCTEM manages for you. Some tools you run
yourself: an nmap scan on a laptop, a testssl.sh check, a URL list from an
archive tool. `openctem import` reads their output on your machine, converts it
to a CTIS report and imports it into your organization. OpenCTEM only reads
the files: it never runs these tools, and nothing of them is bundled.

1. TOC
{:toc}

## Set up

1. Install the `openctem` CLI (a signed binary with each SDK release, see the
   SDK's `docs/tools/cli.md`).
2. Create an API key with **Update Findings**, **Manage Assets** and **Import
   Assets**.
3. Set two environment variables. The key is read from the environment only,
   never from a flag, so it does not land in your shell history.

```sh
export OPENCTEM_URL=https://console.example.com
export OPENCTEM_API_KEY=...
```

## Give the tool its targets

```sh
# your organization's in-scope names, one per line (the API key's data scope applies)
openctem targets export --type domain > names.txt

# export, run, import in one step: no shell, the command never sees the API key
openctem run --type ip --format nmap -- nmap -sV -iL {targets_file} -oX {output_file}
openctem run --type domain --format lines --as domain --tool puredns -- puredns resolve {targets_file} -w {output_file}
```

`--type` is `domain`, `ip`, `url` or `service`; by default only assets an
active scope entry covers are exported (`--scope in_scope`), and `--tag`
narrows further. Run either from cron or a scheduled CI job.

Tools your sensor runs for you are scheduled as scan steps instead: the
platform picks the in-scope targets, signs the job, and the sensor enforces
the scope on every connection. With `openctem run` the platform cannot see
what your command actually scanned, which is why the checks below apply.

## Examples

```sh
# nmap XML (also the -oX output of nmap-compatible scanners)
nmap -sV -oX - 192.0.2.0/24 | openctem import --format nmap

# testssl.sh JSON (flat or pretty)
testssl.sh --jsonfile scan.json www.example.com
openctem import --format testssl scan.json

# one name, address or URL per line
gau example.com | openctem import --format lines --as url --tool gau
puredns resolve names.txt | openctem import --format lines --as domain --tool puredns

# dalfox writes SARIF, which OpenCTEM already reads
dalfox url https://app.example.com/?q=1 -f sarif -o dalfox.sarif
openctem import dalfox.sarif

# any other JSON, CSV or XML: a mapping file
openctem import --mapping wafw00f.mapping.json --tool wafw00f waf.json
```

### Look before you send

```sh
nmap -sV -oX - 192.0.2.0/24 | openctem import --format nmap --dry-run > report.json
```

`--dry-run` prints the CTIS report to the standard output and a summary to
the standard error, and sends nothing. What an import sends is exactly this
report.

### Convert now, upload later

```sh
openctem import --format testssl --out scan.ctis.json scan.json   # no network
openctem import scan.ctis.json                                    # later
```

The file is readable by you only. A CTIS file is recognised on upload.

## Formats

| Format | Tool output | What you get |
|---|---|---|
| `nmap` | `nmap -oX` | addresses, the names you scanned, open ports as services with product, version and CPE. No findings: version matching to vulnerabilities is the platform's job |
| `testssl` | `testssl.sh --jsonfile` or `--jsonfile-pretty` | the TLS service; checks of severity LOW and above as findings (OK and INFO checks are passes, grades are not findings) |
| `lines` | one value per line | `--as host`, `domain`, `ip` (addresses and CIDR blocks), `url` (web origins and their paths, parameter names only) or `auto` |
| `ctis` | a CTIS 2.0 report | the report, validated again |
| others | nuclei, Nessus, SARIF, trivy, grype, semgrep, gitleaks, ZAP, CycloneDX, SPDX, and more | as on the **Import results** page |

## What the platform does with it

- The import uses the rights of the API key, as an upload from the console
  would. It is always partial: it never closes or resolves findings it does not
  mention.
- Every host is checked against your organization's scope. A host your scope
  covers is recorded normally. A host outside it is recorded as a candidate:
  it waits for review and is never scanned. The receipt says how many were held.
- The same service or finding reported by a sensor and by your import is one
  record: you see both sources under **Seen by** on the finding.

## The receipt

```text
stdin (nmap, nmap 7.95): 12 assets, 0 findings, 0 endpoints, 0 components; 3 records read, 0 skipped
receipt 0193...: applied
  findings  received 0  created 0  updated 0  reactivated 0  skipped 0  failed 0  suppressed 0
  assets    created 9  updated 3
  held      4 hosts outside the organization's scope (candidates: recorded, never scanned)
```

| Exit status | Meaning |
|---|---|
| 0 | imported (or printed, or saved) |
| 1 | the platform refused or failed the upload, or the input held nothing usable |
| 2 | a usage error, or the input could not be read |
| 3 | still queued when `--wait` ended (default 60 s); the platform applies it shortly |

## Your responsibility

- **Only scan what you are allowed to scan.** OpenCTEM reads your files; the
  scan itself is yours. Tools that guess the names of storage buckets touch
  other organizations' accounts: point them only at names your organization
  owns.
- **Data terms of the tool's sources.** Some tools return data from third-party
  services with their own terms. For example, a scanner that answers from a
  public internet-scan dataset licensed for non-commercial use only: importing
  its output is your use of that data, under its terms.
- The tools' own licences (GPL, AGPL, the nmap licence) apply to the tools you
  run. OpenCTEM does not run or distribute them.
