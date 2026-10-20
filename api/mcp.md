---
title: MCP server
parent: API
nav_order: 4
---

# MCP server

OpenCTEM runs a **read-only Model Context Protocol (MCP) server**, so an AI assistant (Claude
Desktop, Claude Code or any MCP client) can answer questions about your organization's exposure in
natural language: "which KEV findings are open on internet-facing assets?", "why is this finding
P0?", "draft the executive summary for this pentest campaign".

It reuses the same tenant-scoped read services as the REST API. The one tool that changes data
(adding a comment) is off unless the organization allows it, runs only for a person's OAuth
connection, and only after the person confirms the exact comment in OpenCTEM; API keys cannot
change anything.

## Endpoint

```
POST https://openctem.example.com/api/v1/mcp
Authorization: Bearer oct_...
Content-Type: application/json
```

- Transport: MCP over HTTP, one JSON-RPC 2.0 request and one JSON response per `POST` (no
  server-sent events). Protocol revision `2024-11-05`.
- Methods: `initialize`, `ping`, `tools/list`, `tools/call`, `prompts/list`, `prompts/get`;
  `notifications/*` are acknowledged with `202` and no body.
- Authentication: either an OAuth access token, issued after a person signs in and approves the
  assistant (see [Connect an AI assistant](../user-guide/12-connect-an-ai-assistant.md)), or a
  tenant [API key](authentication.md#tenant-api-keys). A browser session or JWT is refused. Any
  authentication failure is a plain `401` with a `WWW-Authenticate` header that points to the
  protected-resource metadata, so a client can start the sign-in. The organization's policy can
  turn either method off, or turn the whole MCP server off.
- A request from a browser page on a foreign origin is refused before authentication.

## OAuth connection

OpenCTEM is the OAuth 2.1 authorization server of its own MCP endpoint, so a client needs only the
endpoint URL. The platform serves these paths on the API origin (a custom reverse proxy must route
them to the API):

| Path | Purpose |
|---|---|
| `GET /.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/v1/mcp` | Protected-resource metadata (RFC 9728) naming the authorization server |
| `GET /.well-known/oauth-authorization-server` | Authorization-server metadata |
| `GET /oauth/authorize` | Starts the authorization-code flow with PKCE `S256` and the `resource` indicator; sends the person to the consent page |
| `POST /oauth/token` | Exchanges the code, and refreshes tokens |
| `POST /oauth/revoke` | Revokes a token |
| `POST /oauth/register` | Dynamic client registration (RFC 7591); answers only when the operator set `MCP_OAUTH_DCR_ENABLED=true`. Such clients are always shown as unverified |

- **Client identity.** A client identifies by a client ID metadata document (an `https` URL it
  publishes, fetched without redirects, public addresses only) or by a client ID an administrator
  registered for the organization. Every client is a public client: PKCE, never a secret.
- **Tokens.** Authorization codes last 60 seconds. Access tokens (`octm_at_...`) last 10 minutes and
  are bound to one person, one organization, one application and the MCP endpoint. Refresh tokens
  (`octm_rt_...`) rotate on every use; presenting a used one again revokes the connection. An unused
  refresh token lasts 14 days, and a connection ends at the policy's **Connections last (days)**
  limit (1 to 90, default 90).
- **Scopes.** `mcp:findings.read`, `mcp:assets.read`, `mcp:compliance.read`, `mcp:pentest.read`, and
  `mcp:findings.comment` (off unless the organization lists it in its policy). On every request a
  token can do at most what its scopes allow and the person still holds; suspending or removing the
  person ends it at once. A call that needs another scope gets an `insufficient_scope` challenge so
  the client can ask for it.
- **DPoP.** A client that supports DPoP (RFC 9449) gets tokens bound to its own key: every refresh
  and every MCP request carries a single-use proof (ES256 or EdDSA, at most 60 seconds old). An
  organization can require DPoP in its policy; bearer-only connections then stop working.
- **Policy.** The organization policy (MCP on or off, approved publishers, whether unverified
  applications are allowed, the scopes members may grant, API keys on the MCP server, DPoP, how long
  connections last, the TLP limit) is checked at consent, at every token issue and refresh, and on
  every request, so a change applies to existing connections at once. The platform operator can add
  hosts that every organization treats as verified with `MCP_OAUTH_TRUSTED_CLIENT_HOSTS`.

The person-facing steps and the administrator screens are in
[Connect an AI assistant](../user-guide/12-connect-an-ai-assistant.md).

## Connect a client

Most people should connect with OAuth, which needs no key: add the endpoint URL to the assistant
and approve it in OpenCTEM. The steps, the consent screen and the organization policy are in
[Connect an AI assistant](../user-guide/12-connect-an-ai-assistant.md). The rest of this section
is the API-key method for scripts and clients without OAuth support.

![The AI assistants (MCP) settings page on the Connect tab: client configuration with the endpoint URL and the organization's status badges]({{ site.baseurl }}/assets/images/api/mcp-connect.png)

1. In the console open **Settings > Access > AI assistants (MCP)**, open the **Connect** tab and choose **Generate key**.
2. Pick the key's purpose:
   - **General read access**: scopes `findings:read`, `assets:read`,
     `compliance:frameworks:read`.
   - **Pentest report writing**: scopes `pentest:campaigns:read`, `pentest:findings:read`,
     `pentest:retests:read`, `pentest:templates:read`.
3. Copy the key (shown once) and the configuration block the page shows, for example:

```json
{
  "mcpServers": {
    "openctem": {
      "type": "http",
      "url": "https://openctem.example.com/api/v1/mcp",
      "headers": { "Authorization": "Bearer oct_..." }
    }
  }
}
```

For Claude Code you can also add it from the command line:

```bash
claude mcp add --transport http openctem https://openctem.example.com/api/v1/mcp \
  --header "Authorization: Bearer $OPENCTEM_MCP_KEY"
```

An organization can turn API keys off on the MCP server (**Policy** tab); such a key is then refused.

Check the connection with a raw call:

```bash
curl -s https://openctem.example.com/api/v1/mcp \
  -H "Authorization: Bearer $OPENCTEM_MCP_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`tools/list` returns only the tools the key's scopes allow, so a narrow key never sees tools it
cannot call.

## Tools

Every tool is confined to the connection's organization; none takes an organization argument.
Every tool carries MCP annotations: the read tools are marked `readOnlyHint: true`, and no tool is
destructive, so assistants that auto-approve read-only tools do not ask on every read.
`add_finding_comment` is the only tool that is not read-only, and it is listed only for an OAuth
connection that holds `mcp:findings.comment`.

| Tool | Arguments | Returns | Needs |
|---|---|---|---|
| `list_findings` | `severity`, `status`, `source`, `search`, `limit` (default 25, max 100) | findings | `findings:read` |
| `get_finding` | `finding_id` | one finding | `findings:read` |
| `finding_stats` | none | totals by severity and status, KEV, EPSS and SLA roll-ups | `findings:read` |
| `list_active_cves` | `kev_only`, `min_epss` (0 to 1), `severity`, `limit` | CVEs active in the organization, ordered by KEV and EPSS | `findings:read` |
| `explain_finding_priority` | `finding_id` | why a finding has its priority (KEV, EPSS, reachability, severity weighting) | `findings:read` |
| `list_finding_transitions` | `finding_id` | the status moves of a finding the caller may make, each with how (direct, approval request, duplicate picker), the inputs it needs, or the reason codes why not | `findings:read` |
| `get_exposure_chains` | none | shortest attack paths from public entry points to KEV or crown-jewel assets; steps outside the key owner's data scope come back as hidden steps without name or type | `assets:read` |
| `list_remediation_groups` | none | remediation groups (findings fixed by the same solution) | `findings:read` |
| `list_assets` | `exposure` (`public`, `private`, `unknown`), `criticality`, `search`, `limit` | assets | `assets:read` |
| `compliance_posture` | none | framework and control totals, overdue controls | `compliance:frameworks:read` |
| `list_campaigns` | `phase`, `role`, `search`, `include_archived`, `page`, `limit` (max 50) | your pentest campaigns with your role, the phase, TLP, dates, finding counts and the next action for your role | `pentest:campaigns:read` |
| `my_work` | `page`, `limit` | your active campaigns that need something from you: your drafts, findings assigned to you, reviews, retests (for a client: published findings still open) | `pentest:campaigns:read` |
| `get_campaign` | `campaign_id` | a pentest campaign's report context; the emergency contact and escalation details only for the campaign lead | `pentest:campaigns:read` |
| `list_campaign_findings` | `campaign_id`, `severity`, `status`, `search`, `page`, `limit` (max 50) | a campaign's findings with report fields, filtered before paging (`total`, `has_more`, `next_page`) | `pentest:findings:read` |
| `get_pentest_finding` | `finding_id` | one pentest finding with full report fields (evidence as counts only) | `pentest:findings:read` |
| `list_retests` | `campaign_id`, `page`, `limit` | retests of a campaign, newest first | `pentest:retests:read` |
| `list_finding_templates` | `category`, `search`, `limit` | reusable finding templates | `pentest:templates:read` |
| `campaign_report_stats` | `campaign_id` | working counts by severity and status (drafts included), CVSS, progress | `pentest:campaigns:read` |
| `add_finding_comment` | `finding_id`, `content` (plain text, at most 4000 characters), `visibility` (`team` or `client`, pentest findings only), `confirmation_id` | an internal comment, after the person confirms it (see below) | `findings:comment` |

Tools that took `id` now take `campaign_id` or `finding_id`; `id` is still accepted.

### Adding a comment

`add_finding_comment` never writes on its first call. It returns a link to
`/mcp/confirm/<id>` in OpenCTEM; the person who connected the application checks the exact comment
and its visibility there and chooses **Confirm** or **Refuse**. The assistant then calls the tool
again with the same arguments plus `confirmation_id`. A confirmation is bound to the connection, the
tool and the arguments, lasts five minutes and is used once. The comment is internal and never sent
to integrations; on a pentest finding it is visible to the campaign team only, unless `visibility`
is `client`, which only the campaign lead or a reviewer may set. Text with hidden characters is
refused. The organization must list the write scope in its policy (off by default). Requests,
confirmations and refusals are audit-logged (`mcp_action.requested`, `mcp_action.confirmed`,
`mcp_action.refused`).

### Pentest campaigns

- Pentest tools act for the key's user, with no administrator bypass: an administrator who is not a
  member of a campaign sees nothing of it. Start with `list_campaigns` or `my_work` to find a
  campaign instead of pasting ids.
- A campaign **client** sees their campaigns with published counts only and reads published
  findings with `get_pentest_finding`; the campaign-wide tools and prompts answer `not_found` to
  them.
- **TLP limit.** An organization administrator sets the highest TLP sent to AI applications in
  **Settings > Access > AI assistants (MCP) > Policy** (default TLP:AMBER). A campaign above it
  is refused by every pentest tool and prompt with the error `campaign_restricted`, and left out of
  `list_campaigns`, `my_work` and `list_findings` (the lists say how many they left out, with no
  names). A campaign lead can also tick **Keep this campaign away from AI assistants** on the
  campaign's Engagement card. Both changes are written to the audit log.

### Untrusted text and the result guard

Finding titles, descriptions, notes and scanner output can contain text written to manipulate an
AI assistant. Tool results return such text under `untrusted_data`, next to a `notice` telling the
model to treat it as data; prompts carry it in a separate, marked DATA message.

Before an assistant reads a tool result or a prompt data message, the server also cleans it:
bidirectional, zero-width and Unicode tag characters (invisible text that can carry instructions)
are removed, secrets (cloud keys, tokens, private keys, `password=` values) are redacted, and each
field is capped by kind (titles 240, descriptions 16000, short fields 1024 characters). A result
over 256 KB is not returned: the tool answers `result_too_large`, and the assistant should ask for
fewer items (a smaller `limit` or a narrower filter).

## Prompts

Prompts are report-section templates, pre-filled with campaign context, that the assistant uses to
draft text. `exec_summary` and `attack_narrative` use the same findings as the delivered report:
published findings only, no drafts, findings under review, false positives or duplicates, so the
numbers in the draft match the report.

| Prompt | Arguments |
|---|---|
| `exec_summary` | `campaign_id` |
| `finding_writeup` | `finding_id`, `section` (`description`, `impact`, `remediation` or `all`) |
| `remediation_guidance` | `finding_id` |
| `attack_narrative` | `campaign_id` |

## Security model

- **Tenant isolation.** The organization comes only from the key. Tools have no tenant argument,
  so a prompt injection cannot widen the scope.
- **Least privilege.** Each tool checks its permission against the key's scopes (narrowed to what
  the key's user still holds). Keys are never administrators, so group-based data scope and
  pentest campaign membership apply.
- **Network policy.** The organization's IP allowlist applies (`403 IP_NOT_ALLOWED` outside it).
- **Rate limits.** A per-address limit runs before authentication, and the key's own hourly
  limit is shared with the REST API. A key or an MCP connection can also make at most 60 requests
  at once (burst 60); the hourly rate is unchanged, and a client that bursts above 60 gets `429`
  and should pace its requests. List tools return at most 100 rows (pentest lists 50 per page).
- **Errors.** A tool failure is returned as a tool result with `isError: true` and
  `{"error": {"code", "message", "retryable"}}`. Codes: `invalid_argument` (the message names the
  argument), `not_found` (the item does not exist or you cannot read it: one answer for both),
  `forbidden`, `permission_denied` (the key lacks the tool's scope), `module_disabled`,
  `campaign_restricted` (TLP limit or the lead's switch), `result_too_large`, `unavailable` and
  `internal_error` (retry later; no internal detail is returned).
- **Audit.** Every `tools/call` is audit-logged with the tool name, the key or the connected
  application, the outcome and a
  sanitized summary of the arguments (identifiers and enum filters, never free-text search terms
  or result data).

Data an MCP tool returns is sent to the AI client you connected, and from there to its model
provider. Decide which scopes to grant with that in mind.

## Managing AI access (API)

The console's **Settings > Access > AI assistants (MCP)** page (tabs **Connect**, **Applications**,
**Connections**, **Policy**) uses these endpoints. They need a signed-in session; API keys and MCP
tokens are refused. Changes that loosen the policy also need a recent sign-in.

![The Policy tab of AI assistants (MCP): the switch for AI assistants, what they may read or change, and the connection and TLP limits]({{ site.baseurl }}/assets/images/api/mcp-policy.png)

![The Applications tab listing approved AI applications]({{ site.baseurl }}/assets/images/api/mcp-applications.png)

| Endpoint | Who | Purpose |
|---|---|---|
| `GET`, `PUT /api/v1/mcp-access/settings` | `settings:read`; `settings:write` | The organization policy: on or off, approved publishers (at most 50), unverified applications, allowed scopes, API keys on MCP, DPoP, connection days, TLP limit |
| `GET`, `POST /api/v1/mcp-access/clients`, `DELETE .../{id}` | `settings:read`; `settings:write` | Applications registered by the organization; deleting one ends its connections |
| `GET /api/v1/mcp-access/requests`, `POST .../{id}/approve`, `POST .../{id}/deny` | `settings:read`; `settings:write` | Members' access requests; approving adds the publisher host to the approved publishers |
| `GET /api/v1/mcp-access/my-connections`, `DELETE .../{id}` | any member | Your own connected applications |
| `GET /api/v1/mcp-access/connections`, `DELETE .../{id}` | owner or administrator | Every connection in the organization |
| `GET /api/v1/mcp-access/confirmations/{id}`, `POST .../approve`, `POST .../deny` | the connection's person | Confirm or refuse a write action |
| `GET /api/v1/oauth/requests/{id}`, `POST .../approve`, `POST .../deny` | any member | The consent page's own calls |
| `POST /api/v1/oauth/requests/{id}/access-request` | any member | Ask administrators to approve a blocked application's publisher (5 new requests per member per day, 50 waiting per organization) |
| `POST /api/v1/oauth/requests/{id}/allow-publisher` | `settings:write` | Approve the publisher from the consent page |

Requests, approvals and declines are audited (`mcp_access_request.created`, `.approved`, `.denied`),
and policy changes as `mcp_settings.updated`. Platform operators see every AI application, with
counts only, and can block one everywhere in the admin console (**Settings > AI applications**).
