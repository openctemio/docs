---
title: SAML 2.0
parent: Identity and access
nav_order: 8
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
  `https://<app>/login?org={slug}` (`<app>` is `APP_URL`) or at the sign-in start URL above.
- **Set `APP_URL`** when the API is reached through a proxy; without it the SP URLs are derived
  from the request host and trusted forwarding headers.
- **`OAUTH_FRONTEND_CALLBACK_URL`** is the URL on the web app origin where the browser lands after a
  successful SAML sign-in. It defaults to `APP_URL/auth/callback` (and to
  `http://localhost:3000/auth/callback` when `APP_URL` is unset), so with `APP_URL` set you only
  change it when the web app is at another origin.

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

1. **Console > Customers > Organizations >** the organization **> Single sign-on** (tab) **> Verified
   domains:** add the organization's email domain, publish the TXT record shown
   (`_openctem-verify.<domain>`, value `openctem-domain-verification=<token>`), then **Verify now**.
2. In the same tab, under **SAML 2.0** (every change needs a fresh authenticator code):

   | Field | Value |
   |---|---|
   | IdP entity ID (issuer) | The issuer of your IdP |
   | IdP SSO URL | The IdP single sign-on endpoint |
   | IdP signing certificate (PEM) | The IdP signing certificate. Responses are verified against it. An expired certificate is refused; the card shows when the stored one expires. |
   | Allowed email domains | Optional email-domain allow-list |
   | Default role for new users | `viewer` (default) or `member` for just-in-time members. Admins and owners are never provisioned by SSO. |
   | Auto-provision users | Create memberships at first sign-in |
   | Enable SAML login | Master switch |

   **Service provider details** on the same card lists the metadata, ACS and login URLs. Because the
   admin console runs on its own origin, use the values from the table above (built from
   `APP_URL`), not the origin shown there.

3. If the organization has an owner, saving creates a **pending change**. An owner approves it in the
   organization under **Settings > Security > SSO approvals** (with step-up) after comparing the new certificate's SHA-256
   fingerprint with the one in the IdP. Pending changes expire after 7 days.

Signature validation, conditions and replay checks are done by an established SAML library
(`crewjam/saml`); the stored certificate is the only trust anchor. On top of it:

- The IdP must **sign the assertion** itself. Signing only the whole response is not enough. A response
  must carry exactly one assertion, and encrypted assertions are not accepted.
- **SHA-1 is refused.** Set the IdP to sign with RSA-SHA256 (or stronger) and a SHA-256 digest.
- Each assertion is accepted **once**: its ID is remembered (in Redis) until it can no longer be
  valid, and a second use is refused. If Redis cannot be reached, SAML sign-in is refused.
- Only the HTTP-POST binding is accepted (no artifact binding).

## Certificate expiry

Sign-in stops working when the IdP signing certificate expires. The organization's owners get an
in-app alert and an email 30, 7 and 1 day(s) before it expires, and again when it has expired. Ask
the IdP administrator for the new certificate and save it in the SAML settings (as a pending change
if the organization has an owner). Each alert is sent once per certificate; saving a new
certificate starts over.

## Who is admitted

- An **existing account** signs in only if it is already a member of the organization **and** its
  email domain is DNS-verified for the organization. Membership alone is not enough, because one
  account may belong to several organizations.
- A password account is never taken over by a SAML sign-in with the same email.
- A **new person** is provisioned just in time only when auto-provision is on, their email domain is
  DNS-verified for the organization, and it is in the organization's allowed email domains (if set).
- Every failure redirects to `/login?error=saml` without saying why; details are in the API log.

A session from the organization's SAML IdP counts as the organization's SSO: it satisfies SSO
enforcement and the organization's 2FA requirement, for this organization only (when the organization
turned on [SSO must prove two-factor](two-factor.md#sso-must-prove-two-factor), only if the assertion
states a multi-factor authentication context). For
[step-up re-authentication](two-factor.md#step-up-re-authentication), OpenCTEM sends
`ForceAuthn="true"` and requires an `AuthnInstant` no older than 5 minutes.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Redirect to `/login?error=saml` | Check the API log. Common causes: wrong or expired certificate, the IdP signs only the response and not the assertion, SHA-1 signing, a response posted twice, clock skew, the response was not for a request OpenCTEM sent (IdP-initiated), audience mismatch with the entity ID, email domain not verified, the person is not a member and auto-provision is off. |
| Sign-in works but lands on `localhost:3000` | `APP_URL` is not set. Set it (or `OAUTH_FRONTEND_CALLBACK_URL`) to the web app origin. |
| Sign-in fails over plain HTTP | SAML needs HTTPS (secure cookie). |
| The SP URLs shown in the admin console differ from the metadata | The admin console shows its own origin; the metadata uses `APP_URL`. Register the `APP_URL` values. |
