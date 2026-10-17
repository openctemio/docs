---
title: Connect an AI assistant (MCP)
parent: User guide
nav_order: 12
---

# Connect an AI assistant (MCP)

OpenCTEM runs a **Model Context Protocol (MCP) server**. When you connect an AI assistant to it,
the assistant can answer questions about your organization's exposure in plain language ("which
KEV findings are open on internet-facing assets?", "why is this finding P0?", "draft the executive
summary of this pentest campaign") by reading your data through a fixed set of tools.

This page is for three readers:

- **Members** who want to connect Claude or another assistant: [Connect an assistant](#connect-an-assistant).
- **Administrators** who decide which assistants an organization allows:
  [Set the organization policy](#set-the-organization-policy).
- **Security reviewers** who need to know how it is protected: [Security model](#security-model).

The endpoint, the tool list and the API-key method are in the [MCP server reference](../api/mcp.md).

## What an assistant can and cannot do

| It can | It cannot |
|---|---|
| Read findings, vulnerabilities and their priority, assets and attack paths, compliance posture, and pentest campaigns, findings, retests and templates, as far as you were allowed to grant (see [the permissions list](#what-each-line-of-the-consent-screen-means)). | Change anything on its own. The one tool that changes data, adding a comment to a finding, runs only after you confirm the exact comment in OpenCTEM, and is off unless your administrator allows it. |
| See what **you** can see in that organization: your role, your teams and your data scope apply exactly as in the console. | See more than you can. An administrator's bypass never applies to an assistant, and the assistant never gets a permission you do not hold. |
| Keep working until the connection ends (see [how long a connection lasts](#how-long-a-connection-lasts)). | Keep working after you lose access. If you are suspended or removed from the organization, or lose a permission, the assistant loses it at the next request. |
| | Read evidence files or attachments. The tools return only counts for them. |

{: .warning }
Everything a tool returns is sent to the assistant you connected and from there to its model
provider. Decide which assistants to allow, and which access to let members grant, with that in
mind.

Text inside findings (titles, descriptions, notes, scanner output) can contain instructions written
to manipulate an assistant. OpenCTEM returns such text marked as untrusted data, but treat what an
assistant tells you as you would any summary of third-party text.

## Connect an assistant

You need an OpenCTEM account in the organization. You do not need to be an administrator.

### Find the server URL

Open **Settings > Access > AI access (MCP)**. The card **Connect an AI assistant** shows the
configuration with the server URL of your installation. The URL always has this form:

```
https://openctem.example.com/api/v1/mcp
```

Use the host name you use to open the OpenCTEM console, followed by `/api/v1/mcp`. No key is needed:
the assistant opens OpenCTEM in your browser and you sign in.

### Claude on the web and in the Claude apps

1. In Claude open **Settings > Connectors** and choose **Add custom connector**.
   (On a Team or Enterprise plan an owner of the Claude organization adds the connector first; the
   menu entries can differ between Claude versions.)
2. Enter a name, for example `OpenCTEM`, and the server URL from above. Leave any advanced client
   ID or secret fields empty unless your OpenCTEM administrator gave you a client ID for an
   [organization application](#register-an-organization-application).
3. Choose **Add**, then **Connect**. Claude sends you to your OpenCTEM sign-in page. Sign in as you
   normally do (single sign-on and two-factor authentication apply).
4. OpenCTEM shows the [consent screen](#what-each-line-of-the-consent-screen-means). Check it and
   choose **Allow**.
5. You are sent back to Claude, which now lists the OpenCTEM tools. Ask a question such as "List my
   open critical findings."

If the consent screen says **This application cannot be connected**, your administrator has not
allowed Claude yet. Send them the link to this page; they need to
[add `claude.ai` to the trusted application hosts](#recommended-add-the-assistants-host).

### Claude Code

```bash
claude mcp add --transport http openctem https://openctem.example.com/api/v1/mcp
```

Then start `claude`, run `/mcp`, select **openctem** and choose **Authenticate**. A browser window
opens on OpenCTEM for the same sign-in and consent steps. Claude Code runs on your computer, so the
consent screen shows the extra notice [Only continue if you started this](#what-each-line-of-the-consent-screen-means).

The same server can be written into a project's `.mcp.json` file, which is the block the console
shows:

```json
{
  "mcpServers": {
    "openctem": {
      "type": "http",
      "url": "https://openctem.example.com/api/v1/mcp"
    }
  }
}
```

### Claude Desktop

Add the server as a custom connector in **Settings > Connectors**, as for Claude on the web. If your
version of Claude Desktop only reads a configuration file, use the same block as above in its MCP
configuration file and restart the app; it starts the sign-in the first time a tool is used.

### Other MCP clients

Any client that supports MCP over HTTP with OAuth works if it:

- uses the URL above as the server address and discovers the sign-in details itself from OpenCTEM's
  published metadata (`/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-authorization-server`);
- uses PKCE with `S256`, and returns to an `https` address, or to `http` on `127.0.0.1`, `[::1]` or
  `localhost` when it runs on a computer;
- identifies itself in one of two ways: by a **client ID metadata document**, an `https` URL it
  publishes that names its redirect addresses, or by a client ID your administrator
  [registered for it](#register-an-organization-application).

A client that registers itself on the fly (dynamic client registration) works only when the platform
operator turned that on (`MCP_OAUTH_DCR_ENABLED`, off by default) and the organization chose
**Allow unverified applications**. Such a client is always shown as unverified.

Scripts without a person at the keyboard use an [API key](../api/mcp.md#connect-a-client) instead,
if the organization allows API keys on the MCP server.

### What each line of the consent screen means

The consent screen is the one place where you decide. Read it before you choose **Allow**.

| On the screen | What it tells you |
|---|---|
| **Connect {application} to OpenCTEM?** | The name the application gave itself. A name is not proof of who it is: look at the next line. |
| **Published by {host}** | The application's identity document is published on that host, and your organization (or the platform) trusts that host. This is the line to check: `claude.ai` for Claude on the web. |
| **Registered by your organization** | An administrator registered this application in OpenCTEM. |
| **Unverified: registered itself** with an **Unverified** badge | Nobody vouches for the name. See [Unverified applications](#unverified-applications). |
| **Organization** | The organization the connection is for. If you belong to several, choose the right one in this list. The assistant sees only this organization's data. |
| **It will be able to, as you:** | The access you grant, one line per permission group: **Read findings, vulnerabilities, priorities and remediation groups**, **Read assets and attack paths**, **Read compliance posture**, **Read pentest campaigns, findings, retests and templates**. A line with a check mark is granted. A struck-through line is not: you do not hold that access in this organization, or **(not allowed by your organization)**. A line with the **Changes data** badge is the comment tool; every comment it makes asks for your confirmation. |
| **You will be sent back to** | The address your browser returns to after you choose. For Claude on the web it is a `claude.ai` address; for an application on your computer it is `127.0.0.1` or `localhost`. If it is a host you do not recognize, choose **Cancel**. |
| **Only continue if you started this** | The application runs on your own computer, where any program could use the same name. Continue only if you just asked the assistant to connect. |
| **This application cannot be connected** | The organization's policy blocks it. **Allow** is disabled. See [Troubleshooting](#troubleshooting). |
| **Unverified application** | Shown for an unverified application the organization allows. |
| **Cancel** / **Allow** | **Cancel** refuses the request. **Allow** grants exactly the lines with a check mark and sends you back to the application. |

The page also says: it sees only what you can see in this organization, and loses access when you
do. You can disconnect it at any time.

### How long a connection lasts

An assistant works with short access tokens (10 minutes) that it renews in the background. A
connection ends when:

- you or an administrator disconnect it;
- the **Connections last (days)** limit of the policy passes (up to 90 days); you then approve the
  application again;
- the assistant is unused for 14 days;
- you leave the organization or your account is suspended;
- an administrator deletes the application, or the platform operator blocks it.

## Manage and disconnect your connections

Open **Settings > My account > Connected applications** (`/account/connected-apps`), titled
**Your AI applications**. Each row shows the application name and where it is published (or the
**Unverified** badge), the access it holds (**Findings**, **Assets**, **Compliance**, **Pentest**),
when it was connected, when it was last used and from which address, and when it ends.

Choose **Disconnect** and confirm **Disconnect {name}?**. The application loses access at once; to
use it again, connect it again from the application.

If a row looks wrong (an application you do not recognize, or use from an unexpected address),
disconnect it and tell your administrator.

## Set the organization policy

Administrators manage MCP under **Settings > Access > AI access (MCP)**. You need the
`settings:write` permission (Owner and Administrator roles) to change the policy; anyone with
`settings:read` sees it. Saving needs a recent sign-in and the page asks for it when required.

### The default is closed to unknown applications

Out of the box an organization accepts only **verified** applications:

- an application registered by the organization;
- an application whose identity document is published on a host that is on the organization's list
  of **Trusted application hosts** or on the platform's list.

Any other application is refused on the consent screen with **Your organization only allows
approved applications. Ask an administrator to allow this one.** This is the secure default.
Claude on the web is an application published on `claude.ai`, so an organization has to trust that
host before members can connect it.

### Recommended: add the assistant's host

1. Open **Settings > Access > AI access (MCP)** and find the card **Organization policy**.
2. In **Trusted application hosts** add the host, one per line, for example:

   ```
   claude.ai
   ```

   Enter the host name only, without `https://` or a path. Names are lower-cased. At most 50 hosts
   are accepted. Below the box, **Trusted by the platform:** lists hosts the platform operator
   already trusts for every organization.
3. Choose **Save policy**. It applies to existing connections at once.

Ask the member to start the connection again.

{: .note }
Trusting a host means trusting that host to name the application honestly: it can publish a
document for any application it hosts. Add only hosts of services you have decided to allow. The
platform operator can add hosts for every organization with the environment variable
`MCP_OAUTH_TRUSTED_CLIENT_HOSTS` (see [Environment variables](../configuration/environment-variables.md)).

### Unverified applications

**Allow unverified applications** is off by default. Do not turn it on to get one assistant
working. With it on, a member can connect any application whose name nobody vouches for, including
one written to look like a trusted assistant, and the consent screen is the only protection:
a member who clicks **Allow** hands that program their read access to the organization's findings,
assets and pentest data. If you need one assistant, trust its host (above) or
[register it](#register-an-organization-application). If you need many unknown tools, leave this
off and review requests one by one.

### The policy fields

| Field | What it does | Default |
|---|---|---|
| **AI application access** | Off: no application or API key can use the MCP server. Applies at once to existing connections. | On |
| **Allow unverified applications** | Off: only applications your organization registered or published on a trusted host. | Off |
| **Trusted application hosts** | Hosts whose published application identity counts as verified. | Empty |
| **Access members may grant** | The permission groups a member can give an assistant. Unticking one removes it from new consent screens (shown as **(not allowed by your organization)**) and from existing connections. | All read access |
| **API keys on the MCP server** | Whether `oct_` keys may call the MCP server. Keys still work on the REST API. | On |
| **Require proof of possession (DPoP)** | Applications must sign every request with their own key, so a copied token is useless. Applications without DPoP support can no longer connect, and existing connections without it stop working. | Off |
| **Connections last (days)** | How long until a person must approve the application again, 1 to 90. | 90 |
| **Highest TLP sent to AI applications** | Pentest campaigns above this TLP level are never sent: the tools and prompts refuse them and campaign lists leave them out. A campaign lead can also exclude one campaign with **Keep this campaign away from AI assistants** on its Engagement card. | TLP:AMBER |

The comment tool's permission group (adding comments to findings) is not offered by this form and
stays off.

Every change to the policy is written to the audit log.

### Register an organization application

Use this for an assistant your organization runs or has reviewed, or for a client that cannot publish
an identity document.

1. In **Applications registered by your organization** (below the policy card) choose **Register**.
2. Enter the **Name** and the **Return addresses (redirect URIs)**, one per line. Return addresses
   must be `https`, or `http` on `127.0.0.1`, `[::1]` or `localhost` (any port) for applications
   that run on a computer. The application can return only to these addresses.
3. Give the resulting **client id** to the application's owner or enter it in the client's
   advanced connector settings. The consent screen shows **Registered by your organization**.

**Delete** removes the application and ends every connection made with it at once.

### See and end connections of everyone

The card **Connected applications in this organization** (Owner and Administrator) lists every AI
application a member connected: who, which application, access, last use and expiry. Choose
**Disconnect** to end one at once.

## Audit log

OpenCTEM writes these events to **Settings > Organization > Audit log** (resource type `mcp_grant`
unless noted):

| Event | When |
|---|---|
| `mcp_grant.authorized` / `mcp_grant.denied` | A person chose **Allow** or **Cancel** on the consent screen. |
| `mcp_grant.token_issued` | An application received its first tokens. |
| `mcp_grant.revoked` | A connection ended: disconnected by the person, an administrator or the application. |
| `mcp_grant.code_reused`, `mcp_grant.refresh_reused` | A one-time code or a rotated token was presented twice, which indicates theft. The connection is revoked. |
| `mcp_settings.updated` | The organization policy changed. |
| `mcp_client.registered` / `mcp_client.deleted` | An organization application was registered or deleted. |
| `mcp_action.requested`, `mcp_action.confirmed`, `mcp_action.refused` | An assistant asked to add a comment, and the person confirmed or refused it. |

Every individual tool call is also logged with the tool name, the connection, the outcome and a
sanitized summary of its arguments (never free-text search terms or results).

## Troubleshooting

| What you see | Why | What to do |
|---|---|---|
| **This application cannot be connected** / **Your organization only allows approved applications. Ask an administrator to allow this one.** | The application is not verified for this organization and **Allow unverified applications** is off. | An administrator adds the application's host (for `claude.ai`, the host `claude.ai`) under **Trusted application hosts**, or registers it as an organization application. |
| **This application cannot be connected** / **Your organization has turned off AI application access.** | **AI application access** is off. | An administrator turns it on, if the organization wants it. |
| **(not allowed by your organization)** next to a permission, struck through | The policy does not let members grant that access. | An administrator ticks it under **Access members may grant**, if appropriate. |
| A permission struck through without that note | You do not hold that access in this organization. | Ask for the role or permission. The assistant never gets more than you have. |
| **You have none of the access this application asks for in this organization.** | You hold none of the requested access here. **Allow** is disabled. | Check the organization selector; ask an administrator for access. |
| **Choose an organization first: sign in again or pick one from the organization list, then open the link again.** | The consent link opened without a current organization. | Sign in, choose the organization, then connect again from the assistant. |
| **This link is not a valid connection request.** / **This request is no longer available.** | The request expired (it lasts 10 minutes) or was already answered. | Start the connection again from the assistant. |
| **Cannot connect the application** | A generic failure of the consent page; its text gives the reason. | Retry from the assistant; if it persists, send the text to your administrator. |
| The assistant says it cannot sign in, or an authentication error after it worked before | The connection ended: disconnected, expired, your access changed, or DPoP became required. | Check **Connected applications**; connect again. |
| `401 Invalid credentials` from the MCP endpoint | The token is wrong, expired, revoked, the membership ended, or a required DPoP proof is missing or invalid. | Reconnect. A `WWW-Authenticate: DPoP` header names the accepted algorithms. |
| `403 Your organization does not allow API keys on the MCP server` | **API keys on the MCP server** is off. | Use OAuth, or ask an administrator. |
| `403 IP_NOT_ALLOWED` | The organization's IP allowlist applies to MCP like the REST API. | Connect from an allowed network. |
| `429 Rate limit exceeded for this connection` | A connection is limited to 3600 requests per hour. | Wait; reduce automated polling. |
| `campaign_restricted` from a pentest tool | The campaign is above the organization's TLP limit, or its lead excluded it. | Ask an administrator (limit) or the campaign lead. |
| A tool answers `not_found` for something you know exists | You cannot read it with your access (the same answer is given for "does not exist"). | Check your campaign membership and data scope. |
| An administrator cannot see a campaign through the assistant | Assistants never use the administrator bypass; pentest tools need campaign membership. | Be added to the campaign. |

## Security model

For security reviewers.

- **Authorization server.** OpenCTEM is its own OAuth 2.1 authorization server for the MCP
  endpoint. It publishes metadata for discovery (OAuth Protected Resource Metadata, RFC 9728, and
  Authorization Server Metadata, RFC 8414). The authorization code flow requires PKCE (`S256`).
  Authorization codes live 60 seconds and work once; an authorization request lasts 10 minutes.
- **Who is the client.** A client is known by an organization registration, by a client ID metadata
  document (fetched only from public `https` addresses through the SSRF-guarded client, no redirects,
  5 KB body, 5 second budget), or, when the platform operator enables it, by dynamic registration
  (always unverified). A client can only return to its registered redirect addresses.
- **Consent is explicit.** The signed-in person approves each client, organization and permission
  group. The consent page shows where the client is published and where the browser returns.
- **Scope narrowing.** An access token carries the granted scopes intersected, on every request,
  with the permissions the user holds at that moment. The owner and administrator bypass never
  applies. Granting is also capped by the organization's policy.
- **Membership on every request.** Each request re-checks that the user is an active member of the
  organization with an active account; otherwise the grant is revoked.
- **Data scope.** Tools use the same read services as the REST API for that user: group and asset
  data scope, pentest campaign membership, and the campaign client rules apply. No tool takes an
  organization argument: the organization comes only from the grant, so a prompt injection cannot
  widen the scope.
- **Token lifetime.** Access tokens last 10 minutes. Refresh tokens rotate on every use; presenting
  a rotated token again revokes the grant and is audited. An unused refresh token lasts 14 days; a
  grant ends at the policy's limit (at most 90 days). Tokens are stored hashed. A refresh can only
  narrow scopes.
- **Sender constraint (DPoP).** A client that sends a DPoP proof (RFC 9449) at the token endpoint gets
  a token bound to its key: every request needs a fresh proof signed by that key, proofs are accepted
  once (replay cache), and a stolen token alone is useless. **Require proof of possession (DPoP)**
  makes this mandatory for the organization; bearer-only clients are then refused at token issue and
  at refresh, and existing bearer grants stop working.
- **Writes.** The only write is `add_finding_comment`, behind a separate scope that members cannot
  grant from the policy form. The first call returns a confirmation link; the person sees the exact
  comment and visibility in OpenCTEM and confirms within 5 minutes; the assistant repeats the call
  with the confirmation. It never touches severity or status.
- **Network and abuse controls.** The browser-origin guard, the organization's IP allowlist and a
  per-address rate limit run before authentication; each connection is limited to 3600 requests per
  hour. List tools return at most 100 rows.
- **Policy is live.** Changing the policy applies at consent, token issue, refresh and every MCP
  request, so turning access off or removing a host takes effect immediately.
- **Untrusted content.** Tool results mark text from findings and scanners as untrusted data.
- **Audit.** Consent, token, revoke, reuse detection, policy, client and write events are recorded
  (see [Audit log](#audit-log)).
- **Platform operator controls.** Operators can set `MCP_OAUTH_TRUSTED_CLIENT_HOSTS` and
  `MCP_OAUTH_DCR_ENABLED`, and block a client for every organization in the admin console.
