---
title: AI assistants and data access
parent: Who can see and do what
grand_parent: Identity and access
nav_order: 5
---

# AI assistants (MCP) and data access

An AI assistant connected through the sign-in flow acts as **you**, with a delegated connection. It
never gets more than you can do, and for data it gets less than the console gives an owner or
administrator.

## What an assistant sees

- **Only the assets your teams give you.** In the console, an owner or administrator sees every
  asset. An assistant connected as the same person reads only the assets your teams, scope rules
  and direct grants allow, the same as an API key does. An administrator's bypass never applies to
  an assistant.
- **Your permissions still apply.** The assistant has no permission you lack, and it loses one the
  moment you lose it.
- **If you are in no team, it sees nothing.** The tools return empty lists even though the console
  shows hundreds of assets to you as owner. Nothing is broken: the connection's data scope is empty.

An upcoming release adds a notice to such empty results: the tools that list assets, findings,
finding statistics and active vulnerabilities return a `scope_notice` explaining that the connection
covers no assets and what to do, so the assistant can tell you instead of reporting "no findings".

## Fix an empty result today

Add the person to a team that owns the assets they want the assistant to read (see
[Roles, teams and what members can see](roles-teams-and-data.md#a-member-in-no-team-sees-no-assets)).
The connection picks the change up on its next request.

## Full-organization access (opt-in, upcoming)

A person whose role has access to all organization data (owner, administrator, or a role with full
data access) will be able to let one connection read all organization data. The option, **Allow
access to all organization data**, appears on the consent screen only for such people. Safeguards:

| Safeguard | Detail |
|---|---|
| Off by default | You must choose it for each connection. |
| Your identity is confirmed | The consent asks for a fresh sign-in confirmation. |
| Tied to your role | Checked on every request: when you lose the role, the connection returns to scoped data at once. |
| Shorter life | 7 days in total, with a refresh token that expires after 24 hours unused and an access token that lasts 5 minutes (scoped connections last longer). |
| Visible | The connection shows an **All organization data** badge in **Your AI applications** and in the organization's list. |
| Reversible | You, or an organization administrator, can choose **Limit to own data** to return it to scoped data without disconnecting it, or **Disconnect** it. |
| Audited | The audit log records when it was allowed and when it was removed. |
| Still bounded | Private bug-bounty program assets and pentest campaigns you are not a member of stay hidden, as for you in the console. |
| Never for API keys | API keys never get this access. |

Until the release is installed, the option is not offered and every connection is scoped. See
[Connect an AI assistant](../../user-guide/12-connect-an-ai-assistant.md) for the consent screen
and [MCP server](../../api/mcp.md) for the reference.
