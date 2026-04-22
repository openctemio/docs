# RFC-006: Asset Detail — Overview Tab Revamp

- **Status**: Draft (awaiting product/UX sign-off)
- **Created**: 2026-04-22
- **Priority**: Medium
- **Owners**: UI team (frontend), with sign-off from Product on §3.1 widget priority
- **Tracks Task**: #179 *Asset detail Overview revamp*
- **Depends on (already-shipped)**: RFC-001 Asset Identity Resolution, RFC-004 Priority Classes (P0–P3) + EPSS/KEV, migration 000155 runtime telemetry, migration 000156 IOC catalogue + auto-reopen
- **Estimated effort**: ~1.5 weeks across 3 phases (Phase A 2 d, Phase B 4 d, Phase C 3 d)
- **CTEM Stage**: Scoping → Discovery → Prioritization (Stages 1–3)

---

## 1. Problem

The Asset Detail sheet has accumulated five tabs (Overview, Relations, Findings, Details, plus optional `extraTabs` per asset variant) but the **Overview** tab itself has not kept up with the data the platform now produces. Operators land on Overview first; today they see a thin block (description + owner ref + tag list + relationship preview) and almost always have to click through to Findings or Details to make any decision.

Concretely, the platform now persists information that an operator triaging an asset needs in the first 5 seconds — and Overview shows none of it:

| Data point | Persisted since | Surface today on Asset Overview |
|---|---|---|
| Open findings by severity (current state) | always | ❌ hidden behind Findings tab |
| Open findings by **priority class P0–P3** | RFC-004 (mig 000142) | ❌ no surface |
| Earliest SLA breach for the asset | RFC-004 SLA integration | ❌ no surface |
| Last successful scan + scanner coverage | always | ❌ no surface |
| Asset criticality / crown-jewel flag | always | ⚠️ partial — `ClassificationBadges` exists but isn't rendered in Overview by default |
| Identity-resolution state (aliases, dedup-review pending) | RFC-001 (mig 000140) | ❌ no surface |
| Runtime telemetry signals (EDR/XDR last seen) | mig 000155 | ❌ no surface |
| IOC matches (auto-reopen origin) | mig 000156 | ❌ no surface |
| Group / scope memberships | always | ❌ behind Owners tab |

Result: the Overview tab is a partial-information landing page; operators learn to skip it. Recent fixes (#172 collapse subdomains, #177 fix user owner not showing, #178 owners scaling, #180 tags truncation, commits `2c92322`/`e16bf3e`) all worked around the same root cause — the sheet renders what the parent component happens to inject via `overviewContent`, with no shared opinion about *what an Asset Overview is*.

---

## 2. Goals & non-goals

### Goals
1. Make Overview a **decision page**: an operator can decide "do I need to act on this asset right now?" without leaving the tab.
2. Surface platform-level signals already persisted (priority class, SLA, IOC, telemetry, dedup status).
3. Stop variant-by-variant divergence — there should be one `AssetOverview` renderer with predictable layout across all 16 asset types.
4. Keep the sheet narrow enough for a half-screen layout on 1366×768 (most ops laptops).
5. Render 0-data widgets with a dignified empty state, not blanks (avoids the current "did this load?" UX).

### Non-goals
- Replacing the Findings tab. Overview shows aggregates + the top-1; deep work stays in Findings.
- Reworking the Sheet shell (header, toolbar, tabs). Only the body of `<TabsContent value="overview">` (`asset-detail-sheet.tsx:336-377`) changes.
- Adding new API endpoints if existing ones suffice. See §6.
- Mobile redesign. Responsive sizing only — no separate mobile layout.

---

## 3. Proposed design

### 3.1 Widget catalogue (priority-ordered)

Each widget is independently rendered, has a defined empty state, and is gated by a) data availability and b) feature flag `ui.assetOverview.<widgetId>` so we can dark-launch.

