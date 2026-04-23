---
layout: default
title: Security Hardening Operator Guide
parent: Operations
nav_order: 20
---

# Security Hardening — Operator Guide (2026-04)

> **Audience**: operators deploying OpenCTEM into customer infrastructure (cloud, on-prem, or hybrid).
> **Last updated**: 2026-04-22.

This guide covers every deployment switch introduced by the 2026-04 security batch. It is organised around a simple principle:

> **Defaults are safe for a managed-cloud deployment. On-prem deployments only need to flip the Agent's private-target toggle** — nothing else.

If your deployment looks like "SaaS-hosted API + self-installed agents scanning our corporate network," you can jump straight to [Agent private-target opt-in](#agent-private-target-opt-in). The API/SDK opt-ins are edge cases covered later.

---

## What changed

- **SSRF guard** split into two tiers: a hard-block list (IMDS / loopback / CGNAT / multicast / broadcast / IPv6 link-local) that no env var can open, and a soft-block list (RFC1918 + IPv6 ULA) that an operator can opt into.
- **CSRF protection** enabled on every JWT-cookie-authenticated state-changing route via double-submit-cookie (`csrf_token` cookie + `X-CSRF-Token` header). API-key / HMAC webhook routes are exempt.
- **Startup sentinel** refuses to boot the API when `AUTH_JWT_SECRET` or `APP_ENCRYPTION_KEY` still matches the docker-compose dev default **and** `APP_ENV` is not `development`.
- **Audit log hash chain** (migration 000154) is now actively re-verified by an hourly background controller. Any break emits an `ERROR` log tagged `alert=audit_chain_break` and a Prometheus counter.
- **AI-triage budget scaffolding** (migration 000163, [RFC-008](../rfcs/RFC-008-llm-token-budget.md)) ships disabled — no action needed unless you opt into Phase 2.
- **Supply chain**: agent tool binaries (gitleaks/trivy/nuclei/semgrep) SHA-256 verified at image build; release SBOMs Cosign-signed with GitHub OIDC (no long-lived keys).
- **Primitive-adoption lint** (`scripts/security-lint.sh`) runs in CI to catch regressions on all of the above.

Full catalogue of defences with threat models: [`SECURITY.md`](../../SECURITY.md).

---

## Agent private-target opt-in

This is the switch 99% of operators will care about.

### The problem

OpenCTEM agents run scanner CLIs (nuclei, trivy, semgrep, …) against targets that come from the scan orchestrator. By default the agent **refuses** scans that resolve to RFC1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) or IPv6 ULA (`fc00::/7`). That default exists so an agent running on a cloud VM cannot be tricked into scanning the tenant's own VPC.

### When to flip it

Flip `AGENT_ALLOW_PRIVATE_TARGETS=1` when the agent is installed **inside your corporate network** and the assets you want to scan live on private IP ranges. This is the common on-prem profile: agent pod on a K8s cluster in your DC scanning `10.x` services.

### What stays blocked no matter what

Even with the opt-in on, the agent still refuses:

- `127.0.0.0/8` loopback
- `169.254.0.0/16` link-local (cloud IMDS — AWS/GCP/Azure metadata)
- `100.64.0.0/10` CGNAT (carrier NAT — not an intentional target)
- `224.0.0.0/4` multicast, `240.0.0.0/4` reserved, `255.255.255.255/32` broadcast
- `::1/128` IPv6 loopback, `fe80::/10` IPv6 link-local
- Hostname aliases: `localhost`, `metadata.google.internal`, `metadata`, `169.254.169.254`

