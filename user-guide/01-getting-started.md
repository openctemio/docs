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

To leave an organization yourself, use **Leave organization** in **Settings >
Organization > General** (the only owner cannot leave; transfer ownership
first, see [Team and access](02-team-and-access.md#transfer-ownership)).

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

**Dashboard** (`/`) gives you the state of exposure in the current organization:
what is exploitable now and what to do about it. The header has **Refresh**, a
view switcher and an **Options** menu.

![The CTEM view of the dashboard: active exposure, priority classes over time, the CTEM loop and the Fix next list]({{ site.baseurl }}/assets/images/overview/dashboard.png)
*Figure: The CTEM view of the dashboard.*

### The CTEM view (default)

From top to bottom:

1. **Active exposure**: the number of open P0 findings (exploitable now), with
   the risk score, KEV chains, crown jewels at risk and SLA compliance, and a
   90-day P0 burn-down that says whether you are gaining or losing ground.
2. **Priority classes over time**: open P0 to P3 findings over 90 days.
3. **The CTEM loop**: five tiles, one per stage, each opening the matching page.

   | Tile | Opens | Shows |
   |---|---|---|
   | Scoping | Scoping overview | How many readiness checks are met; a flag if no crown jewels are designated |
   | Discovery | Scans | Scan coverage, unscanned assets, critical assets not covered |
   | Prioritize | Findings | Open P0 findings, KEV entries in the catalog |
   | Validate | Compensating controls | Share of findings validated |
   | Mobilize | Remediation | SLA compliance and breaches |

4. **Fix next** (findings ranked by exposure) next to **Attack paths → crown
   jewels** (crown jewels reachable now).
5. **Threat intel context** (EPSS and KEV figures) next to **Coverage &
   hygiene** (scan, validation and SLA coverage).
6. **CTEM maturity**, when the CTEM cycles module is on.
7. **Analyst detail**: findings trend, severity distribution, asset distribution
   and recent activity.

When the organization has no data yet, each block shows an empty state (for
example "Nothing exploitable right now" or "No crown jewels designated") instead
of sample numbers. When a change to the scoring (a new scoring model, the risk
scoring settings, the priority rules or an SLA policy) moves the numbers, the
trend charts mark that date and say that values before and after it are not
directly comparable.

### The Classic view

Choose **Classic** in the view switcher for the earlier layout:

- **Quick Actions**: **New Scan**, **View Findings**, **Remediation Tasks** and
  **Generate Report**. A button is disabled, with a tooltip, when you lack the
  permission (`scans:write`, `findings:read`, `remediation:read`,
  `reports:read`).
- **CTEM Process**: a stepper that works out the current stage from your data.
  No assets yet means Scoping; assets but no findings means Discovery; findings
  means Prioritization; triaged findings means Validation; resolved or closed
  findings means Mobilization.
- Stat cards: **Total Assets**, **Active Findings**, **Avg CVSS Score**,
  **Repositories**.
- **Findings Trend** (by severity over six months) and **Severity
  Distribution**.
- **Asset Distribution** (by asset type), **Recent Activity** (up to ten
  events) and **Quick Stats** (**Findings**, **Critical Findings**, **Overdue**,
  **Repositories with Issues**).

If the dashboard cannot load its data, a banner **Failed to load dashboard data**
appears with **Retry**.

### Custom dashboards

You can build personal dashboards next to the built-in views.

![The Dashboards page with the built-in templates and a saved dashboard]({{ site.baseurl }}/assets/images/user-guide/dashboards.png)
*Figure: Dashboards: start from a template or a blank canvas.*

- Open the view switcher and choose **Manage dashboards…**, or **Options › New
  dashboard**. This opens **Dashboards** (`/dashboards`).
- **Start from a template** (Executive, SOC / Triage, Vulnerability Management,
  My Work, AppSec / Developer) with **Use template**, or click **New blank**.
- Under **Your dashboards**, each card has **Open**, **Edit**, **Set as default**
  and **Delete**. Deleting a dashboard is immediate; there is no confirmation.
- **Edit** sets the **Name**, **Description** and the number of columns (one to
  four).
- To add or arrange widgets, open the dashboard and choose **Options › Customize
  widgets**: **Add component**, drag widgets to reorder, set each widget's size,
  then **Save**.

The view you last chose is remembered in your browser; otherwise your default
custom dashboard opens, and otherwise the CTEM view.

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
