---
title: SAML 2.0
parent: Identity and access
nav_order: 7
---

# Single sign-on with SAML 2.0

OpenCTEM acts as a SAML 2.0 Service Provider (SP) for one organization at a time. Any SAML identity
provider works, for example Okta, Microsoft Entra ID, ADFS or Keycloak. Each organization has at most
one SAML configuration, and it is disabled until enabled.

## Service Provider values

Give these to your identity provider. `{slug}` is the organization's slug and `<APP_URL>` is the
public origin of the installation (`APP_URL`; with the bundled gateway it is set from
`OPENCTEM_PUBLIC_URL`).

| Item | Value |
|---|---|
| SP metadata | `<APP_URL>/api/v1/auth/saml/{slug}/metadata` (public; import it if your IdP supports it) |
| Entity ID (audience) | `<APP_URL>/api/v1/auth/saml/{slug}/metadata` |
| Assertion Consumer Service (HTTP-POST) | `<APP_URL>/api/v1/auth/saml/{slug}/acs` |
| Sign-in start (SP-initiated) | `<APP_URL>/api/v1/auth/saml/{slug}/login` |
| NameID format | `emailAddress` (or `persistent`, see below) |

Requirements:

- **HTTPS.** The request-tracking cookie must survive the cross-site POST back from the IdP, which
  browsers allow only for `Secure` cookies.
- **SP-initiated sign-in only.** Every response must answer a request OpenCTEM sent
  (`InResponseTo`); IdP-initiated (unsolicited) responses are refused. Users start at
  `https://<console>/login?org={slug}` or at the sign-in start URL above.
- **Set `APP_URL`** when the API is reached through a proxy; without it the SP URLs are derived
  from the request host and trusted forwarding headers.
- **Set `OAUTH_FRONTEND_CALLBACK_URL`** to an URL on the console origin (for example
  `https://app.example.com/auth/callback`). After a successful SAML sign-in the browser is sent to that
  origin; its default is `http://localhost:3000`. The Compose deployment sets it to
  `<OPENCTEM_PUBLIC_URL>/auth/callback`; set it yourself in the all-in-one env file or, with Helm, in
  `api.extraEnv`.

## Attributes

The mapping is fixed:

| OpenCTEM field | Taken from |
|---|---|
| Email (required) | the NameID when it contains `@`; otherwise the first attribute whose name contains `emailaddress`, `email`, `mail`, or `urn:oid:0.9.2342.19200300.100.1.3` |
| Display name | an attribute named like `displayname`, `name`, `cn`, or `urn:oid:2.16.840.1.113730.3.1.241` |

Groups and roles are not read from SAML assertions. Use [SCIM](scim.md) group mappings to drive roles
from the identity provider.

When the NameID format is `persistent`, the account is bound to the pair (IdP entity id, NameID) for
this organization, so a later email change at the IdP follows the same account.

## Configure it

A platform administrator (super admin) configures SAML:

1. **Admin console > Organizations >** the organization **> Single sign-on > Verified domains:** add
   the organization's email domain, publish the TXT record shown (`_openctem-verify.<domain>`, value
   `openctem-domain-verification=<token>`), then **Verify**.
2. In the same tab, **SAML 2.0**:

   | Field | Value |
   |---|---|
   | IdP entity ID | The issuer of your IdP |
   | IdP SSO URL | The IdP single sign-on endpoint |
   | IdP certificate | The IdP signing certificate, PEM. Responses are verified against it. |
   | Allowed domains | Optional email-domain allow-list |
   | Default role | `viewer` (default) or `member` for just-in-time members. Admins and owners are never provisioned by SSO. |
   | Auto-provision | Create memberships at first sign-in |
   | Enabled | Master switch |

3. If the organization has an owner, saving creates a **pending change**. An owner approves it in the
   organization under **Settings > SSO approvals** after comparing the new certificate's SHA-256
   fingerprint with the one in the IdP. Pending changes expire after 7 days.

Signature validation, conditions and replay checks are done by an established SAML library
(`crewjam/saml`); the stored certificate is the only trust anchor.

## Who is admitted

- An **existing account** signs in only if it is already a member of the organization **and** its
  email domain is DNS-verified for the organization. Membership alone is not enough, because one
  account may belong to several organizations.
- A password account is never taken over by a SAML sign-in with the same email.
- A **new person** is provisioned just in time only when auto-provision is on, their email domain is
  DNS-verified for the organization, and it is in the organization's allowed email domains (if set).
- Every failure redirects to `/login?error=saml` without saying why; details are in the API log.

A session from the organization's SAML IdP counts as the organization's SSO: it satisfies SSO
enforcement and the organization's 2FA requirement, for this organization only. For
[step-up re-authentication](two-factor.md#step-up-re-authentication), OpenCTEM sends
`ForceAuthn="true"` and requires an `AuthnInstant` no older than 5 minutes.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Redirect to `/login?error=saml` | Check the API log. Common causes: wrong certificate, clock skew, the response was not for a request OpenCTEM sent (IdP-initiated), audience mismatch with the entity ID, email domain not verified, the person is not a member and auto-provision is off. |
| Sign-in works but lands on `localhost:3000` | Set `OAUTH_FRONTEND_CALLBACK_URL` to an URL on the console origin. |
| Sign-in fails over plain HTTP | SAML needs HTTPS (secure cookie). |
| The SP URLs shown in the console differ from the metadata | The console shows its own origin; the metadata uses `APP_URL`. Make them the same origin (the bundled gateway does). |
