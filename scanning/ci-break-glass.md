---
title: Break-glass
parent: CI/CD integration
grand_parent: Scanning
nav_order: 4
---

# Break-glass
{: .no_toc }

A break-glass lets **one commit of one repository** pass the gate for a
limited time, for example an urgent fix that must ship before a finding can be
resolved. It is the exception, not the way to handle false positives: for
those, use an exception or a suppression
([Understand a blocked pull request](ci-blocked-pr.md#fix-it-or-ask-for-an-exception)).

1. TOC
{:toc}

## Rules

- You need `scans:ci:override` (owners, administrators, and the AppSec
  engineer role template) and a recent sign-in (step-up).
- It names the **full** commit id (40 or 64 characters) and covers exactly that
  commit. Abbreviated ids are refused.
- It needs a reason of at least 10 characters, and lasts 1 to 168 hours
  (default 24).
- It applies only to a commit its CI provider signed. A commit a job reported
  itself (CircleCI, or Jenkins without a `sha` claim) never matches.
- It is audited. Every owner and administrator is notified when it is created
  and each time a run uses it. The verdict shows "Break-glass" with the reason
  and expiry; it never names the person, because CI logs may be public.

## Flow

```mermaid
sequenceDiagram
  autonumber
  actor Dev as Developer
  actor Sec as AppSec admin
  participant UI as Console
  participant API as OpenCTEM API
  participant CI as CI pipeline
  participant Host as GitHub / GitLab
  Dev->>Sec: Urgent: PR blocked, needs to ship
  Sec->>UI: Open the failed run › Break-glass this commit
  UI->>API: POST /ci/gate-overrides {repository, full SHA, reason, hours}
  API-->>UI: Step-up required
  Sec->>UI: Confirm with second factor
  UI->>API: Retry
  API->>API: Store, audit, notify every administrator
  Sec->>Dev: Done, re-run the pipeline
  Dev->>CI: Re-run the pipeline on the same commit
  CI->>API: evaluate
  API-->>CI: pass (would fail, break-glass until …)
  API->>Host: Check neutral or success, comment notes the break-glass
```

The override does not change a verdict that already exists. **Re-run the
pipeline on that commit**: its next run passes, and because the check takes
each pipeline's latest verdict, the check turns green.

## Create one

1. Open the failed run (**Pipelines › Runs**, or **Details** on the pull
   request check).
2. **Break-glass this commit** fills in the repository and the full commit.
3. Enter the reason and the hours, then **Override the gate**, and confirm
   with your second factor.

![The Break-glass dialog prefilled with the repository and the full commit id, with a reason]({{ site.baseurl }}/assets/images/scanning/ci/ci-break-glass-dialog.png)

## Review and revoke

**Trust and gate › Break-glass** lists the overrides with who created them,
the reason and the expiry. **Revoke** ends one early; the next
run of that commit is judged normally.

![The Break-glass tab listing one active override with its reason and expiry]({{ site.baseurl }}/assets/images/scanning/ci/ci-break-glass-list.png)
