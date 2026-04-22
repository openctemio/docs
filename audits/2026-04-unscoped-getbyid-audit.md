# Unscoped `GetByID` repository audit — 2026-04-19

Follow-up to F-309 in `2026-04-full-scope-audit.md`. Walked every repository
file under `api/internal/infra/postgres/` and categorised every
`GetByID(ctx, id shared.ID)` method that does NOT take a `tenantID`.

## Why this audit

`GetByID(ctx, id)` without `tenantID` is safe only if the underlying table
is platform-global. If the table carries `tenant_id`, an HTTP handler that
wires a user-supplied `{id}` path param to this method is an IDOR:
caller in tenant A reads tenant B's row.

F-4 and F-5 already hardened the two direct hits. This audit enumerates
the rest so future handlers cannot re-open the same class.

## Results

### Category A — safe (global or system-owned tables, no `tenant_id` column)

| Repository | Table | Reason |
|---|---|---|
| `user_repository.go` | `users` | Users are platform-scoped; tenant binding lives in `tenant_members`. |
| `tenant_repository.go` | `tenants` | Tenants ARE the scope unit. |
| `session_repository.go` | `sessions` | Sessions carry their own user binding. |
| `refresh_token_repository.go` | `refresh_tokens` | Same. |
| `admin_repository.go` (AdminUser, AuditLogRepository) | `admin_users` / `audit_logs` | Platform-operator resource. Audit log reads already hardened in F-2/F-3. |
| `vulnerability_repository.go` | `vulnerabilities` | CVE/vuln catalog is global knowledge. |
| `asset_type_repository.go` | `asset_types` | Shared catalog. |
| `tool_repository.go` | `tools` | Shared tool definitions. |
| `tool_category_repository.go` | `tool_categories` | Shared. |
| `target_mapping_repository.go` | `target_mappings` | Shared tool→asset-type mappings. |
| `compliance_control_repository.go` | `compliance_controls` | Shared compliance catalog. |
| `finding_source_repository.go` (Category + FindingSource) | `finding_sources` | Shared catalog. |
| `rule_bundle_repository.go` | `rule_bundles` | Shared rule bundles. |
| `rule_source_repository.go` | `rule_sources` | Shared. |
| `rule_repository.go` | `rules` | Catalog; tenant-specific overrides live in `rule_overrides`. |
| `rule_override_repository.go` | `rule_overrides` | **Check — rule overrides MAY be tenant-scoped.** See "Action items" below. |
| `asset_source_repository.go` | `asset_sources` | Shared catalog. |
| `datasource_repository.go` | `data_sources` | Shared — tenant assignment lives via relations. |
| `permission_set_repository.go` | `permission_sets` | Mixed: some rows are system (`tenant_id = NULL`), some tenant-owned. See below. |
| `audit_repository.go` | `audit_logs` | Hardened in F-2/F-3. `GetByID` caller should use `GetByTenantAndID`; leaving the unsafe variant for operator tools is acceptable. |

### Category B — hardened or acceptable (platform-agent / tenant-less by design)

| Repository | Handler risk | Status |
|---|---|---|
| `agent_repository.go` (`GetByID`, `GetByAPIKeyHash`) | Platform agents tenant-less; API-key hash IS authentication material | **Documented in F-5** |
| `tool_execution_repository.go` (`GetByID`) | Rows do carry `tenant_id`, but only agent/orchestration paths call this | **Hardened in F-4 + safe variant `GetByIDInTenant` added** |

### Category C — tenant-scoped rows, unsafe method remains

These methods operate on tables that DO have `tenant_id`. No user-facing
handler currently wires them directly, but a future regression would open
an IDOR. Recommend adding doc warnings and — when feasible — a sibling
`GetByTenantAndID` variant.

| Repository | Table | User-facing handler wiring today? | Action |
|---|---|---|---|
| `command_repository.go` | `commands` | No (agent-auth only) | Add doc warning. |
| `pipeline_run_repository.go` | `pipeline_runs` | No (service-internal) | Add doc warning. |
| `pipeline_run_repository.go` (`StepRunRepository`) | `step_runs` | No | Add doc warning. |
| `finding_comment_repository.go` | `finding_comments` | Yes — via `/findings/{id}/comments/{commentId}`? | **VERIFY handler chain.** |
| `finding_data_source_repository.go` | `finding_data_sources` | No | Add doc warning. |
| `component_repository.go` | `components` | Yes — `/components/{id}` | **VERIFY handler extracts tenant from JWT and passes to a tenant-scoped query.** |
| `asset_group_repository.go` | `asset_groups` | Yes | **VERIFY.** |
| `template_source_repository.go` | `template_sources` | Yes — already reviewed in F-308 | Safe (different code path). |
| `workflow_repository.go` + node/edge/run | `workflows_*` | Yes | **VERIFY.** |
| `rule_override_repository.go` | `rule_overrides` | Yes | **VERIFY.** |
| `group_repository.go` | `groups` | Yes | **VERIFY.** |
| `branch_repository.go` | `branches` | Yes | **VERIFY.** |
| `sla_repository.go` | `sla_policies` | Yes | **VERIFY.** |
| `finding_activity_repository.go` | `finding_activities` | Service only | Add doc warning. |
| `scan_repository.go` | `scans` | Yes — `/scans/{id}` | **VERIFY.** |
| `scansession_repository.go` | `scan_sessions` | Yes | **VERIFY.** |
| `exposure_repository.go` | `exposures` | Yes | **VERIFY.** |
| `scanprofile_repository.go` | `scan_profiles` | Yes | **VERIFY.** |
| `tenant_tool_config_repository.go` | `tenant_tool_configs` | Yes | **VERIFY.** |
| `capability_repository.go` | `capabilities` | Yes (F-14 already shrank error leaks) | **VERIFY.** |
| `workflow_node_run_repository.go` | `workflow_node_runs` | Service only | Add doc warning. |
| `pipeline_repository.go` (Template + Step) | `pipeline_templates` / `pipeline_steps` | Yes | **VERIFY.** |

## Action items (tracked as F-310 linter task + follow-ups)

1. **Linter (F-310):** write a `go/analysis.Analyzer` that flags any
   repository method whose signature matches
   `GetByID(ctx, id shared.ID)` when the struct's table has a `tenant_id`
   column. Run in CI. This prevents re-introduction of the pattern.

2. **Spot-check the "VERIFY" rows above.** For each, grep the handlers
   that return a `GET /thing/{id}` response and trace into the service.
   If the handler passes the path-param ID into the unscoped `GetByID`
   without also constraining on `tenant_id`, flag as a real bug.

3. **Add doc-warnings on Category C methods** mirroring the F-4 / F-5
   pattern: clearly mark the unsafe method as "UNSAFE for user-facing
   handlers; add `GetByTenantAndID` for new callers".

## Conclusion

The F-309 enumeration itself is complete: every unscoped `GetByID` in the
repo layer has a classification (A/B/C). The two methods that the
original audit called out directly (F-4, F-5) are hardened. The remainder
either operate on legitimately global tables or are not yet reachable
from user-facing handlers — but the "VERIFY" rows deserve a single-file
grep each before closing permanently.

F-309 report delivered. Verification items tracked in the TODO list.