The guard lives in [`agent/internal/executor/target_security.go`](https://github.com/openctemio/openctemio/blob/main/agent/internal/executor/target_security.go); the test matrix in `target_security_test.go` pins the two-tier behaviour so a regression cannot silently open IMDS.

### How to set it

**Kubernetes (operator-written agent manifest):**

```yaml
# agent Deployment
spec:
  template:
    spec:
      containers:
        - name: agent
          image: ghcr.io/openctemio/agent:1.x
          env:
            - name: AGENT_ALLOW_PRIVATE_TARGETS
              value: "1"
```

**Docker Compose:**

```yaml
# docker-compose.yml
services:
  agent:
    image: ghcr.io/openctemio/agent:1.x
    environment:
      AGENT_ALLOW_PRIVATE_TARGETS: "1"
```

**systemd unit:**

```ini
[Service]
Environment=AGENT_ALLOW_PRIVATE_TARGETS=1
ExecStart=/usr/local/bin/openctem-agent
```

### Verifying it took effect

The agent emits a startup log line reflecting the runtime posture:

```
level=info msg="target guard initialised" allow_private=true
```

If you don't see `allow_private=true` and scans to 10.x still fail with `blocked: private IP`, the env var did not make it into the container — check your orchestrator's env propagation.

---

## API / SDK private-IP opt-in (edge case)

The API and SDK `httpsec` packages also have a soft-block list, but **most deployments do not need to open it.** The API's outbound HTTP clients talk to public endpoints: Slack/Teams/Telegram webhooks, Jira/Linear/Asana, OAuth userinfo, KEV/EPSS feeds, LLM providers. Those are all public hostnames.

### When you do need it

- You run an **internal mirror** of the KEV/EPSS feed at a private IP (air-gapped / regulated envs).
- Your notification webhook target is an **internal Slack clone / ITSM bridge** on an RFC1918 address.
- Your SSO provider (Keycloak, ADFS) is on a private IP.
- An outbound integration (custom webhook) points at an internal host.

If none of those apply — do not set these env vars. Leaving the default closed is strictly safer and costs nothing.

### The env vars

| Variable | Scope | What it opens |
|---|---|---|
| `OPENCTEM_HTTPSEC_ALLOW_PRIVATE=1` | API pod | RFC1918 + ULA for API's outbound HTTP |
| `OPENCTEM_SDK_HTTPSEC_ALLOW_PRIVATE=1` | SDK consumers | Same, for `sdk-go/pkg/httpsec` users |

The SDK also honours `OPENCTEM_HTTPSEC_ALLOW_PRIVATE` as a compatibility fallback, so setting the API variant in a shared env is enough.

### Hard-blocks still apply

Exactly the same hard-block list as the agent — IMDS, loopback, CGNAT, multicast, etc. No env var relaxes those. See [`api/pkg/httpsec/ssrf.go`](https://github.com/openctemio/openctemio/blob/main/api/pkg/httpsec/ssrf.go) and the mirrored `sdk-go/pkg/httpsec/ssrf.go`. `scripts/security-lint.sh` Rule 6 pins both tables identical.

---

## Startup sentinel — secrets in production

The API refuses to boot when `APP_ENV != development` and either of the following still matches the docker-compose dev default:

- `AUTH_JWT_SECRET`
- `APP_ENCRYPTION_KEY`

It also refuses:

- `APP_DEBUG=true` in production
- `CORS_ALLOWED_ORIGINS=*` in production
- `DB_SSLMODE=disable` in production

Generate fresh values:

```bash
# 64-char JWT secret
openssl rand -base64 64

# 32-byte encryption key (hex or base64)
openssl rand -hex 32
openssl rand -base64 32
```

Store in your secret manager (Vault, AWS Secrets Manager, K8s External Secrets, sealed-secrets, SOPS) and mount into the API pod.

### Kubernetes pattern

```yaml
env:
  - name: AUTH_JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: openctem-api-secrets
        key: AUTH_JWT_SECRET
  - name: APP_ENCRYPTION_KEY
    valueFrom:
      secretKeyRef:
        name: openctem-api-secrets
        key: APP_ENCRYPTION_KEY
```

The helm chart's `api.extraEnv` in `values.yaml` takes the same shape. Do not commit the secret values to git.

### If the API refuses to boot

Look for `configuration error: dev-default` in the API logs. Regenerate the secret, update your secret store, roll the pod. **Never** set `APP_ENV=development` in production to bypass the check — the same flag disables other production safeguards (permissive CORS defaults, verbose error envelopes).

---

## Audit log chain — break alert runbook

The API writes `hash_prev -> hash_curr` linkage into `audit_logs` (migration 000154). A background controller (`audit-chain-verify`) re-walks every tenant's chain hourly and logs an `ERROR` if any link fails to recompute.

### What the alert looks like

```
level=error msg="audit chain integrity violation" alert=audit_chain_break
  tenant_id=<uuid> log_id=<uuid> expected_hash=... actual_hash=... reason=...
```

Prometheus counter:

```
openctem_security_audit_chain_breaks_total{tenant_id="...", reason="..."}
```

### What it means

A chain break indicates **one of**:

1. A row in `audit_logs` was inserted or modified via a direct SQL write bypassing the API (operator surgery, backup-restore pointing at the wrong snapshot, misconfigured replica). This is **expected** immediately after a planned restore — validate the restore first.
2. A row was tampered with (insider threat / DB compromise).
3. A software bug in the hash-chain writer. Check recent API deploys.
4. Replication lag on a read replica: the verifier sees a partial chain mid-replication. Usually self-heals on the next hour's run.

### First-response checklist

1. **Correlate with operational events.** Was there a backup restore, DR failover, or direct DB migration in the last 24 h for the affected tenant? If yes, the break is expected; proceed to step 5.
2. **Pull the failing log ID** (from the alert payload) and inspect the surrounding rows:

   ```sql
   SELECT id, created_at, actor_user_id, action, hash_prev, hash_curr
   FROM audit_logs
   WHERE tenant_id = '<uuid>'
     AND created_at BETWEEN NOW() - INTERVAL '2 hours' AND NOW()
   ORDER BY created_at;
   ```

3. **Recompute the expected hash** for the suspect row and compare with `hash_curr`. The algorithm is in `pkg/domain/audit/hash.go`.
4. **Diff the row against the hot standby / last backup** — if the standby's `hash_curr` matches but production's doesn't, you have a write that bypassed the API.
5. **If legitimate (step 1)**: run the admin re-seed endpoint to re-link the chain from the restore point; the verifier will clear on the next hour.
6. **If illegitimate**: treat as a security incident — rotate credentials, review DB access logs, escalate per your IR runbook.

### Counter thresholds

The metric is cumulative. For alerting, page on **any increase over a 1-hour window** per tenant — the expected steady-state is zero. A stalled verifier (i.e. no runs happening) is also alertable via:

```
rate(openctem_security_audit_chain_verify_runs_total[2h]) == 0
```

---

## CSRF — double-submit cookie

Every JWT-cookie-authenticated state-changing route (`POST`, `PUT`, `PATCH`, `DELETE`) now requires:

1. `csrf_token` cookie (set by the API on login / refresh)
2. `X-CSRF-Token` request header (read by the frontend from `document.cookie` and echoed)
3. The two values must match exactly (constant-time compare).

Exempt: API-key auth, HMAC-signed webhook inbound routes, `GET` and `HEAD`.

### For frontend developers

The bundled Next.js UI handles this transparently (`ui/src/lib/api/client.ts`). If you build a **custom** frontend, you must:

- Issue `credentials: 'include'` on fetch (to send the cookie).
- Read `csrf_token` from `document.cookie`.
- Set `X-CSRF-Token: <value>` on every mutating request.

Missing header → `403 csrf_token_missing_header`. Mismatch → `403 csrf_token_mismatch`. Prometheus: `openctem_security_csrf_rejections_total{reason, method}`.

### For non-browser clients

Don't use cookie auth. Use an API key (`X-API-Key`) — those routes are CSRF-exempt. The API-key path is the supported integration surface for scripts, CI jobs, and SDK consumers.

---

## AI-triage budget (disabled by default)

Migration 000163 creates `ai_triage_budgets` but the budget enforcement **ships disabled** (feature-gated per-tenant). To opt in a tenant into observe-only mode:

```sql
INSERT INTO ai_triage_budgets (tenant_id, period_start, token_limit, warn_threshold, block_threshold, tokens_used)
VALUES (
  '<tenant_uuid>',
  DATE_TRUNC('month', NOW()),
  1000000,  -- monthly ceiling
  800000,   -- warn at 80%
  1000000,  -- block at 100% (set > token_limit to observe only)
  0
);
```

Metrics: `openctem_security_ai_triage_budget_used_tokens{tenant_id}` gauge + `openctem_security_ai_triage_budget_exhausted_total{tenant_id}` counter. Full rollout plan in [RFC-008](../rfcs/RFC-008-llm-token-budget.md).

---

## Migration from pre-2026-04

If you are upgrading an existing deployment:

| Step | Required | Notes |
|---|---|---|
| Generate real `AUTH_JWT_SECRET` + `APP_ENCRYPTION_KEY` | Yes — API will refuse to boot with dev defaults | Already had fresh values? Skip. |
| Run migrations up to `000163` | Yes | Idempotent; `migrate-up` handles it. |
| Set `AGENT_ALLOW_PRIVATE_TARGETS=1` on agent | Only if you scan RFC1918 | Otherwise leave unset. |
| Set `OPENCTEM_HTTPSEC_ALLOW_PRIVATE=1` on API | Only if API outbound hits private IPs (internal mirrors / webhooks) | Most deployments don't need this. |
| Frontend: update custom clients to send `X-CSRF-Token` | Only if you replaced the bundled UI | Bundled UI handles it. |
| Prometheus: scrape `openctem_security_*` | Recommended | Dashboards + alerts below. |
| Cosign: verify release SBOMs | Recommended | Command in [`SECURITY.md`](../../SECURITY.md). |

No schema deprecations. No breaking API changes. No existing client will break — CSRF is additive (`GET`/`HEAD` unaffected, API-key unaffected).

---

## Dashboards & alerts

Minimum Prometheus series to scrape and graph:

```
openctem_security_csrf_rejections_total
openctem_security_audit_chain_breaks_total
openctem_security_audit_chain_verify_runs_total
openctem_security_ai_triage_needs_review_total
openctem_security_ai_triage_budget_used_tokens
openctem_security_ai_triage_budget_exhausted_total
```

Recommended alerts:

- `increase(openctem_security_audit_chain_breaks_total[1h]) > 0` → page on-call.
- `rate(openctem_security_audit_chain_verify_runs_total[2h]) == 0` → page on-call (verifier stalled).
- `rate(openctem_security_csrf_rejections_total[5m]) > 10 per second` → investigate (stale UI build or attempted CSRF).
- `openctem_security_ai_triage_budget_used_tokens / on(tenant_id) token_limit > 0.8` → email tenant admins.

---

## Related

- [`SECURITY.md`](../../SECURITY.md) — complete defence catalogue with threat models.
- [RFC-007: Postgres RLS rollout](../rfcs/RFC-007-postgres-rls-rollout.md) — tenant-isolation defence-in-depth.
- [RFC-008: LLM token budget](../rfcs/RFC-008-llm-token-budget.md) — AI-triage budget rollout plan.
- [Configuration reference](./configuration.md) — full env-var catalogue.
- [`docs/architecture/scan-security-hardening.md`](../architecture/scan-security-hardening.md) — scan-orchestrator SSRF / command-injection hardening (2026-01).
