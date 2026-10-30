---
title: Getting started and the dashboard
parent: User guide
nav_order: 1
---

# Getting started and the dashboard

This chapter covers signing in, choosing an organization, accepting an
invitation, finding your way around the console, the dashboard, notifications
and your own account settings.

OpenCTEM is a multi-tenant **Continuous Threat Exposure Management (CTEM)**
platform: each organization's data is fully separated from every other
organization's. The console is organized around the five CTEM stages:

1. **Scoping**: define the attack surface and its business context.
2. **Discovery**: find assets, vulnerabilities and other exposures.
3. **Prioritization**: rank risk by exploitability and business impact.
4. **Validation**: verify that threats are real and that controls work.
5. **Mobilization**: carry out remediation and track progress.

## Sign in

Open the console and go to **Sign in** (`/login`).

![The sign-in page with email and password fields]({{ site.baseurl }}/assets/images/install/sign-in.png)
*Figure: The sign-in page.*

1. Enter your **Email** and **Password** and click **Sign in**. The
   **Forgot password?** link sits next to the password label.
2. Below the form, under **Or continue with**, you may see icon buttons for
   **Google**, **GitHub** and **Microsoft**. Each appears only when the platform
   operator has configured that provider; if none is configured, the block is
   hidden. If you already have a password account with the same email, see
   [Google sign-in for an existing account](#google-sign-in-for-an-existing-account).
3. If your organization uses single sign-on, type your work email: when its
   domain signs in through an organization's SSO, an **Organization SSO**
   section with a **Sign in with {provider}** button appears. A sign-in link
   that ends in `?org=<your-organization>` shows the same section. SSO for an
   organization is set up by the platform administrator (see
   [Identity and access](../identity/index.md)).
4. After repeated failed sign-ins from your network the page asks for a
   **Security check** before you try again.

### Two-factor authentication at sign-in

If you have turned on two-factor authentication, a second step asks for the
**Authentication code** (six digits from your authenticator app); click
**Verify**. If you do not have your phone, choose **Use a recovery code instead**
and enter one of your recovery codes (each code works once).

If your organization **requires** two-factor authentication and you have not set
it up yet, the second step is **Set up two-factor authentication**: scan the QR
code with an authenticator app (or type the secret key), enter the code, click
**Turn on and continue**, then save the recovery codes it shows (**Copy** or
**Download**), tick **I have saved my recovery codes** and click **Continue**.

### Google sign-in for an existing account

If you registered with a password and then click **Google** (or GitHub or
Microsoft) with the same address, the sign-in page says **You already have an
account**: Google is never linked to your account without your say-so. Sign in
with your password (**Forgot your password? Reset it** if needed) and your
second factor. The app then asks **Link Google to your account?**: enter the code
from your authenticator app (or your password, if you do not use two-factor
authentication) and click **Link**. Your other sessions are signed out and you
get an email about it. From then on Google signs you in; if you use two-factor
authentication, the second step still asks for your code. You can also link it
later from **Account > Security > Connected sign-in methods**.

### Where you land after signing in

| You are | You land on |
|---|---|
| A platform administrator | Nowhere in this app: the page says to sign in on the platform console, a separate site with its own sign-in (see [Platform administration](11-platform-administration.md)) |
| A member of one organization | That organization's dashboard (or the page you were sent to) |
| A member of several organizations | **Select an organization**, where you pick one |
| A member of no organization | The onboarding page (see below) |

### Organization suspended or scheduled for deletion

- **Suspended**: when the platform operator suspends an organization, signing in
  to it, and every API key, AI assistant token, sensor and integration of it,
  is refused with **This organization is suspended — contact support**. Nothing
  is deleted; everything works again once the suspension is lifted.
- **Scheduled for deletion**: after an owner deletes the organization it stays
  closed to everyone for 14 days, then it is deleted. When an owner signs in
  during those days, **Organization scheduled for deletion** shows the date and
  offers **Cancel deletion**, which reopens the organization as it was (sign in
  again to open it), or **Continue without it**. Other members cannot open the
  organization until an owner cancels.

{: .note }
In the current release the **Cancel deletion** prompt appears only when the
owner signs in with a password alone. An owner whose sign-in asks for a
two-factor code (or whose organization requires two-factor setup) sees **This
organization is suspended — contact support** instead and cannot cancel from the
sign-in page; contact your platform operator before the 14 days end.

If your own account is blocked by the platform operator, sign-in is refused and
your sessions, API keys and AI assistant tokens stop working.

### Forgot your password

Click **Forgot password?**, enter your email and click **Send reset link**. If an
account exists for that email, you receive a link to **Reset password**: enter a
**New password**, confirm it and click **Reset password**. The link expires after
a limited time (one hour by default); if it has expired, use **Request a new reset
link**.

### Accounts created by an administrator

An owner or administrator can create your account directly instead of inviting
you. You then receive a one-time setup link that opens **Set your password**.
Choose a password, confirm it and click **Set password**, then sign in. Setup
links work once and expire; if yours no longer works, ask your administrator for
a new one.

![The Set your password page with the password and confirmation fields]({{ site.baseurl }}/assets/images/install/set-password.png)
*Figure: Choosing a password from the one-time link.*

## Create an account

By default, accounts are created by administrators and through invitations,
SSO or SCIM; public sign-up is off. The platform operator sets the ceiling
(`SIGNUP_MODE`: `disabled`, `domain` or `open`, see
[Sign-up and invitations](../identity/sign-up-and-invitations.md)) and the
platform console's sign-up policy stays at or below it. The **Sign up** link on
the sign-in page appears only when the policy allows public sign-up, or when you
arrive from an invitation link. When registration is off, `/register` shows
**Registration is disabled**.

When registration is available:

1. Click **Sign up** (or open the link from your invitation).
2. Fill in **First Name**, **Last Name**, **Email**, **Password** and
   **Confirm Password** (and the **Security check**, when the platform shows
   one), and click **Create Account**. The password must meet the platform's
   password policy (at least 12 characters by default).
3. Under public sign-up every address is verified: confirm it from the email
   you receive, then sign in. (An invited account follows the organization's
   email verification setting.)

If you came from an invitation, the email is pre-filled and the invitation is
carried through registration. If the sign-up policy refuses the address, you see
**Your organization isn't set up yet**, which says nothing about whether the
address has an account; with **Request access** on, that page also offers a
request form that an administrator reviews. If your address belongs to an
organization that requires single sign-on, you are sent to the sign-in page to
continue with your organization's SSO.

## Choose or create an organization

An **organization** is your isolated workspace,
with its own assets, findings, members and settings.

- **Several organizations:** you land on **Select an organization**. Click the
  organization to work in. A search box appears when you belong to more than six.
  **Sign out and use a different account** is at the bottom.
- **No organization:** the onboarding page offers what applies to you, after
  your email address is verified:
  - **Invitations** waiting for your address, each with **Accept**.
  - **Your company on {product}**: an organization that verified your email domain
    and lets colleagues join, with **Join** (at once) or **Ask to join** (an
    administrator approves; **Waiting for approval** until then, and you get an
    email when they decide).
  - **Or start fresh**, when the installation lets you create an organization:
    **Set up your first organization** with a **Team name** (the **Team URL** is filled
    in for you; it may contain lowercase letters, numbers and hyphens), an
    optional **Description** and optionally **Products** (leave it empty to get
    every module), then **Create team**. The data region is shown and fixed once
    the organization exists.
  - On installations where only the platform administrator creates
    organizations (the default) and nothing else applies, you see **You are not a
    member of any organization yet**: ask your administrator to add you, or open
    the invitation link you received.

When you may create another organization, **Create a new organization** is also offered
on **Select an organization** and **Create organization** in the organization switcher.

To leave an organization yourself, use **Leave organization** under
**Organization membership** in **Settings > My account > Profile**: every member
can, whatever their role. The only owner cannot leave and the button says why;
transfer ownership first (see
[Team and access](02-team-and-access.md#transfer-ownership)).

## Accept an invitation

An invitation link opens **Invitation**: "{name} invited you to join
{organization}". It shows the organization, **Invited by**, **Invitation for**
(the invited email) and, when three days or fewer remain, when it expires.
**What you get** lists your **Role** (or **Roles**) and the **Teams** you join
(with no team you see data only once a team includes you, unless your role sees
all of the organization's data). It also says when the invitation changes how you
sign in: if you join from outside the organization, members see an **External**
badge next to your name and your access may end on a date; if the organization,
or your roles, require two-factor authentication, you set it up before you can
open the organization. Invitations last seven days by default.

- **Not signed in:** click **Sign in to accept**, or **Create your account** if
  you are new.
- **Signed in:** click **Accept invitation** to join, or **Decline** (it asks for
  confirmation). If you were invited under a different email, choose **Sign in
  with a different account**.

If the invitation has expired or was already used, the page says so; ask the
person who invited you for a new one.

## Find your way around

### The sidebar

- The top group holds **Dashboard**, **My Work**, **Findings** and **Approvals**
  (the false-positive and accepted-risk requests waiting for decisions).
- Below it are the CTEM stage groups (**Scoping**, **Discovery**,
  **Prioritization**, **Validation**, **Mobilization**) and **Insights**.
- The footer holds **Settings** and **Help** (**Documentation**, **Keyboard
  shortcuts**, **Report an issue**, **About OpenCTEM**).
- A **Pinned** section at the top holds the pages, findings quick views and saved
  views you pinned (up to 12 per organization), each view with its live count; see
  [Exposures and findings](05-exposures-and-findings.md#header-and-quick-views).
- Some pages have sub-pages shown as tabs at the top of the page (for example
  **Assets**: Inventory, Needs attention, Groups, Activity).

### The organization switcher

The card at the top of the sidebar shows the current organization. Open it to see
your role, the member count and the **Organization ID** (with a copy
button), and to **Switch organization**.

### The header

From left to right:

- **Search** (or <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>) opens the command
  palette: every page and settings page, the theme, and help.
- **Full screen** toggle.
- The **notification bell** with your unread count. The panel has **Mark all as
  read** and **View all notifications**.
- The **theme** switch: Light, Dark or System.
- Your **avatar menu**: the **My account** pages (Profile, Security,
  Preferences, Notifications, Activity, Connected applications), **All
  settings**, **Language** (English or Vietnamese) and **Sign out**.

![The dashboard in the dark theme]({{ site.baseurl }}/assets/images/overview/dashboard-dark.png)
*Figure: The dark theme, chosen with the theme switch in the header.*

### Permissions in the console

Many buttons are hidden or disabled depending on your permissions. A disabled
control usually explains why on hover. If you cannot find a button described in
this guide, you most likely do not have the permission, or the module is off.

### Keyboard shortcuts

| Keys | Action |
|---|---|
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> | Search pages and settings |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>B</kbd> | Show or hide the sidebar |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd>…<kbd>9</kbd> | Switch to organization 1 to 9 |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> | In a finding drawer: open the full finding page |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>C</kbd> | In a finding drawer: add a comment (when no text is selected) |
| <kbd>C</kbd> | On a finding: open the activity and write a comment |
| <kbd>T</kbd> | On the findings list: open [triage mode](05-exposures-and-findings.md#triage-mode) |
| <kbd>J</kbd> and <kbd>K</kbd> | On a finding opened from a list: the next and the previous finding of that list |
| <kbd>Esc</kbd> | In lists: clear the selected rows |
| <kbd>/</kbd> | In lists: put the cursor in the list's search box |
| <kbd>F</kbd> | In lists: open the filters (on findings and assets: **Add filter**) |

### List toolbars

Every list has the same toolbar. The search box comes first and names what it
searches (for example "Search name, host, IP, version or tool…"); the × in the
box or <kbd>Esc</kbd> clears it. Where the list has a filter panel, the filter
button is joined to the start of the search box and shows how many filters are
applied; while the panel is open the button looks pressed. Status and kind
selects follow the search box. Group, export, refresh and the **View** menu
(row density and columns) sit at the far end. Active filters show as chips in
a row under the toolbar; past six, the rest are behind a **+N** button.

## The dashboard

**Dashboard** (`/`) shows one of your stored dashboards: how exposed you are,
whether it is getting better, and what to fix next. Every widget is drawn from
the dashboard's stored figures, and each one has its own error state, so one
widget that fails never blanks the page.

![The CTEM dashboard: priority exposure, KEV on your assets, open within SLA, time to fix and the CTEM loop with its five stages]({{ site.baseurl }}/assets/images/overview/dashboard.png)
*Figure: The CTEM dashboard of the demo organization.*

### Which dashboard opens

- The dashboard you chose last time (remembered in your browser while it still
  exists and you can still open it).
- Otherwise your own default, then the organization's default dashboard (when
  you may view organization dashboards), then the first organization
  dashboard, then your first own dashboard.
- On your very first visit, when there is no dashboard for you at all, you get
  a personal copy of the **CTEM** template, computed for your own access.
  A line under the header offers **Customize** and **Choose another**.
- If your dashboard is an earlier copy of the **CTEM** or **Overview**
  template, a one-time line names the widgets the template has gained (for
  example the exposure flow) and offers **Add them to this dashboard** (each
  is placed where the template has it), **Switch to the new layout** (a fresh
  copy; your dashboard stays) or dismiss. Your dashboard never changes until
  you choose.
- Every dashboard that existed before the exposure flow was introduced is
  offered the flow panel once, at the top of its layout, the first time
  someone who may edit it opens it. A toast, **Exposure flow added at the top**,
  has **Undo**; a panel you remove is never added again. Empty dashboards and
  dashboards that already show the flow are left alone, and new dashboards are
  never changed. Adding and undoing are audited.

### What would cut exposure most

The first widget of the CTEM, Overview and Executive templates, **What would cut
exposure most**, lists up to three actions and what each would do. Each action
shows its exact effect on a measured figure ("From 14 to 9") and opens the list it
counts. Actions are ranked by the risk points they clear (P0 8, P1 4, P2 2, P3 1)
and are counted in your scope:

- **Known exploited**: fix the open findings in the CISA KEV catalog; P0-P1 open
  falls from a number to a smaller one.
- **Past SLA**: fix the P0-P1 findings past their SLA; **Within SLA** rises.
- **One fix**: apply the proposed remediation that closes the most risk.
- **Blind spot**: cover the tracked assets with no successful scan in the coverage
  window (offered only while discovery coverage is under 90 %, and in the last
  slot).

Each effect is computed for that action on its own. When none of these applies the
widget says "Nothing stands out".

### Key figures and this week in brief

**Key figures** puts five figures in one strip, each counted exactly as its own
widget: **P0–P1 open**, **Known exploited**, **Within SLA**, **Time to fix,
median** and **Discovery coverage**. A figure that cannot be measured says **Not
measured**, never 0.

**This week in brief** is up to three sentences built from the dashboard's
snapshot of the last 7 days, with fixed wording and no AI: new against fixed
findings (open exposure fell, held or grew), the biggest lever, and the P0–P2
findings due soon or past their SLA. Each figure in a sentence is a link to its
list.

All three widgets are computed into the dashboard snapshot on its refresh
schedule (and by **Refresh now**), in the scope of the person reading.

### The exposure flow

The first widget of the CTEM and Overview templates follows findings from
where they come from to where they go, for the period of the widget (30 days
by default).

- **Sources** (left): each tool that sent findings, by kind (sensor, CI,
  connector, import), with how many it sent. A source whose last import or run
  failed says **Failed** and its line is dotted red; a source that has gone
  quiet for more than twice its usual interval says **Stale** and its line is
  dotted amber. Each count opens that source's receipts.
- **Received, new or reopened, actionable** (top of the centre): what came in,
  what became new work, and the open findings with a priority class now.
- **The ring**: actionable findings by priority class (P0 to P3). Each arc is
  labelled with its count and opens the findings of that class; the number in
  the middle is the sum of the arcs.
- **The five stages** under the ring: the same stages as the CTEM loop (below),
  each with its state and its figure; the stage to act on is filled.
- **Outcomes** (right): open findings with their severity split, those past
  their SLA, in progress, and those fixed, accepted or closed as false
  positive in the period. Under them: how many findings imports still
  detected and how many approved rules removed.

Point at a figure, move to it with the keyboard, or tap it once on a phone to
light its path and open a short explanation with a link to its list; tap again
(or click) to open the list. **Esc** closes the explanation. **Show table**
gives every figure as a table. On a phone the three columns stack.

Every figure is defined once, and equals the list it opens. **New or reopened**
is the receipt list's **New** plus **Reopened** everywhere on the dashboard (the
flow, the noise reduction headline, the funnel and the explanations), with the
suppressed findings shown as part of it. The funnel keeps **Received** and **New
or reopened** as the period's flow, and shows **Actionable now** (open P0 to P3)
apart from it, as a stock.

Source counts come from the import and run receipts, which cover the whole
organization: they show on organization dashboards and for the organization
owner. On a personal dashboard of anyone else, the flow shows the findings
figures for the assets you can see and says that source volumes are
organization figures.

### Intake and noise reduction

The last widget of the CTEM template shows what each source sent and what
OpenCTEM did with it:

- every source with its receipts and health, wired into a summary (new, still
  detected, reopened, resolved by the source); pointing at a source shows its
  own summary;
- **Noise reduction**: what was received, split into **new or reopened**,
  **merged** into findings that already exist, **suppressed by rules**
  (approved suppression rules) and **not stored** (out of scope, excluded,
  invalid or failed); the parts add up to what was received;
- the findings closed as false positive in the period;
- the same figures per source as a table.

Every intake figure opens **Import and run receipts** (`/findings/imports`): what
each upload and run did to the organization's findings, with one row per receipt
(**Source**, **Started**, **Status**, **Received**, **New**, **Still detected**,
**Reopened**, **Resolved**, **Suppressed**, **Not stored**), filtered by source,
tool and period, with the totals of the filter. The same list is available through
`GET /api/v1/findings/imports` (see [Ingest](../api/ingest.md)).

### The CTEM loop

The CTEM loop widget (in the widget gallery; the exposure flow carries the same
stages) shows the five stages of the program for the assets you can see, in
order. Each figure opens the list it counts.

| Stage | Figure | Second figure |
|---|---|---|
| **Scoping** | Crown jewels designated | How many have an open P0 or P1 finding |
| **Discovery** | Share of the assets the coverage ledger tracks that had a successful scan in the last 30 days | Assets not scanned in 30 days |
| **Prioritize** | Open P0 findings | Open findings in the KEV catalog |
| **Validate** | Share of open findings with validation evidence | Retests run in the last 30 days |
| **Mobilize** | Share of open findings with an SLA that are within it | Findings past their SLA |

Each stage says whether it is **On track**, **Needs attention**, **Off track**
or **Not measured** (with the reason, for example "No scannable assets in your
scope"; never a 0). The stage with the largest gap is marked **Act here**.

**Attack paths to crown jewels** counts your crown jewels that a public entry
point reaches through known relationships, and lists the top ones with how many
entry points reach them. It shows only crown jewels you can see; entry points
and the assets in between are not named. With no crown jewel designated, it
links to **Crown jewels** to designate them.

### The header

- **The dashboard switcher** lists **Organization** dashboards (only when your
  role holds `dashboards:org:view` or `dashboards:org:manage`) and **Mine**,
  with a search box once there are more than eight, plus **New dashboard** and
  **Manage dashboards**.
- **Customize** edits the dashboard in place: your own dashboards, and
  organization dashboards when you hold `dashboards:org:manage`.
- The **⋯** menu has **Duplicate to mine** (an organization dashboard copied
  to your own dashboards), **Set as my default** or **Set as organization
  default** (managers), **Edit details** and **Delete** (your own dashboards).

### Scope and freshness

Under the header a badge says whose figures these are: **Organization-wide**
(the whole organization, for everyone allowed to view the dashboard) or **Your
scope** (computed for the assets you can see). Lists you open from a widget
always follow your own access.

Next to it the freshness line shows when the figures were computed and when the
next scheduled refresh runs, marks figures that are stale or kept after a
failed refresh, and has **Refresh now**. The owner of a personal dashboard, and
managers of an organization dashboard, also see the **Refresh schedule**
(organization default, every 5 or 15 minutes, hourly, every 6 hours, daily or
only on request).

### Reading a widget

- Each widget has a title, **How this is counted** (the definition), when its
  figures were computed, and, where it makes sense, the change against the
  previous period (green when it is better, red when it is worse, whichever
  direction that is) and a target.
- Clicking a figure, a bar or a row opens the findings list with the same
  filter, so the list matches the number.
- A figure that cannot be measured shows "—" with the reason (for example
  "Too few findings were fixed in this period to measure"), never 0. While the
  organization's dashboard data is built for the first time, widgets say so.

### Templates

**Dashboards** (`/dashboards`) lists your dashboards and five templates:

| Template | What it shows |
|---|---|
| **CTEM** | What would cut exposure most; the exposure flow; key figures; this week in brief beside the attack paths to crown jewels; open exposure by priority; new versus fixed; open findings by age; the Fix next table; intake and noise reduction |
| **Overview** | What would cut exposure most; the exposure flow; key figures; this week in brief beside the attack paths to crown jewels; open exposure by priority; new versus fixed per week; open findings by age; the Fix next table |
| **Executive** | What would cut exposure most; key figures; this week in brief; exposure by priority; time to fix by priority; new versus fixed |
| **Vulnerability program** | Within SLA, priority exposure, open findings and time to fix; SLA at risk; new versus fixed; time to fix by priority; age of open findings |
| **Triage** | Open, priority and KEV counts; open findings by SLA state and by severity; new findings per day; Fix next |

**Use template** copies a template into your own dashboards; **New blank**
starts empty. Each card has **Open**, **Edit** (name, description and one to
four columns; widgets keep their share of the row), **Set as my default** and
**Delete**, which asks first. An earlier personal copy of the CTEM or Overview
template is offered the newer widgets (see above); nothing changes until you
choose.

![The Dashboards page: five templates and the list of your own dashboards]({{ site.baseurl }}/assets/images/user-guide/dashboards.png)
*Figure: Dashboards.*

### Fix next and the findings table

**Fix next** lists open P0 to P2 findings in fix order: priority, then severity,
then newest. It can be drawn as a list or as a findings table (priority, the
finding with its asset and a **KEV** chip, severity and SLA). The table shows the
list's count in its header, the list's filters as read-only chips, and "Top n of
total" with an **Open in Findings** link to the list it counts. A row with no
severity keeps a neutral dot, and a row with no SLA date says "No due date". Each
row carries the finding's EPSS probability as the shared EPSS bar when the feed
has a score for it; a snapshot stored before that field existed shows no bar until
it refreshes.

### Charts over time

The time-series charts (columns, area, line and new versus fixed) share one
tooltip. It shows the span of the bucket ("Week of Oct 20 – 26"), one row per
series in the order the marks are stacked with its colour, value and change
against the previous bucket, a **Total** for stacks, a **Net change** for new
versus fixed, and folds series at zero into one line when a chart has three or
more series. It opens on hover, on keyboard focus of the chart (the arrow keys
move between buckets) and on tap.

### Customize a dashboard

1. Choose **Customize**. The dashboard switches to editing; **Undo**, **Redo**,
   **Add widget**, **Cancel** and **Save** sit in the toolbar.
2. **Add widget** opens the gallery: widgets grouped by goal (**CTEM**,
   **Exposure**, **Remediation and SLA**, **Threat intel**, and **Advanced** for a
   **Note**), with search. Each card shows a live preview from your own data.
3. Adding a widget opens its configuration: the **Metric**, filters (for
   example severity or KEV), **Group by**, the time **Range** and
   **Compare** with the previous period, the **Visualization** (only those
   that fit the data; the default is marked), a **Target** for single figures,
   and the **Title** (leave it empty to use the translated name). The preview
   at the top follows your changes. **Apply** keeps them.
4. Move and resize widgets with the buttons on each widget or by dragging its
   handle. With the keyboard, focus a widget and use the arrow keys to move it,
   Shift and the arrow keys to resize it, Enter to configure, D to duplicate
   and Delete to remove (with **Undo**). Ctrl+Z and Ctrl+Shift+Z (Cmd on a
   Mac) undo and redo.
5. **Save** stores the dashboard; **Cancel** drops every change.

### Stored dashboard figures and Refresh now

Dashboard figures are computed ahead of time from stored per-asset
facts and kept as a snapshot, so opening a dashboard does not recompute them:

- Each dashboard refreshes on its schedule (manual, every 5 or 15 minutes,
  hourly, every 6 hours or daily; the organization default is hourly) and
  shows when its figures were computed. Figures older than twice the schedule,
  or kept after a failed refresh, are marked stale.
- **Refresh now** recomputes a dashboard at once: once a minute per person and
  dashboard, and 30 times an hour per organization.
- A personal dashboard always shows your own data scope. When your access
  changes, the next open recomputes it for your new scope; figures computed for
  your earlier access are never shown.
- An organization dashboard shows organization-wide figures to everyone allowed
  to view it (`dashboards:org:view`, and its audience when one is set); lists of
  findings on it still leave out pentest findings of campaigns you are not a
  member of.

The same data is available through the API for integrations:
`GET /api/v1/me/dashboards/{id}/data`, `GET /api/v1/organization/dashboards/{id}/data`,
`POST …/{id}/refresh`, `POST /api/v1/me/dashboards/widget-preview` and the
metric catalog at `GET /api/v1/me/dashboards/widget-catalog`. Details are in
[Dashboards](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/dashboards.md).

## My work

**My Work** (`/my-work`) is your personal start page: what waits on you, your
team, and your requests. Each tab is one queue with its count, and the count is
always the total of the list it opens.

![The My work page with the Assigned to me queue open]({{ site.baseurl }}/assets/images/user-guide/my-work.png)
*Figure: My work: your open findings, the nearest deadline first.*

- **Assigned to me**: open findings assigned to you or your groups, or on
  assets you own, the nearest SLA deadline first. **SLA due in 72 hours**
  narrows the list to the ones due soon (overdue included).
- **My team**: open findings held by the people who share a group with you, or
  by the group.
- **Awaiting my review** (when you can approve): false-positive and
  risk-acceptance requests you may decide. Each row shows who asked and why,
  what changed since the request (for example **now in CISA KEV**), and the
  facts to weigh. **Approve** asks you to confirm your sign-in; **Reject** asks
  for a reason. You never see your own requests here: another person decides
  them. With a row selected, `j` and `k` move, Enter opens the finding, `a`
  approves and `r` rejects.
- **Requested by me**: your requests waiting for a decision. **Remind
  approvers** (once an hour) or **Withdraw**.
- **Acceptances expiring**: accepted risks on your findings that end within
  30 days, when the finding reopens.
- **My tasks** (when you can read remediation): your open remediation tasks,
  earliest deadline first ([Mobilization](08-mobilization.md)).
- The SLA column shows the time left or past due (in hours under two days) and
  **KEV cap** when the known-exploited rule set the deadline.
- **View all** opens the same list on **Findings**; **Triage these** and the
  header's **Triage** button open triage mode.
- An empty queue suggests the next step, such as **Next: triage 4 new
  findings**.

## Notifications

**Notifications** (`/notifications`, from the bell's **View all notifications**)
lists the in-app notifications sent to you.

1. Three cards at the top: **Unread**, **Read** and **Total**.
2. **Mark all as read** appears when something is unread. **Settings** opens your
   notification preferences (`/account/notifications`).
3. Filter by severity (**All severities**, Critical, High, Medium, Low, Info) and
   by read state (**All**, **Unread**, **Read**). Changing a filter returns to the
   first page.
4. Each row shows the title, type, severity and relative time; unread rows are
   highlighted. Clicking a notification that has a link opens the related item
   and marks it read.
5. Use **Previous** and **Next** to page (20 per page).

Empty states: "No notifications yet" or, when a filter matches nothing, "No
matching notifications".

## Your account

Your own settings are in the settings area under **My account**. Open them from
the avatar menu or from **Settings** in the sidebar footer.

### Profile

**Profile** (`/account`) holds your **Full Name** and **Phone Number**; click
**Save Changes** (enabled only when something changed). **Email** is read-only and
shows **Verified** or **Unverified**; for SSO accounts it says it is managed by
your identity provider. Your avatar comes from your identity provider, or shows
your initials. **Account Information** shows the account ID, the authentication
provider and the creation and update dates.

### Security

**Security** (`/account/security`) has five cards.

![The Set up two-factor authentication dialog with the QR code blurred]({{ site.baseurl }}/assets/images/identity/two-factor-setup.png)
*Figure: Setting up two-factor authentication (the QR code and key are blurred here).*

- **Password** (password accounts): **Change password** opens a dialog for the
  **Current password**, the **New password** and its confirmation. Changing your
  password signs out every other session. The new password must meet the
  platform's password policy (12 characters minimum by default). SSO accounts
  change their password at their identity provider instead.
- **Two-factor authentication** (password accounts):
  - When it is **Off**, click **Set up**: scan the QR code (or type the secret)
    in an authenticator app, enter your **Current password** and the
    **Authentication code**, and click **Turn on**. Turning it on signs out your
    other sessions. Save the recovery codes it shows, tick **I have saved my
    recovery codes** and click **Done**.
  - When it is **On**, the card shows when you turned it on and how many recovery
    codes are left. **New recovery codes** issues a fresh set (your old codes stop
    working); **Turn off** asks for your password and a code, and you receive an
    email about the change.
  - **Required by your organization** means an owner requires two-factor
    authentication; if you turn it off you must set it up again at your next
    sign-in.
  - SSO accounts use their identity provider's two-factor settings.
- **Connected sign-in methods** (when the platform offers Google, GitHub or
  Microsoft sign-in): your password and each provider, **Linked** or **Not
  linked**. **Link** asks for the code from your authenticator app (or your
  password, if two-factor authentication is off; a recovery code does not work),
  then sends you to the provider and back. **Unlink** asks for the same; your
  only way to sign in cannot be removed. An account without a password or
  authenticator app turns on two-factor authentication first. Organization single sign-on is shown as managed by
  your organization. You receive an email for every change.
- **Sessions** lists the devices signed in to your account (browser and system,
  IP address, sign-in time, last activity); your current one is marked **This
  device**. Sign out a single session, or click **Sign out all others**. Both ask
  for confirmation.
- **Delete account**: **Delete my account** (you confirm by typing your email
  address) signs you out everywhere, revokes your API keys and schedules the
  deletion in 14 days. Signing in again within 14 days cancels it; after that your
  account leaves every organization and your personal data is erased. It is
  refused while you are the only owner of an organization: transfer ownership or
  delete the organization first.

See also [Two-factor authentication](../identity/two-factor.md).

### Preferences

**Preferences** (`/account/preferences`):

- **Appearance**: Light, Dark or System.
- **Localization**: **Timezone**, **Date Format** (DD/MM/YYYY, MM/DD/YYYY,
  YYYY-MM-DD) and **Time Format** (24-hour or 12-hour).
- **Reset to Defaults** restores UTC, DD/MM/YYYY, 24-hour and System; click
  **Save Preferences** to keep your changes.

The interface language (English or Vietnamese) is chosen from the avatar menu,
under **Language**.

### Notifications

**Notifications** (`/account/notifications`) decides which notifications you
receive:

- **In-app notifications**: **Show in-app notifications** on or off.
- **Severity filter**: the **Minimum severity** you are notified about.
- **Notification types**: switches for new findings, assignments, status
  changes, comments, mentions, scan started, completed or failed, asset
  discovered, member invited or joined, role changes, SLA breaches, system
  alerts, **Approval requests** (a false-positive or accepted-risk request waits
  for your decision), **AI application requests** and the **Approvals digest**
  (a daily summary of the requests waiting for you, also sent by email; muting it
  stops the email).

- **Watch what I take part in** (on by default): you start watching a finding or
  remediation task when you comment on it, change its status, are assigned it or
  request an approval on it, so you hear about what happens next. Turn it off to
  watch only what you add yourself with the bell; see
  [People on a finding](05-exposures-and-findings.md#a-single-finding).

Click **Save changes**. Organization-wide channels such as Slack or email are set
up by an administrator under
[Integrations](10-settings-and-integrations.md#notification-channels).

### Activity

**Activity** (`/account/activity`) is a read-only log of your recent account
actions, ten per page. A **Security Tip** reminds you to review it regularly;
your signed-in devices are listed under **Security**.

### Connected applications

**Connected applications** (`/account/connected-apps`) lists the AI applications
you allowed to work with the organization's data as you, under **Your AI
applications**. Disconnect one to end its access at once. See
[Connect an AI assistant](12-connect-an-ai-assistant.md).
