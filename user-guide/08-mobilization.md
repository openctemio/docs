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

- **Remediation**: the **Fix plan**, **Suggestions** of findings that one fix
  closes, **Tasks** that give each fix an owner and a deadline, and
  **Campaigns** that track many fixes toward one goal.
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

A **remediation task** is one fix with one owner and one deadline: "upgrade
django to 4.2.30 on the payment services", "rotate the leaked AWS key". It holds
the findings that this fix closes. The platform suggests tasks; a person
accepts them. Nothing is created or changed until someone accepts.

The Remediation pages have four tabs: **Fix plan**, **Suggestions**, **Tasks**
and **Campaigns**. Findings that one fix closes are listed under Suggestions;
the API list `GET /api/v1/findings/remediation-groups` and the MCP tool
`list_remediation_groups` return them for API and MCP clients.

### The fix plan

**Mobilization › Remediation › Fix plan** (`/remediation`) lists the fixes that
remove the most risk, whether they are already tasks or still suggestions, with
counts of open tasks, overdue tasks, suggestions to review and your own tasks.

### Suggestions

**Suggestions** (`/remediation/suggestions`) groups open findings that one fix
closes: the same package upgraded to the same version, the same leaked secret,
or the same specific solution from the scanner. Each card shows the fix, how
many findings and assets it covers, the risk it removes (by priority class) and
who it would go to: the asset's primary owner, or the default queue when the
asset has none.

- **Why?** explains the grouping and shows the fix steps, for example the
  upgrade command to copy.
- **Accept** creates the fix and one task per owner. When the fix is already a
  task for that owner, accepting adds the findings to it.
- **Edit** lets you change the task title and owners, leave findings out (they
  are not suggested for this fix again), set a deadline (it can only make the
  deadline earlier) and turn on **auto-join**: new findings with the same exact
  fix then join the owner's open task by themselves, at most 200 a day. Auto-join
  never changes a finding's status.
- **Dismiss** asks for a reason. A dismissed suggestion comes back only when it
  changes a lot: many more findings, twice the risk, or a P0 or KEV finding.
- **Snooze** hides a suggestion for seven days. Dismiss and snooze can be undone
  from the message that confirms them.
- Select several suggestions and **Accept selected** to accept them in one go
  (up to 50).
