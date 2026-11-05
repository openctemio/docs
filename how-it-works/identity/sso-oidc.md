---
title: Single sign-on with OIDC
parent: Identity and access flows
grand_parent: How it works
nav_order: 6
description: How a person signs in through the organization's identity provider (Microsoft Entra ID, Okta or Google Workspace) and how the platform decides who they are.
---

# Single sign-on with OIDC
{: .no_toc }

A person enters their work email on the sign-in page and is sent to the
organization's identity provider. When they come back, the platform checks
the provider's signed answer, finds the account by the provider's stable
user id, checks membership, and opens a session. A platform administrator sets
the provider up for the organization; when the organization has an owner, the
owner approves the change first.

1. TOC
{:toc}

## The flow

```mermaid
sequenceDiagram
    autonumber
    actor U as Person
    participant B as Browser and console
    box Platform
    participant P as Platform API
    participant R as State store
    end
    box Identity provider
    participant I as Organization IdP
    end
    U->>B: enter work email
    B->>P: discover, same answer shape for every email
    P-->>B: next step sso, opaque organization reference
    B->>P: start sign-in with this provider
    P->>P: check the return address against the allow list
    P->>R: keep state, nonce, PKCE verifier, browser binding hash, 10 minutes
    P-->>B: provider address and a signed state handle
    B->>B: short-lived HttpOnly cookies for state and binding
    B->>I: sign in at the provider
    I-->>B: back to the console with a code and the state
    B->>P: code, state, browser binding
    P->>R: take the state once, compare the binding
    P->>I: exchange the code with the PKCE verifier
    I-->>P: signed ID token
    P->>P: check signature, audience, issuer, nonce, times, directory id
    P->>P: find the account by issuer and subject, never by email
    P->>P: member of this organization, or join it under the JIT rules
    P-->>B: session cookies, sign-in audited
```

1. The console asks the platform where an email signs in. The answer has the
   same shape for every email, so it does not reveal who has an account.
2. The platform builds the provider address with a random nonce and a PKCE
   challenge. What it needs to finish is kept on the server for 10 minutes;
   the browser holds only a signed handle and a binding value in HttpOnly
   cookies.
3. After the provider sign-in, the state is used once. It must come back in
   the same browser that started it.
4. The platform exchanges the code and checks the ID token: the signature
   with the provider's keys (RSA or ECDSA only), the audience, the issuer,
   the nonce, the times (2 minutes of clock skew), and for Microsoft Entra ID
   the directory (tenant) id configured for the organization.
5. The account is found by the provider's issuer and subject. An email match
   alone never signs anyone in to an existing account.
6. A person who is already a member gets a session. A new person joins only
   when just-in-time sign-up is on for the provider, their email domain is a
   verified domain of the organization, and it is allowed for that domain.
   They join as **Member** or **Viewer**, never higher.

### Who gets in

```mermaid
flowchart TD
    T["ID token valid"] --> K{"Account with this issuer and subject?"}
    K -- "yes" --> M{"Member of this organization?"}
    K -- "no" --> E{"Account with this email?"}
    E -- "password account" --> L["Refused, link required. Sign in with the password and link from Account"]
    E -- "bound to another provider" --> D["Refused, different sign-in method"]
    E -- "account without a password, on a verified domain" --> AD["Identity bound to that account after the ownership checks"]
    AD --> M
    E -- "no account" --> J{"Just-in-time sign-up allowed for this verified domain?"}
    J -- "no" --> NM["Refused, not a member. Nothing created"]
    J -- "yes" --> NEW["Account and membership created as Member or Viewer"]
    M -- "yes" --> S["Session"]
    M -- "awaiting approval" --> AW["Refused, awaiting approval. Owners notified"]
    M -- "no" --> J
    NEW --> S
```

## When something fails

| What happens | What you see | What to do |
|---|---|---|
| The state is used twice, expired or from another browser | The sign-in page shows an error | Start the sign-in again from the same browser. |
| The provider's token fails a check | Sign-in refused | An administrator checks the client id, the directory id and the clock. |
| You are not a member and just-in-time sign-up does not apply | "You do not have access to this organization. Contact your administrator." | Ask an administrator to invite you. |
| A password account exists with your email | Link required | Sign in with your password, then link the provider under **Account**. |
| Your email domain is not allowed | Domain not allowed | An administrator adds and verifies the domain. |
| Microsoft has not verified the email | Email not verified by the provider | Fix the email in the directory. |
| The organization has no free seat | No seat | An owner frees a seat or raises the limit. |

## Security

- **Trust boundary.** The identity provider is outside the platform. Only its
  signed ID token is trusted, after the checks above. Email is never the key.
- **What is protected.** The provider's client secret is encrypted with
  AES-256-GCM. The state handle is signed and single use, PKCE protects the
  code, and the nonce ties the token to this sign-in.
- **Organization isolation.** A provider belongs to one organization. For
  Microsoft Entra ID the directory id is pinned: a token from another
  directory is refused.
- **Roles.** Roles are not read from the provider's claims. Use SCIM groups
  or the console to give more.
- **Sign-out.** The provider can end sessions with back-channel logout.
  Disabling a person at the provider alone does not end an open session; use
  SCIM or suspend the member.

## Related

- [OIDC single sign-on](../../identity/sso-oidc.md)
- [Microsoft Entra ID](../../identity/sso-entra-id.md)
- [Google Workspace](../../identity/sso-google.md)
- [Sign-in methods](../../identity/sign-in-methods.md)
- [Single sign-on with SAML](sso-saml.md)
