---
title: Settings and integrations
parent: User guide
nav_order: 10
---

# Settings and integrations

**Settings** (in the sidebar footer) is where you shape the platform to your
organization: its details, which features are on, the policies it applies, how
scanning is set up, and how it connects to your other tools. Inside the settings
area the sidebar is replaced by the settings rail; **Settings** (`/settings`)
shows every settings page you can open, grouped as in the rail, and the rail has
a filter box. The pages are also searchable from the command palette
(<kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>).

| Group | Pages |
|---|---|
| My account | Profile, Security, Preferences, Notifications, Activity: see [Your account](01-getting-started.md#your-account) |
| Organization | General, Modules, Audit log |
| Access | Members, Teams, Roles, Authentication, Directory sync (SCIM), SSO approvals, API keys, AI access (MCP): see [Team and access](02-team-and-access.md) |
| Policies | Risk scoring, SLA policies, Asset lifecycle, Scope policy, Scan freeze windows, Pentest methodology |
| Scanning | Scan profiles, Scanner templates, Template sources, Source credentials, Tools, Capabilities, CI/CD integration, Scanner content |
| Integrations | All integrations, Source control, Vulnerability scanners, Ticketing, Notification channels, SIEM |

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

The page has one **Save** for the active tab. Without permission the fields are
locked and say why.

**Delete this organization** (owner only) is at the bottom of the General tab.
It deletes everything in the organization (assets, findings, scans, members,
roles, settings and its audit log). User accounts survive and keep their other
organizations. You confirm by typing the organization's name.

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

### Audit log

See [Audit log](02-team-and-access.md#audit-log).

## Policies

- **Risk scoring** (`/settings/risk-scoring`): see
  [Prioritization › Risk scoring](06-prioritization.md#risk-scoring).
- **SLA policies** (`/settings/sla-policies`): see
  [Mobilization › SLA policies](08-mobilization.md#sla-policies).
- **Scope policy** (`/settings/scope`): see
  [Scoping › Scope policy](03-scoping.md#scope-policy).
- **Pentest methodology** (`/settings/pentest`): see
  [Validation](07-validation.md#pentest-methodology-and-the-finding-library).

### Asset lifecycle

**Settings › Policies › Asset lifecycle** (`/settings/asset-lifecycle`) moves
stale assets out of the active inventory automatically, so that you focus on
fresh exposure. It needs the `team:update` permission; without it the page says
**Insufficient permissions**.

- **Stale threshold (days)**: 3 to 365, default 14.
- **Discovery grace (days)**: 0 to 90, default 3.
- **Excluded source types**: integration, collector, scanner, manual, import
  (manual and import are excluded by default).
- **Pause lifecycle when ingest is silent** (on by default), so a broken feed
  does not retire your whole inventory.
- **Enabled** turns the worker on. It stays locked until you have run a dry run:
  click **Run dry-run**, then **Run now**, and check how many assets **Would be
  flagged stale**.

Click **Save changes**.

### Scan freeze windows

**Settings › Policies › Scan freeze windows** (`/settings/scanning/freeze-windows`)
sets times when no active scan of the organization is dispatched, for maintenance
or a change freeze. Scheduled runs start when the window ends; passive discovery
and imports continue. Windows that apply to a single scan zone are set on the
zone.

1. Click **Add freeze window**.
2. Enter a **Name** (for example "Weekend patching") and a description.
3. Choose whether it **Repeats** **Every week** (days and times) or happens
   **Once** (start and end), and the **Time zone**.
4. Keep it **Enabled** (a disabled window holds nothing and releases what it
   held) and save.

An active window shows a banner across the console. Deleting a window releases
the work it holds at once. Adding and editing windows needs the scan-zone write
permission.

## Scanning

These pages define what runs where and how. Deploying sensors is covered in
[Sensors](../sensors/index.md); tools are described in
[Tools and capabilities](../scanning/tools.md).

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

### Scanner templates

**Scanner templates** (`/settings/scanning/templates`) holds custom Nuclei,
Semgrep and Betterleaks templates, uploaded here or synced from template sources,
validated and versioned.

- **Upload template**: choose the **Template Type**, a **Name** and description,
  and the file (Nuclei and Semgrep YAML, Betterleaks TOML) or paste its content.
  It is validated as you go.
- Filter by type and status (Active, Pending review, Deprecated, Revoked).
- A row's menu: **Download**, **Deprecate** (deprecated templates cannot be used
  in new scans; the template is not deleted) and **Delete**.

### Template sources

**Template sources** (`/settings/scanning/template-sources`) are external places
custom templates are synced from.

1. Click **Add source**, give it a **Name**, the **Template Type** and a cache
   time.
2. Choose the source: **Git** (repository URL, branch, optional path), **S3**
   (bucket, region, optional prefix) or **HTTP** (URL, timeout).
3. Pick the authentication and, if it needs one, a credential from **Source
   credentials**.
4. **Auto Sync on Scan** (on by default) refreshes the source before scans.

A row's menu: **Sync now**, **Disable** / **Enable**, **Edit** and **Delete**.

### Source credentials

**Source credentials** (`/settings/scanning/credentials`) stores, encrypted, the
credentials that template sources use to authenticate: Git tokens, cloud keys and
more. **Add credential** with a name, an optional expiry date (you are reminded
before it expires) and the credential type (for example API key, basic, bearer
token, SSH key, AWS role). Secret values are never shown again after you save
them; when you edit, leave them empty to keep them. Integrations such as
source control and ticketing store their own credentials on their own pages.

### Tools

**Tools** (`/settings/scanning/tools`) lists the tools your sensors report, and
whether a scan with each can run now.

![The Tools settings page listing the tools the sensors report, their status and versions]({{ site.baseurl }}/assets/images/scanning/tools.png)
*Figure: Settings, Scanning, Tools.*

- Filter by readiness (**Ready**, **Offline only**, **No sensor**, **Outdated**,
  **Disabled**, **Updates available**), category and type (built-in or custom);
  **Show full catalog** includes tools no sensor has yet.
- Each tool shows its category, status, sensors, versions and last report, and
  an **Enabled** switch.
- Open a tool for how to add it to a sensor and which sensors have it.
- **Add tool** registers a custom tool for your own scanner (name, category,
  install method, commands, capabilities, supported targets, output formats).
  Custom tools can be edited and deleted; built-in tools cannot.

### Capabilities

**Capabilities** (`/settings/scanning/capabilities`) is the taxonomy of what
tools can do; tools are matched to scan steps by capability. The **Platform** tab
lists built-in capabilities (read-only); the **Custom** tab lists yours. **Add
capability** (on the Custom tab) sets a display name, a code name, a description,
a category, an icon and a colour. Deleting a capability in use shows the tools and
sensors that use it and asks you to confirm.

### CI/CD integration

**CI/CD integration** (`/settings/scanning/ci`, also the **Trust and gate** tab of
**Discovery › CI/CD**) lets CI jobs (GitHub Actions, GitLab CI, Azure Pipelines,
Bitbucket Pipelines, CircleCI, Jenkins) send results with their own identity
instead of a stored API key, and decides what fails a pipeline. Changing it needs
an owner or admin. See [CI integration](../scanning/ci-integration.md).

![The CI/CD integration settings with a GitHub Actions trust configuration]({{ site.baseurl }}/assets/images/scanning/ci-trust.png)
*Figure: Settings, Scanning, CI/CD integration.*

- **Require OIDC for CI**: CI jobs must use their OIDC identity; when off, CI
  sensor API keys are still accepted.
- **Trust**: **Add trust** for a CI provider, limited to owners, repositories,
  branches and tags, environments and events, optionally to protected branches
  only. Admitting fork pull requests shows a warning, because fork code would act
  with the repository's identity. Each trust gives a **Pipeline snippet** to
  copy.
- **Gate policy**: what fails a pipeline, for the organization, per business unit
  or per repository: **Enforce** or **Warn**, the severity that fails, an
  optional EPSS threshold, **New findings only** and **Known exploited (KEV)
  fails**. A committed secret, and a scanner that fails to run, always fail the
  pipeline; accepted risks, false positives and suppressions are always honored.
- **Break-glass**: override the gate for one repository and commit for a limited
  time (1 to 168 hours) with a reason. Every override is audited and can be
  revoked.

### Scanner content

**Scanner content** (`/settings/scanning/content`) sets how fresh the
vulnerability databases, templates and rules your sensors scan with must be: how
often sensors check for updates, and for the Trivy databases, Nuclei templates and
Semgrep rules a **Maximum age (hours)**, an optional **Pinned version** and, for
Semgrep, the rulesets. **Apply to sensors now** sends the policy to every sensor
that manages its content. Content sources (registries, mirrors) are configured on
the sensor host. Changing it needs an admin.

## Integrations

**Settings › Integrations › All integrations** (`/settings/integrations`) is the
hub: one card per category (**Source control**, **Vulnerability scanners**,
**Ticketing**, **Notification channels**, **SIEM**) and a table of every
connection with its category, status (Connected, Disconnected, Error, Pending,
Expired, Disabled), last sync and **Manage**. Start from a category card to
connect your first tool. Integrations are configured per organization, with the
organization's own credentials.

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
- The live Tenable.sc and Nessus Pro connector is **paused**: connecting it for
  rolling scan coverage is unavailable for now, and connectors created earlier
  are listed as paused (findings they already brought in are kept). Imports of
  `.nessus` exports work.

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
3. **Routing rules** send tickets to different projects by severity, asset scope,
   asset criticality or finding tags. Rules are checked top to bottom and the
   first match wins; otherwise the default project is used.

A row's menu also has **Test connection** (when not connected), **Sync now**
(re-checks the connection) and **Delete**. This is what powers **Create Jira
ticket** on findings and **Create Jira Epic** on remediation campaigns. Jira is
the only ticketing system the console connects to; for GitHub Issues, use your
GitHub source-control connection.

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
3. Under **Advanced Settings**, choose a message template, whether to include
   details, and a rate limit (5 to 60 minutes).
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
