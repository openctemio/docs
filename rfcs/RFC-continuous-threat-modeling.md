# RFC: Continuous Threat Modeling

**Status:** Proposed
**Author:** Platform
**Related:** RFC-017 (CTEM prioritization surfacing), RFC-011 (validation engine), RFC-012 (real BAS execution), CTEM maturity audit (2026-07)
**Supersedes eval:** "Embed OWASP ThreatAtlas" — **rejected** (see Alternatives)

## Summary

Classic threat modeling is a one-off workshop: someone draws a Data-Flow
Diagram (DFD), brainstorms STRIDE threats, writes them in a document, and the
document is stale the day the next deploy ships. That artifact-centric model is
fundamentally mismatched with how OpenCTEM works — a **continuous** CTEM loop
that rescans, re-enumerates assets, and reprioritizes every cycle.

This RFC proposes **continuous threat modeling** built on OpenCTEM's own
machinery: a live, per-scope / per-crown-jewel threat model that is **derived,
never drawn**, and **recomputed every cycle**. The threat model is the product
of three things the platform already computes —

```
attacker_profiles  ×  exposure_chains  ×  ATT&CK techniques (by asset-type)
     (who)                (how far)              (what they'd do)
```

— joined to a curated **technique → mitigation** table, with every threat's
**status derived from live findings and validation** (open / mitigated /
covered). The asset graph *is* the DFD (already computed, with data-flow edge
types); we do not build a diagram editor.

Roughly **70% of the inputs already exist and are wired**. The one net-new
dataset is a technique→mitigation + technique↔asset-type applicability table,
seeded from MITRE ATT&CK's machine-readable, permissively-licensed data. This
RFC also makes **Attacker Profiles** — today CRUD-only with "zero readers in
prioritization" (RFC-017) — into their first real consumer.

## Why continuous, not one-off

A CTEM platform's threat model is worthless the moment it is a document. The
value is a **standing question answered every cycle**: *given who we think will
attack us (attacker profiles), how the internet actually reaches our crown
jewels today (exposure chains), and what those attackers would do at each hop
(ATT&CK techniques), which threats are still open — and which have we mitigated
or validated as covered?*

"Good" for a CTEM threat model means:

- **Live** — regenerated on asset-graph / scan change and once per CTEM cycle;
  never edited by hand, so it can never drift.
- **Grounded** — every threat points at a real asset, a real exposure path, and
  a real finding/validation record; no synthetic "what-ifs".
- **Actionable** — each threat carries a status and a concrete mitigation, and
  rolls up to a coverage % per scope/crown-jewel.
- **Explainable** — "Attacker *External-Unauth* reaches crown jewel *payments-db*
  via `web-lb → api → payments-db`; at `api` they'd use *T1190 Exploit
  Public-Facing Application*; **OPEN** (finding F-1234, not validated)."

## Current state (verified in code)

### Building block 1 — Attacker Profiles (WIRED, but unread)

`migrations/000147_attacker_profiles.up.sql` — table `attacker_profiles`
(tenant-scoped): `profile_type` CHECK ∈
`{external_unauth, external_stolen_creds, malicious_insider, supplier_compromise,
custom}`, plus a `capabilities` JSONB and free-text `assumptions`. The
capabilities shape (from the seed rows and the UI type) is structured:

```json
{ "network_access": "external", "credential_level": "none",
  "persistence": false, "tools": ["commodity","osint"] }
```

Four **default** profiles are seeded per tenant (`is_default = true`):
External-Unauthenticated, External-with-Stolen-Credentials, Malicious-Insider,
Supply-Chain-Compromise. Handler: `internal/infra/http/handler/attacker_profile_handler.go`
(direct SQL, no DDD layer yet); routes `/api/v1/attacker-profiles` in
`internal/infra/http/routes/ctem.go`; UI
`ui/src/app/(dashboard)/(scoping)/attacker-profiles/page.tsx`.

> RFC-017 confirms Attacker Profiles are **CRUD-only — zero readers** in
> prioritization. This RFC is their first real consumer.

### Building block 2 — Exposure Chains (WIRED, live)

