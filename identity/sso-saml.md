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
   | IdP signing certificates (PEM) | One to five IdP signing certificates (for example the current and the next key during a rollover). An assertion signed with any of them verifies. Only expired certificates are refused; the card shows the soonest expiry. |
   | Allowed email domains | Optional email-domain allow-list |
   | Default role for new users | `viewer` (default) or `member` for just-in-time members. Admins and owners are never provisioned by SSO. |
   | Auto-provision users | Create memberships at first sign-in |
   | Enable SAML login | Master switch |

   **Import from metadata** at the top of the card fills the first three fields from the IdP's
   federation metadata URL (https only) or an uploaded metadata file. The import only fills the
   form; nothing is saved until you save.

   **Service provider details** on the same card lists the metadata, ACS and login URLs (built from
   `APP_URL`) and **Download SP metadata (XML)**, the file to upload in the IdP.

3. If the organization has an owner, saving creates a **pending change**. An owner approves it in the
   organization under **Settings > Access & security > SSO approvals** (with step-up) after comparing the new certificate's SHA-256
   fingerprint with the one in the IdP. Pending changes expire after 7 days.

Signature validation, conditions and replay checks are done by an established SAML library
(`crewjam/saml`); the stored certificate is the only trust anchor. On top of it:

- The IdP must **sign the assertion** itself. Signing only the whole response is not enough. A response
  must carry exactly one assertion, and encrypted assertions are not accepted.
- **SHA-1 is refused.** Set the IdP to sign with RSA-SHA256 (or stronger) and a SHA-256 digest.
- Each assertion is accepted **once**: its ID is remembered (in Redis) until it can no longer be
  valid, and a second use is refused. If Redis cannot be reached, SAML sign-in is refused.
- Only the HTTP-POST binding is accepted (no artifact binding).

## Microsoft Entra ID in 5 steps

{: .note }
**Not in v0.18.0.** This walkthrough (with **Download SP metadata (XML)**) and **Import from metadata**, with up to five IdP signing certificates in the configuration above, is merged for the next release; v0.18.0 does not have it yet.

1. **Download our metadata.** In the organization's **Single sign-on** tab, SAML card, select
   **Download SP metadata (XML)**. Set `APP_URL` on the API first; the file is built on it.
2. **Create the Entra application.** Microsoft Entra admin center > **Enterprise applications** >
   **New application** > **Create your own application** > "Integrate any other application you
   don't find in the gallery (Non-gallery)". Open it > **Single sign-on** > **SAML** > **Upload
   metadata file**, choose the file from step 1, and save. Under **Users and groups**, assign who
   may sign in.
3. **Claims.** **Attributes & Claims** > **Unique User Identifier (Name ID)**: source attribute
   `user.objectid`, name identifier format **Persistent**. Keep the `emailaddress` (`user.mail`) and
   `name` claims. Do not use the email or the UPN as the only identifier: both can be renamed and
   reused in the directory.
4. **Import Entra's metadata.** In the Entra application, **SAML Certificates** > copy **App
   Federation Metadata Url**. In the OpenCTEM SAML card > **Import from metadata**, paste it and
   select **Import** (or upload the Federation Metadata XML file). Turn on **Enable SAML login** and
   save; an owner approves the change if the organization has one.
5. **Verify the domain and test.** Verify the organization's email domain under **Verified
   domains**, then sign in at `https://<app>/login?org=<slug>`.

The import fetches the URL through the platform's outbound address guard (no private or internal
addresses, no redirect to them or to plain http), refuses a document that declares a DOCTYPE or
entities, and takes certificates only from the signing keys of the SAML identity provider
description. It does not refresh the certificate later on its own: when Entra rolls its signing key,
import again and save.

## Certificate expiry

Sign-in stops working when the IdP signing certificate expires. The organization's owners get an
in-app alert and an email 30, 7 and 1 day(s) before it expires, and again when it has expired. Ask
the IdP administrator for the new certificate, or import the IdP's metadata again, and save it in
the SAML settings (as a pending change if the organization has an owner). During a rollover, keep
both the old and the new certificate until the IdP signs with the new one. Each alert is sent once per certificate; saving a new
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
| The admin console says the public address is not set | `APP_URL` is not set on the API. The SP URLs and the metadata file are built on it. |
| Import from metadata says the address is not allowed | The URL points to a private or internal address, redirects there, or uses plain http. Upload the metadata file instead. |
