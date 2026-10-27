---
title: The vulnerabilities list
parent: User guide
nav_order: 5.4
---

# The vulnerabilities list

**Vulnerabilities** (`/vulnerabilities`, in the sidebar under **Findings**) shows
one row per vulnerability (CVE) across the assets you can see. **Findings** lists
each instance (a CVE on one asset is one finding); **Vulnerabilities** lists the
issue once, with how many assets and findings it has. A row opens the
[vulnerability page](#the-vulnerability-page).

You need the permissions `findings:vulnerabilities:read` and `findings:read`:
the list shows finding counts.

## What a row shows

| Column | What it means |
|---|---|
| Vulnerability | The CVE id, its title and up to two advisory ids the vulnerability feed ties to it |
| Exploitation | Known exploited (KEV) with its due date, a public exploit and its maturity, an emerging-threat alert, findings past their SLA |
| Priority | The worst priority class (P0 to P3) of its open findings |
| Severity / CVSS | The catalog severity and CVSS score |
| EPSS | The probability of exploitation in the next 30 days, with a 30-day trend line |
| Assets | Assets with an open finding of it, and how many are internet-facing |
| Fix | The fixed version, or "No fix yet" |
| Remediation | How many of its open findings are already in a remediation task |
| Last seen | When a scan last reported it |

The **Display** menu adds Product, Findings, KEV due and First seen.

**Counts follow your data scope.** Every number equals what the findings list
shows you for the same CVE and filters. Assets outside your scope are neither
shown nor counted, so two people can see different numbers for the same CVE.

## Sort and filter

- **Default order: risk.** Worst priority first, then known exploited, an
  emerging threat, EPSS, CVSS and the number of assets. The column headers sort
  by the other keys.
- **Metric strip.** Each tile (All, Known exploited, Public exploit, Emerging
  threat, Past SLA) is a filter.
- **Search** matches a CVE id, an advisory id or the title.
- **Filters panel:** severity, priority, exploitation, EPSS threshold, fix,
  source and asset group. The **Findings** select switches between open, fixed,
  dispositioned or all findings.
- **The URL holds every filter.** Copy it to share a view, and Back from a
  vulnerability page returns to the same list.

## Saved views

**Views** saves the current filters, search and sort under a name. When you save
one, choose who can use it:

- **Only me** (the default);
- **one of your teams**;
- **everyone in the organization**. This option needs the permission
  `findings:views:share`, which owners and administrators have by default.

A view runs as the person who opens it. Sharing a view shares the filters, never
the rows: each person sees their own data scope. Only the owner can change or
delete a view; anyone else can duplicate it and change the copy. An open view
appears in the URL as `view=<id>`; filters you add on top show as unsaved
changes.

## Act on vulnerabilities

Select rows with their checkboxes, up to 100 at a time. The actions bar then
offers the actions your permissions allow. Each action covers **the open findings
of the selected vulnerabilities that you can see under the current filters**. A
filter such as "Source: SCA" narrows the action too.

| Action | What happens | Permission |
|---|---|---|
| **Create task** | Opens the remediation task dialog with those findings. A finding belongs to at most one active task: findings another task already holds are listed, and you skip them or move them (a move is recorded and both owners are told) | `findings:remediation:write` |
| **Accept risk** | Asks for one exception (accepted risk or false positive) over those findings, with a reason, a note and an end date. The organization's approval policy decides it once: one or two approvers, depending on the [approval rules](05-exposures-and-findings.md#approval-rules). Each finding then keeps its own end date and cap. Findings that already wait for a decision are left out. One exception covers at most 500 findings | `findings:write` |
| **Retest** | Re-checks up to 50 of those findings, most urgent first. Each one is checked the way its source allows: a scanner finding is re-run with its own check, a version-match finding has the version read again, and findings people reported are not retested automatically. The result lists what was queued, already running, waiting for the retest limit, or could not be retested | `findings:verify` |
| **Export** | Downloads a CSV of those findings, one line per finding with its asset, title, severity, status, CVE, EPSS, KEV and SLA | `findings:export` |

**Export CSV** at the top of the page exports the findings behind every row
under the current filters, up to 1,000 vulnerabilities. Narrow the filters or
select rows if there are more. One export per person runs at a time.

Exceptions and retests are recorded in the audit log, as are exports.

## The vulnerability page

`/vulnerabilities/CVE-…` answers "are we affected?" for one CVE: the verdict,
where (the affected assets with their port, URL path or file), why (the
installed versions and the fix), who found it, the EPSS trend and the timeline.
Its header has **Create remediation task**, and the **More actions** menu offers
**Accept risk or mark false positive**, **Retest open findings** and **Export
findings (CSV)** for every open finding of that CVE you can see.

## Related

- [Exposures and findings](05-exposures-and-findings.md): the findings list,
  triage and approval requests.
- [Known false positives](known-false-positives.md): how an exception is
  approved, kept across scanners and re-opened.
- [Mobilization](08-mobilization.md): remediation tasks.