`internal/app/attack/exposure_chains.go` — `GetExposureChains(ctx, tenantID)`
runs a **BFS per public entry point** over the live asset graph
(`assets` + `asset_relationships`), returning the shortest path from any
public entry point to every asset carrying an open KEV/critical finding:

```go
type ExposureChain struct {
    EntryPointID, EntryPointName string
    TargetID, TargetName         string
    TargetCriticality            string
    IsCrownJewel                 bool
    Hops                         []ChainHop  // ordered entry→…→target
    Length                       int
    ReachableFromEntryPoints     int         // blast-radius width
    KEVCount, CriticalCount      int
    Score                        float64
}
type ChainHop struct { AssetID, Name, AssetType, Exposure string }
```

Route: `GET /api/v1/attack-surface/exposure-chains`
(`internal/infra/http/routes/assets.go:337`). The graph it walks is filtered to
`attackPathRelationshipTypes` (`internal/app/attack/path_scoring.go:16`):
`runs_on, deployed_to, contains, exposes, resolves_to, depends_on,
sends_data_to, stores_data_in, authenticates_to, granted_to, has_access_to,
load_balances`. A separate `controlRelationshipTypes` set (`protected_by,
monitors`) marks security controls.

**The asset graph is already a DFD.** The relationship taxonomy
(`configs/relationship-types.yaml` → `pkg/domain/asset/relationship_types_generated.go`)
includes exactly the edges a DFD needs — `sends_data_to`, `stores_data_in`,
`authenticates_to`, `exposes`, and the trust-boundary/control edges
`protected_by`, `monitors`. Nodes + these edges = the DFD; **no drawing tool is
needed.** The engine has **no MITRE linkage today** — the
`attackPathRelationshipTypes` allow-list is the only place to hook techniques.

### Building block 3 — ATT&CK metadata (PARTIAL)

- **On findings:** `findings.mitre_technique_id` + `findings.mitre_tactic`
  (`migrations/000150_cia_impact_and_reclassify.up.sql`).
- **On BAS:** `attack_simulations.mitre_tactic / mitre_technique_id /
  mitre_technique_name` (`migrations/000120`).
- **Threat actors:** `threat_actors.mitre_group_id` + technique array
  (`migrations/000121`).
- **UI dataset:** `ui/src/features/pentest/lib/mitre-attack.ts` — the 14
  enterprise **tactics** (`MITRE_TACTICS`) plus **~93 curated techniques**
  (`MitreTechnique{ id, name, tacticId, description }`). **No mitigations
  (M-series). No technique↔asset-type applicability.**
- **Heatmap:** `ui/src/app/(dashboard)/(validation)/pentest/mitre-coverage/page.tsx`
  builds a tactic × technique **coverage matrix** from findings'
  `mitre_technique_id` (covered / detected / bypassed + coverage %). This is the
  ATT&CK-Navigator-style component we reuse.

### Building block 4 — Crown Jewels / Business context / signals (WIRED)

- `assets.is_crown_jewel`, `business_impact_score`, `business_impact_notes`
  (`migrations/000126`); index on crown jewels.
- `business_units` (+ `criticality`, `risk_tolerance`, `parent_id`,
  `business_unit_assets`) — `migrations/000126` + `000188`; `business_services`
  (per-service criticality, PII/PHI, RPO/RTO) — `migrations/000152`.
- Findings carry `is_in_kev`, `epss_score`, `is_reachable` /
  `reachable_from_count` (persisted; RFC-017 wires the writer), `priority_class`
  P0–P3, and status ∈ `new / confirmed / in_progress / fix_applied / resolved`.
- Validation lifecycle (RFC-011) maps a validate result → evidence → finding
  status; BAS runs (RFC-012) persist per-technique outcomes.

### What is missing (the gap this RFC fills)

| Piece | State |
|---|---|
| Who would attack (attacker profiles) | EXISTS, unread |
| How they reach crown jewels (exposure chains) | EXISTS, live |
| ATT&CK tactics + key techniques | EXISTS (UI dataset) |
| Technique → mitigation (M-series) | **MISSING** (net-new) |
| Technique ↔ asset-type / capability applicability | **MISSING** (net-new) |
| A persisted, per-scope threat model joining all of the above | **MISSING** |
| Threat status derived from findings/validation | **MISSING** (derivation logic) |

