---
title: Stage streaming
parent: Scanning
nav_order: 3.7
---

# Stage streaming
{: .no_toc }

A scan workflow chains steps: subdomains, DNS, ports, web probe, templates.
With stage streaming a step starts on the results of the first finished tasks
of the step before it, instead of waiting for all of them. One slow task no
longer holds back the rest of the chain.

It is on by default from the platform release after
{{ site.data.versions.platform }}. Your sensors need no change.

1. TOC
{:toc}

---

## What it does

Without streaming, the next step starts only when every task of the previous
step is done. If the probe step has 72 targets in one slow task, the template
step waits for all 72, even when 60 of them answered in the first minute.

With streaming:

1. The probe step is cut into several smaller tasks (about four, at least 10
   targets each), so the first quarter of the hosts finishes early.
2. When a task finishes and its results are stored in the inventory, the next
   step takes the new targets from them and starts them. This is a **wave**.
3. Each later finished task adds another wave with only the targets not yet
   handed over. A target is never started twice in the same step and run.
4. When the previous step is fully finished, a last wave takes what is left
   and the next step closes.

Every target still passes the same checks as before it starts: scope,
exclusions, the scan zone, hop limit and fan-out caps. Results still come only
from what sensors reported to the platform. A sensor never passes data to
another sensor. Coverage and finding closure stay per task, on the targets
that task ran.

## On the run page

The run page shows each step as a lane. A step that streams is marked:

| Mark | Meaning |
|---|---|
| **Streaming** | The step started on partial results and more targets may still arrive |
| **Streamed in N waves** | The step has taken all its targets, in N waves |

Next to a streamed step the page shows when it started compared with when the
step before it finished, so you can see the time saved. A step that waited for
its predecessor shows no mark.

If a task of the previous step fails, it hands nothing over and the other tasks
are unaffected. The previous step ends **Partial**, and so does a streamed step
that lost a task. See [Scans and scan runs](scans-and-runs.md).

## When a step does not stream

A step waits for the whole previous step when:

- It is **intrusive** (tier T2). Intrusive steps never take derived targets
  from streaming.
- It is a web step that **selects endpoints** (an endpoint selector other than
  *all*). It needs the complete list to choose from.
- It depends on **two or more steps** that have not finished. It needs every
  input before it can pair names with their origins. Once only one is left
  unfinished, it can stream.
- It is skipped by its condition, the scan intensity or the run depth.
- The predecessor has produced no finished task yet.

## The two switches

| Switch | Where | Effect |
|---|---|---|
| `SCAN_STAGE_STREAMING` | Platform environment variable, default `true` | `false` turns streaming off for every workflow |
| **Wait for each stage to finish before the next starts** (`stage_barrier`) | Workflow settings | On: this workflow never streams |

Either one restores the barrier. Use the workflow setting when a single
workflow needs the older, step-by-step behaviour, for example because a tool
downstream is rate-limited and you prefer one large batch. Changing it affects
runs that start afterwards.

## Metrics to watch

| Metric | What to look at |
|---|---|
| `scan_stage_barrier_wait_saved_seconds` | How much earlier streamed steps got their first targets than the barrier would have |
| `scan_stage_time_to_first_successor_seconds{mode}` | Time from a step's start to its successor's first dispatch |
| `scan_stage_stream_waves_total{kind,outcome}` | Waves by kind (`start`, `wave`, `close`) and outcome (`dispatched`, `empty`, `deferred`, `deadline`, `error`) |

A rising share of `deferred` means reports of the previous step overlap with
planning and waves are waiting for them. The step then behaves closer to the
barrier. A steady `error` or `deadline` count needs a look at the run's
unfinished targets.