- Review with the keyboard: **j**/**k** move, **a** accepts, **e** edits, **d**
  dismisses (then **1**–**7** pick the reason), **s** snoozes, **x** selects and
  **?** shows why.

At most 50 new suggestions appear per day; the rest wait for the next day.
Reviewers get one daily notification when new suggestions arrive. **Refresh
now** looks for new suggestions right away.

### Tasks

**Tasks** (`/remediation/tasks`) has views for **All open**, **My tasks** (yours
and your groups'), **Verifying**, **On hold**, **Closed** and **All**, a search,
a sort (deadline, risk, recently changed, newest), and a table or a board.

A task's **state** follows its findings:

- **Open**: nobody has started;
- **In progress**: some findings are being fixed or claimed fixed;
- **Verifying**: every open finding is claimed fixed and waits for its own check;
- **Done**: every finding is closed **and at least one was verified fixed** (by a
  scan, a retest or a reviewer);
- **Closed, not verified**: every finding is closed, but none was verified
  fixed;
- **On hold** and **Canceled** are set by a person; **Archived** means the task
  lost its last finding to a move.

The **deadline** is the earliest SLA deadline of the task's open findings. A
deadline set on the task, or a campaign's due date, can only make it earlier. On
the board only **On hold** can be set by dragging a card.

### A task

Click a task to open it.

- **Fix** shows what to do, with the command to copy for an upgrade.
- **Progress** counts verified, closed, claimed and open findings.
- **Findings** are grouped by asset. Select findings to **Move to…** another
  task (the platform warns you before it hands findings to another owner or
  another fix, or empties this task), to take them out of any task, or to
  **Split** them into a new task of the same fix. You can also drag findings
  onto a task of the same fix. Every move can be undone from its message.
- **Mark fixed** claims the fix for every open finding of the task (a note is
  required; you can claim the findings you own or are assigned, and, as the
  task's owner, every finding of the task). Each finding is
  then checked again on its own; nothing closes until its own check passes.
- **Put on hold**, **Resume** and **Cancel task** (with a reason; a canceled
  task releases its findings) are in the menu.
- The **Timeline** records every change, and each finding's own timeline names
  the tasks it joined and left.

If a finding of a done task comes back, the task is not reopened: the finding
moves to a new task, "Regression: …", linked to the done one.

Managing tasks needs the remediation write permission; **Mark fixed** also needs
the permission to mark findings fixed. Members who see only part of the
organization see a task through their own findings and cannot change a task
that has findings outside their access.

#### If you own a task

The owner of a task, or a member of the team that owns it, can open the task's
findings even when the findings' assets are outside their access, and see a short
card of each asset. They see only the findings of that task, never the asset's
other findings. They can comment, start work, go back to confirmed, **Mark fixed**,
add an evidence note and request a re-check, each with its usual permission.
Marking a finding a false positive, accepting its risk, resolving it, changing its
severity, reassigning it and deleting it need access to the finding's asset; those
moves show greyed out in the status menu, with the reason.

The access lasts only while you own the task: it ends when the owner changes, when
a finding leaves the task, when the task is closed or canceled, and when your team
membership ends or expires. Each move made this way is recorded in the audit log as
"task owner moved finding".

### Campaigns

**Campaigns** (`/remediation/campaigns`) are programs that track many fixes
toward one goal and deadline. A campaign's status is one of **Draft**,
**Active**, **Paused**, **Validating**, **Completed** or **Canceled**; open one
(`/remediation/campaigns/{id}`) to see its progress, dates, owner, validator and
findings, to **Resolve open findings** (each is claimed fixed and checked again
on its own) and to **Create Jira Epic**.

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

## SLA policies

**Settings › Findings & assets › SLA policies** (`/settings/sla-policies`) is where you
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

**Mobilization › Exceptions** (`/exceptions`) holds suppression rules: an
organization's decision that a class of findings is a false positive or an
accepted risk, with an approval step.

1. Click **New rule**. Enter a **Name** (for example "Ignore test-fixture
   secrets"), the **Type** (false positive, accepted risk or won't fix), a
   **Description** (why the findings are suppressed), and what it matches: a
   **Rule ID** (exact, or a prefix ending in `*`) and/or a **Path pattern**
   (`*` and `**` globs, for example `tests/**`), optionally narrowed by
   **Tool name**. At least a rule ID or a path pattern is required. Set
   **Expires** or leave it blank for a rule that never expires.
2. The rule is **Pending approval** until someone **other than the requester**
   approves it. The one exception: when the owner is the only person who can
   approve, the owner may approve their own rule, and that self-approval is
   recorded as a critical audit event.
3. Before approving, the dialog says how many open findings the rule matches
   now. **Approve** closes them in the same step: false positive for a
   false-positive rule, accepted for an accepted-risk or won't-fix rule. Each
   closed finding gets an activity naming the approver and the rule. Or
   **Reject** with a reason.
4. Rules can be edited or deleted. If a rule changes after you opened it,
   approving fails; reload and review the current version.

What an approval closes:

- Only open work. A false-positive rule closes new, confirmed, in-progress,
  fix-applied and not-observed findings. An accepted-risk rule leaves work in
  progress alone, because someone decided to fix it.
- Never findings already decided or resolved, and never findings a person
  reported (pentest, manual, bug bounty, red team).
- At most 10,000 findings per approval. Beyond that the dialog says so; the
  rest stay open, and the rule still applies to them in the CI gate and on
  new findings.

After approval the rule also applies to new findings as they arrive. A new
finding a rule closes at ingest raises no alert: no notification, no ticket
and no SLA deadline. The CI gate does not count a finding an active rule
covers.

Some requests come from repositories, not from people: an exception in a
repository's `.openctem.yml`, an inline ignore comment in the code, or a
scanner ignore file. A CI run on the default branch turns each of these into
a pending accepted-risk rule for that repository, expiring in 90 days, and the
rule names the CI identity as its requester. See
[Known false positives](known-false-positives.md#claims-in-the-repository).

The tabs show **All rules**, **Pending approval**, **Approved**, **Rejected** and
**Expired**. When a rule expires or is deleted, the findings it closed reopen
as New (unless another active rule covers them). A finding someone changed
since is left alone.

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
