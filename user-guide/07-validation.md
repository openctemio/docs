---
title: Validation
parent: User guide
nav_order: 7
---

# Validation

**CTEM stage 4.** Validation **proves that exposures are real and exploitable**,
and **checks whether your defenses detect or stop an attack**. Instead of relying
only on automated scan results (which can contain false positives), it answers:
"can an attacker really use this, and if they try, do our controls work?"

OpenCTEM groups this stage into four kinds of work:

- **Automated re-checks of findings**: **Re-verify** and **Retest** on a
  finding (below).
- **Manual penetration testing**: plan and track engagements (campaigns),
  document findings, retest them after a fix, produce reports, reuse finding
  write-ups, and measure ATT&CK technique coverage.
- **Attack simulation**: run ATT&CK-mapped techniques and measure detection
  and prevention.
- **Control testing**: track whether security controls pass their tests,
  framework by framework.

[Compensating controls](06-prioritization.md#compensating-controls), which lower
the priority of findings, are under Prioritization.

The pages are under **Validation** in the sidebar: **Overview**, **Pentest
campaigns**, **Attack simulation**, **Control testing**, **Retest queue** and
**ATT&CK coverage**. Most need the pentest read permission and their own module.

## Validation overview

**Validation › Overview** (`/validation`) shows whether fixes and controls are
proven and what is waiting to be re-tested:

- **P0/P1 validation coverage**, **Retests due**, **Open campaigns**,
  **Simulations** and **Control tests**.
- **Coverage by priority**: the share of closed findings with validation
  evidence (pentest, scripted or sensor).
- **Recent activity** across pentest findings, simulation runs and control tests.
- Cards linking to each validation area (shown when its module is on).

![The Validation overview with coverage by priority and recent validation activity]({{ site.baseurl }}/assets/images/user-guide/validation.png)
*Figure: The Validation overview.*

## Re-verify a finding

On an automated finding (not pentest, bug bounty, red team or manual), the
finding page has **Re-verify** (needs `findings:write`).

1. Click **Re-verify**. The platform queues a validation job; it runs on a
   sensor that can validate. If none is online, the console says **No validation
   sensor is online**.
2. When the sensor reports back, the result is recorded on the finding as
   validation evidence.

What a result can do:

- A **reachability check** (a non-intrusive TCP connection to the service, for
  example port 443 then 80) only says whether the host answers. It **never
  changes the finding's status**: an open port does not prove the fix failed and
  a refused connection does not prove it worked. Its evidence stays visible on
  the finding.
- A **detection re-run** (for nuclei findings, the finding's own template is run
  again) is a verdict:
  - it matched: **reproducible**, the finding stays open (and a finding
    previously downgraded is reopened as Confirmed);
  - it did not match while the target answered: **not reproducible**, the
    finding is downgraded to **validated fixed**. That is not a closed state: a
    person with the verify permission still resolves it;
  - anything else (target not reachable, template not available, error) changes
    nothing.

Re-runs use only safe templates: templates tagged `dos`, `fuzz`, `intrusive` or
`brute-force` are never run, and every probe is protected against reaching
loopback, cloud-metadata or other blocked internal addresses unless the operator
allows it. Sensors that have nuclei and accept commands offer this re-run.

To confirm a fix, use **Retest now** on the finding (nuclei findings; needs the
verify permission). A retest proves reachability with its own probe and then
settles the finding: fixed and resolved, still vulnerable, regression (reopened)
or inconclusive. See [Exposures and findings](05-exposures-and-findings.md#the-full-page).

The share of findings with validation evidence, and the share of validated
findings downgraded, are shown on
[Program health](09-insights-and-reports.md#program-health).

## Pentest campaigns

A pentest finding is also a finding of your organization: it appears in
**Findings** (`/findings`) next to scanner results, with the source **Pentest**.
Pentest findings use their own statuses (Draft → In Review → Confirmed →
Remediation → Retest → Verified, plus False Positive and Accepted Risk); Draft
and In Review are work in progress and hidden from the findings list unless you
filter on them.

### The campaign list

**Validation › Pentest campaigns** (`/pentest/campaigns`) plans, runs and tracks
penetration-testing engagements.

1. The metrics: **All campaigns**, **In progress**, **Planning**, **Completed**,
   **Critical findings** and **Findings**.
2. Search, and filter by **Status**, type and **Priority**.
3. **My campaigns** shows only the campaigns you are on. If you are on none, the
   page says so and offers **Show all campaigns**.
4. A row's menu: **View details**, **Edit**, the next status step (**Start
   campaign**, **Put on hold**, **Mark completed**, **Resume**), **Export findings
   (CSV)**, **Export findings (Excel)** and **Delete**.

### Create a campaign

Click **New campaign** (needs the campaign write permission):

- **Campaign name** and **Client name** (required).
- **Description**, type and methodology (you can type a new value for either),
  priority, **Client contact**, **Start date** and **End date**.
- **Objectives** (one per line).
- **Team members** (optional): search by name or email and give each a role:
  **Lead** (full control), **Tester** (creates and manages own findings),
  **Reviewer** (verifies findings) or **Observer** (read-only). You are added as
  Lead automatically.

The available campaign types and methodologies are set under
[Pentest methodology](#pentest-methodology-and-the-finding-library).

### The campaign page

A campaign's page (`/pentest/campaigns/{id}`) has the views **Findings**,
**Retests** and **Report**, plus its details:

- **Overview**: description, timeline, methodology, tags, objectives and
  progress.
- **Scope**: **Link Assets**, **Link Asset Groups** and **Manual Scope Items**
  (for targets not in the inventory, with **Bulk import**), in scope or out of
  scope.
- **Rules**: the **Testing Schedule** (24/7, business hours, after hours,
  weekends only, off-peak or custom), **Allowed** and **Restricted** testing
  methods, and **Contacts & Procedures** (emergency contact, communication
  channel, escalation procedure, data handling policy).
- **Team**: add members, change their role or remove them.
- **Checklist**: the OWASP Testing Guide checklist (Untested, Passed, Failed,
  N/A), with notes.
- Actions: **Start**, **Pause**, **Resume**, **Complete campaign**, **Export**,
  **Import findings**.

If you are not on a campaign's team you have view-only access.

### Findings of a campaign

The **Findings** view lists the campaign's findings (most severe first), with
the cards **All findings**, **Critical**, **High**, **Medium**, **In remediation**
and **Verified**, search by title, CWE or CVE, and filters.

- **New finding** (needs `pentest:write`) opens the finding form. Pick a
  template from the finding library to pre-fill it.
- A row's menu: **View details**, **Edit**, **Copy ID**, **Export** (the full
  finding as JSON: proof of concept, CVSS vector, impact, references) and
  **Delete**.

Deleting a campaign deletes its findings too and cannot be undone.

### Reports

The **Report** view generates the engagement deliverable:

1. Click **Generate report** and choose the **Report Type**: Executive Summary,
   Technical Report, Finding Report, Compliance Report, Remediation Report or
   Retest Report.
2. Choose the sections to include (executive summary, finding details, proof of
   concept, evidence, remediation steps, timeline, appendix), filter by severity
   and status, set the **Document Classification** (Public, Internal Use Only,
   Confidential, Restricted) and an optional watermark.
3. Generate. Reports are produced as HTML. When the report is **Completed**,
   **Download**, **Preview** or **Copy link**.

Every campaign's reports are also listed under **Insights › Reports › Pentest**.

## Retest queue

**Validation › Retest queue** (`/validation/retests`) lists findings that were
fixed and need re-verification, across campaigns. It is the "prove it again"
step: after the developers report a fix, a tester checks that the issue is gone.

![The Retest queue listing pentest findings waiting for re-verification]({{ site.baseurl }}/assets/images/user-guide/retest-queue.png)
*Figure: The Retest queue.*

1. The cards: **Pending**, **Retested** and **Success rate**.
2. Search, and filter by severity and campaign (or **All campaigns**).
3. **Pending** lists findings in Remediation or Retest; **History** lists
   findings already retested.
4. **Retest** (needs the retest write permission) opens **Record retest
   result**:
   - **Result**: **Passed**, **Failed** or **Partial**.
   - **Test environment**: Production, Staging or Development.
   - Notes (required; Markdown supported) and optional **Evidence**
     (screenshots, HAR files).

What happens next:

- **Passed** by a lead or reviewer: the finding becomes **Verified**. Passed by a
  tester: it stays in **Retest** until a reviewer confirms.
- **Failed**: the finding goes back to **Remediation** for the developers.
- **Partial**: recorded as a partial fix.

## ATT&CK coverage

**Validation › ATT&CK coverage** (`/validation/attack-coverage`) shows which
MITRE ATT&CK techniques your testing has exercised, from pentest findings and
attack simulations.

1. Choose the **Coverage source**: **All sources**, **Pentest only** or
   **Simulation only**. **Refresh** reloads.
2. The cards: **Techniques covered**, **Pentest findings**, **Simulations
   bypassed** and **Simulations detected**.
3. The **ATT&CK matrix**: one column per tactic, one cell per technique. The
   colour shows coverage and result: no coverage, pentest finding (low or
   medium), pentest finding (high), critical or bypassed, partially detected,
   detected or prevented.
4. **Covered techniques** lists every technique with at least one finding or
   simulation result.

## Attack simulation

**Validation › Attack simulation** (`/attack-simulation`) runs ATT&CK-mapped
attack techniques to check that your controls catch them.

- The cards: **Simulations**, **Active**, **Detected or prevented**,
  **Bypassed** and **Avg detection rate**.
- The table shows each simulation's technique, tactic, last run, detection rate,
  result and status. **Run** re-runs an active simulation; the result appears as
  a toast and in the table.

Simulations are created through the API (`POST /api/v1/simulations`); the console
lists and runs them. Until one exists the page shows **No simulations yet**.

## Control testing

**Validation › Control testing** (`/control-testing`) tracks whether your
security controls pass their tests, framework by framework.

1. The cards: **Controls**, **Passed**, **Failed** and **Coverage** (the share of
   controls tested).
2. **MITRE ATT&CK coverage**: detection and prevention rates per technique, from
   simulations (shown when simulation data exists).
3. **Security controls** lists each control test with its framework, category,
   risk, status and last test.
4. **Add control test**: **Name** and **Framework** are required (for example an
   "MFA Enforcement Test"); optional risk level, **Control ID** (for example
   `AC-2` or `T1078`), category, description, **Test procedure** and **Expected
   result**.
5. **Record result** on a control: the result (Pass, Fail, Partial, Not
   applicable), the evidence and notes.

## Pentest methodology and the finding library

**Settings › Policies › Pentest methodology** (`/settings/pentest`) has two
tabs.

- **Methodology**: the **Campaign types** (each a value and a display label, for
  example External Pentest, Web Application, API Testing, Cloud Infrastructure)
  and the **Methodologies** (for example OWASP Testing Guide, PTES, NIST SP
  800-115, OSSTMM, CREST) offered when creating a campaign. **Reset to defaults**
  restores the built-in lists; at least one campaign type is required.
- **Finding library** (`/settings/pentest/templates`): reusable write-ups that
  pre-fill a pentest finding. Each template has a name, category, severity,
  optional OWASP category and CWE, description, steps to reproduce, business and
  technical impact, remediation, references and tags.
  - Search by name, CWE or tag, and filter by type (built-in or custom),
    category and severity.
  - **New template** creates a custom one. A row's menu: **View**,
    **Duplicate**, and for custom templates **Edit** and **Delete**.
  - Select templates to **Export** them or delete them. Built-in templates cannot
    be edited or deleted.