## Goals

- Auto-generate a **live threat model per scope / crown-jewel** from existing
  data, recomputed each CTEM cycle — never hand-drawn, never stored stale.
- Enumerate, for each `(attacker_profile, exposure_chain)`, the **applicable
  ATT&CK techniques** per hop (by asset-type + attacker capability), each mapped
  to a **mitigation**.
- **Derive threat status** (open / mitigated / covered / accepted) from live
  findings + validation — not a manual field.
- Surface it as a **Threat Model view** (attacker → path → techniques →
  mitigation status) plus an ATT&CK-heatmap, reusing the existing
  mitre-coverage matrix. **No DFD editor.**
- Make Attacker Profiles a real consumer (close the RFC-017 seam from the other
  side).

## Non-goals

- A diagram/DFD editor or free-form modeling canvas (the graph is the DFD).
- Embedding OWASP ThreatAtlas or any design-time modeling app (rejected — see
  Alternatives).
- Full STRIDE taxonomy as the primary organizing axis (offered as an optional
  labeling **layer** in Phase 2; ATT&CK is the spine).
- Re-deriving reachability or attack paths — we consume the existing engine.
- Real BAS execution (RFC-012) — validation status is consumed, not produced,
  here.

---

## Design

### The generation pipeline

For a chosen **scope** (a crown-jewel asset, a business unit, an asset group, or
"whole tenant"):

```
1.  targets   ← crown jewels / critical assets in scope
2.  chains    ← GetExposureChains(), filtered to those targets
3.  for each attacker_profile (active/default) × each chain reaching a target:
4.      admissible? ← attacker capability gate (see below)
5.      for each hop on the chain:
6.          techniques ← applicable(hop.asset_type, hop.edge_type, attacker.capabilities)
7.          for each technique:
8.              mitigation ← technique_mitigations[technique]
9.              status     ← derive(technique, hop.asset, findings, validation)
10.             emit threat_model_threats row
11. cache coverage stats on threat_models
```

**Capability gate (step 4)** — an exposure chain is only admissible for an
attacker profile whose `capabilities` can enter it. The gate is a small,
explicit predicate over the existing capability fields:

- `network_access: external` ⇒ entry point must be `exposure = public`
  (already the exposure-chain entry condition).
- `network_access: internal` (e.g. Malicious-Insider) ⇒ may start deeper in the
  graph (entry set widened to internal assets in scope).
- `credential_level: none / user / admin` and `persistence` gate *which
  techniques* apply at a hop (e.g. `none` unlocks *Exploit Public-Facing
  Application*; `user` unlocks *Valid Accounts*; `admin`/`persistence` unlock
  lateral-movement/persistence techniques).

