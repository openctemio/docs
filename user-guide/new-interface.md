---
title: What changed in the new interface
parent: User guide
nav_order: 0.5
---

# What changed in the new interface

The web console has a new look. Your data, your permissions and the CTEM
stages in the sidebar are the same, and old links keep working. This page lists
what moved and what now works differently, so you can find your way at once.

![The CTEM dashboard: what would cut exposure most, then the exposure flow from the sources to the outcomes]({{ site.baseurl }}/assets/images/overview/dashboard.png)
*Figure: The dashboard in the new interface.*

## In short

- **Every list works the same way**: a title row with the count, one toolbar
  (search, **Add filter**, **Display**), filters shown as chips, and a quick
  view when you click a row.
- **Every record page works the same way**: findings, assets, remediation
  tasks, pentest campaigns and vulnerabilities open with one header, one main
  action, a **More** menu and tabs right under the header.
- **Your account and your organization's settings are apart**: **Account
  settings** and **Organization settings** are both in the menu under your
  avatar.
- **Settings are regrouped by task**, and a few pages were merged.
- **Phones get the full console**: lists turn into cards, menus open as sheets
  from the bottom of the screen, and nothing is hidden for lack of room.

## Around every page

**The sidebar** keeps the CTEM stages (**Scoping**, **Discovery**,
**Prioritization**, **Validation**, **Mobilization**) and **Insights**. Its top
group holds **Dashboard**, **My work**, **Findings**, **Vulnerabilities**,
**Approvals** and **Ready to close**. The footer link to the settings is now
called **Organization settings**.

**The header** shows where you are (each step is a link), then:

- **Search or run a command** (<kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>):
  pages, settings and actions in one box.
- **Create** (+): start a scan, add an asset or a finding, import results,
  create a remediation task or invite people from anywhere.
- **Pending approvals**: the requests waiting for your decision, with their
  number.
- The notification bell, the theme switch and your avatar menu.

**The avatar menu** has **Account settings**, **Organization settings**,
**Language**, **Theme** and **Sign out**.

See [Find your way around](01-getting-started.md#find-your-way-around).

## Your account and your organization

| Before | Now |
|---|---|
| **Settings › My account › Profile, Security, Preferences** | **Account settings** (avatar menu): **Profile**, **Security**, **Preferences** and **Organizations**, in an area of their own with **Back to your organization** at the top |
| **Settings › My account › Notifications, Activity, Connected applications** | **Organization settings › Your membership**, with the new **Membership** page (your role, since when, and **Leave organization**) |
| **All settings** in the avatar menu | **Organization settings** |

## Settings

The settings rail has new groups. Every page keeps its address, except the
merged pages, whose old addresses open the new page.

| Before | Now |
|---|---|
| **Access & security** › Members, Teams, Roles, Service accounts, API keys, AI assistants (MCP), Directory sync (SCIM) | **People and access** |
| **Access & security** › Authentication, Domains, Trusted organizations, SSO approvals | One page, **Sign-in and oversight › Sign-in**, with two tabs: **Sign-in** (two-factor, re-verification, email verification, IP allowlist) and **Joining** (who may join, personal accounts, verified domains, trusted organizations, SSO changes) |
| **Access & security** › Security overview, Audit log, Support access | **Sign-in and oversight** |
| **Findings & assets** › Finding approvals | **Approvals**, a group of its own |
| **Findings & assets** | **Findings and assets** |
| **Scanning** › Tools, Tool defaults, Capabilities, Sensor products, Proxies, and the scanner content pages | **Tools and sensors**, with the sub-headings **Detection content** and **Scanner content** |
| **Organization** › Usage & limits | **Organization › Usage and limits** |
| **Integrations** › SIEM | **Integrations › Event forwarding** |

Settings pages share one layout: one column of sections, one save bar at the
bottom that appears when you change something, and a danger zone at the end
where there is one. The settings overview (`/settings`) starts with a search box
and **Needs attention**. See [Settings and integrations](10-settings-and-integrations.md).

## Lists

Findings, assets, scans, runs, vulnerabilities, exposures, components,
remediation tasks, approvals and the other lists now share one pattern:

- **A title row** names what you are looking at, with one count, **Refresh**
  and, where it applies, **Export**. When you change a saved view or a quick
  view, the row says **Modified** and offers **Save view** and **Reset**.
- **One toolbar.** On findings, assets and scans, a **Basic** | **Query** switch
  comes first. Then the search box, the list's fixed choices (on findings,
  **Practice** and **State**), **Add filter** (or the <kbd>F</kbd> key) and
  **Display** (row density and columns). The separate filter panel opens from
  **Add filter › Show the filter panel**.
