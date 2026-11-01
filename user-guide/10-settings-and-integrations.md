---
title: Settings and integrations
parent: User guide
nav_order: 10
---

# Settings and integrations

**Settings** (in the sidebar footer) is where you shape the platform to your
organization: its details, how it is protected, who may sign in, the policies it
applies, how scanning is set up, and how it connects to your other tools. Inside
the settings area the sidebar is replaced by the settings rail.

| Group | Pages |
|---|---|
| My account | Profile, Security, Preferences, Notifications, Activity, Connected applications: see [Your account](01-getting-started.md#your-account) |
| Organization | General, Modules, Usage & limits, AI |
| Access & security | People and roles: Members, Teams, Roles. **API access**: Service accounts, API keys, AI assistants (MCP). **Sign-in**: Authentication, Domains, Directory sync (SCIM), Trusted organizations, SSO approvals. **Oversight**: Security overview, Audit log, Support access. See [Team and access](02-team-and-access.md) |
| Findings & assets | Finding lifecycle, Finding approvals, SLA policies, Pentest methodology. **Risk and threats**: Risk scoring, Vulnerability matching, Emerging threats, License policy. **Assets**: Asset sources, Asset lifecycle |
| Scanning | Scope policy, Scan approval, Scan windows, Sensor job safety. **Tools**: Scan profiles, Tools, Tool defaults, Capabilities. **Sensors**: Sensor products, Proxies. **Scanner content**: Content catalog, Scanner templates, Detection rules, Wordlists, Content freshness, Source credentials |
| Integrations | All integrations, Source control, Vulnerability scanners, Ticketing, Ticket field mapping, Import mappings, Notification channels, SIEM |

The rail is grouped by the task a page serves, so a page sits next to the others
you use for that task. Only the rail, the **Settings** overview and the command
palette follow this grouping: every page keeps its address, permission and module
gate, so older links keep working. **Wordlists** (`/settings/scanning/wordlists`)
is described in [EASM](../scanning/easm.md), and **Emerging threats**
(`/settings/emerging-threats`) is on the same rail.

Pages that depend on a module or a limit appear only when it applies: for
example **Usage & limits** is listed only while a limit applies to your
organization, and a page whose module is off is hidden.

### Find a setting

**Settings** (`/settings`) lists the page names of each group (a page's
one-line description shows on hover and is searched) and has a search box, and so
has the settings rail. Both find pages and the settings inside them: typing `ip allowlist`, `2fa` or
`interactsh` lists the page and the setting (for example **Authentication ›
IP allowlist**). Opening a setting goes to its page, scrolls to it and outlines
it for a moment. The command palette (<kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>)
finds the same pages and settings. A setting's address (for example
`/settings/authentication#ip-allowlist`) can be shared.

### Save changes

On a settings form, a bar appears at the bottom of the page as soon as you
change something: **Discard** puts back the saved values, **Save changes** (or
<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>S</kbd>) saves them. Leaving the page with
unsaved changes asks first. A switch that applies at once (no Save) says so next
to it. A change that weakens protection (for example two-factor no longer
required, an emptied IP allowlist, or scan jobs allowed to use callbacks) is
listed and confirmed before it is saved. Security pages show who changed them
last, with a link to the audit log.

Loosening a protection needs a recent sign-in, is audited at high or critical
severity and tells every owner and administrator, while tightening needs none.
This covers the asset lifecycle (turning it on, a shorter stale threshold or
grace period, running while an integration is unhealthy, fewer excluded source
types), the CTEM cycle coverage requirement (turned off), the attack-surface
monitoring settings (a monitor, enrichment or the digest turned off, a longer
interval or reappear window, web screenshots on), scan approval (lowering strict,
on, off, or loosening an enforcing rule) and finding approvals.

Almost every create, edit and delete action here is hidden or disabled according
to your permissions. Administrative changes usually need the **Owner** or
**Admin** role, or permissions such as `team:update`.

## Organization

### General

**Settings › Organization › General** (`/settings/general`) has two tabs:

- **General**: the **Organization information**: the logo (hover to upload; it
  stays unsaved until you save), the **Organization name**, **URL slug** and
  **Website**.
- **File storage**: where uploaded files such as pentest evidence are stored:
  **Local filesystem**, **Amazon S3** or **MinIO (S3-compatible)**, with the
  bucket name, region, endpoint (for MinIO, for example
  `https://minio.example.com:9000`), access key and secret key. Only
  administrators can change it.

![The General settings of the organization: name, URL slug and website]({{ site.baseurl }}/assets/images/user-guide/settings-general.png)
*Figure: Settings, General.*

