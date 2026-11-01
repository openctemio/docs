---
title: MCP server
parent: API
nav_order: 4
---

# MCP server

OpenCTEM runs a **Model Context Protocol (MCP) server**, read-only apart from three person-gated write tools, so an AI assistant (Claude
Desktop, Claude Code or any MCP client) can answer questions about your organization's exposure in
natural language: "which KEV findings are open on internet-facing assets?", "why is this finding
P0?", "draft the executive summary for this pentest campaign".

It reuses the same tenant-scoped read services as the REST API. Three tools write, and none of them
decides anything alone: adding a comment (the person confirms the exact comment in OpenCTEM),
proposing a false positive or accepted risk (another person decides it) and saving a pentest finding
as a draft (another campaign member confirms it). Each is off unless the organization allows its
scope, and runs only for a person's OAuth connection; API keys cannot change anything.

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
  registered for the organization. Every client is a public client: PKCE, never a secret. A
  metadata-document client is stored only when a signed-in person approves the consent (the fetched
  document travels with the authorization request until then), so unauthenticated requests cannot
  add applications; a client blocked after the request started is refused at approval. Approving a
  consent needs a recent sign-in (step-up).
- **Tokens.** Authorization codes last 60 seconds. Access tokens (`octm_at_...`) last 10 minutes and
  are bound to one person, one organization, one application and the MCP endpoint. Refresh tokens
  (`octm_rt_...`) rotate on every use; presenting a used one again revokes the connection. An unused
  refresh token lasts 14 days, and a connection ends at the policy's **Connections last (days)**
  limit (1 to 90, default 90).
- **Scopes.** Read: `mcp:findings.read`, `mcp:assets.read`, `mcp:compliance.read`,
  `mcp:pentest.read` and `mcp:scope.read` (permission `attack_surface:scope:read`, for `check_scope`),
  offered up front and shown on the consent page. Write: `mcp:findings.comment`
  (`findings:comment`), `mcp:findings.propose` (`findings:write`) and `mcp:pentest.draft`
  (`pentest:findings:write`), never offered up front: granted only through an `insufficient_scope`
  challenge and only when the organization's policy lists them (off by default). On every request a
  token can do at most what its scopes allow and the person still holds; suspending, blocking or
  removing the person, or the membership passing its end date, ends it at once. A password reset, a
  password change and "sign out all others" revoke the person's connections in every organization
  (the next refresh answers `invalid_grant`).
- **Data scope.** A connection reads only the assets the person's groups and scope rules allow, as `oct_`
  keys do, even for an owner or administrator. When that scope covers no assets, the empty results
  of the asset, finding, finding statistics and active CVE tools carry a `scope_notice` saying so
  and telling the person to ask an owner for access. One opt-in exception: a person whose role has full
  organization data access can choose **Allow access to all organization data** on the consent screen
  (off by default; needs a fresh sign-in confirmation). The connection then reads all organization data
  while the person still holds that role, checked on every request, and lives shorter: 7 days in total,
  refresh token 24 hours unused, access token 5 minutes. Private program assets and pentest campaign
  membership apply as for the person in the console. The person or an organization administrator can set
  it back to scoped (`POST /api/v1/mcp-access/my-connections/{id}/scoped`,
  `POST /api/v1/mcp-access/connections/{id}/scoped`) or revoke it; the audit log records
  `mcp_grant.full_data_allowed` and `mcp_grant.full_data_removed`. API keys never get this.
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
`add_finding_comment`, `propose_finding_status` and `draft_pentest_finding` are not read-only; each
is listed only for an OAuth connection that holds its write scope.

