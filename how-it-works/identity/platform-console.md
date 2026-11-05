---
title: Platform console and break-glass
parent: Identity and access flows
grand_parent: How it works
nav_order: 13
description: How platform administrators sign in to the separate platform console, raise their rights for a short time, and how the break-glass account is created and used.
---

# Platform console and break-glass
{: .no_toc }

The platform console is a separate site for the people who run the
installation. It has its own sessions, always needs a second factor, and is
read-only until the administrator elevates for a short time. A break-glass
account is a spare platform administrator kept for emergencies: it can only
use the console.

1. TOC
{:toc}

## The flow

```mermaid
sequenceDiagram
    autonumber
    actor A as Platform administrator
    box Platform console site
    participant C as Console
    participant P as Console API
    participant L as Admin audit log
    end
    A->>C: email and password
    C->>P: sign in, 5 a minute, CAPTCHA after 3 failures
    P->>P: same password and lockout as the account
    alt wrong, not an administrator, or must use the IdP
        P-->>C: Wrong email or password
    else
        P-->>C: second factor step, 5 minutes
        A->>C: authenticator code or security key
        P->>P: console session, 8 hours, 15 minutes idle, 3 at most
        P->>L: console sign-in
        A->>C: Elevate, role, reason, 15 to 60 minutes, fresh code
        P->>L: elevation written first
        A->>C: change something
        P->>L: write started, then the change
    end
```

1. The console runs on its own address. The main site answers 404 for it.
2. Every console sign-in needs a second factor: a code or a security key.
   The installation can require security keys.
3. The session is read-only until the administrator elevates, with a role,
   a reason and a fresh code, for 15 to 60 minutes.
4. A change is not made when it cannot be audited first.
5. Some changes need a second super administrator to approve: adding or
   removing a super administrator, deleting an organization now, sign-in
   provider and two-factor policy changes, and others.

### Break-glass account

```mermaid
flowchart TD
    CLI["bootstrap-admin on the server, interactive terminal"] --> BG["Primary administrator and a break-glass administrator with a temporary password"]
    BG --> STORE["Credentials stored offline"]
    STORE --> USE{"Emergency, IdP down"}
    USE --> PW["Password and second factor, even when the IdP is required"]
    PW --> ALERT["Audited as break-glass sign-in, other administrators alerted"]
    BG --> TEST["Regular test, confirmed by another administrator"]
    BG -.-> NO["Cannot sign in to the main site, cannot join an organization, cannot approve"]
```

- `bootstrap-admin` creates the first administrator and, unless told not
  to, a break-glass administrator on a separate email. It refuses to print
  credentials to anything but a terminal.
- The break-glass account always has a password path, but still needs its
  second factor. Each use is a high-severity audit event and alerts the other
  administrators.
- Other platform administrators may also be members of organizations on the
  main site. Only break-glass accounts are limited to the console.

## When something fails

| What happens | What you see | What to do |
|---|---|---|
| Wrong password, or the IdP is required for this account | "Wrong email or password" | Use the IdP, or the break-glass account in an emergency. |
| Security keys are required | Security key required | Use a registered key. |
| The audit store is down | The change is refused | Restore the audit store first. |
| A second approval is needed | Second approval required | Ask another super administrator to approve. |
| Session idle for 15 minutes | Sign-in page | Sign in again. |

## Security

- **Separate site.** Its own address, optional network allow list, its own
  cookies with SameSite Strict and a session-bound CSRF token. No API keys.
- **Least privilege in time.** Read-only by default, elevation is short and
  audited.
- **Audit.** The admin audit log is hash-chained, and its head can be checked
  with `bootstrap-admin verify-audit` or shipped to an outside sink.

## Related

- [Platform console](../../console/index.md)
- [Console security](../../console/security.md)
- [First administrator](../../install/first-admin.md)
- [Audit log integrity](../operations/audit-chain.md)
