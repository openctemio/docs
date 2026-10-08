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

**Discovery › Scans** has three tabs: **Scans** (the saved scans and their
schedules), **Runs** (every run they produced) and **Workflows** (the scan
workflows a scan can run). The header has **Quick scan** and **New scan** (both
need the scan write permission). See also [Scans and scan runs](../scanning/scans-and-runs.md).

### Quick scan

**Quick scan** runs a scanner on a few targets now, without saving anything.

1. Paste the **Targets**, separated by new lines, commas or semicolons.
2. Pick the **Scanner** from the active scanners in the tool registry.
3. Click **Start Scan**. Follow the run under **Runs**. If you want to run it
   again later, **Save as scan** keeps the targets and scanner as a saved scan.

### New scan

**New scan** opens a four-step wizard: **Basic Info → Targets → Options →
Schedule**. Each step is checked before you can go on; click a completed step to
go back.

1. **Basic Info**
   - **Scan Name** (required), for example "Production Security Scan".
   - **What to run**: a **Single check** (one scanner on the targets) or a
     **workflow** (one of your organization's scan workflows or a system
     workflow), with a preview of what each step would run.
   - **Advanced Options › Sensor Preference**: **Auto** (the platform picks the
     best available sensor), **Your sensors** (only your organization's
     sensors) or, when offered, **Platform scanning** (the platform's shared
     scanning, for public targets only).
