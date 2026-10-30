---
title: Platform console
nav_order: 6.5
has_children: true
permalink: /console/
---

# Platform console
{: .no_toc }

**Platform administrators** run the installation as a whole: they create and
suspend organizations, help people sign in, decide who may sign up, set the
instance-wide settings and watch the health of the installation. They work in the
**platform console**, a web app of its own with its own sign-in page, its own site
and its own image (`ghcr.io/openctemio/openctem-console`). It is not a part of the
organization web app. An administrator signs in to the console with the same
account they use in the organization web app, if they are also a member of an
organization: the platform role counts only in the console.

These pages describe OpenCTEM v0.16.1 and the changes coming in v0.17.0.

1. TOC
{:toc}

---

## Where the console is

The gateway serves the console on an origin of its own, so a script in the
organization app can never reach it:

| Mode | Address | Settings |
|---|---|---|
| **Port** (default of the Compose stack and the all-in-one image) | `https://<OPENCTEM_HOSTNAME>:8443` | `OPENCTEM_ADMIN_SITE=port`; change the port with `OPENCTEM_ADMIN_PORT` (not 80, 443 or the main site's port) |
| **Host** (recommended for production) | `https://<OPENCTEM_ADMIN_HOST>` | `OPENCTEM_ADMIN_SITE=host` and a DNS name that points at the gateway |
| **Off** | none | `OPENCTEM_ADMIN_SITE=off` runs no console site |

The console is at the root of its site. There is no `/admin` path in the
organization app and no redirect from it.

Who can reach it is checked twice, and both lists default to private networks
(`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` and their IPv6
equivalents):

- the gateway refuses clients outside `OPENCTEM_ADMIN_ALLOWED_CIDRS`;
- the API refuses console requests from outside `ADMIN_ALLOWED_CIDRS` with
  `403 ADMIN_NETWORK_NOT_ALLOWED`. The Compose stack copies the gateway list into
  the API's; with the all-in-one image or your own deployment, set both.

A published container port is not filtered by the host firewall. To keep the
console on one interface only (a VPN or management address), set
`OPENCTEM_ADMIN_BIND` to that address.

{: .warning }
Set the API's `ADMIN_PUBLIC_URL` to the console's origin (for example
`https://ctem.example.com:8443` or `https://admin.ctem.example.com`) before anyone
registers a security key. Its default is the origin of `APP_URL`, the main site,
so on the console's own site the browser's key response is refused ("The security
key response was not accepted"). The Compose file sets it from
`OPENCTEM_ADMIN_PUBLIC_URL` (which `setup.sh` writes), and the all-in-one image derives it
from the gateway's console site settings unless you set it; on Kubernetes and the other
deployments set it yourself. Keys are bound to this host, so changing it later makes
registered keys unusable.

With Docker Compose, `setup.sh` already sets it. To change it, set
`OPENCTEM_ADMIN_PUBLIC_URL` in `.env` and run `docker compose up -d api`, or override it
in a `docker-compose.override.yml`:

```yaml
services:
  api:
    environment:
      ADMIN_PUBLIC_URL: https://ctem.example.com:8443
```

With the all-in-one image, to override the derived value pass `-e ADMIN_PUBLIC_URL=https://ctem.example.com:8443`.

Installation details: [Docker Compose](../install/docker-compose.md),
[All-in-one image](../install/all-in-one.md), [TLS and gateway](../install/tls-and-gateway.md),
[environment variables](../configuration/environment-variables.md).

## Sign in

![The sign-in page of the platform console, titled Platform administration, with email and password fields]({{ site.baseurl }}/assets/images/identity/console-sign-in.png)
*Figure: Platform console sign-in.*

1. Open the console address and enter your administrator **Email** and
   **Password**, then **Continue**. When the installation has an identity
   provider for administrators, the page also offers **Sign in with
   {provider}** (see [Admin sign-in](security.md#admin-sign-in)).
2. Confirm it is you: **Use security key or passkey**, or enter the six-digit
   **Verification code** from your authenticator app, or **Use a recovery code**.
   Two-step verification is required for every administrator. The first time,
   scan the QR code (or type the **Setup key**) and click **Verify and finish
   setup**.
3. With a temporary password (only the first administrator, created with
   `bootstrap-admin`, has one), the console asks you to change it first. Changing
   it signs you out everywhere; sign in again with the new password.

Every refused password sign-in gets the same answer, "Wrong email or password",
also when the password is right but the identity provider is required: the
refusal is audited and counts toward the lockout. When an identity provider is
configured, the page then shows its hint and **Sign in with {provider}**.

A new administrator is invited by e-mail: they open the single-use set-password
link (valid 24 hours), choose a password and enrol their second step. Their
first console sign-in is announced by e-mail to every other administrator.

After repeated failures the sign-in asks for the CAPTCHA, when one is set up
([CAPTCHA](settings.md#captcha)).

The first administrators are created on the server with `bootstrap-admin`:
see [First administrator](../install/first-admin.md).

### One account for the console and the organization web app

The account you sign in to the console with is a normal account. It can also be a
member of organizations (an organization invites it like anyone else) and sign in
to the organization web app, where it has only its role in that organization:
being a platform administrator gives nothing there, and the organization sees an
ordinary member. The two sites keep separate sessions: being signed in to the
organization web app never signs you in to the console, which always asks for its
own sign-in and second step, and a console session never works in the
organization web app.

- A **break-glass** administrator account stays console-only: it cannot join an
  organization.
- Administrators cannot approve an access request made with their own e-mail;
  another administrator decides it.
- If you kept a second account to work in an organization, have the organization
  invite your administrator account, then remove the old account from it.

### Sessions

- A console session ends after **15 minutes** without use and after **8 hours**
  in any case. The console's own background refreshes do not count as use, so an
  unattended tab signs out.
- An administrator holds at most **three** console sessions; signing in a fourth
  time ends the oldest (`console.session_evicted` in the admin activity log).
- Resetting or changing an administrator's password, or resetting their two-step
  verification, ends that administrator's console sessions.
- A super admin sees and ends sessions under [Sessions](security.md#sessions).

## Roles and elevation

Every administrator has one **base role**, set on the Administrators page, and may
hold **additional roles**, given on [Roles](security.md#roles):

| Role | Kind | Can do |
|---|---|---|
| **Platform owner** (Super admin) | base | Everything, including administrators, roles, sessions, approvals, sign-in policy, platform settings and deleting an organization at once |
| **Platform admin** (Operations admin) | base | Create, suspend and reactivate organizations, set an organization's limits, find and help accounts, approve access requests, open support sessions, announcements, threat-intelligence sync |
| **Read-only** | base | View only. Member lists show counts, not people; the Users page is not available |
| **Operator** | additional | Run the shared sensor fleet and the feeds; suspend an organization for abuse |
| **Support** | additional | Help people sign in (Users), read member lists, open support sessions inside a grant |
| **Security auditor** | additional | Read the admin activity log, the administrators and the approvals; change nothing |
| **Billing** | additional | Set organizations' limits and plans |

The full list of permissions per role and per console page is the
[platform permission reference](security.md#roles). The console shows only what
your roles allow.

By default (`ADMIN_ELEVATION=required`) every administrator acts as read-only
after sign-in. To change anything, click **Elevate**, choose one of your **Roles** and a duration (**For**, 15 to 60 minutes), give a reason and
confirm. The banner shows **Acting as {role} until {time}**; **End now** returns
to read-only. Elevating needs a fresh authenticator code or security-key
confirmation given within the last minute (an earlier step-up does not count);
that proof also opens the step-up window, so the first protected action after
elevating asks for no second code. Every elevation is written to the admin
activity log before it is granted: if the log cannot be written, the elevation is
refused (`503 AUDIT_UNAVAILABLE`) and the session stays read-only. With
`ADMIN_ELEVATION=off`, administrators act as their own role from sign-in.

A super admin acting read-only still sees every page; a page that needs a higher
acting role offers the elevation in place.

![The Elevate for a while dialog over the console overview, with Role, For and Reason fields]({{ site.baseurl }}/assets/images/console/elevate.png)
*Figure: Elevating the console session.*

### Confirming protected actions

Actions that change who can sign in or what they may do ask you to **Confirm it
is you** (step-up): a fresh code from your authenticator, or your security key.
One confirmation covers the next five minutes of such actions. The most
sensitive actions need a fresh code or key confirmation every time: elevating,
deleting an organization now, creating an organization's owner, adding a security
key, changing the security-key policy, changing or removing the administrators'
identity provider, changing the platform e-mail relay, the sign-up policy, social
login, the platform AI provider and the other platform settings, and changing a
target mapping. When a form asks for its own code and the code is wrong or was
already used, the refusal shows under that form's code field, which is cleared for
the next code.

The console's most dangerous actions also need a **second super admin**: see
[Approvals](security.md#approvals).

Every state-changing console request, whatever the role, is written to the admin
activity log before it runs (`admin.write_started`). If the log cannot be written,
the change is refused with `503 AUDIT_UNAVAILABLE` and nothing changes.

## Find your way

![The console Overview: the Needs attention list with a service that does not answer, refused actions, an overdue break-glass test, low disk space and backups not reported, above the counts of organizations, sensors, refused actions and the schema version]({{ site.baseurl }}/assets/images/console/overview.png)
*Figure: Platform console, Overview.*

The sidebar groups the pages by what you are doing. A page whose permission none
of your roles holds is hidden.

| Group | Pages | Guide |
|---|---|---|
| (top) | **Overview** | [below](#overview) |
| **Customers** | **Organizations**, **Users** (roles that hold `platform.users.read`: platform owner, platform admin, support), **Access requests**, **Sign-ups**, **Support access** (roles that hold `platform.support.access`) | [Organizations and users](organizations-and-users.md) |
| **Scanning** | **Scan approval**, **Platform scanning**, **Target mappings**, **Content packs**, **Content catalog**, **Threat intelligence** | [Scanning](scanning.md) |
| **Security** | **Administrators**, **Sessions**, **Approvals**, **Roles**, **Admin sign-in**, **Admin activity** | [Security](security.md) |
| **Settings** | **Configuration**, **Sign-up**, **Social login**, **Limits**, **CAPTCHA**, **E-mail**, **Legal**, **Announcements**, **Alerts**, **AI provider**, **AI applications** | [Settings](settings.md) |
| **Monitoring** | **Health**, **Software updates** | [Monitoring](monitoring.md) |

The sidebar footer holds **Help**, the signed-in administrator, **My security
keys**, **Language** and **Sign out**. **Search the console** (Ctrl+K or ⌘K)
finds any page; the sun icon switches between light and dark.

![The Language menu in the sidebar footer offering English and Tiếng Việt]({{ site.baseurl }}/assets/images/console/language.png)
*Figure: The console's language menu.*

**Language** switches the console between English and Vietnamese (Tiếng Việt).
The choice is kept in the browser.

## Overview

**Overview** starts with **Needs attention**, the things an administrator should
act on now, each with a link to the page that fixes it:

- access requests waiting and organizations without an owner;
- break-glass sign-ins, and break-glass accounts not tested in 90 days;
- refused or failed administrator actions in the last 24 hours;
- services that do not answer, data volumes running out of space, failed, stale
  or unreported backups, and certificates close to expiry;
- offline platform sensors, sensor jobs and scan runs waiting too long,
  notifications that gave up, and a database schema behind or ahead of the
  release;
- a newer release or a security release.

Below the list are the number of organizations (and how many have no owner),
platform sensors online, refused administrator actions in the last 24 hours, the
database schema version against the one the release ships, and the most recent
administrator activity.
