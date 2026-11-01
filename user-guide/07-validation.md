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

**Validation › Overview** (`/validation`) shows whether fixes hold and controls work, and what is waiting
for you. Every number opens the findings list it counts.

The strip at the top:

- **P0/P1 validation coverage**: the share of closed P0 and P1 findings with validation evidence (pentest,
  scripted or sensor), the same figure the CTEM cycle uses before a cycle can close. P0 and P1 are shown
  under it. With no closed P0 or P1 finding yet it shows a dash.
- **Validated, last 30 days**: findings closed in the last 30 days after a re-check stopped reproducing
  them.
- **Still reproduces**: open findings whose latest re-check reproduced them.
- **Reopened, last 30 days**: findings that came back after they were closed.

**Waiting for you** lists only the queues that have something in them, each with the action that empties
it:

- **Fixes waiting for validation**: findings marked fixed that no re-check has confirmed yet (pentest
  findings are counted in the retest queue instead when the pentest module is on).
- **Pentest retests due** (pentest module): findings being fixed or fixed, waiting for a retest.
- **Ready to close** (verifiers): closes waiting for a verifier.
- **Open campaigns** (pentest module): campaigns in planning or in progress.

When nothing is waiting, the block says so and links to the validation areas that are on. A module the
organization switched off leaves the page; owners and admins see one line naming it, with a link to
**Settings › Organization › Modules**.

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

### The Verification panel: how a finding can be verified

The finding drawer and page have a **Verification** panel. The platform works out,
for that finding, which ways of verifying a fix apply, and the panel lists them:

| Method | When it is available | Counts as proof |
|---|---|---|
| **Retest** | The finding's tool and rule can be re-run on its target by a sensor of your organization | Yes |
| **Covered scan** | A full scan with the same tool covers the asset and no longer finds it: always for a repository's default branch, and for other assets when automatic closing by scan is on. Never for secrets or for findings a person reported | Yes, the finding closes on its own |
| **Reachability check** | An active asset with a network address (not a secret) | No, it only says whether the target answers |
| **Rotation proof** | Leaked secrets: the credential was revoked at the provider and replaced, recorded in the checklist | Yes |
| **Evidence review** | Any open finding: the verification checklist | Yes |

