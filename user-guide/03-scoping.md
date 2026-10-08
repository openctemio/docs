---
title: Scoping
parent: User guide
nav_order: 3
---

# Scoping

**CTEM stage 1.** Scoping decides *what* is in scope for exposure management and
*why it matters to the business*. In OpenCTEM you run the program as CTEM cycles,
record which assets are business-critical and who owns them, set the boundary
of what scans may touch, and write down which attackers you defend against.
Together these answer "what are we protecting, and why does it matter" before
Discovery starts.

The pages live under **Scoping** in the sidebar: **Overview**, **Cycles**,
**Business context** (Crown jewels, Services, Units), **Scope** and **Threat
model** (Threats, Attacker profiles). What discovery found (attack surface, asset
groups, relationships) is in [Discovery](04-discovery.md); framework compliance
is in [Insights and reports](09-insights-and-reports.md#compliance).

## Scoping overview

**Scoping › Overview** (`/scoping`) answers "is our scope written down for this
cycle?". It shows the active cycle (its day count, objectives, success criteria,
in-scope services and exclusions, with **Open cycle**, or **Start a cycle** when
there is none) and a **Readiness** checklist. Each row is **Ready** or **Not
ready** and links to the page that fixes it:

- Cycle active with a charter
- Crown jewels identified
- Crown jewels have an owner
- Business services defined
- Services linked to their assets
- Assets mapped to a business unit
- Boundary set (targets and exclusions)
- Attacker profiles chosen for the cycle
- Threat model for each crown jewel

![The Scoping overview with the readiness checklist for a CTEM cycle]({{ site.baseurl }}/assets/images/user-guide/scoping-overview.png)
*Figure: Scoping overview: what a cycle needs before it starts.*

A row is hidden when its module is turned off.

## CTEM cycles (start here)

**Scoping › Cycles** (`/cycles`) is the heartbeat of the program. A cycle is a
time-boxed pass through all five stages, with a charter, a frozen scope and an
outcome it is judged by, so each round is measurable and comparable to the last.

### Run a cycle end to end

1. Click **New cycle**, enter a **Name** (for example "Q2 2026 CTEM Cycle"), an
   optional **Description**, and the **Start date** and **End date**, then
   **Create**. The cycle starts in **planning**.
2. Open the cycle and write its **charter** (see below) while it is in planning.
   On the **Attacker profiles** tab, click **Choose profiles** to pick the
   attackers this cycle assumes.
3. **Activate** the cycle. Activating freezes the charter and takes a snapshot of
   the current asset scope: the assets of the in-scope services, or every asset
   when no service is chosen. The scope cannot be changed afterwards. The cycle
   becomes **active**.
