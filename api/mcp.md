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

It reuses the same tenant-scoped read services as the REST API. It cannot change anything.

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

All tools are read-only and confined to the key's organization. None takes an organization
argument.

| Tool | Arguments | Returns | Needs |
|---|---|---|---|
| `list_findings` | `severity`, `status`, `source`, `search`, `limit` (default 25, max 100) | findings | `findings:read` |
| `get_finding` | `id` | one finding | `findings:read` |
| `finding_stats` | none | totals by severity and status, KEV, EPSS and SLA roll-ups | `findings:read` |
| `list_active_cves` | `kev_only`, `min_epss` (0 to 1), `severity`, `limit` | CVEs active in the organization, ordered by KEV and EPSS | `findings:read` |
| `explain_finding_priority` | `id` | why a finding has its priority (KEV, EPSS, reachability, severity weighting) | `findings:read` |
| `get_exposure_chains` | none | shortest attack paths from public entry points to KEV or crown-jewel assets | `assets:read` |
| `list_remediation_groups` | none | remediation groups (findings fixed by the same solution) | `findings:read` |
| `list_assets` | `exposure` (`public`, `private`, `unknown`), `criticality`, `search`, `limit` | assets | `assets:read` |
| `compliance_posture` | none | framework and control totals, overdue controls | `compliance:frameworks:read` |
| `get_campaign` | `id` | a pentest campaign's report context | `pentest:campaigns:read` |
| `list_campaign_findings` | `campaign_id`, `severity`, `status`, `limit` | a campaign's findings with report fields | `pentest:findings:read` |
| `get_pentest_finding` | `id` | one pentest finding with full report fields | `pentest:findings:read` |
| `list_retests` | `campaign_id` | retests of a campaign | `pentest:retests:read` |
| `list_finding_templates` | `category`, `search`, `limit` | reusable finding templates | `pentest:templates:read` |
| `campaign_report_stats` | `campaign_id` | counts by severity and status, CVSS, progress | `pentest:campaigns:read` |

Pentest tools also require the key's user to be a member of the campaign.

## Prompts

Prompts are report-section templates, pre-filled with campaign context, that the assistant uses to
draft text:

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
  limit is shared with the REST API. List tools return at most 100 rows.
- **Errors.** A tool failure is returned as a tool result with `isError: true`. Only input
  validation messages are shown; internal errors are reduced to "tool execution failed".
- **Audit.** Every `tools/call` is audit-logged with the tool name, the key, the outcome and a
  sanitized summary of the arguments (identifiers and enum filters, never free-text search terms
  or result data).

Data an MCP tool returns is sent to the AI client you connected, and from there to its model
provider. Decide which scopes to grant with that in mind.
