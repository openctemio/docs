---
title: GitHub
parent: Social login
grand_parent: Identity and access
nav_order: 2
---

# Social login with GitHub
{: .no_toc }

Adds a **Sign in with GitHub** button to the login page. Any GitHub account with a **verified primary
email** can use it, subject to the [rules for all providers](social-login.md#rules-that-apply-to-every-provider).

1. TOC
{:toc}

## Step 1: Create the OAuth app

Create an **OAuth App** (not a GitHub App) under the account or organization that will own it.

1. On GitHub, open **Settings > Developer settings > OAuth Apps > New OAuth App** (for an organization:
   **Organization settings > Developer settings > OAuth Apps**).
2. **Application name:** for example `OpenCTEM`.
3. **Homepage URL:** `https://<app>`.
4. **Authorization callback URL:** exactly

   ```text
   https://<app>/auth/callback/github
   ```

   GitHub allows one callback URL per OAuth App. Create one app per installation.
5. Leave **Enable Device Flow** off. Select **Register application**.
6. Copy the **Client ID**. Select **Generate a new client secret** and copy it now; GitHub shows it
   once.

OpenCTEM requests the scopes `read:user` and `user:email` (`OAUTH_GITHUB_SCOPES`). It uses them to read
the account's numeric id, name, avatar and the list of emails, and signs the person in with the
**primary, verified** address. GitHub never proves that the person owns a domain mailbox: a GitHub sign-in cannot claim
an invitation, join an organization by its domain or take over an account an administrator created
(`EMAIL_NOT_AUTHORITATIVE`). Link GitHub to an existing account from **My account > Security**
instead. See [Who may sign in](social-login.md#who-may-sign-in).

## Step 2: Configure OpenCTEM

### Option A: platform console (from v0.16.0)

1. Sign in to the platform console as a super admin and elevate (see [Roles and elevation](../console/index.md#roles-and-elevation)).
2. Open **Settings > Social login** and go to the **GitHub** section.
3. Paste the **Client ID** and the **Client secret** (write-only). Check that the shown **Redirect URI**
   equals the callback URL in step 1.
4. Tick **Offer on the sign-in page** and save. Give a reason and confirm with your authenticator code. It applies at once on every server, without a restart.
5. Select **Test configuration**: it asks the provider whether it accepts the client ID and secret and whether the redirect URI is registered.

A provider shown as **Set by the server environment** is pinned by `OAUTH_GITHUB_CLIENT_SECRET` and follows option B.

### Option B: environment variables

Set on the **API** and restart it:

```bash
OAUTH_ENABLED=true
OAUTH_GITHUB_ENABLED=true
OAUTH_GITHUB_CLIENT_ID=<client-id>
OAUTH_GITHUB_CLIENT_SECRET=<client-secret>
```

Per-deployment instructions: [configuration reference](sign-in-configuration.md#setting-the-variables).

## Step 3: Verify

1. Open the login page in a private window and select **GitHub**.
2. Approve the authorization. GitHub returns to `https://<app>/auth/callback/github`.
3. If your GitHub organization restricts third-party access, an organization owner must approve the
   app (**Organization settings > Third-party access**) before members of that organization see
   their organization data; sign-in itself does not depend on it.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| GitHub shows "The redirect_uri MUST match the registered callback URL for this application" | The OAuth App's callback URL is not exactly `https://<app>/auth/callback/github`. Edit the app. |
| 404 on GitHub's authorize page | Wrong client ID, or the app was deleted. |
| Sign-in fails after approval (`callback_failed`) | Wrong or regenerated client secret; the API cannot reach `github.com` and `api.github.com`; or the state expired. |
| "GitHub account has no verified email" in the API log | The account has no verified primary email. The person must verify an email in **GitHub Settings > Emails**. Emails set to private are still returned to the app by the `user:email` scope. |
| Signed in, but no organization | Normal without membership or invitation. Invite the verified email of the GitHub account. |
| "Your organization isn't set up yet" / "registered with a different login method" | See [social login rules](social-login.md#rules-that-apply-to-every-provider). |

More: [Social login troubleshooting](social-login.md#troubleshooting-all-providers).
