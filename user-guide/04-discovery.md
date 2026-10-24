---
title: Discovery and the asset inventory
parent: User guide
nav_order: 4
---

# Discovery and the asset inventory

**CTEM stage 2.** Discovery finds what is actually out there: your assets, the
software they run and the exposures on them. It is driven by **scans**, run by
**sensors**, and by integrations and imports; it produces **assets** and
**findings**.

The pages are under **Discovery** in the sidebar: **Scans** (with **Runs** and
**Workflows**), **Sensors**, **CI/CD**, **Attack surface**, **Assets**,
**Exposures**, **Credential leaks** and **Components**. Exposures and findings
have their own chapter: [Exposures and findings](05-exposures-and-findings.md).

**How data arrives.** The inventory is filled mainly by scans, integrations
(cloud and source control), imports and attack-surface monitoring; you can also
add assets by hand. Until your organization has run a scan or an import, most
asset pages show an empty state with a suggested next step. The recommended order
is: **set your scope → run a scan → review the assets and findings it found.**

## Scans

**Discovery › Scans** has four tabs: **Scans** (the saved scans and their
schedules), **Runs** (every run they produced), **Workflows** (the scan
workflows a scan can run) and **Approvals** (scan approval requests, see
[Scan approvals](#scan-approvals)). The header has **Quick scan** and **New scan** (both
need the scan write permission). See also [Scans and scan runs](../scanning/scans-and-runs.md).

![The Scans page listing three scheduled and manual scans with their last run and success rate]({{ site.baseurl }}/assets/images/scanning/scans-list.png)
*Figure: Discovery, Scans.*

### Quick scan

**Quick scan** runs a scanner on targets now, without saving anything. It
needs the scan write and execute permissions.

1. Paste the **Targets** (up to 1,000), separated by new lines, commas or
   semicolons.
2. Pick the **Scanner** from the active scanners in the tool registry.
3. Below the targets a preview shows what they expand to: how many known assets
   match a wildcard or range, how many **will be scanned**, and how many are left
   out and why (exclusions or the deny list, outside your data scope, ownership
   not confirmed yet, a scope entry that allows a lighter scan than this
   scanner runs, internal addresses no scan zone covers, a kind of asset this
   scanner cannot scan, or archived). With no known names it offers **Run
   discovery on {domain} first**. The preview is a help: if it is unavailable
   you can still start the scan.
4. Click **Start Scan**. Follow the run under **Runs**, where it shows as a
   **Quick scan**. If you want to run it again later, **Save as scan** keeps
   the targets and scanner as a saved scan.

### New scan

**New scan** opens a five-step wizard: **What → Targets → Options →
Schedule → Review**. Each step is checked before you can go on; click a
completed step to go back.

![The first step of the New scan wizard: name and what to run]({{ site.baseurl }}/assets/images/scanning/new-scan.png)
*Figure: The New scan wizard.*

1. **What**
   - **Scan Name** (required), for example "Production Security Scan".
   - **What to run**: a **Single check** (one scanner on the targets), a
     scan workflow (one of your organization's workflows or a system
     workflow, with a preview of its steps), or **Continuous discovery**
     (every day, passive discovery of your root domains, then active probing
     of the assets confirmed since the last run; it saves two scans).
2. **Targets**: combine assets, asset groups and pasted targets (tabs
   **Assets**, **Groups** and **Paste**); at least one target is required.
   - Pasted targets are checked as you type: domain (`example.com`),
     wildcard (`*.example.com`), IPv4 or IPv6 address, CIDR range
     (`192.0.2.0/24`), URL (`https://example.com`) or host and port
     (`example.com:8080`). Private addresses are scanned only inside a scan
     zone, and localhost may be blocked.
   - A wildcard is expanded at every run to the domain and the names your
     inventory holds under it; the step says how many names that is now.
   - For address ranges, **Address ranges** chooses **Find live hosts
     first** (the default when the scan can run it), **Sweep the whole
     range** or **Only the hosts already in the inventory**.
   - A **Scope check** shows which targets your [scope](03-scoping.md#scope)
     allows; refused targets must be fixed before the scan can start.
3. **Options**
   - **Where it runs**: **Auto** (your organization's sensors first, then the
     shared sensors), **Organization sensors** or **Shared sensors** (public
     targets only; offered only where the organization may use them), and the
     **Scan profile** (tool settings, intensity and quality gate; the
     organization default unless you pick another).
   - **Advanced: job size, timeout and retries**: **Targets per job** (how
     many targets one sensor job scans; smaller jobs spread a scan over more
     sensors), **Max duration (seconds, optional)** (empty: no limit of its
     own, the platform's 24-hour cap applies; 30 seconds to 24 hours),
     **Max retries** (0 means no retry) and **Retry backoff (s)**.
4. **Schedule**
   - **When to run?**: **Run immediately** or **Schedule for later**, with the
     **Frequency** (Once, Daily, Weekly, Monthly), the **Date** (once), the
     **Day** (weekly) or **Day of the month** (monthly; a shorter month runs
     on its last day), the **Time** and the **Timezone**. **Save without
     running** saves the scan to start later.
5. **Review**: everything chosen, and the scan zone each target goes to
   (which can be pinned there). Click **Start scan**, **Schedule scan** or
   **Save scan**. If the scan is saved but cannot start, it stays saved and
   you can trigger it later from **View Scan**.

When you trigger a scan, the platform may refuse it and say why, with a fix:
for example a target's [scan window](../scanning/scans-and-runs.md#starting-a-run)
never opens, the scan or the organization already has too many runs at
once, or the scope check refused the targets. Once a run has started, a
task can still wait, for example while another task of your organization is
scanning the same hosts: the run page says why
([Why a task waits](../scanning/why-waiting.md)).

### The scan list

The **Scans** tab lists saved scans with their state, type (workflow or single
scanner), schedule and next run, last run and run count.

- Filter by state (**All**, **Enabled**, **Schedule paused**, **Disabled**),
  scan type, schedule and tags; search by name. **Show one-off scans** includes
  quick scans saved as scans.
- A row's menu: **View details**, **Edit**, **Clone**, **Pause** / **Resume**
  and **Delete**. **Edit** and **Clone** are also on the scan's page. A
  clone keeps every setting and starts paused; editing a scan's targets
  under scan approvals needs a new approval.
- Select several to **Activate**, **Disable** or **Delete** them.
- **Origin** filters the list to scans made by **People** or by the **System**.
  Scans of the **System** origin are the platform's own continuous coverage and
  enrichment scans (see [Managed scans](#managed-scans)).
- Click a scan to open its page (`/scans/{id}`): run statistics (runs, success
  rate, successful, partial, failed, next run), the upcoming runs of its
  schedule, its configuration (scan type, sensor preference, targets per job,
  targets, tags, scan workflow) and its recent runs. **Delete scan** removes the
  scan and its schedule; past runs and findings stay.

### Managed scans

Continuous coverage and automatic enrichment create scans of their own. Such a
scan shows a **System** badge, the banner "Managed by the platform · Continuous
coverage" and **Automatic coverage** as its trigger. It is read-only:

- There is no **Edit**, **Run now**, schedule, **Take ownership** or **Delete**,
  and the API answers `409 SCAN_MANAGED_BY_POLICY` to any such change, so a member
  cannot reshape or pause the platform's coverage.
- **Clone** reads **Clone as my scan** and makes an ordinary scan that you own.
- A scan you created with the same name as a coverage scan is never adopted or
  rewritten by coverage; coverage creates its own under another name. Scans a
  person created or took over are never managed.
- A run's status says how many targets were unreachable or skipped, for example
  "Completed · 3 unreachable", without changing the status.

### Runs

The **Runs** tab (`/scans/runs`) lists every run: from scans, quick scans and
retests.

![A running scan run: stages, tasks and the timeline]({{ site.baseurl }}/assets/images/scanning/scan-run.png)
*Figure: A scan run in progress.*

- Filter by status (Running, Pending, Completed, Partial, Failed, Timed out,
  Canceled, Blocked) and by kind, and **Export CSV**.
- Open a run to see its key numbers (findings, tasks, duration), its **Stages**
  (which tool ran which step on which sensor, and which targets were skipped and
  why), its tasks and logs, and its **Timeline** (task events are kept for 30
  days). Jump to the findings it produced from there.
- The task list shows each task's progress and, for a queued task, what it
  waits for; **Why waiting?** explains it
  ([Why a task waits](../scanning/why-waiting.md)).
- A run that has not finished can be canceled (**Cancel run** in the run's
  panel or on its page); in-flight tasks stop at their next heartbeat.

### Scan approvals

How much human approval a scan needs is the organization's **scan approval**
mode (**Off** by default, **On**, or **Strict**; an administrator of the platform
can force a mode), set with its approval rules under **Settings › Scanning ›
Scan approval**. When a rule catches a scan, its page shows **Needs approval
before it runs**, with who can approve it and **Submit for approval**; when the
scan changes after an approval, it says **Changed since the last approval** and
asks again. The **Approvals** tab (`/scans/approvals`) is the inbox: filter
**Pending** or all, see who requested what, which targets and why, and
**Approve** or **Reject** (with an optional note), **Remind** the approvers, or,
when nobody else can decide, approve your own request as the owner with a reason
and a code from your authenticator app. A request is **Pending**, **Approved**,
**Rejected**, **Canceled**, **Expired** or **Superseded**. An **Emergency run**
skips the approval for a limited window: it asks for a reason, confirms your
identity again, is audited as critical and tells the administrators. See also
[Scoping](03-scoping.md#scope).

### Scan workflows

A **scan workflow** chains several scan steps (for example subdomain discovery,
then HTTP probing, then vulnerability scanning) into one repeatable graph with
dependencies between steps. Scans run either one scanner or one workflow. See
[Scan workflows](../scanning/scan-workflows.md).

![The scan workflow builder showing five chained steps]({{ site.baseurl }}/assets/images/scanning/workflow-builder.png)
*Figure: The scan workflow builder.*

**Discovery › Scans › Workflows** (`/scans/workflows`):

- The cards: **Active**, **Total runs** and **Success rate**. Filter **All
  workflows**, **My workflows** or **System templates**.
- **System templates** are built-in, read-only workflows. **Use template** (or
  **Add to my workflows**) creates your own editable copy.
- **New workflow** opens a three-step form:
  - **Basics**: **Workflow Name**, **Description** and **Tags**.
  - **Steps**: **Add Step**; for each step choose **What it does** (a
    capability), or start from a specific tool, and optionally set the step key
    and timeout. The platform picks a tool for the capability unless you prefer
    or pin one.
  - **Settings**: the workflow **Timeout (seconds)** (a scan's own timeout
    wins), **Max Parallel Steps** and **Sensor selection**.
- A row's menu: **View details**, **Open editor** and **Clone**.

**The workflow editor** (`/scans/workflows/{id}`) is a visual canvas:

- Drag tools from the **Scanner Tools** palette (search, platform and custom
  tools) onto the canvas; connect steps to create dependencies.
- Click a step to edit its settings in the inspector (or **Remove** it). Every
  step needs a scanner or capability; the editor lists the steps that still need
  one.
- An **Unsaved** badge appears when you have changes; **Save** to keep them.
  Leaving with unsaved changes asks for confirmation.
- System templates open read-only; clone one to edit it.

## Sensors

Scans run on **sensors**: the OpenCTEM scanning component you deploy where your
targets are, or the instance's shared sensors for public targets. **Discovery ›
Sensors** (`/sensors`) lists your fleet with each sensor's health, jobs, version,
tools and zone, and lets administrators **Install sensor** (create the sensor
and copy its install command and key) or **Pair a sensor** (the sensor makes its
own key; you approve it by comparing a fingerprint), group sensors into **Scan
zones**, and edit, disable, rotate the key of, revoke or delete a sensor.

![The Sensors page with two online sensors, their version, jobs and tools]({{ site.baseurl }}/assets/images/sensors/sensors-list.png)
*Figure: Discovery, Sensors.*

Deploying and operating sensors is covered in [Sensors](../sensors/index.md).

## CI/CD

**Discovery › CI/CD** (`/ci-cd`) shows the CI/CD pipelines that scan your
repositories from GitHub Actions, GitLab CI and other CI systems, their runs and
repository coverage, with guides for GitHub Actions and GitLab CI. The
**Pipelines** tab lists the pipelines and their CI runs, each judged by the CI
gate; the **Trust and gate** tab (**Connect a pipeline**) decides which
pipelines may send results (trust) and what fails them (gate policy and
break-glass). A repository that a CI trust names also appears as a scope entry
([Scoping](03-scoping.md#scope)). See
[CI integration](../scanning/ci-integration.md).

![The CI/CD page listing two GitHub Actions pipelines with their gate status]({{ site.baseurl }}/assets/images/scanning/ci-pipelines.png)
*Figure: Discovery, CI/CD: one row per CI pipeline.*

## Attack surface

**Discovery › Attack surface** has five tabs: **Overview**, **Review**,
**Lookalikes**, **Changes** and **Web surface**. See also
[Attack surface monitoring](../scanning/easm.md).

### Overview

**Overview** (`/attack-surface`) shows what your organization exposes and how it
changed this week.

- The cards: **Total assets**, **Exposed assets** (public exposure), **Critical
  exposures** and **Average risk score**, each with the number new in the window.
- **External surface**: domains, subdomains, IPs and certificates; how many are
  confirmed yours, need review, or are dependencies or monitor-only; how many
  are new in the last 7 and 30 days and since the CTEM cycle started; and the
  state of Certificate Transparency monitoring.
- **Top external risks**: open exposures of medium severity or higher, with a
  link to all exposures.
- **Monitoring** (for administrators): turn **Certificate Transparency
  discovery** and **DNS checks** on or off, choose **How often** they run (every
  6, 12, 24 or 48 hours, or weekly; never more often than every 6 hours) and
  **Run now** (at most once per 15 minutes). The same card switches **Automatic
  enrichment** (every new asset in your scope gets DNS records, domain
  registration and the network owner of its addresses, from public lookups only),
  **Certificate checks of lookalike domains**, **Network seed lookups**,
  **Screenshots of web assets** (off by default; kept for 30 days) and the
  **Weekly digest** (see [Changes](#changes)).
- **Asset breakdown**, **Exposed assets** (**View all** opens the external
  attack surface list) and **Recent changes** (**View all** opens Assets › Activity).

**Continuous Certificate Transparency monitoring.** Besides scans, the platform
watches public Certificate Transparency logs (crt.sh, with Cert Spotter as a
fallback) for your domains: domain assets, verified domains and domain scope
entries. It reads public data only, uses no credentials and is protected against
requests to internal addresses. Each run it raises exposure events for new
subdomains (`subdomain_discovered`) and for certificates that are expiring
within 30 days or recently expired (`certificate_expiring`,
`certificate_expired`); see [Exposures](05-exposures-and-findings.md#exposures).
New names also join the inventory at once: confirmed when they sit under a
permanent scope entry, otherwise as *discovered* (unless **Review
discovered assets first** is on). DNS
checks run right after and flag dangling CNAME or NS records and weak email
security. The platform operator can turn monitoring off or change its default
interval (24 hours) for the whole installation.

### External attack surface

**View all** on the Overview opens **External attack surface**
(`/attack-surface/external`): every internet-facing asset, riskiest first, with
its service facts, risk, findings and labels. Filter by type and risk, **Export**
to CSV, **Scan this page**, or **Add asset** (an external domain, subdomain, IP
address, service or certificate).

### Review

**Review** (`/attack-surface/review`) collects the decisions that still
need a person. Confirming a name or address as yours adds its exact scope
entry; addresses are never added because a name points at them.

- **Waiting for your decision** opens with the card **N addresses your
  in-scope names resolve to**. Adding them scans every port of those
  addresses; a name never makes an address yours, so add only addresses you
  know are yours. The card shows **Network unknown for N: check they are
  yours**, **Shared, not offered** (CDN, CDN edge range, shared hosting where
  names of 3 or more domains point, another organization's or a provider's
  network), **Your own network** with **Add {prefix}**, and **Already get
  low-impact checks (add to scope for a full scan)**, each address with its
  open ports and other names. Actions: **Add N to scope**, **Not ours**
  (never scanned or suggested again, until undone on the asset), **Not now**
  and **Undo**. A second card lists assets you confirmed that are not in
  scope.
- The list below (views **Awaiting a decision** and **Not ours**) shows each
  name with its state, confidence, why it may be yours (under a verified
  domain, under a domain you listed, a target you scanned, found by one of
  your scans, under a scope entry) and the scope entry that covers it (or
  **Add to scope**).
- Select names and decide: **Ours: add to scope**, **Not ours**,
  **Dependency** or **Monitor only** (needs the assets write permission).

Discovered names join the inventory without waiting here, unless **Review
discovered assets first** is on in the scope policy
([Scoping](03-scoping.md#scope-policy)).

### Lookalikes

**Lookalikes** (`/attack-surface/lookalikes`) finds domains that others
registered to imitate yours, without contacting them: DNS lookups and Certificate
Transparency only, daily for registered lookalikes and weekly for the rest.

- Under **Watched domains**, **Watch a domain** takes one of your root domains
  (a permanent domain scope entry or a verified domain). Each watch has **Monitor**
  on or off, **Candidates to check** (10 to 1000) and the **Kinds of lookalikes**
  to generate (omitted or doubled letters, swapped letters, neighboring keys, a
  hyphen, look-alike characters, bit flips, another ending; none selected means
  all). **Stop watching** resolves its open lookalike exposures.
- **Registered lookalikes** lists the names that exist, with whether they have
  addresses, receive mail or hold certificates (mail servers or a certificate make
  phishing more likely). Decide each: **Ours or benign**, **Not a threat** or
  **Taken down**; the states are **To review**, **Ours or benign**, **Not a
  threat** and **Taken down**. An open lookalike is an exposure
  ([Exposures](05-exposures-and-findings.md#exposures)).
- Certificate lookups of lookalikes go to crt.sh; **Certificate checks of
  lookalike domains** in the Monitoring card turns them off, and lookalikes are
  then checked through DNS only.

### Changes

**Changes** (`/attack-surface/changes`) lists what changed on your external
attack surface: new and removed hosts, opened and closed ports, new or expiring
certificates, DNS changes (including dangling DNS), technology changes and new
exposures, newest first, for the assets you can see. Filter by **Change kinds**
and by time window; **Show older changes** pages back. Once a week the
administrators and the notification channels that receive attack surface events
get a **Weekly digest** of these changes (the day and hour are set in the
Monitoring card; a week without changes sends nothing).

### Web surface

**Web surface** (`/attack-surface/web`) shows what your web origins serve: endpoints,
their parameters (names only), the same path across origins, and what changed.

- The cards: **Endpoints**, **Sensitive, no auth**, **Excluded, untested** and
  **Sensitive and untested**.
- The views: **Origins**, **Endpoints** (filter by method, kind and sensitive
  only), **Path patterns** and **Changes** (appeared, gone, status or auth
  changed, new parameter).
- An endpoint under a scope exclusion shows **Never tested** with a link to the
  exclusion.

Web surface fills in when a scan workflow with a web crawl step runs. The
origins come from the HTTP probe: each probed origin is its own asset, named
by its URL (`https://app.example.com`, `http://203.0.113.7:8080`), next to
the subdomain or address it runs on.

## The asset inventory

**Discovery › Assets** has four tabs: **Inventory**, **Needs attention**,
**Groups** and **Activity**.

### Inventory

**Inventory** (`/assets`) opens on the full, filterable list of assets.

![The asset inventory with repositories, subdomains and IP addresses, their criticality, exposure and owner]({{ site.baseurl }}/assets/images/user-guide/assets-inventory.png)
*Figure: The asset inventory.*

- While the inventory is open, the sidebar lists its **views** under
  **Assets**: **All assets**, then the lenses **External surface**,
  **Applications**, **Cloud & infrastructure**, **Containers & Kubernetes**,
  **Code**, **Identities**, **Data** and **Network**, each with its count
  (`/assets?lens=external_surface`). Lenses with no asset are hidden, and
  **Other** collects assets whose type belongs to no lens. Counts cover only
  the assets you can see. The first line of the list names the open view, its
  total and what the lens holds.
- Every active filter is a chip under the search box ("Criticality is
  Critical, High"); click its **×** to remove it. **Add filter** (or the `f`
  key) lists the filters by group with a search box; pick one and tick its
  values, and the list follows as you tick. The asset type is one of these
  filters (**Type**, with the types of the open view and their counts). On a
  phone or a narrow window, **Filters** opens the same filters in a sheet.
- Search by name, description or alias. The filters narrow by signals
  (crown jewel or not, has findings or not, not seen for 30+ days or seen
  recently), tags, **Technologies** (what probes fingerprinted on the assets: web
  servers, frameworks and CMS, languages and runtimes, JavaScript libraries, CDN,
  hosting, WAF, analytics and security headers; pick a **Category** or search a
  **Technology**), **Scope status** (**In scope**, **Not in scope (passive
  only)**, **Out of scope**, **Internal**) and **Found by**. **Views** offers
  saved filters, among them **Not in scope (passive only)**, **Discovered**,
  **Out of scope** and **New since last visit**.
- The list includes what discovery found. Names awaiting a decision and
  names marked not yours are hidden; the chip **Hiding names awaiting review
  and not ours** says so, and its **Show** lists every name.
- Rows are one line. A long name is cut in the middle so both ends stay
  readable, and the copy button next to it copies the full name. A certificate
  shows its subject name, with its stored name (often a fingerprint) below and
  its other names, issuer and expiry in the tooltip.
- Columns: name, type, service facts, criticality, exposure, internet-facing,
  owner, risk, findings, last seen, labels (off by default; turn it on under
  **View**) and **Scope** (**In scope** when a
  scope entry covers the asset). The scope labels say "passive only" for
  assets no entry covers; such an asset gets what **Scan unclassified
  assets** allows, low-impact checks by default
  ([Unclassified assets](../scanning/scope.md#unclassified-assets)).
- Select rows for bulk actions (they need `assets:write`): **Assign owner**
  (a user or group, with an ownership role), **Set criticality**, **Add tag**,
  **Add to unit**, **Add to service**, **Mark out of scope** (**Exclude from
  scanning** or **Not ours**, up to 200 at once, with **Undo**) and
  **Archive** (hides assets from the default list; it does not change
  scanning). See [Put out of scope](03-scoping.md#put-out-of-scope).
- Click an asset to open its details.

**Category view.** Switch to **Category view** (`/assets?view=categories`) for
the overview by lens: one card per lens with its total and its asset types
with their counts, each a link into the filtered inventory, and what needs
attention: **new this week**, **unowned**, **high risk** and **awaiting
review**. A lens with no assets says how to discover them, and **Other**
holds assets whose type belongs to no lens. With no assets yet, it shows **No
assets discovered yet** with **Run a discovery scan** and **Open scope**. When
the correlator finds likely duplicates, an alert with **Review** appears here
(see [Possible duplicates](#possible-duplicates)).

Each asset is also described along further axes: **Criticality** (Critical,
High, Medium, Low), **Zone** (Internal, External, Cloud, Partner, Vendor, Shadow
IT: the network zone, not the scan scope), **Exposure** (Public, Restricted, Private, Isolated, Unknown:
how reachable it is from the internet) and a **Risk score** (0 to 100, from
criticality, exposure and findings; see
[Risk scoring](06-prioritization.md#risk-scoring)).

### One asset type

Every asset type is a filter of the inventory: pick it under **Add filter ›
Type**, or open a link such as `/assets?types=host` (`&sub_type=` for a sub-type, for
example IAM users). With one type selected, the list becomes that type's
page:

- The header names the type, and the columns after the name are the type's
  own (for example DNS for a domain, ports for an IP address, issuer and
  validity for a certificate). **Add filter** adds the type's properties.
- **Add {type}** (needs `assets:write`) opens a form built from the type's
  fields, and **Export** writes the list as CSV.
- A scannable type shows, per row, whether scans can reach the asset.
- A row's menu holds the type's actions (for example **Scan** and **Sync from
  source** for a repository, **Open link**, **Copy IPs**, **Copy name**),
  **Edit** and **Delete**.

The add and edit form sets the type's fields, the **Criticality**, **Zone**,
**Exposure**, the **Business Impact (CIA)** ratings (see
[Scoping](03-scoping.md#how-business-context-raises-criticality)), an **Owner
Reference** and, for some types, the group.

**Lowering an asset's risk needs a reason, and sometimes approval.** Raising the
**Criticality** or **Exposure**, or setting the crown-jewel flag, applies at once.
Lowering the criticality, marking an internet-facing asset isolated or removing the
crown-jewel flag drops the priority class of the findings on the asset, so when
that would move an open P0 or P1 finding to a lower class the edit dialog shows
the impact (how many open findings move, and how many from P0 or P1), asks for a
**reason** and then follows the organization's approval policy and level, the same
one as a false positive (**Settings › Findings › Finding approvals**):

- A person the policy lets decide alone is applied at once and audited at high
  severity.
- Otherwise the lowered fields are held and the dialog shows "waiting for
  approval" while the rest of the edit applies. The requester and the asset's
  owners never approve; an approver (permission `findings:approve`) decides
  through the API for now (`POST /assets/{id}/risk-requests/{request_id}/approve`
  or `/reject`), and the requester can cancel. The console has no approval banner
  on the asset page yet.
- A lowering that drops no open P0 or P1 finding applies as before. In the
  inventory, **Set criticality** on several assets decides each asset the same
  way: an asset that needs a reason or an approval is reported as failed.

### Asset details

Clicking an asset in a list opens its detail panel (a drawer; the expand icon in
its header, or **Open full page** in the row menu, opens the same details as the
full page `/assets/{id}`):

![The detail drawer of the subdomain www.example.com: state and scope badges, Key facts, risk, scope and scanning, ownership and exposure]({{ site.baseurl }}/assets/images/user-guide/asset-drawer.png)
*Figure: The asset drawer.*

- The header shows the asset's state with the scan-scope answer next to it
  (**In scope**, **Not in scope · passive only**, **Excluded**, **Not ours**,
  the same answer the inventory's **Scope** column and the scan gate give),
  its classification, a **Control plane** badge when it is one, the named
  **Criticality**, **Exposure** and **Zone** badges ("Criticality: Medium",
  "Exposure: Public", "Zone: Internal"; the zone is the network zone, not the
  scan scope) and its CIA ratings, with **Edit** and **Delete**.
- **Overview** opens with **Key facts**, then **Technologies** (what runs on
  it, by category, with **View all**), the risk summary (**Why this score?**
  unfolds the factors of the risk score and the open findings that drive it),
  the **Scope and scanning** card, ownership, the description, exposure,
  discovery, **All properties** and **Related assets**.
  - **Key facts** shows what matters for the asset's type: for a domain or
    subdomain what it resolves to (every address), its CNAME, hosting (ASN
    and network owner), HTTP server header, TLS with version, technologies
    with versions and DNS records as a table; for an IP address its network
    owner, reverse DNS, location and open ports; for a service its endpoint,
    product, TLS and HTTP response; for a certificate its subject, every
    alternative name, issuer, validity and key; for a host its operating
    system, addresses and hardware; a repository and a cloud storage
    resource show their own facts. A long list shows its first values and a
    **+N** button that opens the full list with **Copy all**.
  - **Scope and scanning** says whether scans can reach the asset and why
    ("In scope through the scope entry *.example.com"; **Why** opens the
    ownership panel), with the actions you may take: **Scan now**, **Add to
    scope**, **Mark out of scope**, and **Confirm and allow scanning** for a
    name that resolves only through a wildcard DNS record. Each action is
    hidden without its permission.
    A certificate has no address of its own, so a scope entry cannot match its
    fingerprint. Its card judges the certificate by the endpoints that served
    it: "In scope because *host* serves it and the scope entry *pattern* covers
    that endpoint" when one of them passes the scope check, or "Held because
    *host* is *reason*" (third-party infrastructure, a wildcard DNS name, not
    covered by a scope entry, marked not yours, held by a platform guardrail)
    with a link to the endpoint. With no known endpoint there is nothing to
    scan. Endpoints outside your data scope are not named. The card also says
    whether the certificate is yours (a name in it is under one of your domains
    or a verified domain) or a third party's. Ownership never authorizes a
    probe, and a certificate never brings its endpoint into scope.
  - **All properties** is folded until opened, with a search. Record lists
    (DNS records, open ports) read as tables, and dates as local dates.
  - **Related assets** lists one line per kind of relationship, with its
    count and the first related assets; **View all** opens **Relations**
   .
- **Owners**: **Add Owner** with a role (Primary, Secondary, Stakeholder,
  Informed, Regulatory), and the direct access grants.
- **Timeline**: what changed on the asset, and when (a value or the source that
  decides it).
- **Relations**: the related assets, grouped by relationship and
  read from this asset in plain words: **Resolves to** and **Names that resolve here**,
  **Alias (CNAME) of**, **Exposes**, **Serves certificate**, **Runs on** and
  **Hosts**, **Part of**, **Depends on** and **Used by**, and so on. Each
  group shows its count and its first assets, most critical first, and
  **Show all** pages through the group with a name search. Each related asset
  shows its criticality, **Internet-facing** when it is public, its state
  when it is not active and **Control plane** when it is one, and each link says who recorded it (**Scanner**, **Import**, **Added by
  hand** or **Inferred**), with **low confidence** when it applies and when a
  scan last reported it ("not seen for N days" once it is stale). Related
  assets you cannot access are never shown, only counted ("2 related assets
  you can't access"). For up to 30 links, **Graph** draws them.
  **Add relationship** picks the **Relationship Type** and one or more
  **Target Asset** entries, with an optional description, **Confidence**,
  **Impact Weight** (1 to 10) and the **Control-plane dependency** flag.
  Relationships can be edited or removed from a related asset's menu.
- **Technologies** (when probes fingerprinted any): each technology with its
  category, version, confidence, source and first and last sighting.
- **Software**: what the asset runs (from SBOM uploads of CI, service and
  version detection scans, or an endpoint sensor), matched against known CVEs,
  with the severity counts of each version. A name that matches no product the
  vulnerability feed knows is marked **No CPE match: CVEs not checked**.
- **Findings**: the asset's findings.
- **Details**: ownership and scope (with "Is it yours?" when you can decide it),
  which source decides each attribute, **Data freshness** (when DNS records,
  the web service, ports, the TLS certificate, the registration and the network
  owner were last observed), **Coverage** (for each check this kind of asset
  needs: its state, why it was skipped, when it last succeeded, and whether it is
  a gap), timeline, technical details and **Identity history** (the merges that
  formed this asset).

![The full page of the subdomain app.example.com: criticality, risk score, exposure and properties]({{ site.baseurl }}/assets/images/user-guide/asset-detail.png)
*Figure: Asset details.*

The asset page (`/assets/{id}`) summarizes criticality, risk score, exposure and
findings, with its properties and identity.

### Groups

**Groups** (`/assets/groups`) organizes assets into logical groups by
environment and criticality, to track risk and findings per group and to use as
scan targets and team scopes.

![The Asset groups page with six groups, their environment, criticality and risk score]({{ site.baseurl }}/assets/images/user-guide/asset-groups.png)
*Figure: Asset groups.*

1. The cards: **Groups**, **Critical groups**, **Assets in groups** and
   **Average risk score**.
2. **New group** (needs the asset-groups write permission) opens a wizard:
   **Basic Info** (name, description, **Environment**: Production, Staging,
   Development or Testing; **Criticality**; optional business unit, owner and
   tags) → **Add Assets** → **Review** → **Create Group**.
3. Filter by environment, criticality, findings and risk score; search; **Export
   as CSV** or **Export as JSON**.
4. A row's menu: **Quick view**, **Open full page**, **Edit**, **Add assets**,
   **Manage assets**, **Copy ID**, **Copy link** and **Delete**.
5. Select groups to change their **Criticality** or **Environment**, or
   **Delete** them.

Deleting a group unassigns its assets; the assets themselves are kept. A group's
page shows its asset distribution, finding severity and risk, and its assets and
findings.

### Activity

**Activity** (`/assets/changes`) shows what changed on your assets.

- The kinds of change, with their counts in the period: **Appeared**,
  **Disappeared** (no scan has seen the asset within the stale threshold),
  **Newly exposed**, **Exposure changes**, **Shadow IT** and **Values**.
- For the first five, pick the period (24 hours, 7 days, 30 days or 90 days);
  **Internet-facing only** narrows the list. Each change shows the asset, the
  change (appeared, disappeared, seen again, exposure, internet reachability,
  renamed, reclassified), the old and new value, the current exposure, the
  source and when.
- **Values** (`/assets/changes?view=values`) lists every change of an asset
  value or of the source that decides it, newest first, filtered by
  attribute, source or asset tag.

### Needs attention

**Needs attention** (`/assets/attention`) is a list of the reasons an asset
needs attention, in two groups, each row with a count and a line on why. The
counts come from the same lists the queues show, so they cover only assets you
may open.

- **Fix on the asset**: **No owner** (`/assets/attention/no-owner`),
  **Criticality not set** and **Not scanned** (no successful scan in 30 days).
  The queue lists the assets with that gap, with the inventory's bulk actions
  (**Assign owner**, **Set criticality**, tags) and **Open in the inventory** for
  the same filter.
- **Review**: **Relationships** (listed only while that module is on) and
  **Possible duplicates**, described below.

Each reason page has a back link, the reason as a heading that opens a menu to
switch reason (with counts), the why line and **Open in the inventory**.

![The Needs attention page: reasons in two groups, Fix on the asset and Review, each with a count]({{ site.baseurl }}/assets/images/user-guide/assets-needs-attention.png)
*Figure: Assets > Needs attention.*

#### Relationships

**Relationships** (`/assets/suggestions`) lists relationships the platform detected
between assets. Approving one creates the link, which enriches the graph that
[exposure chains and attack paths](06-prioritization.md#exposure-chains-and-attack-paths)
use.

1. **Scan** generates new suggestions.
2. Each suggestion shows the **Source**, the **Relationship**, the **Target**,
   the **Reason** and the **Confidence**.
3. Click the relationship to change its type (for example Contains, Resolves to,
   Runs on, Depends on, Exposes, Authenticates to, Protected by).
4. **Approve** or dismiss (**X**) each one, select several and **Approve**, or
   **Approve all**. Approving asks for confirmation because it creates
   relationships.

Approving needs the assets write permission.

#### Possible duplicates

When the correlator flags assets that are likely the same (shared IP address,
shared identifier, renamed host, name or IP match), **Needs attention ›
Possible duplicates** (`/assets/duplicates`) lists them, and the category view
shows an alert with **Review** that opens the same page.
For each set it shows which asset to keep (with its findings) and which to merge
into it. **Merge** moves all findings onto the kept asset; **Keep separate**
leaves them apart. Both need the asset delete permission. An asset's merge
history appears under **Identity history** in its details.

### Asset lifecycle

Assets that are no longer seen can be retired automatically; see
[Asset lifecycle](10-settings-and-integrations.md#asset-lifecycle).

## Credential leaks

**Discovery › Credential leaks** (`/credentials`) lists leaked passwords, keys
and tokens tied to your organization, from breaches, code and the dark web. It is
separate from **Exposures › Secrets** (secrets committed to your own code).

1. The cards: **Total leaks**, **Active**, **Critical**, **High** and
   **Resolved**.
2. Search; filter by status (Active, Pending, Resolved, Inactive) and source (Dark
   web, GitHub/GitLab, Phishing, Data breach, Internal, Other; the source is
   classified automatically).
3. Group by **Identity** to see every leak of one email or username together, or
   use **No grouping** for the flat list.
4. Columns: credential, source, username, leak date, status, classification and
   risk. **Export** downloads CSV.
5. Click a leak for its risk score, severity, days since the leak, the leak
   details (source, username, credential type, leak date) and the **Related** leaks
   of the same identity. **Mark resolved** closes an active leak.

The leaked secret is masked. **Reveal** needs the reveal permission and a recent
sign-in, and every reveal is recorded in the audit log.

Credential leaks arrive through imports and integrations; the console does not
add, edit or delete them by hand.

## Software components (SBOM)

**Discovery › Components** (`/components`) is your software bill of materials:
the packages your repositories, images and hosts are built from, where they are
used, their vulnerabilities and their licenses. It is the basis of supply-chain
security. Packages come from sensors that run an SCA tool, from CI jobs that
upload a report and from SBOM imports; there is no manual add or delete. See also
[Exposures and findings](05-exposures-and-findings.md).

![The Components page with totals, vulnerable components, ecosystems and licenses]({{ site.baseurl }}/assets/images/user-guide/components.png)
*Figure: Software components.*

- The header has **Export SBOM**, **Import VEX** (needs the approve permission
  on findings) and **Import SBOM** (needs the components write permission).
- The strip shows **Packages** (with the versions and assets behind them),
  **Vulnerable**, **Known exploited** (CISA KEV), **Fix available** and
  **Outdated**; each of the first four filters the list. The view switch offers
  **All**, **Vulnerable**, **Known exploited**, **Fixable** and **Direct
  dependencies**.
- The list has one row per package: **Package**, **Versions** in use,
  **Assets** (with direct and transitive uses), **Vulnerabilities** (open, by
  severity), **Fix**, **License**, **Risk** and **Last seen**. Search by name or
  namespace; the filters (a side panel, or **Filters** on a phone) cover
  **Risk**, **Severity**, **Has open vulnerabilities**, **Known exploited (KEV)**,
  **Fix available**, **Ecosystem**, **Dependency** (direct or transitive),
  **Scope** (runtime, development, test, build, optional or provided) and
  **License**. Search, sort, page and filters are kept in the address.
- Click a package for its page (`/components/{id}`): the package URL (with a copy
  button), licenses, KEV flag and risk, and the tabs **Versions** (with the
  version to upgrade to, and a hint when it is a major version), **Where used**
  (the asset, version, direct or transitive, scope, manifest and open findings;
  **Show how this package is brought in** lists the dependency paths, and
  **Graph** draws the asset's dependency graph, with the vulnerable packages and
  every path to them highlighted), **Vulnerabilities** (with links to the
  findings of each CVE; **Include closed findings** adds the closed ones) and
  **VEX**.
- With no packages yet the page says **No components yet** and offers **Import
  SBOM** or **Set up a sensor**.
- License verdicts follow the organization's license policy under **Settings ›
  Findings & assets › License policy**.

### VEX statements

The **VEX** tab lists the statements about the package: status (**Not
affected**, **Affected**, **Fixed** or **Under investigation**), justification,
the versions or range, every asset or one asset, a review date, and whether it
was written or imported. **New statement**, **Edit** and **Delete** need the
approve permission on findings. A **Not affected** statement does not close
findings by itself: it asks for false positive approval for the open findings it
covers (a person approves it, and the findings stay open until then), and
**Fixed** resolves them. Statements also apply to findings reported later, and a
statement for every asset needs access to every asset. **Import VEX** reads an
OpenVEX, CSAF VEX or CycloneDX VEX document (JSON, up to 5 MB) in three steps
(file and optional asset, preview, import); statements about packages not in the
inventory are skipped. See [Known false positives](known-false-positives.md).

### Import an SBOM

**Import SBOM** is a three-step dialog: choose the **asset the SBOM
describes** and the file (CycloneDX 1.4 to 1.6 or SPDX 2.2 and 2.3, JSON, up to
50 MB), check the **preview** (new, unchanged and recorded-but-not-in-the-file
packages, and skipped entries; nothing is written yet) and import. Packages the
file lists replace the ones recorded for the same manifest.

### Export an SBOM

**Export SBOM** opens a dialog:

1. Choose the **Format**: CycloneDX (1.6 JSON) or SPDX (2.3 JSON).
2. Choose the **Contents**: **One asset** or **Every asset I can see**.
3. Click **Download**. The server builds the document from the components you
   may see and your browser saves it (`sbom-<date>.cdx.json` or
   `sbom-<date>.spdx.json`).

The document lists each component with its package URL, licenses (SPDX
identifiers where the license is one), ecosystem and vulnerability count. The
API is `GET /api/v1/components/sbom?format=cyclonedx|spdx`, with an optional
`asset_id` for one asset (permission `components:read`). An inventory of more
than 10,000 components is refused: export one asset at a time.
