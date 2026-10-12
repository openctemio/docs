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
(adding a comment) runs only for a person's OAuth connection, after the person confirms the exact
comment in OpenCTEM; API keys cannot change anything.

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
- Authentication: a tenant [API key](authentication.md#tenant-api-keys) only. A browser
  session or JWT is refused. Any authentication failure is a plain `401`.

## Connect a client

1. In the console open **Settings > AI access (MCP)** and choose **Generate connection key**.
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

Check the connection with a raw call:

```bash
curl -s https://openctem.example.com/api/v1/mcp \
  -H "Authorization: Bearer $OPENCTEM_MCP_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`tools/list` returns only the tools the key's scopes allow, so a narrow key never sees tools it
cannot call.

## Tools

Every tool is confined to the key's organization; none takes an organization argument. Every tool
carries MCP annotations: the read tools are marked `readOnlyHint: true`, and no tool is
destructive, so assistants that auto-approve read-only tools do not ask on every read.

| Tool | Arguments | Returns | Needs |
|---|---|---|---|
| `list_findings` | `severity`, `status`, `source`, `search`, `limit` (default 25, max 100) | findings | `findings:read` |
| `get_finding` | `finding_id` | one finding | `findings:read` |
| `finding_stats` | none | totals by severity and status, KEV, EPSS and SLA roll-ups | `findings:read` |
| `list_active_cves` | `kev_only`, `min_epss` (0 to 1), `severity`, `limit` | CVEs active in the organization, ordered by KEV and EPSS | `findings:read` |
| `explain_finding_priority` | `finding_id` | why a finding has its priority (KEV, EPSS, reachability, severity weighting) | `findings:read` |
| `get_exposure_chains` | none | shortest attack paths from public entry points to KEV or crown-jewel assets | `assets:read` |
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

Tools that took `id` now take `campaign_id` or `finding_id`; `id` is still accepted.

### Pentest campaigns

- Pentest tools act for the key's user, with no administrator bypass: an administrator who is not a
  member of a campaign sees nothing of it. Start with `list_campaigns` or `my_work` to find a
  campaign instead of pasting ids.
- A campaign **client** sees their campaigns with published counts only and reads published
  findings with `get_pentest_finding`; the campaign-wide tools and prompts answer `not_found` to
  them.
- **TLP limit.** An organization administrator sets the highest TLP sent to AI applications in
  **Settings > AI access (MCP) > Organization policy** (default TLP:AMBER). A campaign above it
  is refused by every pentest tool and prompt with the error `campaign_restricted`, and left out of
  `list_campaigns`, `my_work` and `list_findings` (the lists say how many they left out, with no
  names). A campaign lead can also tick **Keep this campaign away from AI assistants** on the
  campaign's Engagement card. Both changes are written to the audit log.

### Untrusted text

Finding titles, descriptions, notes and scanner output can contain text written to manipulate an
AI assistant. Tool results return such text under `untrusted_data`, next to a `notice` telling the
model to treat it as data; prompts carry it in a separate, marked DATA message.

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
  limit is shared with the REST API. List tools return at most 100 rows (pentest lists 50 per
  page).
- **Errors.** A tool failure is returned as a tool result with `isError: true` and
  `{"error": {"code", "message", "retryable"}}`. Codes: `invalid_argument` (the message names the
  argument), `not_found` (the item does not exist or you cannot read it: one answer for both),
  `forbidden`, `permission_denied` (the key lacks the tool's scope), `module_disabled`,
  `campaign_restricted` (TLP limit or the lead's switch), `unavailable` and `internal_error`
  (retry later; no internal detail is returned).
- **Audit.** Every `tools/call` is audit-logged with the tool name, the key, the outcome and a
  sanitized summary of the arguments (identifiers and enum filters, never free-text search terms
  or result data).

Data an MCP tool returns is sent to the AI client you connected, and from there to its model
provider. Decide which scopes to grant with that in mind.