**Applicability (step 6)** is the net-new mapping (see "The one net-new
dataset"): a technique is applicable at a hop when the hop's **asset-type** and
the **incoming edge relationship-type** match the technique's applicability
predicate and the attacker's capability clears its minimum. Examples:

| Hop asset-type / edge | Attacker capability | Applicable technique |
|---|---|---|
| `web_service`, entry (`exposes`) | any external | T1190 Exploit Public-Facing App |
| `host` via `authenticates_to` | `credential_level ≥ user` | T1078 Valid Accounts |
| `database` / `stores_data_in` | reached | T1005 Data from Local System / TA0010 Exfiltration |
| `cloud_account` via `has_access_to` | `credential_level = admin` | T1098 Account Manipulation |

**Status derivation (step 9)** — the load-bearing rule that keeps the model
continuous:

- **open** — a matching open finding exists on the hop asset (by
  `mitre_technique_id`, or by asset + technique's CWE/category), status ∈
  `new/confirmed/in_progress`, not validated.
- **mitigated** — the matching finding is `fix_applied` / `resolved`, **or** a
  compensating `protected_by` / `monitors` control edge covers the hop asset.
- **covered** — a validation/BAS record (RFC-011/012) for that technique on that
  asset returned "blocked/detected".
- **accepted** — a finding exception / risk acceptance applies.
- **theoretical** — technique is applicable but no finding/validation exists yet
  (surface as low-confidence; drives "where to test next").

Because status is **read from live findings/validation on every regeneration**,
the model can never be a stale artifact — the #1 failure mode of threat
modeling. If a finding is fixed, the threat flips to *mitigated* next cycle with
no human edit.

### Why this is the right design for OpenCTEM

- It **reuses** the exposure-chain BFS, the attacker-profile capabilities, the
  ATT&CK metadata, crown jewels, and the finding/validation lifecycle — it does
  not re-implement any of them.
- The DFD problem (the expensive, staleness-prone part of classic threat
  modeling) is **already solved** by the asset graph + relationship taxonomy.
- It turns three disconnected assets (attacker profiles, exposure chains, ATT&CK
  coverage) into one CTEM-native narrative.

---

## Data model

Two **runtime** tables (tenant-scoped, regenerated) and two **catalog** tables
(global seed data, tenant-agnostic).

### Runtime (per tenant, regenerated each cycle)

```sql
-- One row per generated threat model, keyed to a scope.
CREATE TABLE threat_models (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    scope_type        VARCHAR(20) NOT NULL   -- crown_jewel|business_unit|asset_group|tenant
        CHECK (scope_type IN ('crown_jewel','business_unit','asset_group','tenant')),
    scope_ref_id      UUID,                  -- asset/BU/group id (NULL for tenant-wide)
    name              VARCHAR(255) NOT NULL,
    generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    input_hash        TEXT,                  -- hash(graph+findings+profiles) → skip no-op regen
    technique_dataset_version VARCHAR(20),   -- ATT&CK version threats were computed against
    -- cached rollups
    threats_total     INT DEFAULT 0,
    threats_open      INT DEFAULT 0,
    threats_mitigated INT DEFAULT 0,
    threats_covered   INT DEFAULT 0,
    coverage_pct      NUMERIC(5,2) DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, scope_type, scope_ref_id)
);

-- One row per (attacker × chain-hop × technique) enumerated threat.
CREATE TABLE threat_model_threats (
    id                 UUID PRIMARY KEY,
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    threat_model_id    UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    attacker_profile_id UUID REFERENCES attacker_profiles(id) ON DELETE SET NULL,
    entry_point_asset_id UUID,              -- chain entry point
    target_asset_id    UUID,               -- chain target (crown jewel / critical)
    hop_asset_id       UUID,               -- asset the technique applies at
    hop_index          INT,                -- position on the chain
    chain_fingerprint  TEXT,               -- stable id for the exposure chain
    technique_id       VARCHAR(20),        -- ATT&CK Txxxx
    tactic             VARCHAR(50),
    mitigation_id      VARCHAR(20),        -- ATT&CK Mxxxx
    status             VARCHAR(20) NOT NULL DEFAULT 'theoretical'
        CHECK (status IN ('open','mitigated','covered','accepted','theoretical')),
    status_reason      TEXT,               -- human-readable derivation
    evidence_finding_id UUID,              -- the finding that set the status (nullable)
    score              NUMERIC(6,2) DEFAULT 0,  -- inherits chain.Score × technique weight
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tmt_model  ON threat_model_threats(threat_model_id);
CREATE INDEX idx_tmt_status ON threat_model_threats(tenant_id, status);
CREATE INDEX idx_tmt_tech   ON threat_model_threats(tenant_id, technique_id);
```

Threats are **fully regenerated** per model (delete-and-insert inside a tx),
so there is no drift and no stale-row reconciliation. Status is *derived at
generation time* and cached on the row for query/filter; the derivation reads
live findings/validation, so a regeneration always reflects current reality.

### Catalog (global seed, versioned, tenant-agnostic)

```sql
-- ATT&CK technique → mitigation, seeded from MITRE ATT&CK (see net-new dataset).
CREATE TABLE attack_technique_mitigations (
    technique_id       VARCHAR(20) NOT NULL,   -- Txxxx / Txxxx.yyy
    technique_name     VARCHAR(255) NOT NULL,
    tactic             VARCHAR(50)  NOT NULL,
    mitigation_id      VARCHAR(20)  NOT NULL,   -- Mxxxx
    mitigation_name    VARCHAR(255) NOT NULL,
    mitigation_summary TEXT,
    dataset_version    VARCHAR(20)  NOT NULL,   -- e.g. "attack-16.1"
    PRIMARY KEY (technique_id, mitigation_id, dataset_version)
);

-- Which techniques apply to which asset-type / edge / capability. Curated.
CREATE TABLE technique_applicability (
    technique_id      VARCHAR(20) NOT NULL,
    asset_type        VARCHAR(50) NOT NULL,   -- matches assets.asset_type taxonomy
    edge_type         VARCHAR(40),            -- optional relationship_type context (NULL = any)
    min_network       VARCHAR(20),            -- external|internal (attacker capability gate)
    min_credential    VARCHAR(20),            -- none|user|admin
    requires_persistence BOOLEAN DEFAULT FALSE,
    dataset_version   VARCHAR(20) NOT NULL,
    PRIMARY KEY (technique_id, asset_type, dataset_version)
);
```

These two catalog tables are the **only** net-new dataset. Everything else is a
join over data that already exists. Tenant scoping follows the existing pattern
(runtime tables carry `tenant_id`; catalog tables are global read-only seed).

---

## Backend

New bounded context `internal/app/threatmodel/` (DDD, unlike the attacker-profile
handler's direct-SQL shortcut):

- `threatmodel/service.go` — `GenerateForScope(ctx, tenantID, scope) (*ThreatModel, error)`:
  loads chains via the **existing** `SurfaceService.GetExposureChains`, loads
  attacker profiles, walks the pipeline above, derives status against the finding
  repo, writes `threat_models` + `threat_model_threats` in one tx.
- `threatmodel/applicability.go` — pure, unit-testable enumeration
  `applicableTechniques(assetType, edgeType, capabilities) []Technique`, reading
  the catalog. Mirrors the IO-free `buildExposureChains` pattern.
- `threatmodel/status.go` — pure `deriveStatus(technique, asset, findings,
  validations) (Status, reason, evidenceID)`.
- Repository in `internal/infra/postgres/threat_model_repository.go`
  (tenant-scoped, paginated, `SELECT` specific columns).

### Endpoints

```
GET  /api/v1/threat-models                         list (per scope), tenant-scoped
GET  /api/v1/threat-models/{id}                     one model + its threats (filter by attacker/status/tactic)
POST /api/v1/threat-models/generate                 { scope_type, scope_ref_id } → generate/refresh
GET  /api/v1/threat-models/{id}/coverage            tactic×technique heatmap payload (Navigator-shaped)
GET  /api/v1/crown-jewels/{assetId}/threat-model     convenience: model for a crown jewel
```

Permissions reuse existing gates (`AssetsRead` / a new `ThreatModelsRead|Write`);
also expose a read tool on the MCP server (RFC-016) so AI clients can query the
model.

### When it recomputes

`input_hash` makes regeneration cheap and idempotent (skip when inputs
unchanged). Triggers:

- **On demand** — `POST /generate` from the UI.
- **On asset-graph / scan change** — hook the same events that drive the
  RFC-017 reclassify sweep (EPSS/KEV/asset/relationship change) to mark affected
  scopes dirty; a controller regenerates dirty models.
- **Per CTEM cycle** — a daily controller (mirroring the threat-intel / EPSS
  refresh controllers) regenerates all crown-jewel and BU-scoped models, so the
  model tracks the loop.

Reuse, not duplication: the exposure-chain engine, attacker-profile capabilities,
finding/validation lifecycle, and controller/scheduler patterns are all existing
— the new code is the join, the applicability catalog, and the status
derivation.

---

## UI

New **Threat Model** surface (under Scoping or Insights; one route per scope) —
**not** a DFD editor:

1. **Threat Model view** (`/threat-models/[id]` or `/crown-jewels/[id]/threat-model`):
   for the chosen crown-jewel/scope, an **attacker → path → technique →
   mitigation-status** breakdown. Group by attacker profile; each group lists
   its admissible exposure chains (reuse the existing exposure-chain path
   rendering: `web-lb → api → payments-db`), and under each hop the applicable
   techniques with a status chip (open/mitigated/covered) and the mapped
   mitigation. Every open threat deep-links to its evidence finding.
2. **Coverage heatmap** — an ATT&CK-Navigator-style tactic × technique matrix,
   **reusing** `ui/src/features/pentest/lib/mitre-attack.ts` +
   the mitre-coverage page's matrix component, colored by threat status for this
   scope (open = hot, covered = cool). Export as a Navigator layer JSON.
3. **Scope picker + coverage %** — pick crown jewel / BU / group; show the
   cached `coverage_pct` and open/mitigated/covered counts; "Regenerate" button.

Attacker profiles gain a "used by N threat models" back-reference so the Scoping
page stops being a dead-end CRUD screen.

---

## The one net-new dataset

The **only** new data is `attack_technique_mitigations` + `technique_applicability`.

- **Size.** ATT&CK Enterprise ≈ 200 techniques + ~600 sub-techniques and ~43
  mitigations (M-series), with a many-to-many `mitigates` relationship — a few
  thousand technique↔mitigation rows. We seed a **curated core** (the ~93
  techniques already in `mitre-attack.ts`, extended toward the common web/host/
  cloud/identity set) rather than the full matrix. `technique_applicability` is
  hand-curated to OpenCTEM's ~15 asset types and the ~12 attack-path
  relationship types — order low-hundreds of rows for the MVP core.
- **Sourcing.** MITRE publishes ATT&CK as machine-readable **STIX 2.1** in the
  `mitre-attack/attack-stix-data` GitHub repo (`enterprise-attack.json`).
  Techniques are `attack-pattern` objects (external ref `Txxxx`); mitigations
  are `course-of-action` objects (`Mxxxx`); the technique→mitigation links are
  `relationship` objects of type `mitigates`. It is **versioned** (e.g.
  ATT&CK v16.x) — we pin `dataset_version` per row so a model records which
  ATT&CK version it was computed against. A small offline generator
  (`cmd/gen-attack-mitigations`) transforms the STIX bundle into a seed
  migration; regenerate on ATT&CK releases (a few times a year).
- **Curation / maintenance.** `technique_applicability` (technique↔asset-type↔
  capability) is **ours** — MITRE does not publish it. It is small, reviewed,
  and versioned in-repo alongside the relationship taxonomy. Owned by the
  platform team; updated when we add asset types or relationship types.
- **Licensing / attribution.** ATT&CK is provided by The MITRE Corporation under
  the **ATT&CK Terms of Use** — free to use, reproduce, and redistribute
  (including in commercial products) **with attribution**. We include the
  required notice ("© The MITRE Corporation. ATT&CK® is a registered trademark…
  reproduced with permission") in the seed file, docs, and the UI heatmap
  footer, and record the version. No copyleft, no redistribution restriction,
  no external runtime dependency — the data is embedded as a seed.

Contrast with embedding a modeling *application*: here we import **data**, not a
UI, and the data is small, permissive, versioned, and machine-readable.

---

## Phasing

Effort is rough; ~70% of inputs already exist and are wired.

### Phase 1 — MVP: read-only auto-generated model for one crown-jewel/scope  (S–M)

- Seed `attack_technique_mitigations` (curated core) + `technique_applicability`
  (web/host/db/cloud/identity asset types) from ATT&CK STIX.
- `threatmodel` service: generate for a **crown-jewel scope** by joining
  existing exposure chains × the four default attacker profiles × applicable
  techniques; derive status from findings; persist `threat_models` +
  `threat_model_threats`.
- Endpoints `GET /threat-models`, `GET /{id}`, `POST /generate`.
- UI: single read-only Threat Model view (attacker → path → technique →
  mitigation status) + coverage %.
- **On-demand generation only.** *Proves the whole loop end-to-end with almost
  entirely existing data.*

### Phase 2 — Richer: per-attacker views, STRIDE layer, coverage, export, auto-refresh  (M)

- Coverage heatmap reusing the mitre-coverage matrix; Navigator-layer export.
- Per-attacker-profile filtering; optional **STRIDE labeling layer** (map each
  ATT&CK tactic/technique to its STRIDE category as a display facet — ATT&CK
  stays the spine).
- Auto-regenerate on asset-graph/scan change (dirty-marking) + a daily
  per-cycle controller for all crown-jewel/BU scopes.
- BU-scoped and asset-group scoped models; attacker-profile back-reference in UI.

### Phase 3 — Advanced  (M–L, later)

- Validation-driven "covered" status from live BAS/validation (RFC-011/012):
  "test this open threat" button dispatches a safe-check and flips status on
  result.
- Threat-model diff over time ("new threats since last cycle") and trend.
- Custom attacker profiles fully honored (capabilities → applicability already
  supports it); tenant-authored applicability overrides.
- Export to report generator (pentest PDF / executive summary).

---

## Alternatives considered

| Option | What it is | Why not (for OpenCTEM) |
|---|---|---|
| **OWASP ThreatAtlas** | Design-time threat-modeling **diagram app**, OWASP **incubator** | Immature incubator; **not embeddable** (a standalone UI, not a data/library); design-time & diagram-centric — the exact **one-off, drift-prone** model CTEM replaces. Prior eval **rejected**. |
| **OWASP Threat Dragon** | DFD editor + STRIDE, JSON model files | A **drawing tool**; requires humans to draw and maintain DFDs → stale by next deploy. We already have the DFD (asset graph). |
| **pytm** | Threat model **as Python code** | Model is code you write and re-run by hand; not continuous; not tenant-data-driven; another artifact to maintain. |
| **Threagile** | YAML-declared architecture → risk rules | Same staleness: a hand-authored YAML model diverges from the live asset graph; rule engine duplicates our prioritization. |
| **Full ATT&CK Navigator embed** | Technique heatmap UI | We already have the matrix component; we reuse it. Navigator alone has no attacker/path/mitigation model. |

**Why the chosen approach wins:** it is the only option that is **continuous by
construction** — derived from live CTEM data every cycle, with zero hand-drawn
artifacts — and it is **~70% built** because it composes machinery OpenCTEM
already runs. The others all reintroduce the manual-artifact staleness that CTEM
exists to eliminate.

## Risks & mitigations

- **#1 failure mode — one-off vs continuous mismatch.** If the model ever becomes
  an editable stored artifact, it will drift and rot like every classic threat
  model. **Mitigation:** the model is **fully regenerated** from live data;
  `threat_model_threats` is delete-and-insert; status is **derived, never a
  manual field**; `input_hash` + controllers keep it fresh per cycle. There is no
  "edit threat" endpoint by design (only accept/except, which routes through the
  existing finding-exception mechanism).
- **Applicability quality.** The technique↔asset-type mapping is curated and
  imperfect — over/under-enumeration is possible. **Mitigation:** keep the MVP
  core small and reviewed; mark no-evidence threats as `theoretical`
  (low-confidence) rather than alarming; iterate.
- **Combinatorial blow-up.** attackers × chains × hops × techniques could be
  large. **Mitigation:** reuse the existing `exposureChainCap = 100` and
  shortest-path-per-target dedup; cap techniques per hop; scope generation to
  crown jewels/critical targets (already the exposure-chain target selector).
- **ATT&CK version drift.** **Mitigation:** pin `dataset_version` on every model;
  regenerate the seed on ATT&CK releases via the offline generator.
- **Scope creep into a diagram editor.** **Mitigation:** explicit non-goal; the
  graph is the DFD; the UI renders paths and a heatmap only.
- **License.** ATT&CK is permissive with attribution — include the MITRE notice
  in seed/docs/UI and record the version.

## Scope discipline

Resist building a DFD/diagram editor. The differentiator is that OpenCTEM
**already computes the DFD** (asset graph + data-flow edge types) and the
**threats** (exposure chains + findings) — this feature is the **join and the
continuous status derivation**, not a modeling canvas.

## Decision log

- **Derive, never draw.** The asset graph is the DFD; the threat model is a query
  over live data, regenerated each cycle — not a stored, editable artifact.
- **ATT&CK is the spine, STRIDE is an optional label layer.** ATT&CK maps
  cleanly to techniques-per-hop and to our existing coverage heatmap; STRIDE is a
  display facet in Phase 2.
- **Attacker Profiles become a real consumer.** This closes the RFC-017 seam from
  the modeling side.
- **One net-new dataset, imported as data (not an app).** technique→mitigation +
  technique↔asset-type applicability, seeded from permissive ATT&CK STIX.
- **Reject ThreatAtlas / Threat Dragon / pytm / Threagile** — all reintroduce
  the manual-artifact staleness CTEM exists to remove.
