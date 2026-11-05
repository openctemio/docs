---
title: Sign-up and invitations
parent: Identity and access flows
grand_parent: How it works
nav_order: 1
description: How a person gets an account, verifies their email, creates a first organization or joins one by invitation.
---

# Sign-up and invitations
{: .no_toc }

A person gets into OpenCTEM in one of three ways: an administrator creates
the account, an organization invites them, or they sign up themselves when the
installation allows it. Self sign-up is off by default. After sign-up the
person either creates their first organization, when that is allowed, or
accepts an invitation.

1. TOC
{:toc}

## The flow

### Self sign-up and the first organization

```mermaid
sequenceDiagram
    autonumber
    actor U as Person
    participant B as Console
    box Platform
    participant P as Platform API
    participant M as Mail
    end
    U->>B: Create an account
    B->>P: register, at most 3 a minute from one address
    P->>P: sign-up policy allows this address
    P->>P: password policy, at least 12 characters, not breached
    alt email already has an account
        P-->>B: the same answer as a new account, a set-password link may be mailed
    else new account
        P->>P: store the account, password hashed with bcrypt
        P->>M: verification link, valid 24 hours
        P-->>B: account created, check your email
    end
    U->>P: open the link, email verified
    U->>P: sign in
    P-->>B: no organization yet, account space
    U->>P: create the first organization, if allowed
    P->>P: organization created with this person as owner, audited
    P->>P: two-factor required for owners? then enrol first
    P-->>B: session in the new organization
```

1. The sign-up policy decides who may register. It is set by a platform
   administrator under **Settings > Sign-in and sign-up > Sign-up** and
   cannot go above the installation's own limit. An address whose domain
   must sign in with its organization's single sign-on is refused.
2. The answer is the same whether the email is new or already has an
   account, so the page does not reveal who is registered.
3. The verification link lasts 24 hours. A person cannot sign in before the
   email is verified, unless the installation has no mail server at all.
4. When creating an organization is allowed, the person becomes its owner.
   If owners must use two-factor authentication, they enrol before they get
   a session.

### Accepting an invitation

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrator
    actor U as Invited person
    box Platform
    participant P as Platform API
    end
    A->>P: invite by email with roles, needs the invite permission
    P->>P: random token stored hashed, valid 7 days, 50 an hour per inviter
    P-->>U: email with the invitation link
    U->>P: open the link, look up the invitation
    alt no account yet
        U->>P: register with the invitation, then sign in
    end
    U->>P: accept
    P->>P: invitation email equals the account email, pending, not a member yet
    P->>P: membership created with the invited roles, audited
    P->>P: organization rules, verified email, single sign-on, two-factor
    alt a rule is not met
        P-->>U: refused with the reason, for example two-factor enrolment required
    else
        P-->>U: session in the organization
    end
```

1. An invitation can be sent again after 10 minutes, at most 5 times.
   Revoked invitations are kept for 30 days and then removed.
2. A person who already has organizations sees invitations on **Your
   invitations** and can accept or decline them there.
3. The invitation must be accepted by the account whose email it was sent
   to.

## When something fails

| What happens | What you see | What to do |
|---|---|---|
| Sign-up is closed | "Your organization isn't set up yet" | Ask an administrator for an account or an invitation. |
| The domain must use single sign-on | Sign-up refused | Use **Sign in with SSO**. |
| The password is too short or found in a breach list | The rule that failed | Choose another password. |
| The verification link expired | The link is refused | Ask for a new link. One link is sent per address every 2 minutes. |
| You sign in before verifying | Email not verified | Open the link in your mailbox. |
| Creating organizations is off | "Organizations are created by the application administrator." | Ask for an invitation. |
| The invitation was sent to another email | Refused | Sign in with the invited email. |
| The invitation expired | Refused | Ask for a new invitation. |
| The organization requires two-factor | Two-factor enrolment required | Enrol, then sign in again. You are already a member. |

## Security

- **No enumeration.** Registration and resend answers are the same for known
  and unknown emails.
- **Secrets at rest.** Passwords are bcrypt hashes. Verification and
  invitation tokens are stored as SHA-256 hashes.
- **Organization isolation.** An invitation names one organization and one
  email. Roles are checked against what the inviter may grant.
- **Audit.** Registration, organization creation, invitations and
  acceptance are audited.

## Related

- [Sign-up and invitations](../../identity/sign-up-and-invitations.md)
- [First administrator](../../install/first-admin.md)
- [Ownership invitations](ownership-invitations.md)
- [Two-factor and the two-factor floor](two-factor.md)
