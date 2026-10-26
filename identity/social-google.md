---
title: Google
parent: Social login
grand_parent: Identity and access
nav_order: 1
---

# Social login with Google
{: .no_toc }

Adds a **Sign in with Google** button to the login page. Any Google account with a verified email can
use it, subject to the [rules for all providers](social-login.md#rules-that-apply-to-every-provider).
To let the members of one company sign in with their Google Workspace accounts, use
[organization SSO with Google Workspace](sso-google.md) instead.

1. TOC
{:toc}

## What you need

- The public origin of your installation, `https://<app>` (`APP_URL`). Use it exactly as people type
  it in the browser.
- A Google Cloud project, and permission to create OAuth clients in it.
- Access to the platform console, or to the API's environment.

## Step 1: Configure the Google consent screen

1. In the [Google Cloud console](https://console.cloud.google.com/), select or create a project.
2. Open **APIs & Services > OAuth consent screen** (in newer consoles: **Google Auth Platform >
   Branding / Audience**).
3. **User type:** choose **External** so any Google account can sign in. Choose **Internal** only if
   every user is in your own Google Workspace; then no other account can sign in.
4. Fill in the app name, the support email and the developer contact. Under **Authorized domains** add
   the registrable domain of `<app>` (for example `example.com`).
5. **Scopes:** add `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. These are the
   non-sensitive scopes OpenCTEM requests by default (`openid email profile`), so no Google
   verification review is needed for them.
6. **Publishing status:** while the app is in **Testing**, only the **test users** you list can sign in
   and everyone else sees `access_blocked`. Select **Publish app** (In production) so any account can
   sign in.

## Step 2: Create the OAuth client

1. **APIs & Services > Credentials > Create credentials > OAuth client ID** (in newer consoles:
   **Google Auth Platform > Clients > Create client**).
2. **Application type:** **Web application**. Name it, for example, `OpenCTEM sign-in`.
3. **Authorized JavaScript origins:** none are required, because the browser never calls Google's
   token endpoint; the exchange happens on the API. If the form insists, add `https://<app>`.
4. **Authorized redirect URIs:** add exactly

   ```text
   https://<app>/auth/callback/google
   ```

   Scheme, host, port and path must match; no trailing slash.
5. Select **Create** and copy the **Client ID** and the **Client secret**.

## Step 3: Configure OpenCTEM

### Option A: platform console (from the release that adds it)

1. Sign in to the platform console as a super admin.
2. Open **Settings > Sign-in > Social login > Google**.
3. Paste the **Client ID** and the **Client secret** (write-only: it is stored encrypted and never
   shown again). The page shows the **Redirect URI** to register; it must equal the one from step 2.
4. Turn the provider on and save. It applies at once, without a restart.
5. Select **Test** to run a sign-in through Google.

If the field is locked, an environment variable sets it and takes precedence (option B).

### Option B: environment variables

Set these on the **API** and restart it:

```bash
OAUTH_ENABLED=true
OAUTH_GOOGLE_ENABLED=true
OAUTH_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=<client-secret>
```

`OAUTH_ENABLED` defaults to `true`. `OAUTH_STATE_SECRET` is optional: unset, it is derived from the
session secret. Keep `openid` in `OAUTH_GOOGLE_SCOPES` if you override it (the default is
`openid,email,profile`): the account and its email are taken from Google's signed ID token, which
OpenCTEM checks against Google's keys, your client ID and Google's issuer.

How to set them per deployment is in the
[configuration reference](sign-in-configuration.md#setting-the-variables).

## Step 4: Verify

1. Open the login page in a private window. A **Google** button appears. If it does not, check
   `https://<app>/api/v1/auth/providers`.
2. Select it, choose an account and approve. You return to `https://<app>/auth/callback/google` and then
   to the app.
3. A person who is new and has no invitation sees the "set up" refusal when sign-up is closed. Invite
   them first, or use an account that already exists.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Google shows `Error 400: redirect_uri_mismatch` | The redirect URI registered in step 2 is not identical to `https://<app>/auth/callback/google`: wrong scheme (`http` vs `https`), host (`www`), port, a trailing slash, or a different public URL than the one in `APP_URL`. Google's error page shows the URI it received: copy it into the client. Changes can take a few minutes to apply. |
| `Error 403: access_denied` or "This app is blocked" / `access_blocked` | The app is in **Testing** and the account is not a test user, or the app is **Internal** and the account is outside the Workspace. Publish the app or add the user. |
| "Google hasn't verified this app" warning | The app is published but unverified. Basic scopes (`openid email profile`) do not need a review; the warning appears when sensitive scopes were added or branding is not verified. Remove extra scopes, or complete Google's brand verification. People can continue under **Advanced**. |
| `invalid_client` / callback fails right after consent | Wrong client ID or secret, or the secret was regenerated. Copy them again. |
| `invalid_scope` | `OAUTH_GOOGLE_SCOPES` contains something Google does not accept, or omits `openid`. Reset it to the default. |
| `callback_failed` (invalid state) | The state expired (10 minutes), was reused, or the person came back on another host name. Start again. |
| Signed in, but no organization | Normal for a new person without membership or invitation. Invite the email of their Google account. |
| "Your organization isn't set up yet" | Sign-up is closed and there is no invitation. See [Sign-up and invitations](sign-up-and-invitations.md). |
| "registered with a different login method" | The email already has a password account or an account made with another provider. See [existing accounts](social-login.md#existing-accounts). |

More: [Social login troubleshooting](social-login.md#troubleshooting-all-providers).
