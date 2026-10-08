---
title: Mobilization
parent: User guide
nav_order: 8
---

# Mobilization

**CTEM stage 5.** Mobilization turns what you found and prioritized into
**remediation that is tracked until it is closed**, and **automates** the
repetitive steps. It is where risk actually goes down, not just where you learn
about it.

The pages are under **Mobilization** in the sidebar:

- **Remediation**: tasks and campaigns that turn findings into owned work with a
  priority, a due date and progress (tab **Tasks**), and **Solution families**
  that resolve a whole family of findings with one fix.
- **SLA Compliance**: how open findings stand against their deadlines.
- **Exceptions**: suppression rules for false positives and accepted risks, with
  an approval step.
- **Automations**: "when something happens, do something": notify, assign, open
  a ticket or run a saved scan.

Around them sit the capabilities that carry remediation to the finish:
engineering-grade tickets in Jira, SLA policies, program health and a scope
refinement loop back to Scoping. Repeating scans with a multi-step **scan
workflow** is part of [Discovery](04-discovery.md#scan-workflows).

Creating and editing tasks needs the remediation write permission; creating and
running automations needs the workflows write permission.

## Remediation tasks

**Mobilization › Remediation › Tasks** (`/remediation`) tracks the work of fixing
findings: who owns it, where it stands and when it is due. Each task is a
**remediation campaign**: it can group many findings and shows how many are
linked and resolved.

![The Remediation tasks page with two campaigns, their priority, status and assignee]({{ site.baseurl }}/assets/images/user-guide/remediation.png)
*Figure: Remediation tasks.*

1. The header has **Refresh**, **Export** (**Export as CSV** or **Export as
   JSON**) and **New task**.
2. The quick filters **All tasks**, **Open**, **In progress**, **In review**,
   **Blocked** and **Overdue** each show a count; the filter panel narrows by
   priority, status and assignee.
3. Switch between **Table view** and **Kanban view**:
   - The table shows each **Task** (with its linked findings), **Priority**,
     **Status**, **Assignee** (or Unassigned) and **Due date** (days left or
     overdue).
   - Kanban shows one column per status; each card shows the assignee, due date
     and an overdue flag.
4. **New task**: the **Title** (required), a description, the priority
   (**Urgent**, **High**, **Medium**, **Low**), the **Due Date**, **Assign to…**
   and **Link Findings** (pick open findings). Click **Create Task**.
5. A task's menu: **View details**, **Open campaign**, **Create Jira epic**,
   **Copy ID** and **Delete**, plus the status steps that fit its current status
   (**Start Task**, **Submit for Validation**, **Block**, **Unblock**,
   **Complete**).
6. Click a task to open its details: rename it, change its priority, see its
   progress and linked findings (**Manage** to link more, or unlink one), assign
   an owner and a **Validator**, set the start date and description.
7. Select several tasks to **Move to** In progress, Review or Completed at once.
   Tasks that cannot move from their current status are reported.

### The campaign page

**Open campaign** opens the campaign (`/remediation/{id}`). Its status is one of
**Draft**, **Active**, **Paused**, **Validating**, **Completed** or **Canceled**,
with the actions **Activate**, **Pause**, **Resume**, **Start Validation**,
**Complete** and **Cancel**. It shows the description, priority, progress (it
auto-completes when all its findings are resolved), start and due dates, owner,
validator, risk reduction and tags.

![A remediation campaign page with its progress, dates and owner]({{ site.baseurl }}/assets/images/user-guide/remediation-campaign.png)
*Figure: A remediation campaign.*

- **Resolve open findings** applies one outcome to all of the campaign's open
  findings: **Fix applied — pending rescan verification (recommended)** or
  **Resolved — close now**, with an optional note (for example a change
  reference). Large bulk resolutions ask you to confirm.
- For each linked finding: **Open finding**, **Create ticket** or **Unlink from
  campaign**.
- **Create Jira Epic** pushes the campaign to Jira: enter the **Jira project
  key** (for example `SEC`). It needs a connected Jira integration (see
  [Ticketing](10-settings-and-integrations.md#ticketing)).

### The engineering ticket brief

A ticket is only useful if an engineer can fix the issue without coming back with
questions. On a finding's **Remediation** tab, the **Definition of Done &
Acceptable Fixes** card records:

- **Definition of done (success criteria)**;
- **How we verify the fix**;
- **Preferred fix**;
- **Alternative acceptable fixes** (**Add alternative**).

Click **Edit**, fill in the fields and **Save** (needs `findings:write`). When a
ticket is created for the finding (Jira, or GitHub Issues through the API and
automations when a GitHub source-control connection exists), the platform adds a
Markdown block with **Definition of done**, **Verification** and **Acceptable
fixes** (preferred and alternatives) to the ticket body. The block is added only
when you have filled in at least one field, and it only ever contains your
guidance, never a secret from the finding.

## Solution families

**Mobilization › Remediation › Solution families** (`/remediations`) groups the
open findings that share **one fix**, for example "upgrade library X to version
Y", which can close dozens of findings across many assets at once.

Each family shows the fix, its findings and its assets. For a family you can:

- **Track as campaign**: create a remediation campaign for it;
- **Resolve all**: resolve every finding in the family in one step (through the
  normal bulk-update path, with its limits).

A solution family resolves a group of findings quickly; a remediation task is a
piece of work with an owner, a lifecycle and progress. The list is also
available through the API (`GET /api/v1/findings/remediation-groups`) and the
MCP tool `list_remediation_groups`.

## SLA policies

**Settings › Policies › SLA policies** (`/settings/sla-policies`) is where you
**define** remediation deadlines.

- The **default policy** applies to every finding:
  - a finding with a priority class (P0 to P3) gets its deadline from the
    **priority-class window**;
  - a finding without a class yet uses its **severity window**;
  - the finding turns **warning** once the policy's **Warning threshold (%)** of
    its window has passed, and **overdue** at the deadline;
  - **Deadline notifications** (on by default) decide whether the warning and the
    breach are sent to your notification channels. The status changes either
    way.
- Without a policy the platform defaults apply: **P0 2 days, P1 5, P2 15,
  P3 30**. Create the default policy to set your own windows.
- Click **New policy**, give it a **Name** and **Description**, set the windows
  in days and the warning threshold, and tick **Make this the default policy**.
  Only the default policy applies to findings.
- Saving a policy changes deadlines computed from then on, not deadlines already
  set.

## SLA compliance

**Mobilization › SLA Compliance** (`/sla`) is where you **monitor** deadlines:
open findings tracked against their remediation SLA.

- The cards: **SLA exceeded**, **Overdue**, **Warning** and **On track**.
- **Breaches by severity** and **Aging of breaches** (1-7, 8-30, 31-90 and 90+
  days past due).
- **Breached findings** lists the findings past their deadline.

This page reports status; SLAs are configured under SLA policies. SLA compliance
also appears on the Executive summary and Program health dashboards.

## Exceptions

**Mobilization › Exceptions** (`/exceptions`) holds suppression rules that hide
false positives and accepted risks, with an approval step.

1. Click **New rule**. Enter a **Name** (for example "Ignore test-fixture
   secrets"), the **Type**, a **Description** (why the findings are suppressed),
   and what it matches: a **Rule ID** (for example `semgrep.sql-injection`)
   and/or a **Path pattern** (for example `tests/**`), optionally narrowed by
   **Tool name**. At least a rule ID or a path pattern is required. Set
   **Expires** or leave it blank for a rule that never expires.
2. The rule is **Pending approval** until someone **other than the requester**
   approves it. The one exception: when the owner is the only person who can
   approve, the owner may approve their own rule, and that self-approval is
   recorded as a critical audit event.
3. Approvers click **Approve**, or **Reject** with a reason.
4. Rules can be edited or deleted. If a rule changes after you opened it,
   approving fails; reload and review the current version.

The tabs show **All rules**, **Pending approval**, **Approved**, **Rejected** and
**Expired**. When a rule expires or is deleted, the findings it hid return to the
open backlog (unless another active rule covers them).

## Automations

**Mobilization › Automations** (`/automations`) runs actions when something
happens, for example "when a critical finding is created on a production asset,
assign it to a senior engineer, alert Slack and open a Jira ticket".

1. The cards: **Active**, **Total runs** and **Success rate**.
2. Three tabs:
   - **Workflows**: each automation with its status, trigger, last run and run
     count. A switch turns it on or off; the menu has **View details**, **Edit in
     builder**, **Duplicate** and **Delete**.
   - **Recent executions**: each run with its status, time and how many steps
     completed.
   - **Visual builder**: the canvas.
3. **New workflow** asks for a **Name** and an optional description. The new
   automation starts with a manual trigger; then open the builder.

### The visual builder

- Click or drag steps onto the canvas: **Trigger**, **Condition**, **Action**
  and **Notification**, then connect them from a step's handle. A condition has
  **Yes** and **No** branches.
- Select a step to set it up:
  - **Trigger**: **Manual**, **Finding Created**, **Finding Status Changed**,
    **Asset Discovered** or **Scan Completed**, with an optional JSON filter.
  - **Condition**: an expression such as `finding.severity == critical`.
  - **Action**: **Assign User**, **Update Status**, **Add Tags**, **Remove
    Tags**, **Create Ticket**, **Update Ticket**, **Trigger Scan** (pick a saved
    scan) or **HTTP Request**.
  - **Notification**: pick one of your notification channels.
- An automation needs at least one trigger. Click **Save workflow**.

Older automations that use a trigger or action the platform no longer supports
are marked **Uses an unsupported step** and never fire with it; choose another
before saving.

## Measure results and close the loop

Mobilization only matters if **risk actually goes down** and the lessons **feed
back into Scoping**.

- **Program health** (`/insights/program-health`) is the outcome scorecard:
  remediation completion and time for urgent findings, asset owner coverage,
  re-open rate, SLA compliance, the exposure trend and the validation downgrade
  rate. A metric without enough data shows **Not measured** rather than a made-up
  number. See [Insights and reports](09-insights-and-reports.md#program-health).
- **SLA compliance**: every finding has a deadline from its priority class (your
  SLA policy); overdue findings raise escalations. On the Tasks page, watch the
  **Overdue** filter and the due dates.
- **Scope refinement**: when you review and close a CTEM cycle, record **Scope
  refinement** notes: what this round taught you about next round's scope. The
  notes of the last closed cycle are shown when you plan the next one. This is a
  deliberate manual loop, written by people, not generated from remediation data.
  See [Scoping](03-scoping.md#ctem-cycles-start-here).
