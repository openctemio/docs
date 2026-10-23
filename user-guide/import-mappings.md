---
title: Import any CSV, JSON or XML with a mapping
parent: User guide
nav_order: 5.7
---

# Import any CSV, JSON or XML with a mapping

Most tools that OpenCTEM reads have a built-in importer. For everything else
(a spreadsheet export, the output of an in-house script, a JUnit-style report,
a JSON export of another product) you describe the file once in an **import
mapping**, and OpenCTEM reads every later file of that shape through it. No
code and no plugin are needed.
{: .fs-6 .fw-300 }

1. TOC
{:toc}

## What a mapping is

A mapping is a small declarative document in the language
`openctem.io/mapping/v1`. It says:

- the **source** kind: CSV, JSON, JSON Lines or XML;
- which element, row or list item is **one record**;
- for each record, which **fields** of the finding (title, severity, asset,
  CVE, description, location and so on) come from which column or path, with a
  few simple transforms (trim, lower case, split a list, translate values
  through a table, convert to a number);
- the **identity** of a finding: the members that tell one finding from
  another.

A mapping has no loops, expressions or code, and cannot read files or reach
the network, so reading a file costs time in proportion to its size. The
language is specified in the
[ctis mapping reference](https://github.com/openctemio/ctis/blob/main/docs/mapping.md).

A mapping is saved under a **name** (lowercase letters, digits, `.`, `_` and
`-`, starting with a letter or digit, at most 64 characters, for example
`acme-portscan`). Each change to it saves a new **version** (1, 2, 3, ...), so
an import can name the exact version it was written for.

## The mapping editor

In the console, open **Import mappings** and choose **New mapping** (or open an
existing one). The editor has three panes:

| Pane | What it shows |
|---|---|
| Left: **Sample** | A sample file you paste or drop in. It is used only for the preview and is not stored. |
| Middle: **Fields** | A table that maps each column (or path) of your sample to a finding field, with the transform for each. Columns of the sample that nothing uses are listed, so you notice what you left out. |
| Right: **Preview** | The first records of the sample as the **CTIS result** they become, the **identity key** of each finding, and the problems found (a row skipped, a value that did not convert). It updates as you edit. |

Nothing is imported by the editor: the preview never writes data.

### Starter templates

**New mapping** offers three starting points, each with a matching sample:

| Template | For |
|---|---|
| **Generic CSV** | One finding per row from the columns `title`, `severity`, `asset`, `asset_type`, `cve` and `description`. |
| **Generic findings JSON** | A JSON document with a `findings` list, one finding per item. |
| **JUnit-style XML** | Test results: a failed test case becomes a misconfiguration finding, an errored one a low finding, and passed or skipped cases give nothing. |

Pick the closest one, paste a sample of your own file, then rename the columns
in the **Fields** table until the preview shows the findings you expect.

## Identity: what makes two findings the same

Every mapping lists its **identity members**: the finding fields, such as
`rule_id` and `location.path`, that decide whether a row is a new finding or
the same finding seen again. Choose members that stay the same for the same
issue and differ between issues.

- Every finding rule must set every identity member.
- **A constant identity is refused.** If every identity member is a fixed
  value, every row would be one finding, and all but one would be lost. The
  editor reports this and will not save.
- A row whose identity members are all empty is skipped, with a message in the
  preview.
- **Changing the identity needs confirmation.** When you save a new version
  whose identity members differ from the previous version, the editor shows
  the difference and asks you to confirm. Findings imported earlier **keep
  their identities**: after the change, the same issue in a new file can be
  recognised as a new finding. If that is not what you want, ask an operator
  to re-key the existing findings with the `refingerprint` tool of the
  platform, or keep the previous identity.

## Import with a mapping

A file goes through a mapping when you give `format=mapping:<name>`, or
`format=mapping:<name>@<version>` for one version. Without a version, the
mapping's current version is used. The mapping can also be named by its id
(`format=mapping:<id>`).

### In the console

**Findings > Import results**: choose the saved mapping as the format of the import, choose the file and
click **Preview** for a dry run, then **Import**. The receipt is the same as
for any import.

### With the API

```bash
curl -X POST "https://openctem.example.com/api/v1/findings/imports?format=mapping:acme-portscan@2" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@portscan-export.csv"
```

The CI run upload takes the same query parameter, with the file as the body:

```bash
curl -X POST "https://openctem.example.com/api/v1/ci/runs/$RUN_ID/results?format=mapping:acme-portscan" \
  -H "Authorization: Bearer $RUN_TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary @portscan-export.csv
```

A name that matches no saved mapping (or a version that does not exist) is
answered with `400` and the code `unknown_mapping`. See
[Ingesting results](../api/ingest.md).

### From a pipeline

```bash
openctem-ci upload --format mapping:acme-portscan portscan-export.csv
openctem-ci upload --format mapping:acme-portscan@2 portscan-export.csv
```

The command checks the value before it sends anything. See
[Upload existing reports](../scanning/ci-upload.md).

### Always partial coverage

An import through a mapping is **always partial coverage**: it never closes
findings, because OpenCTEM cannot know whether a file lists everything its
tool saw. Findings the file does not mention stay as they are. The platform
records the **source** of these findings as `mapped:<name>`, so you can filter
a finding list down to what came through a mapping.

## What a mapping cannot set

A file is data from outside, so some fields are decided only by OpenCTEM and
cannot be set by a mapping. A mapping that names one of them is refused when
it is saved:

- the **tenant** (the organization the data belongs to);
- **asset ownership and criticality**;
- a finding's **status**, including closing or reopening it;
- the **source** and provenance of the finding (the tool, the import, who sent
  it);
- **fingerprints**: the identity of a finding is computed by OpenCTEM from the
  fields, never taken from the file. A constant `fingerprint` is refused too.

Links between records, report-level members and the tool name cannot be set
either, so a file cannot claim to be another tool or point at another
record.

## Limits

| Limit | Value |
|---|---|
| Sample file in the editor (preview) | 5 MiB |
| Mapping document | 256 KiB (at most 200 rules) |
| One CSV cell | 64 KiB (a longer one skips its row) |
| CSV columns | 1024 |
| XML | no document type declaration of any kind (no DTD, no entities): a file that has one is refused |
| XML and JSON nesting | 64 levels |

The CSV reader removes a UTF-8 byte order mark and refuses UTF-16 (save the
file as UTF-8). A cell is always read as text and never evaluated, so a
spreadsheet formula in a cell stays text. Size limits of an import itself are
those of [Ingesting results](../api/ingest.md).

## Permissions

| To | You need |
|---|---|
| Create, edit and delete mappings | `integrations:manage` |
| See mappings and use the preview | `integrations:read` or `assets:import` |
| Import a file through a mapping | The permissions the import already needs; a mapping adds none |

Findings from an import land only on assets you can change, as for every
import.

## Example

A CSV export with the header `title,severity,asset,asset_type,cve,description`:

```csv
title,severity,asset,asset_type,cve,description
Outdated web server,high,198.51.100.10,ip_address,CVE-2024-0001,"Server banner shows an end-of-life version"
Directory listing enabled,medium,www.example.com,domain,,Listing is open on /files/
```

Saved as the mapping `acme-portscan` from the **Generic CSV** template, it
gives two findings (the first with the CVE), imported with:

```bash
openctem-ci upload --format mapping:acme-portscan export.csv
```
