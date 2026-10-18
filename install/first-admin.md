---
title: First administrator
parent: Install
nav_order: 6
---

# First administrator and organization
{: .no_toc }

A new installation has no accounts and no sign-up page. You create the first
**platform administrators** and, usually, the first **organization** with its
owner from the command line, with `bootstrap-admin`.

1. TOC
{:toc}

---

## Who is who

| Account | What it does | Created by |
|---|---|---|
| Platform administrator | Runs the installation from the platform console, its own site (see [Sign in](#sign-in)): organizations, shared sensors, platform settings. Belongs to no organization and cannot see organization data. | `bootstrap-admin`, or another platform administrator. |
| Break-glass administrator | A second, local platform administrator for emergencies, never bound to an identity provider. Every sign-in with it is audited and alerted. | `bootstrap-admin -backup-email`. |
| Organization owner | Owns one organization: invites users, configures SSO, manages roles and data. | `bootstrap-admin -org-*`, or the admin console. |

By default only a platform administrator creates organizations
(`SIGNUP_MODE=disabled`). See
[Sign-up and more organizations](#sign-up-and-more-organizations) for the
alternatives.

## Run `bootstrap-admin`

The tool connects to the database with the same settings as the API, creates
both administrators with a temporary password printed once, and creates the
organization through the normal, audited organization service.

**Docker Compose** (in `api/deploy`):

```bash
docker compose exec api /app/bootstrap-admin \
  -email=admin@example.com \
  -backup-email=breakglass@example.com \
  -org-name="Example Corp" \
  -org-owner-email=owner@example.com
```

**All-in-one image:**

```bash
docker exec openctem /opt/openctem/api/bootstrap-admin \
  -email=admin@example.com \
  -backup-email=breakglass@example.com \
  -org-name="Example Corp" \
  -org-owner-email=owner@example.com
```

**Kubernetes:** enable `api.bootstrapAdmin` in the chart values, which runs the
same tool as a post-install Job. See
[Kubernetes](kubernetes.md#first-administrator).

The output contains, for each administrator, a block like this:

```text
=== Administrator created ===
  ID:       ...
  Name:     admin
  Email:    admin@example.com
  Role:     super_admin
  Password: ...   (temporary, shown once; must be changed at first sign-in)
```

and an `=== Organization created ===` block. Copy the passwords now; they are not
stored anywhere you can read them again. Keep the break-glass credentials offline.

The organization owner gets a one-time set-password link, valid for 24 hours:
emailed when [SMTP is configured](../configuration/email.md), otherwise printed
in the output.

## Sign in

![The sign-in page with email and password fields]({{ site.baseurl }}/assets/images/install/sign-in.png)
*Figure: The sign-in page at `/login`.*

![The set-password page a new account owner reaches from the one-time link]({{ site.baseurl }}/assets/images/install/set-password.png)
*Figure: The page the one-time set-password link opens.*

1. Each administrator signs in to the **platform console**, not to the
   organization sign-in page: it is its own site, with its own sign-in page.
   Where it is depends on how you installed:

   | Install | Platform console address |
   |---|---|
   | Compose or all-in-one, port mode (default) | `https://<host>:8443/` (`OPENCTEM_ADMIN_PORT`), from the networks in `OPENCTEM_ADMIN_ALLOWED_CIDRS` (private networks by default). From elsewhere, use your VPN or an SSH tunnel: `ssh -L 8443:127.0.0.1:8443 you@<host>`, then `https://localhost:8443/`. |
   | Host mode (`OPENCTEM_ADMIN_SITE=host`) | `https://<OPENCTEM_ADMIN_HOST>/`, its own DNS name. Recommended for production: the browser then isolates it from the main site. |
   | Kubernetes | `admin.site.host` (host mode), or `kubectl port-forward` in port mode; see [Kubernetes](kubernetes.md). |
   | Ansible kit | The console host or port you chose; see [Install with Ansible](ansible.md). |

   Sign in with the email and the temporary password, change the password and
   enroll an authenticator app (TOTP). The console asks for a TOTP code at every
   sign-in.
2. The owner opens the set-password link, chooses a password, signs in at
   `https://<host>/login` (the organization sign-in page, on the main address), and then invites users or configures SSO for the
   organization (see [Identity and access](../identity/index.md)).

## Options

| Flag | Environment variable | Meaning |
|---|---|---|
| `-email` | `ADMIN_EMAIL` | The platform administrator. Required. |
| `-name` | `ADMIN_NAME` | Display name (default: the part of the email before `@`). |
| `-role` | | `super_admin` (default), `ops_admin` or `readonly`. |
| `-backup-email` | `ADMIN_BACKUP_EMAIL` | The break-glass administrator. Required unless `-no-backup`. |
| `-backup-name` | `ADMIN_BACKUP_NAME` | Its display name. |
| `-no-backup` | | Create only the primary administrator. Not recommended: the tool prints a warning. |
| `-org-name` | `ORG_NAME` | Create the first organization. Needs `-org-owner-email`. |
| `-org-slug` | `ORG_SLUG` | URL slug of the organization (default: derived from the name). |
| `-org-owner-email` | `ORG_OWNER_EMAIL` | Owner of the organization. An existing account keeps its credentials; a new one gets the set-password link. |
| `-org-owner-name` | `ORG_OWNER_NAME` | Owner's display name for a new account. |
| `-force` | | Delete and re-create an existing administrator with the same email. |
| `-link` | | Link an administrator created by v0.8.0 or earlier to a sign-in account, keeping its role and authenticator. |
| `-db` | `DATABASE_URL` | Database URL. Default: built from `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` and `DB_SSLMODE`. |

The tool is idempotent: an administrator that already exists is reported and left
unchanged, and an organization whose slug exists is skipped. Re-run it to add a
break-glass administrator or an organization to an existing installation. An
email that already has an ordinary account cannot become a platform administrator.

## Sign-up and more organizations

`SIGNUP_MODE` is the installation's sign-up ceiling. The default,
`disabled`, suits a self-hosted install where the operator decides which
organizations exist: nobody signs up on their own, and only a platform
administrator creates further organizations in the platform console,
**Organizations**, **Create**. `domain` lets people with an address on an
organization's verified domain sign up and join it; `open` lets anyone sign up
and create an organization (a hosted service). `domain` and `open` need the
platform e-mail. The old `TENANT_CREATION_MODE` variable is gone and stops the
API from starting while it is set. See
[Sign-up and invitations](../identity/sign-up-and-invitations.md#creating-organizations)
for both layers, the limits and the CAPTCHA rules.

![The Organizations list of the admin console with Example Corp and its owner]({{ site.baseurl }}/assets/images/user-guide/admin-organizations.png)
*Figure: Platform console, Organizations: every organization of the installation.*

Users never sign up on their own by default: accounts come from an organization
owner or administrator (direct creation or invitation) or from the
organization's SSO. See
[Sign-up and invitations](../identity/sign-up-and-invitations.md).