| # | Widget | Data source | Empty state | Why first |
|---|---|---|---|---|
| W1 | **Open-Findings Summary** — counts by severity + by priority class (P0–P3) with a single-row sparkline of last 30 days | `GET /api/v1/findings?asset_id=…&status=open&group_by=severity,priority_class` (existing — `finding_handler.go`) | "No open findings on this asset" | most decisions hinge on this number |
| W2 | **Earliest SLA breach** — countdown chip + class color + linked finding | `GET /api/v1/findings?asset_id=…&status=open&order_by=sla_deadline_asc&limit=1` (existing) | "All findings within SLA" | answers "is this on fire?" |
| W3 | **Asset Identity Card** — name, type, sub_type, criticality, crown-jewel pin, aliases (RFC-001), dedup-review status if pending | asset entity + `GET /api/v1/assets/dedup/reviews?asset_id=…` (existing per RFC-001) | always populated | replaces the current `ClassificationBadges` non-default rendering |
| W4 | **Coverage & Last Scan** — last successful scan timestamp per scanner, asset-scanner compatibility (smart filtering result) | `GET /api/v1/scans?asset_id=…&order_by=finished_at_desc&limit=5` + `tool.target_mapping` | "No scans recorded for this asset" | trust signal — when did we last look? |
| W5 | **Owners & Scope** — group memberships, individual owners (the existing `asset-owners-tab` content collapsed to a chip-list with "View all" → switches tab) | existing assets/owners endpoint | "No owners assigned" | answers "who do I escalate to?" |
| W6 | **Recent Activity** — last 5 audit events for the asset (created/renamed/owner-changed/finding-resolved) | `GET /api/v1/audit-logs?resource_type=asset&resource_id=…&limit=5` (existing — uses hash chain mig 000154) | "No recent activity" | provides change context |
| W7 | **Runtime Signals** — last EDR/XDR telemetry event + open IOC matches (auto-reopen origin) | `GET /api/v1/telemetry-events?asset_id=…&limit=1` + `GET /api/v1/ioc/matches?asset_id=…&status=open` (mig 000155, 000156) | "No runtime signals" / hidden if telemetry plugin not enabled | freshest threat intel for the asset |
| W8 | **Description & Owner Reference** — current free-text + ownerRef block | asset entity (already shown today) | hidden when both empty | preserved — operators rely on the free text |
| W9 | **Tags** — current `TagsSection` (already shown today) | asset entity + tag suggestions endpoint | "No tags" + add affordance | preserved |
| W10 | **Relationship Preview** — current `RelationshipPreview` (already shown today) | `useAssetRelationships()` hook | hidden when no relationships | preserved, max items raised from 3 → 5 (request from #178 thread) |

Default rendering order, top to bottom: W1, W2, W3, W4, W5, W7, W6, W8, W9, W10.

### 3.2 Layout

Two-column at ≥1024 px sheet width (current sheet on the dashboard route is 720 px → single-column; on the `(dashboard)/assets/[id]` route the page can go full width → two-column):

```
┌──────────────────────────────────────────────┐
│ Identity card (W3, full row)                 │
├────────────────────────┬─────────────────────┤
│ Open findings (W1)     │ Earliest SLA (W2)   │
├────────────────────────┼─────────────────────┤
│ Coverage & scans (W4)  │ Owners & scope (W5) │
├────────────────────────┼─────────────────────┤
│ Runtime signals (W7)   │ Recent activity (W6)│
├────────────────────────┴─────────────────────┤
│ Description & owner ref (W8, full row)        │
│ Tags (W9, full row)                           │
│ Relationships preview (W10, full row)         │
└──────────────────────────────────────────────┘
```

At <1024 px, all widgets stack to one column in the same order.

### 3.3 Component architecture

Today: each variant sheet (`asset-detail-sheet.tsx`, `container-detail-sheet.tsx`, `api-detail-sheet.tsx`) ships its own `overviewContent` prop. This is the source of the divergence problem.

Proposed:

```
features/assets/components/
├── asset-detail-sheet.tsx          (unchanged shell)
├── overview/
│   ├── asset-overview.tsx          NEW — top-level renderer; reads asset + widget config
│   ├── widgets/
│   │   ├── open-findings-card.tsx
│   │   ├── sla-breach-card.tsx
│   │   ├── identity-card.tsx
│   │   ├── coverage-card.tsx
│   │   ├── owners-card.tsx
│   │   ├── activity-card.tsx
│   │   └── runtime-signals-card.tsx
│   └── widget-config.ts            NEW — per-asset-type widget allow-list
└── ...
```

`AssetOverview` accepts `asset` + optional `extraSlots` for variant-specific content (e.g., container image vulnerabilities, API endpoint count). Variant sheets stop overriding `overviewContent` and instead pass `extraSlots` so the layout stays consistent.

### 3.4 Data fetching

- Each widget owns its own SWR call with `revalidateOnFocus: false` and a 30 s `dedupingInterval` so opening/closing the sheet repeatedly doesn't re-hit the API.
- W1 (open findings summary) uses `keepPreviousData` to avoid flicker between assets.
- All requests include `tenant_id` via the standard JWT path — no new tenant validation needed.

### 3.5 Empty / loading / error states

- Skeleton on initial load (one skeleton per widget so the user sees the layout immediately).
- Empty state inside the widget border, not a hidden widget — operators learn the layout faster when widgets are predictable.
- Per-widget error boundary — one widget's API failure must not blank the entire Overview. Failing widget shows a dismissible "Couldn't load coverage data — Retry" inline.

---

## 4. Alternatives considered

| # | Option | Why rejected |
|---|---|---|
| A | Keep `overviewContent` prop, add a "default" overview renderer if absent | Doesn't solve variant drift — variants keep overriding; still no shared opinion. |
| B | Move Overview content out of the sheet entirely; use a dedicated `/assets/[id]` route | Breaks the sheet-first ops flow (operators triage from list pages without losing context). Future work, not this RFC. |
| C | Auto-generate widgets from a JSON schema | Premature abstraction; we have 7 widget types, not 70. |
| D | Render every persisted field as an accordion | Information overload; defeats the "decision page" goal. |

Chosen: explicit widget components, explicit ordering, behind feature flags for safe rollout.

---

## 5. UX edge cases

- **Asset with 50 tags** — already partially fixed by #180 (column truncation in lists). Sheet's `TagsSection` should reuse the same overflow pattern (collapse with "+N more" affordance) — no new work, just verify.
- **Asset in dedup review** — W3 surfaces a banner "This asset has 2 candidate duplicates pending review" with a deep link to `assets/dedup/reviews/<id>` (RFC-001).
- **Subdomain under root** (#172) — W3 shows "subdomain of acme.com" with a one-click swap to the root. Restricted to asset types that have `member_of` relationships per commit `e16bf3e`.
- **Cloud account / host** (commit `2c92322`) — W3 must use the new typed labels, not the raw enum.
- **Asset with no findings ever** (just discovered) — W1 + W2 + W4 all show empty states; the page does not look broken; W3 + W5 + W8 + W9 still render.
- **Asset findings auto-reopened by IOC match** — W2's "earliest breach" must reflect the new deadline; W7 shows the IOC match that caused it. Otherwise an operator wonders why an unresolved finding suddenly has a tighter SLA.

---

## 6. API surface

**No new endpoints required.** Every widget reads from existing endpoints listed in §3.1. The change is **purely UI-side composition** of data already available.

Two minor request-shape additions would let us cut round-trips by ~3 → 1 per Overview load. These are additive and backward-compatible:

1. `GET /api/v1/findings/summary?asset_id=…` returning `{by_severity, by_priority_class, earliest_sla_deadline, total_open}` — replaces W1+W2's two separate calls. Maps to existing finding query helpers.
2. `GET /api/v1/assets/{id}/overview` returning a composed payload `{asset, identity, coverage, owners, activity, signals}` — replaces W3+W4+W5+W6+W7's five calls.

If we keep the per-widget endpoints in §3.1, ship Phase A+B without backend changes; add the composed endpoint in Phase C as an optimization.

---

## 7. Implementation phases

### Phase A — Scaffold + W3, W8, W9, W10 (existing-data widgets) — **2 days**
- Create `overview/` folder + `AssetOverview` shell + widget skeleton boundary.
- Migrate the four already-present sections (W3 identity, W8 description, W9 tags, W10 relationship preview) into widget components.
- Wire the existing variant sheets through `extraSlots` so nothing visually regresses.
- Acceptance: pixel-diff against current Overview is zero (we have only refactored).
- Tests: render-snapshot per asset type; verify variant `extraSlots` still appears.

### Phase B — Decision widgets W1, W2, W4, W5 — **4 days**
- Implement W1 (open findings summary), W2 (SLA breach), W4 (coverage), W5 (owners chip-list).
- Add SWR hooks per widget with shared `dedupingInterval`.
- Empty/loading/error states per widget.
- Behind feature flag `ui.assetOverview.decisionWidgets` (default off in prod, on in staging).
- Acceptance: an operator can answer "does this asset have an open P0?" and "is anything past SLA?" without leaving Overview.
- Tests: each widget gets unit tests for empty/loading/loaded/error states + an integration test asserting the API path is the existing one (regression guard against accidentally creating new endpoints).

### Phase C — Threat-intel widgets W6, W7 + composed endpoint (optional) — **3 days**
- Implement W6 (recent activity), W7 (runtime signals + IOC matches).
- W7 gracefully hides when telemetry isn't enabled for the tenant — no "Coming soon" placeholder (anti-pattern in this codebase per `simulation/` cleanup precedent).
- *Optional:* implement `GET /api/v1/assets/{id}/overview` composed endpoint and switch the widgets to use it via a feature flag `ui.assetOverview.composedFetch`.
- Acceptance: opening Overview triggers ≤2 API requests after composed endpoint is on; ≤7 requests if widgets fetch independently. Both numbers are within the SLO budget.
- Tests: per-tenant tenant-isolation test for the composed endpoint (LARGE); cache invalidation on finding state change.

---

## 8. Acceptance criteria (definition of done for #179)

1. Overview tab on `asset-detail-sheet.tsx`, `container-detail-sheet.tsx`, `api-detail-sheet.tsx` renders identical layout structure (widget order may be variant-customized via `extraSlots`, but never via `overviewContent` overrides).
2. The 7 priority widgets (W1–W7) ship behind feature flag and pass UAT in staging on the canonical 6 asset types: domain, host, cloud_account, container, repository, web_app.
3. No regression: `npm run validate` passes; `npm run build` succeeds; existing `asset-detail-sheet` snapshot tests still pass with updated snapshots; Playwright `e2e/asset-detail.spec.ts` (TBD — does not exist yet, must be added in Phase A) covers tab navigation + widget render + empty state.
4. Performance: Overview FCP ≤ 600 ms on a P95 desktop with cold cache and 200 ms backend latency. Widget skeletons must appear within 100 ms of sheet open.
5. Telemetry: emit `asset.overview.widget.viewed`, `asset.overview.widget.error`, `asset.overview.action.clicked` so we can measure adoption and tune §3.1 priority order post-ship.
6. Docs: update `/docs/ui/features/asset-detail.md` (create if missing) with the widget catalogue + extension points for variant sheets.

---

## 9. Risks

- **Widget overload on small sheets.** Mitigation: hide W6+W7 below 720 px sheet width; document in component story.
- **API request fan-out.** Mitigation: shared SWR `dedupingInterval`; Phase C composed endpoint as the long-term answer.
- **Variant drift returns** if anyone re-introduces `overviewContent`. Mitigation: deprecate the prop in Phase A with a `console.warn` in dev, remove in Phase B.
- **Empty-state fatigue** if a fresh tenant's assets render mostly empty widgets. Mitigation: in zero-data tenant detected (no findings on any asset), render a one-time onboarding card pointing at scan setup.
- **Feature-flag hygiene.** Mitigation: each flag has an owner + sunset date in `config/feature-flags.ts`; Phase B+C flags removed in the milestone after rollout.

---

## 10. Open questions for product

These are blockers for promoting #179 from "spec done" to "ready for code":

1. **Widget order** — is §3.1's order correct, or should W4 (coverage) come before W2 (SLA)? Ops vs SecOps may disagree.
2. **W3 vs W8 split** — should free-text description live inside the identity card (top), or stay as a separate full-width block (current)?
3. **W7 default visibility** — render with empty state, or fully hidden when no telemetry plugin? Hidden is cleaner; empty teaches operators that the feature exists.
4. **Composed endpoint** — Phase C optional? Or required for ship?
5. **Mobile behavior** — accept the single-column stack, or design a separate compact layout?

Sign-off needed on these five before kicking off Phase A.

---

## 11. Out of scope for this RFC (follow-up tickets)

- Cross-asset comparison view (placing two assets side-by-side).
- Asset risk-trend chart (requires history table; separate RFC).
- Drag-to-reorder per-user widget preferences (mentioned by ops; defer to v2).
- Page-route variant of Asset Detail (`/assets/[id]` standalone) — Option B in §4.

---

**Last Updated**: 2026-04-22