| Tool | Arguments | Returns | Needs |
|---|---|---|---|
| `list_findings` | the Findings page's filters: `severity`, `status`, `state` (`open`, `fixed`, `dispositioned`, `closed`), `source`, `search`, `asset_id`, `cve`, `kev`, `min_epss`, `priority_class` (`P0` to `P3`), `sla_status`, `assignee` (`me` or a user id), `created_after`, `created_before`, `updated_after`, `updated_before`, `sort` (a field, `-` for descending); `page`, `limit` (default 25, max 100) | findings in the Findings page's order, each with its priority class, KEV, EPSS, SLA status and first detection; comma lists match any value, filters combine | `findings:read` |
| `get_finding` | `finding_id` | one finding | `findings:read` |
| `finding_stats` | none | totals by severity and status, KEV, EPSS and SLA roll-ups; `kev_open` counts the same findings as the `open_kev_findings` of `list_active_cves` | `findings:read` |
| `list_active_cves` | `kev_only`, `min_epss` (0 to 1), `severity`, `page`, `limit` | the CVEs of open findings you can see, one row per CVE, riskiest first (priority, KEV, emerging threat, EPSS, CVSS, assets), read through the vulnerabilities list; each row has `open_kev_findings` and `catalog_status` (`in catalog`, or `not in catalog` when title, CVSS and EPSS come from the findings) | `findings:read` |
| `explain_finding_priority` | `finding_id` | why a finding has its priority (KEV, EPSS, reachability, severity weighting) | `findings:read` |
| `list_finding_transitions` | `finding_id` | the status moves of a finding the caller may make, each with how (direct, approval request, duplicate picker), the inputs it needs, or the reason codes why not | `findings:read` |
| `get_exposure_chains` | none | shortest attack paths from public entry points to KEV or crown-jewel assets; a chain of length 0 is an asset exposed directly, `summary.multi_hop_chains` counts the others, and `relationship_note` says when no asset relationships exist to build longer paths; steps outside the key owner's data scope come back as hidden steps without name or type | `assets:read` |
| `list_remediation_groups` | `page`, `limit` | remediation groups (findings fixed by the same solution), most findings first | `findings:read` |
| `list_assets` | `exposure` (`public`, `private`, `unknown`), `criticality`, `search`, `page`, `limit` | assets, riskiest first, with `risk_score` (0 to 100) and `risk_scored_at` | `assets:read` |
| `search_assets` | `query` (name or description text, an IP address or a CIDR), `cve` (assets with an open finding of it), comma lists `type`, `exposure`, `criticality`, `monitoring_state`, `scope_status`, `technology`; `internet_facing`, `has_findings`, `owner_id` (a user or group); `page`, `limit` (default 25, max 100) | the assets you can see, as the console's inventory filters them, riskiest first, each with a link to its asset page | `assets:read` |
| `get_asset` | `asset_id`, or `name` (exact); `sections` (any of `overview`, `findings`, `coverage`, `ports`, `lineage`, `changes`; default all) | one asset as its page shows it: identity and attributes, open findings by severity and the top ones by priority, coverage per capability (last run, gaps and their causes), open ports and services of the addresses it resolves to, how it was discovered, and recent changes. Each section is the asset page's own data under the same data scope; a section you may not read says so | `assets:read` |
| `compliance_posture` | none | framework and control totals, overdue controls | `compliance:frameworks:read` |
| `list_campaigns` | `phase`, `role`, `search`, `include_archived`, `page`, `limit` (max 50) | your pentest campaigns with your role, the phase, TLP, dates, finding counts and the next action for your role | `pentest:campaigns:read` |
| `my_work` | `page`, `limit` | your active campaigns that need something from you: your drafts, findings assigned to you, reviews, retests (for a client: published findings still open) | `pentest:campaigns:read` |
| `get_campaign` | `campaign_id` | a pentest campaign's report context; the emergency contact and escalation details only for the campaign lead | `pentest:campaigns:read` |
| `list_campaign_findings` | `campaign_id`, `severity`, `status`, `search`, `page`, `limit` (max 50) | a campaign's findings with report fields, filtered before paging (`total`, `has_more`, `next_page`) | `pentest:findings:read` |
| `get_pentest_finding` | `finding_id` | one pentest finding with full report fields (evidence as counts only) | `pentest:findings:read` |
| `list_retests` | `campaign_id`, `page`, `limit` | retests of a campaign, newest first | `pentest:retests:read` |
| `list_finding_templates` | `category`, `search`, `limit` | reusable finding templates | `pentest:templates:read` |
| `campaign_report_stats` | `campaign_id` | working counts by severity and status (drafts included), CVSS, progress | `pentest:campaigns:read` |
| `check_scope` | `target` (domain, IP, CIDR or URL, at most 512 characters), `intensity` (`passive`, `active` default, `intrusive`), `program_id` | whether the target may be tested at that intensity: `allowed`, `passive_only` or `refused`, with reason codes and a hint (see below) | `attack_surface:scope:read` |
| `add_finding_comment` | `finding_id`, `content` (plain text, at most 4000 characters), `visibility` (`team` or `client`, pentest findings only), `confirmation_id` | an internal comment, after the person confirms it (see below) | `findings:comment` |
| `propose_finding_status` | `finding_id`, `status` (`false_positive` or `accepted`), `closure_reason`, `justification` (at most 2000 characters), `expires_at` (accepted only) | an approval request in the person's name, decided by another person (see below) | `findings:write` |
| `draft_pentest_finding` | `campaign_id`, `title`, `severity`, `description` (required); `asset_id` or `affected_targets`, `steps_to_reproduce`, `request_responses` (at most 10), `cvss_vector`, `cwe_id`, `owasp_category`, impacts, `remediation_guidance`, `reference_urls` | a draft pentest finding (see below) | `pentest:findings:write` and the `pentest` module |

