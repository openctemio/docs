---
title: Sign-in methods overview
parent: Identity and access
nav_order: 0
---

# Sign-in methods overview
{: .no_toc }

OpenCTEM has four ways to sign in. They are independent: you can use one or all of them, and each
has its own setup page.

1. TOC
{:toc}

## The four methods

| Method | Who it is for | Who sets it up | Where it is configured | Setup page |
|---|---|---|---|---|
| **Email and password** (local account, optional authenticator-app 2FA) | Everyone by default | Nobody; users create their own password after an invitation or sign-up | Built in | [Two-factor authentication](two-factor.md) |
| **Social login** (Google, GitHub, Microsoft) | The whole installation: a convenience button on the login page | The operator of the installation | Platform console (**Settings > Social login**, from v0.16.0) or API environment variables | [Social login](social-login.md) |
| **Organization SSO** (OpenID Connect with Google Workspace, Microsoft Entra ID or Okta; SAML 2.0) | The members of one organization, with that organization's own directory | A platform administrator, approved by the organization owner | Platform console, organization, **Single sign-on** tab | [Google Workspace](sso-google.md), [Entra ID](sso-entra-id.md), [Okta](sso-oidc.md), [SAML 2.0](sso-saml.md) |
| **Platform administrator sign-in** | The people who run the installation | The first administrator, then a platform owner who invites the others | The platform console's own sign-in page; optional identity provider under **Security > Admin sign-in** | [Admin sign-in](../console/security.md#admin-sign-in) |

## When to use which

- **A small team or a trial:** password sign-in is enough. Turn on 2FA for the organization.
- **You want a "Sign in with Google" or "Sign in with GitHub" button for everyone:** use social login.
  It only proves who the person is. It does not put anyone in an organization, and it does not
  replace an organization's own security policy.
- **A company that wants its employees to sign in with the company directory, with access removed when
  they leave the directory, and password sign-in switched off:** use organization SSO, then turn on
  SSO enforcement. Social login cannot do this.
- **Administrators of the installation:** use the platform console's sign-in page. An organization's
  SSO and social login never sign anyone in to the console. An administrator's account may also be a
  member of organizations and use any of these methods on the main site, where it has only its
  organization role.

## What each method proves and what it grants

| | Password | Social login | Organization SSO |
|---|---|---|---|
| Proves | Knowledge of the password (and the second factor, if enrolled) | Control of an account at Google, GitHub or Microsoft with a **verified email** | Membership of the organization's directory |
| Creates an account | When the sign-up policy or an invitation allows it | Only when the sign-up policy admits it or the person has a pending invitation | Yes, just in time, for email domains the organization has proven with DNS, if enabled |
| Adds the person to an organization | Through an invitation | **Never** | Just in time, for verified domains, as viewer or member only |
| Counts as the organization's SSO (enforcement) | No | **No** | Yes |
| Counts as the organization's 2FA | Only with a second factor | **No** | Yes, unless the organization turned on **SSO must prove two-factor** |

## Security notes

- Accounts are matched by the provider's stable identity (issuer and subject), not by email alone.
  A sign-in whose email matches an existing account created another way is refused (social sign-in:
  `409 OAUTH_ACCOUNT_EXISTS`; organization SSO: "this email is registered with a different sign-in
  method", `SSO_DIFFERENT_METHOD`), so a verified email at one provider cannot take over an account
  made at another. A sign-in never links itself to an existing account; linking always needs the
  person's typed code or password. Details: [Existing accounts](social-login.md#existing-accounts).
- Only provider-verified emails are accepted: Google `email_verified`, a verified GitHub primary
  email, and for Microsoft the `xms_edov` claim. A verified email proves the mailbox only where the
  provider runs it (Gmail, the account's own Workspace domain, Microsoft); a personal Google account on
  a company address and any GitHub account cannot claim invitations, domain joins or provisioned
  accounts.
- Every social and OIDC flow uses PKCE and a `state` that is an opaque handle to a server-side record:
  it lives 10 minutes by default, is consumed by the first callback and is bound to the browser that
  started the sign-in.
- Every refusal carries a stable code, which the web console words in the person's language; see
  [Sign-in refusal codes](../api/authentication.md#sign-in-refusal-codes).
- Social login and SSO never grant the owner or admin role.
- Organization SSO changes made in the console need the organization owner's approval.
- Keep a way back in: in an organization that requires SSO, an owner can still sign in with a password
  and their second factor (audited and announced to the other owners and admins), and each
  installation should have a break-glass platform administrator. See
  [Enforcing SSO](sso-google.md#enforcing-sso-and-break-glass).

## Where the settings live

Every variable is listed on one page: [Sign-in configuration reference](sign-in-configuration.md).