- **Filters are chips** under the toolbar. Click a chip's text to change that
  filter where it is; its x removes it.
- **Short rows.** A row's name stays on one line; other values wrap to at most
  two lines, and what is still cut short is in the tooltip and in the quick view.
- **A click on a row opens a quick view** over the list, with previous and next
  to move through the rows (<kbd>J</kbd> and <kbd>K</kbd> on findings). The name
  is a real link: <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+click opens the full page in a
  new tab.
- **The row menu is the same on a desktop and a phone.** An action that does
  not apply stays in its place, disabled, and says why.
- **Empty lists say why** (nothing yet, nothing matches, no permission, or the
  list could not be loaded) and offer one next step.

Some names changed on the findings list: the **Dispositioned** state is now
**Dismissed** (false positives, accepted risks and duplicates), and the KEV and
EPSS badges are in their own **Signals and EPSS** column. The **Assets**
inventory now opens sorted by risk, highest first, and the scoping decisions
waiting for you are a count on its **Needs attention** tab. See
[The findings list](05-exposures-and-findings.md#the-findings-list) and
[List toolbars](01-getting-started.md#list-toolbars).

## Record pages

A finding, an asset, a remediation task, a pentest campaign or a vulnerability
opens with the same layout:

- **The header**: what the record is (type and identifier chips), its place in
  the list it came from ("2 of 27", with previous and next), its title, **one
  main action** chosen by its state (for example **Mark fix applied** on a
  finding in progress, or **Mark fixed** on a task), and a **More** menu (copy
  the link or the ID, and the rarer actions).
- **Tabs** right under the header. A finding has **Overview**, **Evidence**,
  **Validation**, **Remediation**, **Data flow**, **Pentest details**,
  **Related** and **Details**, as they apply. An asset has **Overview**,
  **Findings**, **Relationships**, **How we found this**, **Ports and services**, **Web**,
  **Owners and access** and **Activity**, as they apply.
- **The details** (owner, dates, scores) are a list beside the tabs on a wide
  screen and under the header on a narrow one.

**Triage mode** is now a page of its own: the finding on one side, your decision
on the other, with **Undo last** and **Exit** in the header.

## The dashboard

The dashboard's name is its switcher: the arrow after the name opens your other
dashboards, **New dashboard** and **Manage dashboards**. Each widget has one
menu: **Open list** (the list the figure counts), **Show table** or **Show
chart**, and how the figure is counted. See [The dashboard](01-getting-started.md#the-dashboard).

## CI/CD

**Discovery › CI/CD** has one row of tabs: **Pipelines**, **Runs** and
**Coverage**, then **Connections**, **Gate** and **Pull request feedback**. The
old **Settings** tab is split across the last three, and break-glass moved to
the **Runs** tab, next to the run it unblocks. **Connect a CI provider** is the
one way to add a CI trust. See [CI/CD quickstart](../scanning/ci-quickstart.md).

## Attack surface and scope

**Discovery › Attack surface** has one row of tabs instead of five views with a
second switch under them: **Overview**, **Technologies**, **Certificates**,
**Web surface**, **Exposures**, **Lookalikes**, **Changes**, **Page changes**,
**Discovery** and **Review** (the decisions that used to be under
**Discovery › Decisions**). **Posture** opens from the Overview. See
[Attack surface](04-discovery.md#attack-surface).

**Scoping › Scope** keeps its tabs (**Scope**, **Domain proof**, **Networks**,
**Programs**, **Letters**). Entries, exclusions and the changes waiting for
approval are one list on **Scope**: **Show** in its toolbar picks which. See
[Scope](03-scoping.md#scope).

## Forms and dialogs

Every form, wizard and create or edit dialog uses one frame: each field has its
label above it and its help or error under it, and the buttons are in one row at
the bottom. The main button stays available: when something is missing, it says
what under the field instead of staying greyed out. A wizard shows its steps at the top. Leaving a form with unsaved
changes asks first.

## On a phone

- Lists show cards, and **Show 25 more** under the last card instead of page
  numbers. To select cards, choose **Select** in the toolbar's **More** menu.
- Action menus and pickers open as sheets from the bottom of the screen.
- Page tabs are one row you can swipe.
- The way back to the list leads the header of a record page.

## Sign-in pages

Sign-in, sign-up, password links, two-factor setup, choosing an organization
and the other pages outside the console share one frame: the brand, then one
card with the form. What you enter and the steps are the same.
