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
   hidden.
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

### Where you land after signing in

| You are | You land on |
|---|---|
| A platform administrator | Nowhere in this app: the page says to sign in on the platform console, a separate site with its own sign-in (see [Platform administration](11-platform-administration.md)) |
| A member of one organization | That organization's dashboard (or the page you were sent to) |
| A member of several organizations | **Select a team**, where you pick one |
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

An **organization** (sometimes shown as a *team*) is your isolated workspace,
with its own assets, findings, members and settings.

- **Several organizations:** you land on **Select a Team**. Click the
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
    **Set up your first team** with a **Team name** (the **Team URL** is filled
    in for you; it may contain lowercase letters, numbers and hyphens), an
    optional **Description** and optionally **Products** (leave it empty to get
    every module), then **Create team**. The data region is shown and fixed once
    the organization exists.
  - On installations where only the platform administrator creates
    organizations (the default) and nothing else applies, you see **You are not a
    member of any organization yet**: ask your administrator to add you, or open
    the invitation link you received.

When you may create another organization, **Create a new team** is also offered
on **Select a team** and **Create organization** in the organization switcher.

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
- Some pages have sub-pages shown as tabs at the top of the page (for example
  **Assets**: Inventory, Groups, What changed, Web surface, Suggestions).

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
| <kbd>Esc</kbd> | In lists: clear the selected rows |

## The dashboard

**Dashboard** (`/`) shows one of your stored dashboards: how exposed you are,
whether it is getting better, and what to fix next. Every widget is drawn from
the dashboard's stored figures, and each one has its own error state, so one
widget that fails never blanks the page.

### Which dashboard opens

- The dashboard you chose last time (remembered in your browser while it still
  exists and you can still open it).
- Otherwise your own default, then the organization's default dashboard (when
  you may view organization dashboards), then the first organization
  dashboard, then your first own dashboard.
- On your very first visit, when there is no dashboard for you at all, you get
  a personal copy of the **CTEM** template, computed for your own access.
  A line under the header offers **Customize** and **Choose another**.
- If your dashboard is a copy of the **Overview** template made before it
  showed the CTEM loop, a one-time line offers **Add the CTEM loop** (added
  after the first row of figures), **Switch to the CTEM template** (a new CTEM
  dashboard; your Overview stays) or dismiss. Your dashboard never changes
  until you choose.

### The CTEM loop

The CTEM loop widget shows the five stages of the program for the assets you
can see, in order. Each figure opens the list it counts.

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
| **CTEM** | Active exposure (priority exposure, KEV on your assets, crown jewels with open P0/P1 findings, open within SLA); the CTEM loop; Fix next; attack paths to crown jewels; open exposure by priority over 90 days |
| **Overview** | Priority exposure, KEV on your assets, open within SLA and time to fix, each with its change and target; the CTEM loop; open exposure by priority over 90 days; new versus fixed per week; Fix next; SLA at risk; open findings by severity and age |
| **Executive** | The same four figures over a year with targets; exposure by priority per month; time to fix by priority; new versus fixed per month |
| **Vulnerability program** | Within SLA, priority exposure, open findings and time to fix; SLA at risk; new versus fixed; time to fix by priority; age of open findings |
| **Triage** | Open, priority and KEV counts; open findings by SLA state and by severity; new findings per day; Fix next |

**Use template** copies a template into your own dashboards; **New blank**
starts empty. Each card has **Open**, **Edit** (name, description and one to
four columns; widgets keep their share of the row), **Set as my default** and
**Delete**, which asks first.

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

**My Work** (`/my-work`) is your personal queue: findings assigned to you or on
assets you own, and remediation tasks assigned to you or your teams. The tabs
**Findings** and **Tasks** switch between them (**Tasks** appears when you can
read remediation).

![The My work page listing the findings assigned to the signed-in user]({{ site.baseurl }}/assets/images/user-guide/my-work.png)
*Figure: My work: the findings assigned to you or on assets you own.*

- The metric strip shows **Open · assigned to me**, **Critical / high** and
  **Overdue (SLA)**; each opens the findings list with that filter.
- The table lists the top 15 by priority (Finding, Severity, Status, SLA,
  Created). Click a row to open the finding, or **View all** for the full list.
- When nothing is assigned to you, the page says **You're all caught up**.
- **Tasks** lists your open remediation tasks, earliest deadline first, with
  **View all tasks** for the full list
  ([Mobilization](08-mobilization.md)); with none it says **No open tasks**.

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

**Security** (`/account/security`) has four cards.

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
