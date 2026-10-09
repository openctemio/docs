---
title: "MCP and AI clients permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 29
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# MCP and AI clients: permissions

The MCP endpoint for AI clients, its OAuth authorization server, connections and organization policy.

- **Permissions:** `settings:read`, `settings:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `settings:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| `settings:write` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/.well-known/oauth-authorization-server` | no permission: public OAuth authorization server metadata of the MCP endpoint (RFC 8414, RFC-062): static, no tenant data | system: public MCP authorization server metadata (RFC 8414), no tenant data |  | see Requires |
| GET | `/.well-known/oauth-protected-resource` | no permission: public OAuth Protected Resource Metadata of the MCP endpoint (RFC 9728, RFC-062): static, no tenant data | system: public MCP resource metadata (RFC 9728), no tenant data |  | see Requires |
| GET | `/.well-known/oauth-protected-resource/api/v1/mcp` | no permission: public OAuth Protected Resource Metadata of the MCP endpoint (RFC 9728, RFC-062): static, no tenant data | system: public MCP resource metadata (RFC 9728), no tenant data |  | see Requires |
| POST | `/api/v1/mcp` | no permission: MCP oct_ API-key auth | scoped: each tool runs as the key's user (API keys never get full data) |  | see Requires |
| GET | `/api/v1/mcp-access/connections` | team role admin | scoped: each tool runs as the key's user (API keys never get full data) |  | Owner, Administrator |
| DELETE | `/api/v1/mcp-access/connections/{id}` | team role admin | scoped: each tool runs as the key's user (API keys never get full data) |  | Owner, Administrator |
| GET | `/api/v1/mcp-access/my-connections` | no permission: MCP oct_ API-key auth | scoped: each tool runs as the key's user (API keys never get full data) |  | see Requires |
| DELETE | `/api/v1/mcp-access/my-connections/{id}` | no permission: MCP oct_ API-key auth | scoped: each tool runs as the key's user (API keys never get full data) |  | see Requires |
| GET | `/api/v1/mcp-access/settings` | `settings:read` | scoped: each tool runs as the key's user (API keys never get full data) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| PUT | `/api/v1/mcp-access/settings` | `settings:write` | scoped: each tool runs as the key's user (API keys never get full data) | yes | Owner, Administrator |
| GET | `/api/v1/oauth/requests/{id}` | no permission: self-scoped (RFC-062 consent): the signed-in session answers its own MCP consent request in its current organization; the grant never exceeds what the user holds, API keys refused (APIKeyRouteDenied) | separate: the caller's own MCP consent request (RFC-062): client and scope names, no tenant data |  | see Requires |
| POST | `/api/v1/oauth/requests/{id}/approve` | no permission: self-scoped (RFC-062 consent): the signed-in session answers its own MCP consent request in its current organization; the grant never exceeds what the user holds, API keys refused (APIKeyRouteDenied) | separate: the caller's own MCP consent decision (RFC-062) |  | see Requires |
| POST | `/api/v1/oauth/requests/{id}/deny` | no permission: self-scoped (RFC-062 consent): the signed-in session answers its own MCP consent request in its current organization; the grant never exceeds what the user holds, API keys refused (APIKeyRouteDenied) | separate: the caller's own MCP consent decision (RFC-062) |  | see Requires |
| GET | `/oauth/authorize` | no permission: OAuth endpoints of the MCP authorization server (RFC-062): public by protocol; authorize only stores a request for the consent page, token and revoke are bound to a PKCE-protected code or a hashed token of the presenting client | system: MCP OAuth authorization endpoint: stores a request, no tenant data |  | see Requires |
| POST | `/oauth/revoke` | no permission: OAuth endpoints of the MCP authorization server (RFC-062): public by protocol; authorize only stores a request for the consent page, token and revoke are bound to a PKCE-protected code or a hashed token of the presenting client | system: MCP OAuth revocation endpoint, no tenant data |  | see Requires |
| POST | `/oauth/token` | no permission: OAuth endpoints of the MCP authorization server (RFC-062): public by protocol; authorize only stores a request for the consent page, token and revoke are bound to a PKCE-protected code or a hashed token of the presenting client | system: MCP OAuth token endpoint: issues tokens of a consented grant, no tenant data |  | see Requires |
