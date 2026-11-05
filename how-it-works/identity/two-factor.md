---
title: Two-factor and the two-factor floor
parent: Identity and access flows
grand_parent: How it works
nav_order: 4
description: How a person enrols an authenticator, how the code is checked at sign-in, and how organizations and the platform require it.
---

# Two-factor and the two-factor floor
{: .no_toc }

Local accounts protect their sign-in with a time-based one-time password
(TOTP) from an authenticator app. An organization can require it, and the
platform administrator can set a floor that applies to every organization.
People who sign in through their organization's single sign-on prove the
second factor at their provider.

1. TOC
{:toc}

## The flow

### Sign-in with a second factor

```mermaid
sequenceDiagram
    autonumber
    actor U as Person
    participant B as Console
    box Platform
    participant P as Platform API
    end
    U->>B: email and password
    B->>P: sign in
    P->>P: password correct, a second factor is required now
    P-->>B: challenge token, single use, 5 minutes
    alt factor enrolled
        U->>B: six-digit code or a recovery code
        B->>P: verify with the challenge token
        P->>P: code valid for this 30-second step, not used before
    else not enrolled, organization requires it
        B->>P: start enrolment with the challenge token
        P-->>B: secret and QR code
        U->>B: first code from the app
        B->>P: confirm enrolment
        P-->>B: 10 recovery codes, shown once
    end
    alt wrong code
        P-->>B: code invalid, failure counted, 5 tries per challenge
    else accepted
        P-->>B: session, as for a password sign-in
    end
```

1. The challenge token is not a session. It is stored hashed, works once
   and only for 5 minutes, and is burned after 5 wrong codes.
2. Codes are six digits, change every 30 seconds, and one step either side
   is accepted. A code that was already used is refused.
3. A recovery code works once. Using one is audited and the person is
   emailed.
4. Turning two-factor on ends every other session of the person.

### Who must use two-factor

```mermaid
flowchart TD
    S["Person signs in"] --> F{"Signed in with this organization's SSO?"}
    F -- "yes" --> E{"Organization requires proof of MFA from the IdP?"}
    E -- "no" --> OK["The provider owns the second factor"]
    E -- "yes, and the token shows MFA" --> OK
    E -- "yes, no MFA in the token" --> R1["Refused, MFA evidence required"]
    F -- "no" --> O{"Organization requires two-factor for this role?"}
    O -- "yes" --> REQ["Required now"]
    O -- "no" --> FL{"Platform floor covers this role?"}
    FL -- "no" --> NO["Not required"]
    FL -- "yes" --> G{"Grace period over?"}
    G -- "no" --> NO
    G -- "yes" --> REQ
```

- The floor is set under **Settings > Organizations > Two-factor**: No
  floor, Owners and administrators, or Everyone. Existing members get 14
  days of grace and new accounts 7 days, each adjustable from 0 to 90.
- An organization can only be stricter than the floor.
- Creating an API key or another credential needs two-factor even during
  the grace period.
- If the policy cannot be read, two-factor is treated as required.

## When something fails

| What happens | What you see | What to do |
|---|---|---|
| The code is wrong | Code invalid | Check the time on your phone and try the next code. |
| The challenge expired or was used | Challenge invalid | Sign in again. |
| Too many wrong codes | The account is locked like after wrong passwords | Wait and try again. |
| You lost your phone | | Use a recovery code, then replace the device under **Account > Security**. An owner or administrator can reset your two-factor. |
| You try to turn it off while it is required | Required by policy | It stays on while any of your organizations, or the floor, requires it. |
| Your SSO token carries no MFA proof | MFA evidence required | Ask your identity provider administrator to require MFA. |

## Security

- **At rest.** The TOTP secret is encrypted with AES-256-GCM. Recovery codes
  and challenge tokens are stored hashed.
- **Replay.** Each 30-second step is accepted once per account.
- **Organization isolation.** One organization's requirement never weakens
  another's. The strictest rule that applies wins.
- **Audit.** Enrolling, disabling, resets, recovery code use and failed codes
  are audited.

## Related

- [Two-factor authentication](../../identity/two-factor.md)
- [Two-factor requirements](../../identity/access/two-factor-requirements.md)
- [Step-up re-authentication](step-up.md)
- [Password sign-in](sign-in.md)