4. When the work is done, **Start review**. The cycle stops taking new findings
   into scope and moves to **review**. Record **Scope refinement** notes: what
   to change in scope next time and the lessons learned (for example "Add exposed
   RDP to scope next cycle").
5. **Close cycle**. Closing is irreversible: the charter's success criteria are
   evaluated and the cycle and its scope snapshot become read-only.

Status flows **planning → active → review → closed**, one step at a time, and
each step asks for confirmation.

When you create the next cycle, the lessons from the last closed cycle are shown
as a callout so you can carry the relevant items into the new scope and charter.
The **Operating rhythm** card shows a reference cadence (**Weekly triage**,
**Monthly steering**, **Quarterly scope refresh**); activating a cycle anchors the
quarterly checkpoint to its end date.

### The cycle page

A cycle's page (`/cycles/{id}`) has the tabs **Charter**, **Assets in scope**
(the frozen snapshot), **Attacker profiles** and **Outcome**, and shows the next
lifecycle action as its main button.

### The charter

Edit the charter from the cycle page. Its sections:

- **Scope & objectives**: **Objectives**, **Business priorities**, **In-scope
  services** (none means activation covers every asset) and the attacker
  profiles.
- **Risk & success**: **Risk appetite** and the **Success criteria**.
- **Exclusions**: what is deliberately out of scope, picked from the exclusions
  that scans enforce.
- **Escalation, Roles & Timeline**: **Escalation path**, **Sponsor**,
  **Operator**, **Engineering partner** and **Timeline** (for example "90-day
  cycle, weekly triage").

Click **Save Charter**.

### Success criteria are checked at close

Each success criterion is a **name**, a **metric** and a **target** (click **Add
success criterion**). When the cycle closes, the platform checks every criterion
against the metrics it measured between activation and close, and records one of:

- **Met** / **Unmet**: the metric was recognized and the target is a number the
  platform could compare. The measured value is stored next to the verdict.
- **Not measurable**: the metric is not one the platform measures, the target is
  not a numeric comparison, the unit does not fit, or there was no data (for
  example, no risk snapshot before the cycle started). The reason is shown so you
  can reword the criterion next cycle. Free-text criteria are never guessed at.

The **Outcome** tab shows each verdict and the cycle's **Completion rate**:
met ÷ (met + unmet). Not-measurable criteria are left out; a cycle whose criteria
are all not measurable has no completion rate.

Metrics a criterion can name (case and spacing do not matter):

| Metric | Measures | Default comparison |
|---|---|---|
| `mttr` / `mttr_hours` / `mttr_days` | Mean time from finding creation to resolution | at most |
| `p0_resolved`, `p1_resolved` | P0 / P1 findings resolved during the cycle | at least |
| `p0_open`, `p1_open` | P0 / P1 findings open at close (daily risk snapshot) | at most |
| `findings_resolved`, `findings_opened` | Findings resolved / created during the cycle | at least / at most |
| `validation_coverage` | Percentage of resolved findings with validation evidence | at least |
| `risk_reduction` | Percentage drop in average asset risk from start to close | at least |
| `risk_after` | Average asset risk at close | at most |
| `p_class_churn` | Priority-class changes during the cycle | at most |
| `scope_drift_size` / `new_external_assets` | External-surface assets (domain, subdomain, IP address, certificate) first seen during the cycle; names marked as not yours are left out | at most |

Targets read like `0`, `< 48h`, `<= 14 days`, `>= 90%`, `at least 5` or
`under 2 weeks`. A bare number uses the default comparison above, so
`MTTR: 7 days` means "at most 7 days" and `P0 resolved: 10` means "at least 10".

## Business context

Risk scoring and prioritization lean heavily on business context. **Scoping ›
Business context** has three tabs; each is its own module.

### Crown jewels

**Crown jewels** (`/crown-jewels`) lists the assets whose compromise would hurt
the business most. They get extra weight everywhere risk is ranked.

1. Click **Designate crown jewel**.
2. **Search asset** and pick it.
3. Describe the **Business impact notes** (what happens if it is compromised).
4. Confirm.

The table shows each crown jewel's risk, business impact, findings, exposure
(internet-exposed or not) and owner, with the cards **Crown jewels**,
**Internet-exposed**, **With critical findings** and **Average risk score**.
Open one to see its key numbers, why it is critical, its reachability from the
internet and its **Dependencies** (connected assets). Use **Edit** or **Remove**
from the row menu; **Export** downloads the list.

### Services

**Services** (`/business-services`) groups assets by the business service they
deliver, so you can reason about risk to a service rather than to raw hosts.

1. Click **New service**.
2. Enter the **Name** (required, for example "Customer Payment Service"), a
   **Description** and the **Criticality** (critical, high, medium or low).
3. Under **Compliance scope**, select the frameworks that apply: PCI-DSS, HIPAA,
   SOC2, GDPR, ISO27001, NIST.
4. Under **Data handling**, tick **Handles PII**, **Handles PHI** and/or
   **Handles Financial Data**.
5. Enter **Availability (%)**, **RPO (min)**, **RTO (min)**, **Owner name** and
   **Owner email**, and save.
6. Link the service's assets and say how the service uses them.

The cards show **Services**, **Critical**, **Handle PII** and **Handle financial
data**. Use the row menu to **Edit** or **Delete** (deleting cannot be undone).
Creating and editing needs the business-services write permission.

### Business units

**Units** (`/business-units`) models your organization so that security
priorities follow the business.

1. Click **New business unit**.
2. Enter the **Name**, a **Description**, the **Criticality** and the **Risk
   tolerance** (low, medium or high).
3. Optionally pick a **Parent unit** to build your hierarchy. The picker leaves
   out the unit itself and its own sub-units, so loops are impossible.
4. Enter the **Owner** and **Owner email**, and optional **Tags**.
5. Click **Create**.

Use **Manage assets** to attach assets, **View details** to see the key numbers,
**Hierarchy** and sub-units, and **Edit**, **Delete** or **Export** as needed.
Deleting a unit with sub-units warns you that they are affected too. From the
asset inventory you can also select assets and use **Add to unit** or **Add to
service**.

### How business context raises criticality

The platform does not use an asset's own criticality on its own. It computes an
**effective criticality**: the **highest** of these signals (it only ever raises,
never lowers):

- the asset's own **criticality**;
- the criticality of the **business unit** the asset belongs to (a sub-unit
  inherits upwards: it is never less critical than any of its parents);
- the criticality of the **business service** the asset powers;
- the criticality inherited through **control-plane** relationships (below).

When a signal raises the value, an audit reason says which one (for example
"raised by business unit criticality: high"). Effective criticality feeds both
the asset's risk score and the priority class of its findings. Your own
criticality value is never overwritten.

**Confidentiality, integrity and availability impact.** In an asset's add or edit
form, **Business Impact (CIA)** has **Confidentiality Impact**, **Integrity
Impact** and **Availability Impact**, each **Low**, **Moderate**, **High** or
**Not rated**. A high CIA rating raises the **priority of findings** on that
asset (it can lift a finding near a threshold up one class, with a reason such as
"impact raised by CIA rating"). It does not change the asset's risk score and is
not part of effective criticality.

**Control-plane dependencies.** When you add a relationship between assets, tick
**Control-plane dependency (IdP / secrets / CI-CD / SIEM)** when the *target*
asset governs the security of the source (an identity provider, secrets store,
CI/CD system or SIEM that the asset relies on). The control-plane asset's
effective criticality is then raised to the highest criticality of everything
that depends on it, across several hops (with loop protection and a depth limit).
If an identity provider serves several critical services, the identity provider
becomes critical too.

## Scope

**Scoping › Scope** (`/scope`) defines what scans may touch. Anything not listed
is out of scope, and an exclusion always wins. See also
[Scope and authorization to scan](../scanning/scope.md).

![The Scope page listing domains, address ranges and repositories in scope]({{ site.baseurl }}/assets/images/scanning/scope-entries.png)
*Figure: Scope: the entries in effect.*

The cards **In scope**, **Out of scope** and **Waiting for approval** also switch
tabs. The tabs are **In scope**, **Out of scope**, **Approvals** and **Domain
proof**. **Policy** opens the scope policy.

### Add to scope

Users who can approve scope changes see **Add to scope**; members who can only
request see **Request access**.

1. In **What**, type the entry. Its kind is detected for you (use **Change** to
   pick it yourself): domain (`example.com`), IP address (`203.0.113.7`), IP range
   (`203.0.113.0/24`), URL (`https://app.example.com/portal`), repository
   (`github.com/example/web`) or cloud account.
2. For a domain, choose what it **Covers**: the domain and every name below it
   (`*.example.com`), or the domain only. To cover the names below a domain but
   not the domain itself, add an exclusion of exactly that domain.
3. Choose the **Duration**: **Permanent** (names found under it join the
   inventory) or **One-off** (expires after the number of **Days** you choose, up
   to the policy maximum; it authorizes scans only, and names found still need
   review).
4. Choose the **Deepest probe allowed**: **T0 passive**, **T1 safe active** or
   **T2 intrusive**. T2 is for approvers only and needs an expiry, an approval
   and a verified domain.
5. Give a **Reason** (required for one-off entries, requests and T2; kept in the
   audit log) and an optional description.
6. Click **Add to scope** or **Send request**.

The dialog tells you whether the entry needs approvals or takes effect at once;
you may be asked to confirm your identity first. A member's request is limited
to one name or address (no wildcard or range), is always one-off and at most
T1. Some targets are always refused, whatever the settings: public suffixes,
government and military names, shared-provider apexes used as wildcard roots,
link-local and cloud-metadata addresses, and very large public ranges.

The In scope table shows each entry's kind, status (**Active**, **Pending
approval**, **Expired**, **Inactive**, **Rejected**), deepest probe, reason and
who added it. Row actions: **Edit**, **Deactivate**, **Activate** and **Extend**
(both may need approval), and **Remove**. An edit that widens scope sends the
entry back to pending.

### Put out of scope

On the **Out of scope** tab, click **Put out of scope**:

1. Enter **What** (a domain, IP address or range, URL or repository).
2. Optionally block only part of a host: tick the path option, enter a **Path
   prefix** (for example `/admin`) and choose the HTTP methods (or **Block only
   what changes state**).
3. Enter a **Reason** and, optionally, when it **Ends** (1 to 365 days).

A new exclusion is **Pending approval** and scans still reach the target until
someone other than you, who holds the exclusion-approve permission (owners and
admins by default), approves it. Exclusion statuses: **Excluded**, **Pending
approval**, **Lifted**, **Rejected**, **Ended**. Path exclusions also have a
**Testing mode** (**Blocked**, **Read-only** or, for at most 90 days,
**Allowed**).

### Approvals

The **Approvals** tab is one queue for both entries ("Adds to scope") and
exclusions ("Puts out of scope"). Click **Approve** or **Reject**, or select
several and **Approve selected**. You can never approve your own request, and
approving widening entries can require a fresh identity check.

![The Approvals tab of the Scope page with a cloud account and an exclusion waiting for a second administrator]({{ site.baseurl }}/assets/images/scanning/scope-approvals.png)
*Figure: Scope changes waiting for another administrator's approval.*

### Domain proof

The **Domain proof** tab proves that you control a domain with a DNS TXT record:
enter the **Domain**, click **Prove a domain**, publish the record and click
**Check**. Proof does not put anything in scope; scope entries do. Depending on
the platform's settings, active probes from platform sensors need a proved
domain.

![The Domain proof tab with two verified domains and one waiting for its TXT record]({{ site.baseurl }}/assets/images/scanning/scope-domain-proof.png)
*Figure: Domain proof: two domains verified, one waiting for its DNS TXT record.*

### Scope policy

**Settings › Policies › Scope policy** (`/settings/scope`) sets how scope may
change. Only scope approvers can edit it; saving asks you to confirm your
identity, is audited and notifies every administrator.

| Setting | Options | Default |
|---|---|---|
| **Approvals for widening** | Default (one, when there are two or more admins), None, One approver, Two approvers | Default |
| **One-off entries** | Approvers; members request · Approvers only · Off | Approvers; members request |
| **Longest one-off entry** | 1 to 30 days | 7 |
| **Default deepest probe** | T0 passive, T1 safe active (T2 is never a default) | T1 |
| **Add discovered names automatically** | on or off | on |

The **In effect now** section shows the resulting approval count, whether
active probes need domain proof (set by the platform operator) and that scope
checks are always on. When automatic adding is off, every newly discovered name
waits in the attack-surface review queue.

## Threat model

**Scoping › Threat model** has two tabs.

### Threats

**Threats** (`/threat-model`) derives attack techniques per crown jewel, maps
them to MITRE ATT&CK and scores them by coverage.

1. Under **Generate a threat model**, choose a crown jewel in **Crown-jewel
   scope** and click **Generate** (needs the assets write permission). With no
   crown jewels yet, use **Manage crown jewels**.
2. Open a model from **Threat models**. It shows **Coverage**, **Threats**,
   **Open**, **Mitigated** and **Covered** (by a compensating control).
3. The **Threats** table lists each threat's attacker, attack path, technique,
   tactic, mitigation, status (Open, Mitigated, Covered, Accepted, Theoretical),
   score and evidence, with filters. The **Coverage matrix** tab shows ATT&CK
   coverage and downloads an ATT&CK Navigator layer.
4. Click **Refresh** to regenerate the model after the inventory changes.

Threats are derived; they are not edited by hand.

### Attacker profiles

**Attacker profiles** (`/attacker-profiles`) describes the adversaries that
exposure assessment and threat models reason about.

1. Click **New profile**.
2. Enter the **Name** and a **Description**.
3. Pick the **Profile type**: External (Unauthenticated), External (Stolen
   Credentials), Malicious Insider, Supply Chain Compromise or Custom.
4. Set **Network access** (external, internal or dmz), **Credential level**
   (none, user or admin), whether it **Can establish persistence**, its **Tools**
   and its **Assumptions**.
5. Click **Create**.

Built-in profiles are marked **Default** and are read-only. Custom profiles can
be deleted from the row menu (this cannot be undone). Creating and deleting
profiles needs the attacker-profiles write permission. A cycle chooses which
profiles it assumes on its **Attacker profiles** tab.