2. **Targets**: combine any of these sources; at least one target is required.
   - **Asset Groups**: tick groups (each shows its asset count).
   - **Individual Assets**: search assets by name and pick them.
   - **Custom Targets**: one per line. Each line is checked as you type:
     domain (`example.com`), wildcard (`*.example.com`), IPv4 or IPv6 address,
     CIDR range (`192.0.2.0/24`), URL (`https://example.com`) or host and port
     (`example.com:8080`). Private addresses (10.x, 172.16-31.x, 192.168.x) are
     scanned only inside a scan zone, and localhost may be blocked.
   - **Total Selected Targets** sums all sources. A **Scope check** shows which
     targets your [scope](03-scoping.md#scope) allows; refused targets must be
     fixed before the scan can start.
3. **Options**
   - **Targets per job** (1 to 50): how many targets one sensor job scans.
     Smaller jobs spread a scan over more sensors.
   - **Reliability**: **Timeout (seconds)** (up to 24 hours), **Max retries**
     (0 to 10; 0 means no retry) and **Retry backoff (s)**.
4. **Schedule**
   - **When to run?**: **Run immediately** or **Schedule for later**, with the
     **Frequency** (Once, Daily, Weekly, Monthly), the **Day** for weekly scans
     and the **Time**.
   - Click **Start Scan** or **Schedule Scan**. If the scan is saved but cannot
     start, it stays saved and you can trigger it later from **View Scan**.

When you trigger a scan, the platform may stop it and explain why: a [scan
freeze window](10-settings-and-integrations.md#scan-freeze-windows) is active, a
run of the same targets is already in progress (the sensor runs them one after
the other), or the scope check refused some targets.

### The scan list

The **Scans** tab lists saved scans with their state, type (workflow or single
scanner), schedule and next run, last run and run count.

- Filter by state (**All**, **Enabled**, **Schedule paused**, **Disabled**),
  scan type, schedule and tags; search by name. **Show one-off scans** includes
  quick scans saved as scans.
- A row's menu: **View details**, **Edit**, **Clone**, **Pause** / **Resume**
  and **Delete**.
- Select several to **Activate**, **Disable** or **Delete** them.
- Click a scan to open its page (`/scans/{id}`): run statistics (runs, success
  rate, successful, partial, failed, next run), the upcoming runs of its
  schedule, its configuration (scan type, sensor preference, targets per job,
  targets, tags, scan workflow) and its recent runs. **Delete scan** removes the
  scan and its schedule; past runs and findings stay.

### Runs

The **Runs** tab (`/scans/runs`) lists every run: from scans, quick scans and
retests.

- Filter by status (Running, Pending, Completed, Partial, Failed, Timed out,
  Canceled, Blocked) and by kind, and **Export CSV**.
- Open a run to see its key numbers (findings, tasks, duration), its **Stages**
  (which tool ran which step on which sensor, and which targets were skipped and
  why), its tasks and logs, and its **Timeline** (task events are kept for 30
  days). Jump to the findings it produced from there.
- A running run can be **canceled**; in-flight tasks stop at their next
  heartbeat.

### Scan workflows

A **scan workflow** chains several scan steps (for example subdomain discovery,
then HTTP probing, then vulnerability scanning) into one repeatable graph with
dependencies between steps. Scans run either one scanner or one workflow. See
[Scan workflows](../scanning/scan-workflows.md).

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
targets are, or the platform's shared sensors for public targets. **Discovery ›
Sensors** (`/sensors`) lists your fleet with each sensor's health, jobs, version,
tools and zone, and lets administrators **Install sensor** (create the sensor
and copy its install command and key) or **Pair a sensor** (the sensor makes its
own key; you approve it by comparing a fingerprint), group sensors into **Scan
zones**, and edit, disable, rotate the key of, revoke or delete a sensor.

Deploying and operating sensors is covered in [Sensors](../sensors/index.md).

## CI/CD

**Discovery › CI/CD** (`/ci-cd`) shows the CI/CD pipelines that scan your
repositories from GitHub Actions, GitLab CI and other CI systems, their runs and
repository coverage, with guides for GitHub Actions and GitLab CI. Its **Trust and
gate** tab is the same as
[Settings › Scanning › CI/CD integration](10-settings-and-integrations.md#cicd-integration).
See [CI integration](../scanning/ci-integration.md).

## Attack surface

**Discovery › Attack surface** has two tabs: **Overview** and **Review**. See also
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
  **Run now** (at most once per 15 minutes).
- **Asset breakdown**, **Exposed assets** (**View all** opens the external
  attack surface list) and **Recent changes** (**View all** opens What changed).

**Continuous Certificate Transparency monitoring.** Besides scans, the platform
watches public Certificate Transparency logs (crt.sh, with Cert Spotter as a
fallback) for your domains: domain assets, verified domains and domain scope
entries. It reads public data only, uses no credentials and is protected against
requests to internal addresses. Each run it raises exposure events for new
subdomains (`subdomain_discovered`) and for certificates that are expiring
within 30 days or recently expired (`certificate_expiring`,
`certificate_expired`); see [Exposures](05-exposures-and-findings.md#exposures).
New names also join the inventory: confirmed when they sit under a verified
domain or a permanent scope entry, otherwise waiting in the review queue. DNS
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

**Review** (`/attack-surface/review`) is the ownership queue: names discovery
found that may be yours. Confirming records ownership; a scope entry is still
what lets scans reach a name.

- **Awaiting review** lists the names with their state, confidence, why they may
  be yours (under a verified domain, under a domain you listed, a target you
  scanned, found by one of your scans, covered by a scope entry) and what scope
  entry covers them (or **Add to scope**). **Not ours** lists the names you
  rejected.
- Select names and decide: **Confirm**, **Not ours**, **Dependency** or
  **Monitor only** (needs the assets write permission).
- **Suggested rules** group names by a pattern. **Accept as rule** adds a scope
  entry (which goes through scope approval); **Reject as rule** adds an exclusion
  and marks the names not ours. Each asks for a reason, kept in the audit log.

## The asset inventory

**Discovery › Assets** has five tabs: **Inventory**, **Groups**, **What
changed**, **Web surface** and **Suggestions**.

### Inventory

**Inventory** (`/assets`) opens on the full, filterable list of assets.

- The cards: **All assets**, **Critical**, **Internet-facing**, **Unowned** and
  **With findings**.
- Search by name, description or alias. The filter panel narrows by signals
  (crown jewel or not, has findings or not, not seen for 30+ days or seen
  recently) and tags. **Quick views** offers saved filters.
- Columns: name, type, service facts, criticality, exposure, internet-facing,
  owner, risk, findings, last seen and labels.
- Select rows for bulk actions (they need `assets:write`): **Assign owner**
  (a user or group, with an ownership role), **Set criticality**, **Add tag**,
  **Add to unit** and **Add to service**.
- Click an asset to open its details.

**Category view.** Switch to **Category view** (`/assets?view=categories`) for
the overview by category: **Total assets**, **High-risk assets** (risk score 70
or more), **Average risk score** and **Open findings**, and one card per
category listing its asset types and counts. Categories and types with no data
are hidden. With no assets yet, it shows **No assets discovered yet** with **Run
discovery scan**, **Connect provider** and **Configure scope**. When the
correlator finds likely duplicates, an alert with **Review** appears here (see
[Duplicates](#duplicates)).

| Category | Asset types |
|---|---|
| External Attack Surface | Domains, Subdomains, Certificates, IP Addresses |
| Applications | Web applications, APIs, Mobile Apps |
| Infrastructure | Hosts, Containers, Kubernetes, Services |
| Network & Security | Firewalls, Load Balancers, Switches, Routers |
| Cloud | Cloud Accounts, Storage |
| Data | Databases |
| Identity & Access | Users, Roles, Service Accounts |
| Code & CI/CD | Repositories |

Each asset is also described along further axes: **Criticality** (Critical,
High, Medium, Low), **Scope** (Internal, External, Cloud, Partner, Vendor, Shadow
IT: who owns it), **Exposure** (Public, Restricted, Private, Isolated, Unknown:
how reachable it is from the internet) and a **Risk score** (0 to 100, from
criticality, exposure and findings; see
[Risk scoring](06-prioritization.md#risk-scoring)).

### Pages per asset type

Each row of a category card opens the page for that type, for example
`/assets/domains`, `/assets/hosts` or `/assets/repositories`. These pages share
one layout:

- **Export** (CSV) and **Add {type}** (needs `assets:write`): you can add any
  type by hand, for example a domain, IP address, website, API, host, service,
  container, database, storage bucket, cloud account, network device, mobile
  app, certificate, identity or repository.
- Search, a status filter, **Filter by tags** and **Filter by property**.
- Columns common to all types (status, classification, labels, findings, risk,
  last updated, scope match) plus columns for the type:

  | Type | Type-specific columns |
  |---|---|
  | Domains | Type (root or sub), DNS |
  | IP addresses | ASN / organization, type, open ports |
  | Websites | Status, technologies, TLS |
  | APIs | Type (REST, GraphQL, gRPC, WebSocket, SOAP), auth, endpoints, status, TLS, base URL |
  | Hosts | IP, OS, resources, architecture, ports |
  | Services | Port, protocol, product, status, technologies, TLS |
  | Containers and Kubernetes | Kind, provider, version, namespace |
  | Databases | Engine, size, security |
  | Storage | Provider, region, size, security |
  | Cloud accounts | Provider, account ID, resources, security |
  | Network devices | Device type, vendor / model, firmware, management IP |
  | Mobile apps | Version |
  | Certificates | Issuer, valid until, validity, SANs |
  | Identities | Type, email / ID, provider, MFA |
  | Repositories | Source, visibility, language |

- A row's menu: **View details**, **Edit**, a copy action, type-specific actions
  and **Delete**; select rows to **Delete selected**.
- **Repositories** also show a banner to add or manage source-control
  connections, and **Trigger Scan**, **Sync Now** and **Open in Browser** per
  repository (or **Scan Selected** and **Sync Selected**). A repository opens its
  own page with its branches and findings.

The add and edit form sets the type's fields, the **Criticality**, **Scope**,
**Exposure**, the **Business Impact (CIA)** ratings (see
[Scoping](03-scoping.md#how-business-context-raises-criticality)), an **Owner
Reference** and, for some types, the group.

### Asset details

Clicking an asset in a list opens its detail panel:

- The header shows its status, classification, a **Control plane** badge when it
  is one, and its CIA ratings, with **Edit** and **Delete**.
- **Overview**: risk summary, ownership, description, exposure, discovery,
  service facts, a preview of relationships, tags.
- **Owners**: **Add Owner** with a role (Primary, Secondary, Stakeholder,
  Informed, Regulatory), and the direct access grants.
- **Relations**: the asset's relationships as a list, cards or a graph (all,
  outgoing, incoming). **Add relationship** picks the **Relationship Type** and
  one or more **Target Asset** entries, with an optional description,
  **Confidence**, **Impact Weight** (1 to 10) and the **Control-plane
  dependency** flag. Relationships can be edited or removed.
- **Findings**: the asset's findings.
- **Details**: ownership and scope (with "Is it yours?" when you can decide it),
  timeline, technical details and **Identity history** (the merges that formed
  this asset).

The asset page (`/assets/{id}`) summarizes criticality, risk score, exposure and
findings, with its properties and identity.

### Groups

**Groups** (`/assets/groups`) organizes assets into logical groups by
environment and criticality, to track risk and findings per group and to use as
scan targets and team scopes.

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

### What changed

**What changed** (`/assets/changes`) shows new, gone and newly exposed assets
over a period (24 hours, 7 days, 30 days or 90 days).

- The views: **Appeared**, **Disappeared** (no scan has seen the asset within the
  stale threshold), **Newly exposed**, **Exposure changes** and **Shadow IT**.
- **Internet-facing only** narrows the list.
- Each change shows the asset, the change (appeared, disappeared, seen again,
  exposure, internet reachability, renamed, reclassified), the old and new
  value, the current exposure, the source and when.

### Web surface

**Web surface** (`/assets/web`) shows what your web origins serve: endpoints,
their parameters (names only), the same path across origins, and what changed.

- The cards: **Endpoints**, **Sensitive, no auth**, **Excluded, untested** and
  **Sensitive and untested**.
- The views: **Origins**, **Endpoints** (filter by method, kind and sensitive
  only), **Path patterns** and **Changes** (appeared, gone, status or auth
  changed, new parameter).
- An endpoint under a scope exclusion shows **Never tested** with a link to the
  exclusion.

Web surface fills in when a scan workflow with a web crawl step runs.

### Suggestions

**Suggestions** (`/assets/suggestions`) lists relationships the platform detected
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

### Duplicates

When the correlator flags assets that are likely the same (shared IP address,
shared identifier, renamed host, name or IP match), the category view shows an
alert with **Review**, which opens **Duplicate Review** (`/assets/duplicates`).
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
the packages your repositories and images depend on, their vulnerabilities and
their licenses. It is the basis of supply-chain security.

- The overview: **Total components** (direct and transitive), **Vulnerabilities**
  (critical and high), **License risks** and **Outdated**, with cards for
  vulnerable components, ecosystems and license compliance (each with **View
  all**). When components carry CISA KEV vulnerabilities, an alert at the top
  links to them.
- **All components** (`/components/all`): the full list with the cards **Total
  Components**, **Direct Dependencies**, **Outdated** and **Vulnerable** (click
  to filter), the tabs All, Direct, Transitive, Outdated and Vulnerable, search
  and an ecosystem filter. Click a component for its versions, CVEs and the assets
  that use it. **Export CSV**.
- **Vulnerable components** (`/components/vulnerable`): components with known
  vulnerabilities, by severity, with a **CISA KEV** tab.
- **Package ecosystems** (`/components/ecosystems`): components, vulnerable and
  outdated counts per package ecosystem (npm, PyPI, Maven, Go, ...), to see where
  supply-chain risk concentrates.
- **License compliance** (`/components/licenses`): licenses by category
  (permissive, copyleft or high risk, unknown) and risk, for compliance
  reporting. **Export Report**.

### Export an SBOM

**Export SBOM** (`/components/sbom-export`, with the SBOM export module):

1. Choose the **SBOM Format** (CycloneDX or SPDX) and the **Output Format** (JSON
   or XML).
2. Under **Include in Export**, choose **Vulnerability Information**, **License
   Information** and **Document Metadata**.
3. Click **Export SBOM**; the file downloads in your browser.

{: .note }
The exported file is a simplified, CycloneDX-style list of components (name,
version, package URL, license, vulnerability count). It is not yet a complete
CycloneDX or SPDX document; validate it before handing it to tools that require
the full specification.
