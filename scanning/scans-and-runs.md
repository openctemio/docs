---
title: Scans and scan runs
parent: Scanning
nav_order: 3
---

# Scans and scan runs

A **scan** says what to scan, with which tool or scan workflow, and when. Each
time it fires, it creates a **scan run**; the run is split into **steps** (one
per tool or workflow step), and each step is cut into **tasks** that sensors
claim and run. Results flow back into the inventory, and the next steps take
what the earlier ones found.

```mermaid
flowchart LR
    SC["Scan<br/>(definition)"] -->|"fires"| RUN["Scan run"]
    RUN -->|"has"| ST["Steps"]
    ST -->|"cut into"| TK["Tasks"]
    TK -->|"claimed by"| SEN["Sensors"]
    SEN -->|"results"| INV["Assets, findings,<br/>exposures"]
    INV -->|"outputs feed<br/>the next step"| ST
```

| Term | Meaning | API |
|---|---|---|
| **Scan** | What to scan, how, and when | `/api/v1/scans` |
| **Scan run** | One execution of a scan | `/api/v1/scan-runs` |
| **Step** | One step of a run: a single tool, or one step of a [scan workflow](scan-workflows.md) | in `GET /api/v1/scan-runs/{id}` |
| **Task** | One unit of sensor work of a step: one tool on a slice of the targets, held by one sensor under a lease | `GET /api/v1/scan-runs/{id}/tasks` |

Everything is under **Discovery > Scans**, with the tabs **Scans**, **Runs**,
**Workflows** and **Approvals**. Reading needs `scans:read`; creating, editing and
canceling need `scans:write`; running needs `scans:write` and
`scans:execute`.

## Scans

A scan has:

- **Targets**: names, addresses, CIDRs or URLs typed directly, and asset
  groups. Group members are read when the run starts. At most 10,000
  resolved targets per scan. Archived assets are skipped; stale ones are
  scanned (a scan is how they are seen again). A wildcard (`*.example.com`)
  and an address range are expanded when each run starts: see
  [Your first scan](index.md#your-first-scan).
- **What to run**: a single tool with its settings, or a scan workflow.
- **Scan zone**: **Automatic** (route each target to its zone) or one zone
  ([Scan zones](../sensors/zones.md)).
- **Schedule**: manual, once (at a date and time from a minute to a year
  ahead), daily, weekly or monthly at a time, a cron expression, or a recurrence
  rule (RFC 5545 `RRULE` parts, for example `FREQ=WEEKLY;BYDAY=MO;BYHOUR=2`),
  in a time zone you choose. Schedules more frequent than every 15 minutes are
  refused. The scan page lists the next occurrences
  (`POST /api/v1/scans/schedule-preview`).
- **Max duration** (optional, under **Advanced: job size, timeout and
  retries**): from 30 seconds to 24 hours. Empty means no limit of its own:
  the workflow's timeout applies, else the platform's 24-hour cap. Clearing
  the field (or sending `timeout_seconds: 0`) removes it. See
  [Run deadline](#run-deadline).
- **Targets per job**: how many targets one sensor task scans.
- **Retries**: up to 10, with a backoff (default 60 seconds).
- **Status**: `active`, `paused` or `disabled`. Only active scans run on
  their schedule.

![The Scans page listing three scans with their workflow, last run, success rate and schedule]({{ site.baseurl }}/assets/images/scanning/scans-list.png)
*Figure: Scans.*

Creating or editing a scan runs the [scope gate](scope.md) on its direct
targets: a target your organization may not probe refuses the whole request
(`TARGET_OUT_OF_SCOPE`, each target with its reason).

Other actions:

- **Edit** (scan page header and the scan's menu in the list): every setting,
  targets and asset groups included. A cron or recurrence schedule is kept.
  When scan approvals are on, a scan whose targets changed needs approving
  again.
- **Clone** (same places): a copy with a new name that keeps every setting,
  intensity included, and **starts paused**. It passes the same checks as a
  new scan.
- **Quick scan**: one scanner on up to 1,000 targets now, without saving a
  scan (**Save as scan** keeps it). It needs `scans:write` and
  `scans:execute`. A quick scan never run again is archived after 30 days.
- Pause, activate and disable; export and import
  (`GET /api/v1/scans/{id}/export`, `POST /api/v1/scans/import`); bulk
  activate, pause, disable and delete.

## Starting a run

A run starts only from a scan (a quick scan creates an unsaved one), so every
run passes the same gate:

- **Run now** in the console, or `POST /api/v1/scans/{id}/trigger`;
- **Quick scan**;
- the scan's **schedule**;
- an [automation](scan-workflows.md#automations-are-different) step;
- an automatic **retry** of a failed run.

Retests and validation of findings also create runs; the Runs list shows the
kind of each run (**Scan**, **Quick scan**, **Retest**, **Validation** and
others) and can filter by it.

When a run starts, the targets are resolved (direct targets and group
members), checked against scope, exclusions and the actor's access, routed to
zones and cut into tasks. If nothing can run, the trigger is refused before a
run exists, for example `NO_TARGETS`, `ALL_TARGETS_EXCLUDED`,
`NO_ZONE_COVERAGE`, `ZONE_SPLIT_REQUIRED`, `NO_SENSOR_FOR_TOOL`,
`TOOL_DISABLED`, `WILDCARD_TARGET`, `MAX_CONCURRENT_RUNS` or
`SCAN_WINDOW_NEVER_OPENS`. **Run now** shows the reason with a fix.

The whole path of a run, from the trigger to its final status:

```mermaid
sequenceDiagram
    autonumber
    actor U as Person, schedule or automation
    participant API as API
    participant DB as PostgreSQL
    participant S as Sensors of the zone
    participant W as Ingest worker
    U->>API: trigger the scan
    API->>API: scan active? tools enabled? a sensor online for each tool?
    API->>API: resolve targets (direct targets, asset group members)
    API->>API: scope gate: exclusions, attribution, scope entries,<br/>tier, the actor's data scope
    API->>API: route targets to scan zones, check scan windows
    alt nothing can run
        API->>DB: scan run with status blocked and the refusal code
        API-->>U: refused (for example NO_TARGETS, SCAN_WINDOW_NEVER_OPENS)
    else
        API->>DB: scan run (pinned workflow version) and its steps
        API->>DB: first steps: targets filtered, cut into tasks
        API-->>U: run pending
        loop each task
            S->>API: claim the task (lease) once its hosts are free
            API->>API: re-check the targets against the scope gate
            S->>S: local policy, run the tool
            S->>API: report (CTIS), complete
            API->>W: report queued
            W->>DB: assets, findings and exposures (de-duplicated),<br/>step outputs
        end
        API->>API: step finished: plan the next steps from its outputs,<br/>every new target through the scope gate again
        API->>DB: tasks of the next steps
        API->>DB: all steps settled: completed, partial or failed
    end
    Note over API,DB: Separately, controllers time out runs past their deadline,<br/>fail runs no sensor claimed, stop stalled tasks,<br/>and requeue tasks whose lease expired.
```

- **One run per occurrence.** Each scheduled occurrence creates at most one
  run, however many API replicas are running.
- **No overlap.** A scheduled occurrence is skipped while the scan's
  previous run is still active. Occurrences missed while the platform was
  down are skipped, not replayed.
- **Scan windows.** Policies under **Settings > Policies > Scan windows**
  say when targets may be scanned (allow windows) or never (blackouts). A
  scheduled run none of whose targets may run now is moved to the next
  opening; a manual run starts and its waiting targets wait for their window.
  A target whose windows never open refuses the trigger
  (`SCAN_WINDOW_NEVER_OPENS`).
- **Concurrency limits.** A trigger is refused with `MAX_CONCURRENT_RUNS`
  when the scan, or the organization, already has as many active runs as
  allowed.
- **Rollover.** When a run reaches its deadline, its unfinished targets are
  recorded and the next scheduled run plans them first.

## Scan runs

![The Runs tab listing nine runs: running, completed, partial and failed]({{ site.baseurl }}/assets/images/scanning/scan-runs.png)
*Figure: Scan runs.*

| Status | Meaning | Final |
|---|---|---|
| `pending` | Created; no task claimed yet | no |
| `running` | At least one task claimed or started | no |
| `completed` | Every task completed | yes |
| `partial` | Some work completed and some failed, or the deadline passed with work done, or zone routing left targets uncovered. Results are kept | yes |
| `failed` | No task completed: all failed, or no sensor claimed any task within 4 hours (scheduled runs) or 1 hour (other runs). A run whose work waits for its scan window or for its hosts is not failed this way | yes |
| `timeout` | The deadline passed and no task completed | yes |
| `canceled` | Stopped by a person | yes |
| `blocked` | Refused before anything was dispatched (scope, scan window, no sensor or tool, no target) | yes |

A finished run never changes again: a late result, a cancel racing a
completion or a duplicate report cannot reopen it or count its findings
twice.

### Run deadline

A run has no fixed default deadline. Its deadline is the scan's **Max
duration** when one is set, else the scan workflow's timeout, else the
platform's 24-hour cap. The run page says which one applies and why. A step
is not started when less time is left before the deadline than its tool needs
to do anything useful: it fails with `DEADLINE_TOO_CLOSE`, and its targets
count as the run's unfinished targets.

### Steps and tasks

Each step of a run shows its state (pending, waiting for a sensor, running,
succeeded, partial, failed, skipped, canceled), the tool the planner chose,
its tasks by state, and the findings it produced. The run page offers:

- **Tasks**: each task, its state and the sensor that took it, with its
  **Logs** (what the tool and the sensor logged, kept 14 days). A task
  refused before any tool started shows the refusal reason. A running task
  shows its progress (`{done}/{total} targets done`, when it last moved and
  its time budget). A queued task says what it waits for in the **Sensor**
  column (**Waiting for a sensor**, **Waiting for its hosts: another task is
  scanning them**, or **Handed back: its sensor is still scanning one of its
  hosts**); **Why waiting?** explains it ([Why a task waits](why-waiting.md)).
  A completed task lists the targets it skipped and the hosts it did not
  fully cover.
- **Map**: the run drawn on the workflow version it executes.
- **Stages**: per step, how many targets came from the seeds or from earlier
  steps, and how many were skipped and why.

![A completed scan run: findings, tasks, duration, stages and the task timeline]({{ site.baseurl }}/assets/images/scanning/scan-run-completed.png)
*Figure: A completed run: each stage with its tool, inputs and planned targets, and the timeline of its tasks.*

When a sensor claims a task, the platform runs the scope gate again on the
task's targets, with the same inputs the run was dispatched with (tier, act
scope of the person who triggered it, scan zone). A task can wait in the queue
while scope changes: an exclusion is added, an entry is removed or lowered, an
asset is marked "Not ours", a zone shrinks, or the person loses access. Targets
that are now refused are removed from the task before the sensor receives it.
A task left with no target is not handed out: it fails with `SCOPE_CHANGED`,
naming each removed target and its refusal code, and its step fails with the
same code (not retried). If the check itself cannot run, the task stays queued
for a later claim.

A task is claimed by a sensor under a lease that the sensor's heartbeats
renew. If a sensor goes silent, its tasks go back to the queue about a minute
after the lease runs out (3 minutes by default) and another sensor of the
zone takes them.

Within one organization, a task is not handed out while another task of the
organization is scanning one of its hosts. See
[Why a task waits](why-waiting.md#waiting-for-its-hosts).

### Liveness and stalls

A task is not cut off by a fixed timeout. Each task carries a time budget
that the platform works out from the tool and the number of targets (a
per-target budget, a budget for the whole task between 5 minutes and 24
hours, and a stall window between 5 minutes and 1 hour). The sensor's
heartbeat reports, for each task it holds, how many targets are finished and
whether the tool is still producing records, output or CPU time.

- **Slow but working** tasks keep running: any of those signals moving
  counts.
- **Stalled**: when none of them moved for the task's stall window, the
  platform asks the sensor to stop the task and hand back what it finished.
  The task completes `partial` with the finished targets' results, and only
  its unfinished targets are queued again as a new task. If the sensor does
  not answer within 5 minutes, the whole task is queued again. A task that
  stopped with nothing finished is queued again, not failed.
- **Overrun**: a task still running at twice its budget plus 5 minutes is
  taken back at once, whatever the signals say.
- **Unfinished targets only**: when a sensor ends a task with some targets
  done and others unfinished (for example when the task's budget ran out),
  only the unfinished targets run again; a finished target is never scanned
  twice because a later one stopped the task.

Stopping and handing back is something the platform does on a stall; there
is no console action that stops a run and keeps its partial results.
Stopping on request and per-target outcomes need sensor v0.21.0 or later
(sdk-go v0.28.0 or later); with an older sensor a stalled task is queued
again whole.

### Failures and retries

- Permanent failures (refused targets, `SCOPE_CHANGED`, invalid settings,
  missing tools) are never retried.
- Lost work and timeouts are retried twice, with a backoff.
- Other failures follow the scan's retry setting.

### Cancel a run

**Cancel run** on the run page or in the run's panel in the Runs list, or
`POST /api/v1/scan-runs/{id}/cancel` (`scans:write`). Only a run that has
not finished can be canceled. The run becomes `canceled` at once; its open steps and tasks
are closed and never re-queued. A sensor holding a task hears about it on its
next heartbeat (within about 5 seconds while it works) and stops the tool; an
offline sensor hears it when it reports the task again. A canceled task
delivers nothing more; results ingested before the cancel stay. Canceling
again does nothing.

## Results

Sensors send results as CTIS reports bound to their task. The platform
accepts a report only from the sensor that holds the task's current lease,
for that task's tool and targets, and only with the asset types the tool is
declared to produce. Out-of-contract assets are, by default, held in the
sensor results quarantine for review instead of applied. Findings and assets then appear under **Findings**, **Assets** and
**Attack surface**, with the scan run as their source.

A finding that a later scan no longer sees is not resolved automatically by
default. Fix verification uses [retests](../user-guide/index.md) of the
finding instead.

## Scan profiles

A **scan profile** (**Settings > Scanning > Scan profiles**,
`/api/v1/scan-profiles`) is a reusable set of tool settings: which tools are
enabled with which options, an intensity (`low`, `medium`, `high`), a timeout,
and for template-based tools which templates to use (`default`, `custom` or
`both`, with the custom template ids). The platform provides system profiles;
organizations clone and adapt them, and one profile can be the default. A
scan can reference a profile.
