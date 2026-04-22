# OpenCTEM Architecture: Agent-Orchestrator Model

**Status:** Canonical. All CTEM Stage-2 (Discovery) and Stage-4 (Validation) work MUST honour this model.

**Source of this decision:** 2026-04-19 review — an earlier refactor landed direct-execute code in the API process (cloud SDK calls, Atomic Red Team invocations) before catching that it violated the agent-first model the product was already built around. This document is the fix.

---

## The principle

```
┌──────────────────────────────────────────────────────────┐
│                       API (orchestrator)                 │
│  - Define job shapes                                     │
│  - Gate / rate-limit / opt-in / audit                    │
│  - Persist Evidence after agent reports                  │
│  - Emit events, compute priority, cycle management       │
└────────────┬─────────────────────────────────────┬───────┘
             │ dispatch                            │ ingest
             ▼                                     │
┌──────────────────────────┐                       │
│   Agent (executor)       │  ────── results ──────┘
│  - Local cloud SDK       │
│  - Scanner binaries      │
│  - Network reach target  │
│  - Tenant-local creds    │
└──────────────────────────┘
```

## Why

Four constraints force this split:

1. **Network reachability.** Internal tenant assets (RFC1918 / VPC-only / behind corporate VPN) are not reachable from a public SaaS API. The agent sits inside the tenant network; it can reach.
2. **Credential blast radius.** Cloud-admin credentials (AWS `AssumeRole`, GCP service-account JSON, Azure SP) stored in the SaaS control plane would be a catastrophic breach target. The agent fetches decrypted credentials from the tenant's own secret store via a short-lived reference token.
3. **Legal boundary on exploit execution.** Running Atomic Red Team / Caldera techniques is adversary emulation on tenant infrastructure. It MUST originate from an asset the tenant controls, not the SaaS API, per most pentest waivers.
4. **Operational isolation.** An SDK bug or malicious scan output that takes down an agent is one tenant's problem. The same in the API is everyone's problem.

## What lives where

### API (this repository)

| Concern | Package | Why here |
|---|---|---|
| Job shapes (JSON contract) | `internal/app/connector`, `internal/app/validation` | API is the source of truth for what an agent may be asked to do. |
| Dispatch + polling queue | `internal/infra/controller`, `cmd/server/platform_*` | Exists already; agents long-poll. |
| Opt-in + attacker-profile gate | `validation.DefaultSelector`, `validation.kindAllowedByProfile` | Policy must not live on the agent. |
| Evidence persistence + redaction | `validation.EvidenceStore`, `validation.Redactor` | Durable state, tenant-scoped reads. |
| Proof-of-fix orchestration | `validation.ProofOfFixService` | Finding-status transitions are domain logic. |
| Rate limit / flood guard | `app.BulkGuard`, `app.P0FloodGuard` | API protects itself first. |
| CTEM event emission | `*ChangePublisher`, `SLABreachPublisher` | Cross-tenant event bus. |
| Cycle / SLA / priority domain | `pkg/domain/*` | Invariants of the product. |

### Agent (separate repository)

| Concern | Why there |
|---|---|
| Cloud SDK calls (AWS, GCP, Azure) | Needs tenant credentials + VPC reach. |
| Scanner binaries (Nuclei, Trivy, Semgrep, Gitleaks) | Already agent-side today. |
| Adversary emulation (Atomic Red Team, Caldera) | Must originate from tenant infrastructure; legal requirement. |
| SafeCheck probes (TCP open, TLS expiry, DNS, HTTP GET) | Agent has network reach; API does not. |
| Runtime telemetry capture | Agent is on the host. |

## Concrete interfaces

The API declares the contract; the agent implements it.

### Connector dispatch

```go
// internal/app/connector/connector.go
type DiscoveryJob struct {
    JobID          shared.ID
    TenantID       shared.ID
    Provider       Provider      // "aws" | "gcp" | "azure" | "kubernetes" | "git-host"
    CredentialRef  CredentialRef // opaque pointer to secret-store
    Region         string
    ProjectID      string
    SubscriptionID string
    TimeoutSeconds int
}

type DiscoveryDispatcher interface {
    Submit(ctx context.Context, job DiscoveryJob) (*DiscoveryResult, error)
}
```

Agent flow:
1. Long-poll the platform-job queue for `kind: cloud-discover` jobs matching its advertised providers.
2. Resolve `CredentialRef` against the tenant secret store with the agent's own API key.
3. Run the appropriate cloud SDK (agent repo imports `aws-sdk-go-v2`, NOT api/).
4. POST results via `POST /api/v1/ingest/cloud-assets`.

### Validation dispatch

```go
// internal/app/validation/executor.go
type ValidationJob struct {
    JobID          shared.ID
    TenantID       shared.ID
    FindingID      shared.ID
    ExecutorKind   ExecutorKind // "safe-check" | "atomic-red-team" | "nuclei" | "caldera"
    Technique      TechniqueID  // MITRE ATT&CK id
    Target         Target
    ProfileID      shared.ID
    TimeoutSeconds int
}

type ValidationDispatcher interface {
    Submit(ctx context.Context, job ValidationJob) (Evidence, error)
}
```

Agent flow:
1. Long-poll for `kind: validation` jobs matching its declared ExecutorKinds.
2. Run the local tool (SafeCheck / ART / Nuclei / Caldera).
3. POST `Evidence` via `POST /api/v1/validation/evidence`.
4. API's `EvidenceStore` redacts + persists; `ProofOfFixService` reconciles finding status.

## What the API never does

- Import `aws-sdk-go-v2`, `google.golang.org/api`, `github.com/Azure/azure-sdk-for-go`.
- Shell out to `atomic-red-team` / `caldera` / `nuclei` binaries.
- Hold decrypted tenant cloud credentials in memory for longer than a credential-rotation RPC.
- Send HTTP probes to tenant-hosted targets.

If you find yourself writing any of the above in the `api/` module, **stop and move it to the agent repo**.

## Migration note

The `internal/app/validation` and `internal/app/connector` packages previously contained concrete in-process executors (`SafeCheckExecutor`, `AtomicRedTeamExecutor`, `CalderaExecutor`, `NucleiExecutor`, `AWSConnector`). Those were deleted in the refactor that produced this document. What remains in the API are interfaces, data shapes, and the selector policy. The replacement concrete implementations live in the agent repository.

## Guardrails

1. **Lint:** a future `ctem-gates` step SHOULD flag any import of cloud-SDK packages from `api/` source code.
2. **Review:** any PR adding direct network egress from the API to a tenant-owned target is rejected by default.
3. **Testing:** unit tests on the API mock the dispatcher. Agent-side tests live in the agent repo. Integration tests run both processes.
