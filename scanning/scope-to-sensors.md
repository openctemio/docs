---
title: How scope reaches sensors
parent: Scanning
nav_order: 1.5
---

# How scope and exclusions reach sensors
{: .no_toc }

An exclusion, a "Not ours" decision or a missing scope entry is enforced at
several points, from the platform to the sensor and back. If one point
misses something, the next one catches it, so a planning mistake cannot
reach an excluded target. This page follows a target through each of those
points in order.

1. TOC
{:toc}

---

## Who decides what

| Decision | Set by | Effect on active scans |
|---|---|---|
| **Scope entry** (Scoping > Scope > In scope) | People with scope write | Authorizes the full scan of what it covers (the scan's own intensity). |
| **Exclusion** (Scoping > Scope > Out of scope, or the inventory's **Mark out of scope > Exclude from scanning**) | People with scope write; under Strict scan approval it waits for another approver | Always wins: the target is never actively scanned, whatever covers it. |
| **Not ours** (the asset's ownership, the inventory's **Mark out of scope > Not ours**, or **Not ours** on the addresses card) | People with assets write | The asset, and names found again under a rejected name, are never actively scanned and never suggested again. |
| **Scan unclassified assets** (Settings > Policies > Scope policy) | Scope approvers | What inventory assets that no entry covers get: **Off (passive only)**, **Low-impact (default)** or **Full**. Strict scan approval forces Off. Platform guardrails apply in every mode. |
| **Scan zones** (Discovery > Sensors > Zones) | Administrators | Private addresses and internal names are authorized by a zone, not by scope entries, and go only to that zone's sensors. |
| **Sensor-local policy** (a file on the sensor host) | The owner of the network the sensor sits in | Only narrows what the platform sends; the platform cannot change it. |
| **Platform deny list** | The platform operator | Never scanned, inside an organization's own entry too. |

A verified domain is proof of control only. It never authorizes a scan by
itself. Details of each decision are in
[Scope and authorization to scan](scope.md).

## 1. On the platform, before the job exists

Every way a scan starts goes through the same gate: scheduled, manual and
quick scans, workflow runs and each later step, automation, coverage,
validation and retests, and connector scans.

- **Targets the gate refuses are left out** of the job, each with a refusal
  code (see [the code table](scope.md#check-before-you-scan)).
- **Ranges are cut, not dropped.** A range target is cut around excluded
  addresses and the rest is sent as pieces. For example, `198.51.100.0/29`
  minus `198.51.100.5` becomes `198.51.100.0/30`, `198.51.100.4` and
  `198.51.100.6/31`. A range is also cut into pieces of at most a /24 (IPv6
  /120). A range target may hold at most 65,536 addresses. A range that
  would need more than 4,096 pieces is refused with `RANGE_TOO_FRAGMENTED`.
- **Web jobs get their web scope at creation.** A job for a web tool carries
  the path exclusions of its hosts (`web_scope`). A web job that cannot carry
  its scope is not created.
- **Fail closed.** When a lookup the gate needs fails, nothing is dispatched.

## 2. In the signed job

The job a sensor receives carries what it must leave alone. The job
signature covers it:

- **`exclusions`**: the organization's address exclusions near the job's
  ranges (in the /24 or IPv6 /120 buckets around them).
- **`web_scope`**: the paths the job may not request, and the methods it may
  use.

With job signing, the signer keeps its own ledger of approved exclusions. It
refuses to sign a job that names an excluded target (`target_excluded`).

## 3. When a sensor claims the job

A job can wait in the queue while scope changes. When a sensor polls, claims
or acknowledges it, the platform runs the gate again on its targets:

- Targets that left scope since the job was queued are removed. A job with
  nothing left fails with `SCOPE_CHANGED`.
- A gate that cannot decide withholds the job.
- Jobs on unclassified assets are fitted to the low-impact profile here, or
  refused (`low_impact`), and port scans of names are limited to the web
  ports when needed (`web_ports_only`). See
  [Unclassified assets](scope.md#unclassified-assets).

## 4. On the sensor

- **Ranges are cut again, address by address.** The sensor walks each range
  and leaves out the job's `exclusions`, then its local policy's
  `targets.deny`, then its built-in deny list. An address target the job
  excludes is removed. An exclusion the sensor cannot read refuses the job.
  This needs sensor v0.20.0 or later; older sensors ignore `exclusions`, and
  the platform's cut pieces still protect them.
- **The port scanner skips them too.** naabu gets the exclusions as
  `-exclude-hosts`.
- **Web requests go through the task's forwarder.** On a sensor that confines
  its tools' network (it advertises `net.confined@1`; see
  [Tool confinement](../sensors/security.md#tool-confinement)), every request
  of a web-scoped task goes through the forwarder, which checks it against
  the job's `web_scope`:
  - a request under a denied path is refused, whatever its method;
  - a method the job may not use is refused;
  - redirects are checked again;
  - traffic the forwarder cannot read as HTTP is refused.

  nuclei, validation and retest jobs with a web scope run **only** on a
  confined sensor (sensor v0.19.0 or later, started with its seccomp
  profile). They wait for one, and the run says why
  ([Why a task waits](why-waiting.md)). When the organization has no
  confined sensor at all, the job is refused with `NO_CONFINED_SENSOR`.
- **The local policy and the kill switch.** The sensor refuses every job
  outside its [local policy](../sensors/network.md#sensor-local-policy), and
  runs nothing while its kill-switch file exists.

## 5. After the run

When results come back, a result for an address outside the addresses a
range job was given (an excluded address included) is dropped with its
findings and never stored.

## How a path exclusion becomes web scope

| Exclusion | Web scope of the job |
|---|---|
| Path, **Blocked**, blocking GET or HEAD | A denied path: no request under it, whatever the method |
| Path, **Read-only**, or a rule that blocks only methods that change state | The whole job is limited to GET and HEAD |
| Path, **Allowed** (a testing window of at most 90 days) | Nothing is added |

## See what was left out

- **Before a scan starts:** the scan preview lists the targets exclusions
  would leave out, with the rule that matched.
- **After it ran:** the run page shows "N targets left out by exclusions":
  each target (a range shows how many addresses it lost) and the rule that
  matched (up to 50).
- **Any target, any time:** the inventory's **Scope status** filter, the
  asset's **Scope and scanning** card, and `POST /api/v1/scope/check`.
