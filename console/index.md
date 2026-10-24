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
organization web app, and an administrator account belongs to no organization.

These pages describe OpenCTEM v0.11.0.

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
key response was not accepted"). The v0.11.0 Compose file does not pass this
variable to the API, and neither does the all-in-one image; keys are bound to
this host, so changing it later makes registered keys unusable.

With Docker Compose, add a `docker-compose.override.yml` next to
`docker-compose.yml` and run `docker compose up -d api`:

```yaml
services:
  api:
    environment:
      ADMIN_PUBLIC_URL: https://ctem.example.com:8443
```

With the all-in-one image, pass `-e ADMIN_PUBLIC_URL=https://ctem.example.com:8443`.

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
3. With a temporary password, the console asks you to change it first. Changing
   it signs you out everywhere; sign in again with the new password.

After repeated failures the sign-in asks for the CAPTCHA, when one is set up
([CAPTCHA](settings.md#captcha)).

The first administrators are created on the server with `bootstrap-admin`:
see [First administrator](../install/first-admin.md).

An administrator account cannot sign in on the organization site (password,
second factor, social or single sign-on): that sign-in fails as if the password
were wrong, and the page tells administrators to use the platform console.

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

| Role | Can do |
|---|---|
| **Super admin** | Everything, including administrators, sessions, approvals, sign-in policy, platform settings and deleting an organization at once |
| **Operations admin** | Create, suspend and reactivate organizations, set an organization's limits, find and block accounts, approve access requests, open support sessions, manage target mappings, sync threat intelligence |
| **Read-only admin** | View only. Member lists show counts, not people; the Users page is not available |

By default (`ADMIN_ELEVATION=required`) every administrator acts as read-only
after sign-in. To change anything, click **Elevate**, choose a **Role** no higher
than your own and a duration (**For**, 15 to 60 minutes), give a reason and
confirm. The banner shows **Acting as {role} until {time}**; **End now** returns
to read-only. Every elevation is in the admin activity log. With
`ADMIN_ELEVATION=off`, administrators act as their own role from sign-in.

A super admin acting read-only still sees every page; a page that needs a higher
acting role offers the elevation in place.

![The Elevate for a while dialog over the console overview, with Role, For and Reason fields]({{ site.baseurl }}/assets/images/console/elevate.png)
*Figure: Elevating the console session.*

### Confirming protected actions

Actions that change who can sign in or what they may do ask you to **Confirm it
is you** (step-up): a fresh code from your authenticator, or your security key.
One confirmation covers the next five minutes of such actions. The most
sensitive actions (deleting an organization now, creating an organization's
owner, adding a security key, changing the security-key policy) need a fresh code
or key confirmation every time.

The console's most dangerous actions also need a **second super admin**: see
[Approvals](security.md#approvals).

A super admin's change is written to the admin activity log before it runs. If
the log cannot be written, the change is refused with `503 AUDIT_UNAVAILABLE` and
nothing changes.

## Find your way

![The console Overview: the Needs attention list with a service that does not answer, refused actions, an overdue break-glass test, low disk space and backups not reported, above the counts of organizations, sensors, refused actions and the schema version]({{ site.baseurl }}/assets/images/console/overview.png)
*Figure: Platform console, Overview.*

The sidebar groups the pages by what you are doing. Items marked with a role are
hidden from lower roles.

| Group | Pages | Guide |
|---|---|---|
| (top) | **Overview** | [below](#overview) |
| **Customers** | **Organizations**, **Users** (operations admin and above), **Access requests**, **Sign-ups**, **Support access** (operations admin and above) | [Organizations and users](organizations-and-users.md) |
| **Scanning** | **Scan approval**, **Platform scanning**, **Target mappings**, **Content packs**, **Content catalog**, **Threat intelligence** | [Scanning](scanning.md) |
| **Security** | **Administrators**, **Sessions**, **Approvals**, **Admin sign-in** (all super admin), **Admin activity** | [Security](security.md) |
| **Settings** | **Configuration**, **Sign-up**, **Limits**, **CAPTCHA**, **E-mail**, **Legal**, **Announcements**, **Alerts**, **AI provider**, **AI applications** | [Settings](settings.md) |
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