Tools that took `id` now take `campaign_id` or `finding_id`; `id` is still accepted.

`list_findings`, `list_active_cves`, `list_assets`, `list_remediation_groups`, `search_assets` and the
pentest list tools are paged: pass `page` (from 1) and `limit`, and read `total`, `has_more` and
`next_page` in the result. A finding's status is per finding and per asset: the same CVE can be a false
positive on one asset and new on another.

When a connection reads only the assets of the person's groups (it was not allowed all organization data
on the consent screen), the asset and finding tools add `scope_notice`, for example "You can see 12 of 40
assets; the rest are not assigned to a group you belong to." The organization's total is shown only to a
person whose role reads it in the web console.

`get_asset` and `search_assets` return console links only when the operator set `APP_URL`.

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

### Checking scope

`check_scope` gives the same answer a scan would get from the organization's scope entries. It never
widens a scope and never lists scope entries or deny-list contents. A lookup error refuses. A target
covered only by a bug-bounty program rule is allowed only for a member of that program who names it
in `program_id`. A refusal says it is the platform's decision and that variations of it are refused
too. Each connection may ask 30 times a minute (burst 10; a limited call answers with
`retry_after_seconds`), and the audit trail stores the target as a digest.

### Proposals and pentest drafts

- `propose_finding_status` changes nothing on the finding: it files an approval request in the
  person's name, marked as written by the AI application, and another person decides it in the
  approval queue (`/findings/approvals`); the person cannot approve it. Use
  `list_finding_transitions` first: only findings that offer this move as an approval request accept
  it. One pending request per finding; pentest findings are reviewed in their campaign instead.
- `draft_pentest_finding` saves the finding in the name of the person who connected the
  application, always as a draft that the campaign client never sees, after the campaign membership,
  TLP limit and AI switch checks and under the usual phase and role rule for adding findings. The
  finding records the application (`drafted_via`), kept on every edit, and the finding sheet shows
  **Proposed by AI application**. The person cannot confirm a draft their application wrote: another
  campaign member (a reviewer or the lead) does. A finding with the same title in the campaign
  answers a conflict. Recorded request/responses are masked and their secrets encrypted like any
  pentest evidence.

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
- **Platform decisions.** A refusal by a permission, a campaign role, a restricted campaign or a
  missing person-approved connection says that the platform made a policy decision, that variations
  of the call are refused too, and where a person can change it, so automated clients do not retry
  with other arguments.
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
counts only, and can block one everywhere in the admin console (**Settings > AI applications**,
which pages and searches by host or name).