A method that cannot be used says why (for example "A leaked secret is verified by
rotating it, not by a re-check", or "No sensor of your organization can re-check
it"). The panel also states what resolving needs for the finding's risk tier:

- **Critical, P0 or KEV:** a passing retest, or the checklist completed by
  **another person** than the one who resolves.
- **High or P1:** a passing retest or the completed checklist.
- **Everything else:** a note.

Proof older than the last time the finding was seen or reopened does not count.

**Fill in the checklist:** click **Checklist** in the panel (needs the verification
checklist permission), tick each item and add notes and evidence links. For a
secret the items describe the rotation; give the key reference's last four
characters only, never the secret. Completing every item records you as the person
who verified the fix. For a critical finding the panel then tells you that another
person must resolve it, and their status menu offers **Resolved**.

In the status menu a move you cannot make shows a lock and the reason under it
(for example "Needs proof: a passing retest, or the checklist completed by another
person"). The **Check reachability** button (needs the verify permission) appears
only where a reachability check can run.

### Retest checks: retest findings that have no template

A finding that no scanner template can re-run (a manual or bug-bounty finding,
a web issue from a pentest report, a DAST finding) can get a **retest check**:
someone on the security team reads the finding and attaches the check that
reproduces it. **Retest now** and the automatic proof of fix then run that check.

Open the finding, then **Retest check**:

1. Write the check, in one of two ways:
   - **HTTP assertion**: the request (method GET, HEAD, POST or OPTIONS, a path
     relative to the finding's target, headers, a body for POST) and what the
     response shows while the issue is there (status codes, words or regular
     expressions in the body or headers, each optionally negated). No YAML needed.
   - **Nuclei template**: paste or upload a template, or pick one from the
     organization's template library.
2. **Validate**: shows any problem per field, the check's tier and the template
   that will run.
3. **Save**. A check you write is stored in the template library, tagged
   `retest-check`.

What a check may do: send HTTP requests to the finding's own target only. Every
path is relative to the target, raw requests use `Host: {{Hostname}}`,
redirects to other hosts, out-of-band callbacks, fuzzing and code are refused,
and a check never holds credentials (no `Authorization`, `Cookie` or API-key
values). The target is always the finding's own asset; a check has no target
field.

How a result counts:

- **The check matched**: the finding is still vulnerable. The first match also
  **calibrates** the check.
- **The check did not match** on the target's answered endpoint: verified fixed,
  but only once the check is calibrated. A check that never matched the finding
  proves nothing about a fix, so its no-match is "not reproduced". Run the check
  once before the fix is deployed to calibrate it.
- **The check could not load or run**, or the target did not answer: inconclusive.
  The finding is never resolved by a check that failed.

Changing a check resets its calibration and approval. An **intrusive** check
(tier T2: it changes state, for example `PUT` or `DELETE`, or sends many
requests) runs only after someone else with the scope-approval permission
approves that exact version (**Approve**, with a recent sign-in); the author
cannot approve their own check. If your organization requires template versions
to be approved for sensors, the check also waits for that approval.

A retest with a check needs an organization sensor whose version runs delivered
checks (it reports the capability `retest-templates:nuclei`); shared sensors
never run organization checks. Without one, **Retest now** is not offered and
the reason is shown.

Permission: attaching, changing and removing a check needs
`findings:retest_checks:write` (owner, admin and the Security analyst,
Vulnerability manager, AppSec engineer and Validation engineer role templates);
reading it needs `findings:read`. Every change and approval is audited, and each
retest records which check and which exact version ran.

The share of findings with validation evidence, and the share of validated
findings downgraded, are shown on
[Program health](09-insights-and-reports.md#program-health).

## Pentest campaigns

A pentest finding is also a finding of your organization: it appears in
**Findings** (`/findings`) next to scanner results, with the source **Pentest**.
Pentest findings use the shared finding statuses plus Draft and In Review
(Draft → In Review → Confirmed → In Progress → Fix Applied → Resolved, plus
False Positive, Risk Accepted and Duplicate); a passed retest resolves the finding with the
resolution method `retest_verified`. Draft and In Review are work in progress:
they are hidden from the findings list unless you filter on them, and a campaign
client never sees them. A finding is **published** once it reaches Confirmed.

### The campaign list

**Validation › Pentest campaigns** (`/pentest/campaigns`) plans, runs and tracks
penetration-testing engagements.

1. The metrics: **All campaigns**, **Planning**, **Testing**, **Reporting**,
   **Remediation**, **Critical findings** and **Findings**. A planning campaign
   whose readiness checks pass shows **Ready to start**.
2. Search, and filter by **Status** and by what is tested (**Targets**). Archived
   campaigns are listed only when you filter on them.
3. **My campaigns** shows only the campaigns you are on. If you are on none, the
   page says so and offers **Show all campaigns**.
4. A row's menu: **View details**, **Duplicate**, the phase actions (see
   [The campaign page](#the-campaign-page)), **Export findings (CSV)**,
   **Export findings (Excel)** and **Delete**. Phase actions are offered to the
   campaign lead and to organization owners and administrators who are members
   of the campaign.

![The pentest campaign list with targets, status, TLP and progress per campaign]({{ site.baseurl }}/assets/images/user-guide/pentest-campaigns.png)
*Figure: The campaign list.*

### Create a campaign

**New campaign** (needs the campaign write permission) opens a wizard in three
steps. Only the **Campaign name** and the **Client** are required, and **Create
campaign** works from any step; everything else can be filled in later.

1. **Engagement**: name, client, description, **What is tested** (one or more
   target types from your organization's list, for example web application, API
   and cloud), **Approach**, **Environment**, **Sharing (TLP)**, methodology,
   start and end dates, objectives (one per line) and the
   [methodology checklists](../pentest/checklists.md) the campaign runs
   (preselected from the targets). Defaults: grey box,
   staging, TLP:AMBER, your organization's first methodology, and an end date
   two weeks from today.
2. **Scope and rules**: targets in and out of scope (domain, URL, IP, CIDR,
   application), and the rules of engagement: testing window, emergency contact
   and data handling. Inventory assets and asset groups are linked on the
   campaign afterwards. Never put passwords here: test accounts belong in
   [Test credentials](#test-credentials).
3. **Team and sign-off**: you are the lead; add testers, reviewers, observers and
   client contacts, and set the optional
   [completion sign-off](#deliver-the-report).

![Step 1 of the New campaign wizard: engagement details, targets, approach, environment and TLP]({{ site.baseurl }}/assets/images/user-guide/pentest-campaign-wizard.png)
*Figure: The creation wizard, step 1.*

**Duplicate** (on a campaign's row menu) starts the wizard from that campaign's
settings, scope, rules of engagement, linked assets, tags, team and completion
policy, under "Copy of ...". You become the lead. Findings, dates, ticket links
and test credentials are not copied.

### The campaign profile

The campaign header shows what is tested, the status, the environment, the TLP
label and the ticket links. The **Engagement** card on the **Overview** tab
holds the profile, which the lead can edit:

- **What is tested**: up to 20 target types. The list is your organization's,
  under [Pentest methodology](#pentest-methodology-and-the-finding-library).
- **Approach**: **Black box** (the testers get no inside information), **Grey
  box** (some, such as a user account or documentation) or **White box** (full
  access, such as source code and architecture).
- **Environment**: Production, Staging, Development or Other.
- **Sharing (TLP)**: the Traffic Light Protocol level printed on the campaign's
  reports, which tells readers how far they may share them:

  | Level | Readers may share it with |
  |---|---|
  | TLP:CLEAR | Anyone; no restriction. |
  | TLP:GREEN | Their community (peers and partner organizations), not publicly. |
  | TLP:AMBER (default) | People in their own organization, and its clients, who need to know. |
  | TLP:AMBER+STRICT | People in their own organization only. |
  | TLP:RED | Nobody: the named recipients only. |

- **Keep this campaign away from AI assistants**: the lead can exclude the
  campaign from every [AI assistant](12-connect-an-ai-assistant.md); the
  organization's TLP limit for assistants can also exclude it.
- **Signed authorization letter**: the signed permission to test, linked from a
  file uploaded to the campaign. The web console picks a file already uploaded
  to the campaign; it has no upload button for campaign files yet, so upload the
  letter with `POST /api/v1/attachments` (`context_type=campaign`,
  `context_id` the campaign id) first. When an owner or administrator turns on
  **Campaigns cannot start without a signed authorization letter** (**Settings ›
  Findings & assets › Pentest methodology**, **Authorization letter**; off by default), a
  campaign cannot move from planning to testing until a letter is linked.

### The campaign page

A campaign's page (`/pentest/campaigns/{id}`) has the tabs **Overview**,
**Findings**, **Retests**, **Report**, **Scope**, **Team**, **Checklist** and
**Rules**. The header carries the phase actions (the next step first, for
example **Finish testing**), **Export** and **Import**.

A **status stepper** under the header shows the campaign's phase and the next
action in words:

| Step | Campaign status | Who adds findings | Next action |
|---|---|---|---|
| Planning | Planning | nobody yet | **Start testing** |
| Testing | In progress | the lead and testers | **Finish testing** |
| Reporting | Reporting | the lead and reviewers (late additions, audited) | **Deliver report** |
| Remediation | Completed | nobody: findings are fixed, retested and closed | **Close campaign** |
| Closed | Archived | nobody: read-only | **Unarchive** returns it to Remediation |

- **Planning**: scope, rules, the authorization letter and the team are
  prepared. Under the stepper, **Ready to start** appears once the dates, the
  authorization letter, a lead and a tester, and the scope are set; otherwise
  the missing items are listed. When your organization requires an
  authorization letter, testing cannot start without one.
- **Reporting**: testing is over. The lead and reviewers decide every draft
  (confirm, reject, mark as duplicate), write the report and collect the
  [completion sign-offs](#deliver-the-report). **Back to testing** returns to
  testing and clears the sign-offs.
- **On hold** pauses testing or reporting: no new findings, existing ones can
  be updated, and **Resume** returns to the phase it was paused in.
- A canceled campaign is marked on the step it interrupted; it can be moved
  back to planning or closed.

Only the campaign lead changes the phase, or an organization owner or
administrator who is a member of the campaign. Every change is audited and the
campaign's members are notified. Starting, resuming and unarchiving run at
once; the other changes ask first.

![A campaign page with its status stepper, header badges and the Findings view]({{ site.baseurl }}/assets/images/user-guide/pentest-campaign.png)
*Figure: A campaign in testing, with its status stepper.*

The other tabs (Findings, Retests and Report are described below):

- **Overview**: the campaign's numbers, the **Engagement** profile, **Tickets**,
  **Test credentials**, description, timeline, methodology, tags and
  objectives.
- **Scope**: **Link Assets**, **Link Asset Groups** and **Manual Scope Items**
  (for targets not in the inventory, with **Bulk import**), in scope or out of
  scope.
- **Team**: add members, change their role or remove them (the lead).
- **Checklist**: the campaign's [methodology checklists](../pentest/checklists.md)
  (OWASP and your organization's own), with a result per item.
- **Rules**: the **Testing Schedule**, **Allowed** and **Restricted** testing
  methods, and **Contacts & Procedures** (emergency contact, communication
  channel, escalation procedure, data handling policy).
If you are not on a campaign's team you have view-only access.

### Campaign roles

Every pentest action checks your organization permission first and your campaign
role second. A campaign role never grants an organization permission.
Organization owners and administrators can act on every campaign; an action that
skips a campaign rule asks them for a reason and is audited.

| | Lead | Tester | Reviewer | Observer | Client |
|---|---|---|---|---|---|
| See drafts and findings in review | yes | yes | yes | yes | no |
| See published findings | yes | yes | yes | yes | yes |
| Add findings | testing, reporting | testing | reporting | no | no |
| Edit findings | yes | own | yes | no | no |
| Mark a draft as a duplicate | yes | no | yes | no | no |
| Publish a finding | yes | no | yes | no | no |
| Request a retest | yes | own | yes | no | yes |
| Record a retest result | yes | own (cannot resolve) | yes | no | no |
| Accept the risk, mark a false positive | yes | no | yes | no | no |
| Generate and deliver reports | yes | no | no | no | no |
| Change the phase, manage the team, links and sign-off policy | yes | no | no | no | no |
| Sign off the report | if the policy names the role | no | if named | no | if named |
| List, add and reveal test credentials | yes | yes | list and reveal | no | no |

"Own" means findings the tester created or is assigned. The client role is for
the tested organization's people: they see published findings, request retests
when a fix is in place, and sign off when the policy asks them to.

### Test credentials

Test accounts and keys for the engagement go in **Test credentials** on the
**Overview** tab, never in a description or the rules of engagement. **Add
credential** stores a label, a kind (password, API key, token, SSH key,
certificate, other), an optional username and the secret. The secret is
encrypted with the installation's encryption key and never shown in a list.

- **Who.** The lead and testers add credentials; the lead, testers and reviewers
  list and reveal them. Organization owners and administrators must be on the
  campaign team to see them, so every reveal names a team member. A credential
  is deleted by the lead, the member who added it, or an organization
  administrator.
- **Reveal.** **Reveal** shows the value once and hides it again after a few
  seconds. Every reveal is recorded in the audit log at high severity, and the
  credential shows when it was last revealed.
- **Limits.** At most 50 credentials per campaign, 16 KiB each.
- **Archive.** Archiving the campaign deletes its credentials; deleting the
  campaign does too.

### Tickets and Jira

**Tickets** on the **Overview** tab links the campaign to up to five https
links, for example the engagement ticket in any tracker (**Edit links**, the
lead). Never paste tokens or passwords into a link: credentials in a link are
refused, and the query and fragment are dropped.

With [Jira connected](10-settings-and-integrations.md), **Find a Jira issue or
epic** searches your Jira site by key or summary, through the organization's
integration (the credential never reaches the browser), and links the issue. A
Jira link must be on your organization's connected Jira site.

On a linked Jira epic, **Create tickets for open findings** creates a Jira
ticket, as a child of the epic, for each open published finding (Confirmed, In
Progress, Fix Applied; at most 100 per run) that has no ticket in the epic's
project yet. The result says how many were created, already had one, or failed.
Status sync then works as for any finding ticket. Link changes and ticket runs
are audited.

### Findings of a campaign

The **Findings** view lists the campaign's findings (most severe first), with
the cards **All findings**, **Critical**, **High**, **Medium**, **In progress**
and **Resolved**, search by title, CWE or CVE, and filters.

- **New finding** opens the finding editor (below).
- A row's menu: **View details**, **Edit**, **Copy ID**, **Export** (the full
  finding as JSON: proof of concept, CVSS vector, impact, references) and
  **Delete**.
- Select findings to **Request retest** for all of them at once.

Who can add a finding depends on the phase: the lead and testers while
testing, the lead and reviewers while reporting (organization owners and
administrators act as the lead). In planning, on hold, after the report is
delivered, and on canceled or closed campaigns nobody can. When you cannot,
**New finding** is replaced by a note that says why, with the phase action
(for example **Start testing** or **Reopen testing**) for those who may take
it. After delivery, fixing, retesting and closing published findings
continue. Deleting a campaign deletes its findings too and cannot be undone.

**Drafts from AI applications.** An AI application connected over MCP can save a
pentest finding as a draft when your organization's AI assistants policy allows
the `mcp:pentest.draft` scope (off by default; see
[Connect an AI assistant](12-connect-an-ai-assistant.md)). The draft is saved in the
name of the person who connected the application, is never visible to the
campaign client, and shows **Proposed by AI application**. The person who
connected the application cannot confirm the finding it drafted: another campaign
member (a reviewer or the lead) does.

**Duplicate**: in a finding's **Status** menu, the lead or a reviewer marks a
draft or a finding in review as a duplicate of another finding of the same
campaign, chosen in a list. The duplicate keeps its history and is never
published; **Draft** in the same menu takes it back.

### Write a finding

The finding editor (**New finding**, or **Edit** on a finding) is one page with
a summary card that shows what is still missing (**Ready to submit**).

- **Start from the finding library**: **Use a template** searches your
  [finding library](#pentest-methodology-and-the-finding-library) and fills the
  description, classification, steps, impact and remediation. Fields you
  already wrote stay; switching to another template replaces only the text the
  previous one filled in.
- **Title**, **Severity** (one click) and the **Campaign**.
- **Affected targets**: URLs, hosts, endpoints or files. Type a target, or
  search your inventory: assets in the campaign's scope come first, each with
  why it matches (named in the campaign, in a campaign asset group, covered by a
  scope item) or why not (excluded by an item, not in the campaign scope). One
  target can be the **linked asset**, which counts the finding on dashboards and
  asset risk; the link is set when the finding is created. At least one target
  is required.
- **Description**, **Proof of concept**, impact and remediation are Markdown.
  Paste or drop a screenshot into any of them: it is uploaded as evidence of the
  finding and inserted where you pasted it. Use a code block with a language for
  requests, responses and payloads.
- **Steps to reproduce**: one box per step. Reorder them by dragging the handle,
  with **Move up** and **Move down**, or from the keyboard (Space on the handle,
  then the arrow keys). Each step's menu duplicates, inserts below or deletes it
  (with **Undo**).
- **CVSS**: a calculator for CVSS 3.1 and 4.0. Paste a vector or pick the
  metrics; the score is computed by the FIRST specification and suggests a
  severity.
- **Classification**: searchable **CWE** and **OWASP Top 10** pickers, plus CVE
  and MITRE ATT&CK technique.
- **Assignment and tags**, and references.

A new finding is kept as a draft in your browser while you type (until you sign
out or switch organization), and offered again with **Restore draft** next time;
leaving the page with unsaved changes asks first. Ctrl+S (Cmd+S) saves and
Ctrl+Enter (Cmd+Enter) runs the main action.

The save buttons follow your campaign role:

| Button | Result | Who |
|---|---|---|
| **Save draft** (or **Save draft and start another**) | Draft: only the team sees it. | Lead, tester |
| **Submit for review** | In Review: waits for a reviewer or the lead. | Lead, tester |
| **Publish** | Confirmed: published, visible to the client, the remediation deadline starts. | On a new finding: the lead (and organization owners and administrators). On a finding in review: the lead or a reviewer. |

#### Confirm with a proof basis

Moving a pentest finding to Confirmed (publishing a new one, or confirming one in
review) asks for its **Proof basis**, how the finding was established, in the
**Confirm this finding** dialog:

- **Executed live**: the attack was run against the live target.
- **Executed in a lab**: the attack was run in a lab or staging copy.
- **Inferred from code or configuration**: concluded from code, configuration or
  headers without running the attack.

Clients and approvers read the basis next to the finding. The dialog also lists
what is still missing: steps to reproduce, an evidence item with the **Proof**
role, the impact and an affected target. The list advises and never blocks.

Without a basis the confirmation is refused. A person who may confirm the finding
can choose **Confirm without a proof basis** and give a **Reason** (10 to 500
characters). The reason is kept on the finding with who and when, the finding
shows **Confirmed without a proof basis**, and the audit log records
`finding.proof_basis_overridden`. A finding that is already confirmed is not
asked again; the rule applies to the next move to Confirmed. API clients that
confirm pentest findings send `proof_basis` (`executed_live`, `executed_lab` or
`static_unexecuted`); without it the API answers `422 PROOF_BASIS_REQUIRED`.

#### Evidence, request and response, and the write-up

A finding's evidence has roles and an order, set from the finding's **Evidence**
tab (see [Exposures and findings](05-exposures-and-findings.md#the-full-page)).
Saving a pentest finding records its **evidence version**. When evidence is added,
removed, re-roled or reordered afterwards, the finding sheet and the editor show
**Evidence changed since this write-up** until the finding is saved again. If you
opened the editor before new evidence arrived, saving is refused as a conflict
(`409`): reload, check the text against the current evidence, and save again.

HTTP requests and responses recorded on a pentest finding (through the API, the
Burp Suite import or an AI application's draft) are stored as evidence, not in
the finding's own fields. Session cookies, bearer tokens, API keys and passwords
in them are masked in the stored item; the secret values are encrypted apart and
shown only through **Reveal** by people with the **Reveal Evidence Secrets**
permission and a recent sign-in, for 60 seconds, each reveal audited. The finding
page and the sheet show them in the shared evidence viewer under **HTTP
request/response**. A finding keeps at most 50 recorded exchanges; an exchange
already on the finding is skipped when sent again. They are kept as long as the
finding (the evidence retention does not delete them), and their secret values
expire with the organization's evidence secret retention. Evidence records count
against the organization's daily evidence budget (`EVIDENCE_DAILY_CAP`; see
[Environment variables](../configuration/environment-variables.md)); over the
budget a manual add is refused.

The API response of a pentest finding no longer carries `request_responses`: read
them with `GET /api/v1/findings/{id}/evidence-items`.

### Retests

When a fix is in place, anyone who may request a retest (see
[Campaign roles](#campaign-roles)) uses **Request retest** on the finding, with
an optional note on what was fixed. The finding moves to **Fix Applied** and
appears in the campaign's **Retests** view and the
[Retest queue](#retest-queue). The assignee and the author are notified.

A retest is recorded with **Retest** in either place. Each retest keeps the
finding's status before and after it, so the retest history and the retest
report show, for example, "Fix Applied → Resolved".

### Deliver the report

**Deliver report** (the lead, during reporting) moves the campaign to
remediation. The dialog lists what delivering means: findings still in draft
or review, published findings that stay open for remediation and retest,
reports generated and delivered, and the sign-offs. Findings in draft or
review block delivery: confirm, reject, mark as duplicate or delete them
first.

**Completion sign-off** (off by default) asks a number of people (0 to 5) from
chosen roles (lead, reviewer, client) to agree with the report before it is
delivered. Set it in the wizard or on the **Completion sign-off** card on the
campaign.

- Each person counts once. With two or more sign-offs required, the lead cannot
  meet the policy alone.
- Members with a named role use **Sign off** on the completion card while the
  campaign is in reporting, and can **Withdraw my sign-off**.
- The lead can raise the policy at any time before delivery, but lower it only
  during planning; after that only an organization owner or administrator can
  lower it.
- An organization owner or administrator can deliver without the sign-offs by
  giving a reason (audited at high severity); a lead cannot.
- Going back to testing clears the sign-offs.

A delivered campaign shows **Report delivered, remediation open** with the
number of findings awaiting a fix or a retest. **Reopen testing** takes it back
to testing; it asks for a reason, which is audited. **Close campaign** when
remediation is over: closing makes it read-only, stops retests and deletes its
test credentials.

### Reports

The **Report** view generates the engagement deliverable (the lead):

1. Click **Generate report** and choose the **Report type**: Executive summary,
   Technical report, Findings report, Compliance report, Remediation report or
   Retest report.
2. Choose the **Format**: PDF, HTML, JSON or **Word (DOCX)**. Word reports use
   your organization's own templates; see the
   [Report template guide](../pentest/report-templates.md).
3. Choose the content: proofs of concept, unpublished findings (left out by
   default), severities, statuses, the **Document classification** and an
   optional watermark. Reports carry the campaign's TLP label; the built-in
   PDF and HTML reports also show the methodology checklist coverage.
4. **Generate report**, then **Download**. **Mark delivered** records that the
   report went to the client.

Every campaign's reports are also listed under **Insights › Reports › Pentest**.

## Retest queue

**Validation › Retest queue** (`/validation/retests`) lists findings that were
fixed and need re-verification, across campaigns. It is the "prove it again"
step: after the developers report a fix, a tester checks that the issue is gone.

![The Retest queue listing pentest findings waiting for re-verification]({{ site.baseurl }}/assets/images/user-guide/retest-queue.png)
*Figure: The Retest queue.*

1. The cards: **Pending**, **Retested**, **Passed**, **Failed** and **Success
   rate**.
2. Search, and filter by severity and campaign (or **All campaigns**).
3. **Pending** lists findings being fixed (In Progress) or fixed and waiting for
   the retest (Fix Applied); **History** lists the retests recorded, each with
   the finding's status before and after it.
4. **Retest** (needs the retest write permission) opens **Record retest
   result**:
   - **Result**: **Passed**, **Failed**, **Partial** or **Unable to verify**.
   - **Test environment**: Production, Staging, QA or Development.
   - Notes (required; Markdown supported) and optional **Evidence**
     (screenshots, HAR files).

What happens next:

- **Passed** by a lead or reviewer: the finding becomes **Resolved**, with the
  resolution method `retest_verified`. Passed by a tester: it stays in **Fix
  Applied** until a reviewer confirms.
- **Failed**: the finding goes back to **In Progress** for the developers.
- **Partial**: the partial fix is recorded and the status stays unchanged; the
  lead or a reviewer decides what happens next.
- **Unable to verify**: the fix could not be checked (for example the
  environment is down or the credentials expired). The notes must say why (at
  least 10 characters); the finding stays in **Fix Applied** and can be
  retested.

Retests continue after the report is delivered; a closed campaign must be
unarchived first.

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

**Settings › Findings & assets › Pentest methodology** (`/settings/pentest`) has four
tabs.

- **Methodology**: the **Target types** a campaign's **What is tested** offers
  (each a value and a display label, for example External network, Web
  Application, API Testing, Cloud Infrastructure), the **Methodologies** (for
  example OWASP Testing Guide, PTES, NIST SP 800-115, OSSTMM, CREST), and
  **Authorization letter**: **Campaigns cannot start without a signed
  authorization letter** (off by default). **Reset to defaults** restores the
  built-in lists; at least one target type is required.
- **Checklists** (`/settings/pentest/checklists`): the built-in OWASP and PTES
  checklists and your organization's own, written, cloned or imported from a
  spreadsheet. See [Methodology checklists](../pentest/checklists.md).
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
- **Report templates** (`/settings/pentest/report-templates`): your
  organization's Word layouts for campaign reports. Download a starter
  (standard, executive one-pager or detailed technical), open the **Tag
  reference**, upload a template (it is checked at once, with every problem
  and its fix listed) and preview it with sample data. See the
  [Report template guide](../pentest/report-templates.md).