The page saves with the bar at the bottom (see [Save changes](#save-changes)).
Without permission the fields are locked and say why. Only the owner can change
the **URL slug**, and not while single sign-on is configured (the sign-in
addresses registered at your identity provider use it).

The owner's **Danger zone** at the bottom of the General tab has two actions:

- **Transfer ownership**: opens Members, where you choose the new owner (see
  [Transfer ownership](02-team-and-access.md#transfer-ownership)).
- **Delete organization**: closes the organization for everyone at once and
  deletes everything in it (assets, findings, scans, members, roles, settings and
  its audit log) after **14 days**. Until then nobody can use it: sign-ins, API
  keys, AI assistant tokens, sensors, directory sync, CI and inbound webhooks
  are refused, and scheduled work stops. Any owner can cancel the deletion from
  the sign-in page during those 14 days (see
  [Organization suspended or scheduled for deletion](01-getting-started.md#organization-suspended-or-scheduled-for-deletion)),
  and everything works again as before. User accounts survive and keep their
  other organizations. You confirm by typing the organization's name.

Leaving an organization is in **My account › Profile**, for every member.

Each user chooses their own time zone, date format and theme under
[Preferences](01-getting-started.md#preferences). Organization sign-in rules are
under [Authentication](02-team-and-access.md#sign-in-policy).

### Modules

**Settings › Organization › Modules** (`/settings/modules`) turns product areas
on or off for your organization. A module that is off disappears from the
sidebar and its permissions are left out of the role editor.

- The cards: **Total modules**, **Enabled**, **Disabled** and **Core (always
  on)**. Core modules are required for the platform to work and cannot be turned
  off.
- **Products** narrows the platform to the products you pick; with none selected
  every module is available.
- **Fine-tune features**: individual modules grouped by CTEM stage (Scoping,
  Discovery, Prioritization, Validation, Mobilization, Insights & Reporting,
  Operations & Data, Settings & Integrations). Toggle them and click **Save
  changes**, or **Discard**.
- Modules depend on each other ("Needs N", "Used by N"). When a change would
  break a dependency, the page tells you which modules block it and offers to
  **Enable required** modules or to **Disable them too**. Some changes warn that
  another module will degrade.
- **Remove my changes** resets every module to the default (all enabled), after
  confirmation.

If a page in this guide is missing for your organization, its module is probably
off here.

### Usage & limits

**Settings › Organization › Usage & limits** (`/settings/limits`, owners and
administrators) shows the limits that apply to the organization, such as seats,
assets, findings, sensors and API keys, and what it uses. The page is listed
only while a limit applies. Limits are set by a platform administrator; see
[Platform administration](11-platform-administration.md#organizations). A limit
never removes anything: new additions over it are refused.

### AI

**Settings › Organization › AI** (`/settings/ai`, shown while the AI triage module is
on) decides whether this organization's findings may be sent to an AI provider
for triage, and which provider reads them. Everyone with settings access can read
the page; only owners and administrators can change it, and a change needs a
recent sign-in and is recorded in the [audit log](02-team-and-access.md#audit-log)
(never the key). Nothing is sent until **Turn on AI triage for this
organization** is on; turning it on asks you to confirm what is sent. The result
of a triage is a suggestion: nothing on a finding changes without a person.

The page opens on a status strip: whether **AI triage** is on, the **Source** of
the AI (**Platform AI**, **Own provider**, **Off** or **Not set up**),
**This month** (tokens used against the limit), **Automatic triage** and how many
**Masked data kinds** there are. Each tile opens the tab that changes it. The
tab is in the URL (`?tab=`), and a settings search result such as AI data masking
opens the right tab.

| Tab | What it holds |
|---|---|
| **Provider** | The consent to AI triage and the **AI source**, with its connection test. |
| **Features** | **Automatic triage** and **AI agents**. |
| **Knowledge** | The sources AI agents cite, for people who may read them (`ai_knowledge:read`). |
| **Limits and data** | **Use and limits** (this month's use against the monthly limit, and the highest TLP sent to AI, with a link to the policy) and **Data masking**. |
| **Activity** | The latest AI events from the audit log, for people who may read it. |


- **What is sent** (folded away until you open it) lists the data of one analysis: the finding's title,
  description, severity and score, source and tool, file path and code snippet,
  CVE, CWE and OWASP ids, and whether the asset is internet-facing. Detected
  secrets are masked first. A pentest finding follows your AI data policy
  (**Settings › Access & security › AI assistants (MCP)**, Policy): a campaign above your TLP limit
  for AI, or with AI turned off by its lead, is never sent.
- **AI source** chooses who runs the analysis:

  | Source | What it does |
  |---|---|
  | **Platform AI** | The provider your platform administrator set up. It counts toward your monthly allowance. |
  | **Own provider** | Your own account with a provider or a server you run: **Anthropic Claude**, **OpenAI**, **Google Gemini** or an **OpenAI-compatible server** (for example Azure OpenAI, vLLM, Ollama, LiteLLM or OpenRouter). Finding content goes to that provider; the platform never sees your key. |
  | **Off** | No AI triage, even when it is turned on above. |

- **Own provider** takes a **Provider**, a **Model** and an **API key**. An
  OpenAI-compatible server also needs a **Base URL**, which must be a public
  https address (private network, loopback and link-local addresses are refused);
  its key is optional. The key is **write-only**: the page shows only that a key
  is set, its last four characters and when it was set, and leaving the field
  empty keeps the saved key. A saved key is sent only to the provider and address
  it was entered for: changing either removes it, and **Remove the saved key**
  removes it on demand. **Test connection** makes one small request with no
  finding data and answers with a fixed reason when it fails (key refused, rate
  limited, timeout, unreachable, address not allowed).
- **Monthly token cap** (**Limits and data** tab). The page shows the tokens used this month. The cap is
  set by the platform administrator and counts your organization's tokens
  whichever key pays for them, so it also limits an organization on its own
  provider; at the cap triage stops until the next month.
- **Automatic triage** (**Features** tab, owners and administrators) sends new
  findings of the chosen **Severities** to the AI provider without anyone asking,
  after **Wait before triage (seconds)** (0 to 3600; it gives duplicate findings
  time to merge first). It works only while AI triage is on. Turning it on, or
  adding a severity while it is on, needs a recent sign-in, is audited at high
  severity (`ai_settings.auto_triage_updated`) and every owner and administrator
  is told. Turning it off, fewer severities and a different delay apply at once.
  The policy is also read and written with `GET` and `PUT
  /api/v1/organization/settings/ai/auto-triage`.
- **Knowledge sources** (**Knowledge** tab): see
  [Settings > AI: knowledge sources](ai-knowledge-sources.md).
- If the platform administrator turns off own providers for the installation
  (Console › **AI provider**), a saved own provider stops at its next call and
  the page says so; switch to **Platform AI** or **Off**. It never falls back to
  the platform key by itself.
- Saving fails with a message when someone else saved a change in the meantime;
  reload and apply yours again.

**AI agents** and **Data masking** are described in
[Settings > AI: AI agents](ai-agents.md) and
[Settings > AI: data masking](ai-data-masking.md), and
[AI suggestions and approval](ai-suggestions-and-approval.md) says how a person decides a
suggestion. See [AI triage](../api/ai-triage.md) for what the analysis returns.

## Access & security

Members, teams, roles, directory sync, API keys and AI assistants are described
in [Team and access](02-team-and-access.md). The pages below are the rest of
this group.

### Security overview

**Settings › Access & security › Security overview** (`/settings/security`, owners and
administrators) checks how well the organization is protected and lists what to
fix first: two-factor for owners and administrators, members without a second
factor, email verification, the IP allowlist, members who have not signed in for
90 days, pending requests to join, API keys that expire soon or are unused, idle
directory sync tokens, sensor job opt-ins, a verified domain and active support
access. Each check says **Passed**, **Warning**, **Risk** or **Information**,
with a link to the page that fixes it, and the page shows a score out of 100
(the two two-factor checks weigh three times as much as the others; information checks do not count). The same
score and the first three things to fix are shown at the top of **Settings**.

![The security overview: a score out of 100 and the checks grouped by area]({{ site.baseurl }}/assets/images/user-guide/settings-security-overview.png)
*Figure: Settings, Security overview.*

### Authentication

**Settings › Access & security › Authentication** (`/settings/authentication`) sets how
people sign in and who may join: see
[Team and access › Sign-in policy](02-team-and-access.md#sign-in-policy). What
scan jobs may do on your sensors is on
[Sensor job safety](#sensor-job-safety).

### Domains

**Settings › Access & security › Domains** (`/settings/domains`; owners change it,
administrators read it) decides what the organization's verified single sign-on
domains do to accounts on them. A platform administrator verifies the domains;
everything here is off until an owner turns it on. For each verified domain
choose who can join with an address on it (**Only people we invite**, **Anyone,
after an administrator approves** or **Anyone, automatically**) and the role they
join as (**Viewer** or **Member**), whether to show the organization to
colleagues who sign up, whether to require single sign-on for every account on
the domain, and whether to block new organizations for accounts on it. A domain
that is not verified, or that another organization also claims, has no effect.

### Trusted organizations

**Settings › Access & security › Trusted organizations**
(`/settings/trusted-organizations`; owners change trusts, administrators read
them) lists partner organizations whose people sign in here with their own
company's single sign-on, and organizations that trust this one. A trust
applies only once both owners agree.

### Audit log

**Settings › Access & security › Audit log**: see [Audit log](02-team-and-access.md#audit-log).

### Service accounts

**Service accounts** (`/settings/service-accounts`) are identities for
integrations, such as a SIEM export or a ticketing bridge, so no integration
borrows a person's key. A new account holds no permission: give it a role under
**Roles** and assets through a team. It acts only through API keys created
on this page; the secret is shown once, and only scopes you hold yourself can be
given. A service account is never an owner or administrator, never has full data
access and never signs in.

- **Who can manage them.** Creating or deleting a service account and creating or
  deleting its keys needs the `service_accounts:manage` permission, which owners
  and administrators hold and a custom role can carry. If a custom role created
  service accounts through member management before, add `service_accounts:manage`
  to it. The **Keys** of an account (prefixes, scopes, creators) are visible to
  owners and administrators only, and the last-used address of a key is shown to
  administrators only.
- **Read-only keys.** API keys are read-only, so the key dialog offers read scopes
  only (`*:read` or `*:view`); a key with a write scope is refused.
- **No full data through a team.** A service account cannot be given full data
  access by joining a team or a team role either; the platform refuses it.
- **Keys end with the person who made them.** When a member who created keys is
  offboarded or leaves, or an administrator or owner is demoted to member or
  viewer, the active keys they created are revoked and audited. The member access
  report lists them and the offboarding result counts them; recreate those keys
  under a person who stays.

## Findings & assets

- **Finding lifecycle** (`/settings/finding-lifecycle`): your own
  sub-statuses, the moves between statuses and the requirements each move
  needs. See [Exposures and findings](05-exposures-and-findings.md).
- **Finding approvals** (`/settings/finding-approvals`): who decides false
  positives and accepted risks, and who is told. The **Approval policy** card
  sets, separately, whether a second person approves a **False positive** and a
  **Risk acceptance**: **Always** (the default), **Only for serious findings** or
  **Never** (see [Known false positives](known-false-positives.md)). Whoever
  decides, a reason is required, the decision is audited, and an accepted risk
  ends on its date. Below it, **Approval tiers and approvers** sets how many
  people approve each kind of request by how risky the finding is, a security
  pool and how long a decision lasts; and a **Backup contact** is an advisor or
  auditor outside the organization who is emailed when the only member approves
  their own request. An organization with one member can accept a risk alone
  only when **Risk acceptance** is **Only for serious findings** or **Never**;
  such an acceptance ends sooner (7 days for P0 or known exploited, 45 for P1,
  90 otherwise). A lower level (two people to one), a lower second-look share or other relaxing
  change takes effect 24 hours after you save it, while it shows as waiting with
  a **Cancel the change** button; it is audited as critical, and every owner,
  administrator and approver is told (the notice says **Finding approvals
  lowered** and names a lowered second-look share); a stricter one
  applies at once. Changing it needs an owner or administrator with
  `settings:write` and a recent sign-in.
- **Vulnerability matching** (`/settings/vulnerability-matching`): opens
  findings when a published CVE affects a product version your assets run.
  Changing it needs `team:update`.

- **Risk scoring** (`/settings/risk-scoring`): see
  [Prioritization › Risk scoring](06-prioritization.md#risk-scoring).
- **SLA policies** (`/settings/sla-policies`): see
  [Mobilization › SLA policies](08-mobilization.md#sla-policies).
- **Pentest methodology** (`/settings/pentest`): see
  [Validation](07-validation.md#pentest-methodology-and-the-finding-library).

### License policy

**Settings › Findings & assets › License policy** (`/settings/license-policy`) sets
which open-source licenses your packages may use. Turn on **Evaluate licenses**,
then add ordered rules, each matching one SPDX license id or a category
(permissive, weak copyleft, copyleft, proprietary, public domain, unknown) with
the action **Allow**, **Review** or **Deny**, and choose the verdict for a known
license no rule matches. Denied licenses open findings; review verdicts open
medium findings only if **Open findings for review verdicts** is on, otherwise
they show only in the inventory. Saving evaluates the inventory and reports how
many packages were flagged. Changing it needs `settings:write`.

### Asset lifecycle

**Settings › Findings & assets › Asset lifecycle** (`/settings/asset-lifecycle`) moves
stale assets out of the active inventory automatically, so that you focus on
fresh exposure. It needs the `team:update` permission; without it the page says
**Insufficient permissions**.

- **Stale threshold (days)**: 3 to 365, default 14.
- **Discovery grace (days)**: 0 to 90, default 3.
- **Excluded source types**: integration, collector, scanner, manual, import
  (manual and import are excluded by default).
- **Pause lifecycle when ingest is silent** (on by default), so a broken feed
  does not retire your whole inventory. Loosening the lifecycle needs a recent
  sign-in (see [Save changes](#save-changes)).
- **Enabled** turns the worker on. It stays locked until you have run a dry run:
  click **Run dry-run**, then **Run now**, and check how many assets **Would be
  flagged stale**.

Click **Save changes**.

### Asset sources

**Settings › Findings & assets › Asset sources** (`/settings/asset-sources`, owners and
administrators) chooses which source decides each kind of asset value
(criticality, owner, exposure) when scans, imports, connectors, feeds and people
disagree.

## Scanning

These pages define what runs where and how.

- **Scope policy** (`/settings/scope`): see
  [Scoping › Scope policy](03-scoping.md#scope-policy).

### Scan approval

**Settings › Scanning › Scan approval** (`/settings/scanning/scan-approval`)
sets which scans need a person's approval before they run. The mode is **Off**
(the default: nobody approves, scope entries take effect at once), **On** (the
approval rules decide which scans are held) or **Strict** (as On, with two
distinct approvers and a justification for each held scan, and scope entries need
approval too). Only an owner changes the mode, with a reason. Rules can start
from a preset (**Light**, **Standard**, **Strict**), run in **Monitor** mode to
record what they would hold, and be tried on existing scans. A platform
administrator can set the mode for the whole installation or an organization;
the page then shows it as in force.
 Deploying sensors is covered in
[Sensors](../sensors/index.md); tools are described in
[Tools and capabilities](../scanning/tools.md).

### Scan windows

**Settings › Scanning › Scan windows** (`/settings/scanning/scan-windows`) sets
when scans may touch which targets. Each policy is one of two kinds:

- **Allow: scan only inside the windows** (testing windows, such as business
  hours).
- **Blackout: never scan inside the windows** (maintenance, change freezes).

A policy selects its targets by **Tags**, **Groups**, **Asset types**,
**Criticality**, **Business units**, **Scope entries**, **Zones** or bug-bounty
**Programs** (or **Every target**), and has weekly slots or dated one-off
windows in a time zone. It applies to all tools, to active and intrusive
tools, or to intrusive tools only, and may cap rate and concurrency.
**Grace (minutes)** is how long running work may finish after its window
closes (15 minutes by default).

Work outside its windows **waits** instead of being refused: a manual run
during a blackout starts and waits, a scheduled run with nothing open is
deferred to the next opening, and a step with targets inside and outside is
split so the open targets go now. Waiting does not count against the run's
deadline. A target whose windows never open refuses the run with
`SCAN_WINDOW_NEVER_OPENS`. When a window closes under a running task, the
task gets its grace, then goes back to the queue and its sensor is told to
stop. **Preview** shows why a target cannot be scanned now and when it can.

Managing policies needs `scans:windows:manage`. **Override windows** lifts
the policies for 15 minutes to 24 hours in an emergency, with a reason and a
current authenticator code (`scans:windows:override`, owners and
administrators); it is audited and every owner and administrator is notified.
Bug-bounty program testing windows are never lifted.

Freeze windows from earlier releases were converted to blackout policies on
upgrade.

### Sensor job safety

**Settings › Scanning › Sensor job safety** (`/settings/scanning/sensor-safety`,
read by administrators, changed by the owner) sets what scan jobs may do on your
sensors. A sensor's own local policy always decides first: these settings only
narrow what is sent.

- **Private targets need a sensor-local policy**: jobs that scan private
  addresses go only to sensors whose network owner installed a local policy.
- **Allow out-of-band callbacks (interactsh)** and **Allow custom templates**:
  off by default; turning one on is audited at critical severity.
- **Refuse tools that skip TLS certificate verification**. The User-Agent and
  headers your scans send moved to **Settings > Scanning > Scan
  identification** ([Scan identification](../scanning/scan-identification.md)).
- **Sensor keys and shared sensors**: the key-bound sensor identity and key
  binding requirements and the shared sensors opt-out. Each of these switches
  applies as soon as you change it.

The scan-job fields are saved with the bar at the bottom of the page; turning
protection off is listed and confirmed first.

### Scan profiles

**Scan profiles** (`/settings/scanning/profiles`) are reusable scan
configurations: which tools run, how intensively and for how long.

- **Add profile**: **Create custom profile** or **Add preset profile** (Discovery
  Scan, Quick Security Check, Full Security Scan, Compliance Audit; a preset you
  already have is marked **Exists**).
- A custom profile has a **Name**, **Description**, **Intensity** (Low, Medium,
  High), **Timeout (minutes)**, **Max Concurrent Scans**, the **Tools** it runs
  (for example Semgrep, Trivy, Nuclei, Betterleaks, Checkov, Grype, Syft) and
  **Set as Default**.
- A row's menu: **Set as default**, **Edit**, **Clone** and **Delete** (system
  profiles cannot be deleted).
- A profile's quality gate and which profile is the default apply to the whole
  organization, so only owners and administrators change them; members do not
  see **Set as default**.

### Tools

**Tools** (`/settings/scanning/tools`) lists the tools your sensors report, and
whether a scan with each can run now.

![The Tools settings page listing the tools the sensors report, their status and versions]({{ site.baseurl }}/assets/images/scanning/tools.png)
*Figure: Settings, Scanning, Tools.*

- Filter by readiness (**Ready**, **Offline only**, **No sensor**, **Outdated**,
  **Disabled**, **Updates available**), category and type (built-in or custom);
  **Show full catalog** includes tools no sensor has yet.
- Each tool shows its category, status, sensors, versions and last report, and
  an **Enabled** switch (owners and administrators; the switch applies to the
  whole organization).
- Open a tool for how to add it to a sensor and which sensors have it.
- **Add tool** registers a custom tool for your own scanner (name, category,
  install method, commands, capabilities, supported targets, output formats).
  Custom tools can be edited and deleted; built-in tools cannot.

### Tool defaults

**Tool defaults** (`/settings/scanning/tool-defaults`) are the options every
sensor of your organization runs each tool with. A sensor can override any
option in its own tool settings. The order is: the tool's default, these
organization defaults, then a sensor's overrides; a scan or workflow step can
only lower rate, concurrency and retries, and a sensor's local policy can always
narrow further. Tools appear once a sensor reports them. Owners and
administrators change the defaults, and the page lists sensors whose tool
version refuses a default.

### Sensor products

**Sensor products** (`/settings/scanning/sensor-products`) is for sensors your
organization builds itself on the sensor SDK (sdk-go). Record each product's
**Latest release** and **Minimum release** (versions such as `v1.4.0`), and its
sensors on **Discovery › Sensors** show **update available** below the latest
release and **unsupported** below the minimum. Without a recorded release, such
a sensor shows only whether its SDK is current. Products your sensors report
but that are not recorded yet are suggested above the list.

![Settings, Scanning, Sensor products, with one product and its latest and minimum release]({{ site.baseurl }}/assets/images/sensors/sensor-products.png)
*Figure: Settings, Scanning, Sensor products.*

Every member who can read sensors sees the list; adding, changing or removing a
product needs the sensors write permission and is audited. A recorded release
line changes what your organization sees only: authorization and job dispatch
never depend on it. First-party products (names that start with `openctemio-`)
are managed by the platform and cannot be added, and at most 50 products can be
recorded. See
[How the console judges a sensor's version](../sensors/operate.md#how-the-console-judges-a-sensors-version).

### Capabilities

**Capabilities** (`/settings/scanning/capabilities`) is the taxonomy of what
tools can do; tools are matched to scan steps by capability. The **Platform** tab
lists built-in capabilities (read-only); the **Custom** tab lists yours. **Add
capability** (on the Custom tab) sets a display name, a code name, a description,
a category, an icon and a colour. Deleting a capability in use shows the tools and
sensors that use it and asks you to confirm.

### CI/CD integration

CI trust, the gate policy and break-glass are not settings pages: they are on
the **Settings** tab of **Discovery › CI/CD** (`/ci-cd`), which shows every section on one page, in the order a pipeline is set up: Trusted pipelines, Gate policy, Pull request feedback and Break-glass. The page lets CI
jobs (GitHub Actions, GitLab CI, Azure Pipelines, Bitbucket Pipelines, CircleCI,
Jenkins) send results with their own identity instead of a stored API key, and
decides what fails a pipeline. Trust, the CI settings and pull request
feedback need an owner or admin (`scans:ci:write`). Gate policies and
expected scans need `scans:ci:policy`, and break-glass `scans:ci:override`:
both can be given to an AppSec team through a custom role from the **AppSec
engineer** template. Creating or changing a trust, changing the CI settings,
loosening a gate policy, connecting a code host and creating a break-glass
ask for a recent sign-in. See
[CI/CD quickstart](../scanning/ci-quickstart.md) and
[CI integration](../scanning/ci-integration.md).

![The CI/CD integration page with a GitHub Actions trust configuration]({{ site.baseurl }}/assets/images/scanning/ci-trust.png)
*Figure: Discovery, CI/CD, Settings.*

- **Connect a pipeline** (button in the page header on every tab, for owners and administrators): a four-step wizard (CI system, organization and
  default branch, pipeline snippet, first run) that creates the trust, or
  reuses one that already admits the organization, and waits for the
  pipeline's first run.
- **Require OIDC for CI**: CI jobs must use their OIDC identity; when off, CI
  sensor API keys are still accepted.
- **Trust**: **Add trust** for a CI provider, limited to owners, repositories,
  branches and tags, environments, events and **Pipeline definitions** (only
  jobs that run your central workflow), optionally to protected branches and
  tags only. Admitting fork pull requests shows a warning, because fork code
  would act with the repository's identity. The audience must contain the
  organization id (default `openctem:tenant:<id>`). A GitHub trust can name a
  **GitHub Enterprise issuer** (GitHub Enterprise Server or an enterprise's
  own issuer). Each trust gives a **Pipeline snippet** to copy.
- **Recent refused pipelines**: pipelines whose identity no trust admitted, with
  the rule that refused each one and how to fix it. The latest three show; the
  rest open on request. The **Pipelines** tab also says when pipelines were
  refused in the last 7 days and links here.
- **Gate policy**: what fails a pipeline, for the organization, per business unit
  or per repository: **Enforce** or **Warn**, the severity that fails, an
  optional EPSS threshold, **New findings only**, **Known exploited (KEV)
  fails** and **Dependency and image vulnerabilities block only when a fix
  exists** (off by default). A committed secret, a scanner that fails to
  run, and a missing expected scan always fail the pipeline. False positives
  and approved suppressions are always honored, and accepted risks until
  their end date.
- **Break-glass**: override the gate for one repository and one full commit id
  for a limited time (1 to 168 hours) with a reason. Every override is audited
  and can be revoked.
- **Pull request feedback**: install the OpenCTEM GitHub App or connect a
  GitLab group with a group access token, so the gate shows as a check or
  commit status with comments on the pull request.

### Scanner content

The rules, templates and other content your sensors scan with, and where they
come from.

### Content catalog

**Settings › Scanning › Content catalog** (`/settings/content`) is the
catalog of signed packages of rules, templates and other content. Installing one
makes it available to the whole organization. The tabs are **Catalog** (browse
and install), **Installed** (update, roll back, uninstall), **Requests** (members
ask, an approver decides) and **Settings**, where **Require approval** makes a
second member approve every install, update, rollback and uninstall. Turning it
on takes effect at once; turning it off takes effect 24 hours later.

### Scanner templates

**Scanner templates** (`/settings/scanning/templates`) holds custom Nuclei,
Semgrep and Betterleaks templates, uploaded here,
validated and versioned.

- **Upload template**: choose the **Template Type**, a **Name** and description,
  and the file (Nuclei and Semgrep YAML, Betterleaks TOML) or paste its content.
  It is validated as you go.
- Filter by type and status (Active, Pending review, Deprecated, Revoked).
- A row's menu: **Download**, **Deprecate** (deprecated templates cannot be used
  in new scans; the template is not deleted) and **Delete**.

### Source credentials

**Source credentials** (`/settings/scanning/credentials`) stores, encrypted, the
credentials stored for fetching scanner content: Git tokens, cloud keys and
more. **Add credential** with a name, an optional expiry date (you are reminded
before it expires) and the credential type (for example API key, basic, bearer
token, SSH key, AWS role). Secret values are never shown again after you save
them; when you edit, leave them empty to keep them. Integrations such as
source control and ticketing store their own credentials on their own pages.

### Content freshness

**Content freshness** (`/settings/scanning/content`) sets how fresh the
vulnerability databases, templates and rules your sensors scan with must be: how
often sensors check for updates, and for the Trivy databases, Nuclei templates and
SAST rules a **Maximum age (hours)**, an optional **Pinned version** and, for
the SAST rules, registry rulesets. **Apply to sensors now** sends the policy to
every sensor that manages its content. Content sources (registries, mirrors) are
configured on the sensor host. Changing it needs an admin.

Without rulesets, sensors run the OpenCTEM SAST rules pack (signed releases of
[openctemio/sast-rules](https://github.com/openctemio/sast-rules)); a pinned
version is a pack release such as `v0.1.0`. Registry rulesets are fetched by your
own sensors from the registry, under the registry's licence; scans the platform
runs on its own sensors never use them.

## Integrations

**Settings › Integrations › All integrations** (`/settings/integrations`) is the
hub: one card per category (**Source control**, **Vulnerability scanners**,
**Ticketing**, **Notification channels**, **SIEM**) and a table of every
connection with its category, status (Connected, Disconnected, Error, Pending,
Expired, Disabled), last sync and **Manage**. Start from a category card to
connect your first tool. Integrations are configured per organization, with the
organization's own credentials.

Connecting, changing, disabling or deleting an integration, creating a
notification channel or changing a channel's settings asks you to confirm your
identity again (a recent sign-in or an authenticator code), because these change
where your data goes.

### Source control

**Source control** (`/settings/integrations/scm`) connects GitHub, GitLab,
Bitbucket or Azure DevOps so you can import repositories for scanning.

1. Click **Add connection**, pick the **Provider**, name the connection, check
   the **Base URL**, optionally set the organization or group, and paste a
   **Personal Access Token** with read access to repositories.
2. **Test Connection**, then **Add Connection**.
3. From the row menu, **Sync repositories**, select the repositories and
   **Import** them. Imported repositories appear under the repository assets.

A row's menu also has **Test connection**, **Edit** and **Delete** (deleting a
connection keeps the imported repositories but stops syncing them).

### Vulnerability scanners

**Vulnerability scanners** (`/settings/integrations/scanners`) imports Nessus and
Tenable scan exports: hosts become assets and vulnerabilities become findings.

- **Import .nessus** opens the same **Import results** dialog as the findings
  list: choose the file, **Preview** (required before importing), then
  **Import**. Results below Low are left out from this page.
- **Connect Tenable.sc** (Beta) links a Tenable Security Center you run. The
  connector runs as its own image next to your Tenable.sc and keeps its API
  keys: see [Tenable.sc connector](../sensors/connector-tenable.md). Pick the
  connector's sensor and the instance name from its config. Each connector
  card shows the sync state, the Tenable.sc version and license use, the
  allow-lists the connector's owner set, and **Sync now**, **Edit** and
  **Remove** for administrators (`integrations:manage`).
- **Rolling coverage** (in the connector dialog) scans your inventory through
  the connector in batches that fit the Tenable.sc license: choose the scan
  policy and repository, an optional lower license cap and a safety margin.
  **License rotation** stays **off** unless an administrator confirms that
  your Tenable license terms allow rotating more assets through the license
  than it holds; then **aging** waits for Tenable.sc's nightly cleanup of the
  rotation repository between batches, and **recycle** has the connector
  recreate that repository (an option its owner must allow). The coverage
  panel shows the license, the current batch and the cycle's progress.
- Connectors are **Beta**: the parts of the Tenable.sc API only its
  documentation describes are confirmed on a first real installation.

### Ticketing

**Ticketing** (`/settings/integrations/ticketing`) connects **Jira Cloud** to
create and track remediation tickets.

1. Click **Connect Jira**. Enter a **Connection name**, the **Jira base URL**
   (for example `https://example.atlassian.net`), the **Atlassian account
   email**, an optional **Default project key** (for example `SEC`) and an **API
   token**. The connection is tested when you create it.
2. **Configure** the connection:
   - the **Default project**;
   - **Bidirectional status sync**: when a finding's status changes, move the
     linked Jira issue to match (Jira-side changes already sync back);
   - the **Issue type**, the **Default priority** and the **Severity → Jira
     priority** mapping (by default Critical → Highest, High → High, Medium →
     Medium, Low → Low, Info → Lowest);
   - the Jira status names used for outbound changes, and an **inbound status
     mapping** from Jira statuses to finding statuses (confirmed, in progress or
     fix applied).
3. **Ticket field mapping** (`/settings/integrations/ticketing/mappings`) maps
   OpenCTEM attributes to Jira fields, the Jira fields that come back and the
   status mapping, per project and issue type. Without a mapping, tickets use
   the built-in fields: summary, description, priority from severity and labels.
4. **Routing rules** send tickets to different projects by severity, asset scope,
   asset criticality or finding tags. Rules are checked top to bottom and the
   first match wins; otherwise the default project is used.

A row's menu also has **Test connection** (when not connected), **Sync now**
(re-checks the connection) and **Delete**. This is what powers **Create Jira
ticket** on findings and **Create Jira Epic** on remediation campaigns. Jira is
the only ticketing system the console connects to; for GitHub Issues, use your
GitHub source-control connection.

#### What a ticket may contain

Every ticket, ticket update and workflow ticket action passes one outbound
check, for Jira and GitHub Issues alike:

- **Pentest findings** go to a tracker only from their campaign: the campaign
  lead's **Create tickets for open findings** under the campaign's Jira epic. **Create Jira
  ticket** on the finding, remediation task issues and workflow ticket actions
  refuse them (403, `TICKET_EGRESS_REFUSED`).
- **TLP:** a campaign marked TLP:RED is never sent. A campaign above the
  organization's tracker limit is refused, and updates to its existing tickets
  stop. The limit is the pentest setting `ticket_max_tlp`
  (`PATCH /api/v1/tenants/{tenant}/settings/pentest`, owners and
  administrators): `clear`, `green`, `amber` (default) or `amber_strict`.
- **Secret findings** send the location only: never the value, its masked
  preview, the code snippet or the fingerprint.
- **Findings that expose data** (a data exposure risk above none) send the
  severity, status and location only, under the title "Data exposure finding".

**Link an existing issue** on a finding needs the fix-claim permission
(`findings:fix_apply`) as well as `findings:write`: moving a linked issue to
Done claims the fix.

### Notification channels

**Notification channels** (`/settings/integrations/notifications`) sends
security alerts to **Slack**, **Microsoft Teams**, **Telegram**, **custom
webhooks** and **email (SMTP)** for the whole organization. Your personal in-app
notifications are set under
[My account › Notifications](01-getting-started.md#notifications-1).

![The Notification channels page with a connected Slack channel]({{ site.baseurl }}/assets/images/user-guide/notification-channels.png)
*Figure: Settings, Integrations, Notification channels.*

1. Click **Add channel** and pick the provider: a webhook URL for Slack, Teams
   and custom webhooks; a bot token and chat ID for Telegram; SMTP server
   settings and recipients for email.
2. Name the channel, choose the **Severity Filters** (Critical and High by
   default) and the event types to send.
3. Under **Advanced Settings**, choose a message template, whether to **Include
   details in notifications**, and a rate limit (5 to 60 minutes). Details are
   off by default: messages carry only the event type, severity and a link, with
   no finding or asset names. Turn it on to send finding titles and descriptions
   to that channel.
4. Click **Create Channel**, then **Send test** from the row menu. A toast says
   whether the test was delivered.

**View events** shows what each channel sent and whether delivery succeeded;
**Queue** shows notifications waiting to be delivered or retried, where failed
entries can be retried. Both need the integrations manage permission. See
[Notification channels](../configuration/notifications.md).

### SIEM

**SIEM** (`/settings/integrations/siem`) forwards findings, exposures, scans and
SLA breaches to **Splunk** through the HTTP Event Collector (HEC).

1. Click **Add Splunk HEC**.
2. Enter a **Name**, the **HEC endpoint URL** (for example
   `https://splunk.example.com:8088`), the **HEC token** (stored encrypted) and,
   optionally, the **Index** and **Sourcetype**.
3. Click **Create integration**, then **Send test event** from the row menu.

Events go out through the same delivery queue and filters as notifications.
