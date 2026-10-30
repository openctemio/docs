---
title: Microsoft
parent: Social login
grand_parent: Identity and access
nav_order: 3
---

# Social login with Microsoft
{: .no_toc }

Adds a **Sign in with Microsoft** button to the login page. It accepts work and school accounts from
any Microsoft Entra directory, subject to the
[rules for all providers](social-login.md#rules-that-apply-to-every-provider).

**Personal Microsoft accounts (outlook.com, hotmail.com, live.com) are not accepted.** OpenCTEM trusts
the email of a Microsoft sign-in only when the ID token carries the `xms_edov` ("email domain owner
verified") claim, which personal accounts and guests with an unverified email domain do not have. Such
sign-ins are refused. Use Google or GitHub for people with personal accounts.

For the members of one company, use [organization SSO with Entra ID](sso-entra-id.md), which is pinned
to the company's directory and can enforce SSO.

1. TOC
{:toc}

## Step 1: Register the application

In the Microsoft Entra admin center, **Entra ID > App registrations > New registration**:

1. **Name:** for example `OpenCTEM sign-in`.
2. **Supported account types:** *Accounts in any organizational directory (Any Microsoft Entra ID
   tenant - Multitenant)*.
3. **Redirect URI:** platform **Web**, exactly

   ```text
   https://<app>/auth/callback/microsoft
   ```

4. Select **Register**, then copy the **Application (client) ID**.
5. **Certificates & secrets > New client secret.** Copy the secret **Value** (not the Secret ID) and
   note the expiry date: sign-in stops when the secret expires, so set a reminder.
6. **API permissions:** delegated Microsoft Graph `openid`, `email`, `profile`, `User.Read`. Grant
   admin consent if your directory asks for it.
7. **Token configuration > Add optional claim > ID token > `xms_edov`.** This is required; accept the
   prompt to enable the Microsoft Graph email permission. Without it every Microsoft sign-in is
   refused.

## Step 2: Configure OpenCTEM

### Option A: platform console (from v0.16.0)

1. Sign in to the platform console as a super admin and elevate (see [Roles and elevation](../console/index.md#roles-and-elevation)).
2. Open **Settings > Social login** and go to the **Microsoft** section.
3. Paste the **Application (client) ID** and the secret **Value** (write-only). Check that the shown
   **Redirect URI** equals the one in step 1.
4. Tick **Offer on the sign-in page** and save. Give a reason and confirm with your authenticator code. It applies at once on every server, without a restart.
5. Select **Test configuration**: it asks the provider whether it accepts the client ID and secret and whether the redirect URI is registered.

### Option B: environment variables

Set on the **API** and restart it:

```bash
OAUTH_ENABLED=true
OAUTH_MICROSOFT_ENABLED=true
OAUTH_MICROSOFT_CLIENT_ID=<application-client-id>
OAUTH_MICROSOFT_CLIENT_SECRET=<client-secret-value>
```

The default scopes are `openid,email,profile,User.Read` (`OAUTH_MICROSOFT_SCOPES`); keep `openid`.
Per-deployment instructions: [configuration reference](sign-in-configuration.md#setting-the-variables).

## Step 3: Verify

1. Open the login page in a private window and select **Microsoft**.
2. Sign in with a work account. You return to `https://<app>/auth/callback/microsoft`.
3. Try an outlook.com account: it is refused. This is expected.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Microsoft shows `AADSTS50011` (reply URL does not match) | The redirect URI in the app registration is not exactly `https://<app>/auth/callback/microsoft`, or it was added under another platform type than **Web**. |
| `AADSTS7000215` / `invalid_client` | You copied the Secret ID instead of the secret **Value**, or the secret expired. Create a new secret. |
| `AADSTS700016` (application not found in the directory) | The registration is single-tenant. Change **Supported account types** to multitenant. |
| `AADSTS65001` (consent required) | Grant admin consent for `User.Read`, or let the user consent. |
| Sign-in refused after Microsoft authentication | The `xms_edov` claim is missing or false (add the optional claim; personal accounts and unverified-domain guests never have it), or `openid` is missing from the scopes. The API log says "email not verified by Microsoft". |
| `callback_failed` (invalid state) | The state expired (10 minutes) or was reused. Start again. |
| Signed in, but no organization | Normal without membership or invitation. Invite the work email. |

More: [Social login troubleshooting](social-login.md#troubleshooting-all-providers).
