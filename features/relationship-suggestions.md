---
layout: default
title: Relationship Suggestions
parent: Features
nav_order: 35
---

# Relationship Suggestions

Auto-detect and review asset relationships based on DNS hierarchy and resolution data.

## Overview

The Relationship Suggestions system analyzes existing assets and generates recommended relationships that users can review, modify, and approve before they become permanent links in the asset graph.

## How It Works

1. **Scan** — System analyzes all domains, subdomains, and IP addresses
2. **Generate** — Creates pending suggestions based on detection rules
3. **Review** — Users review suggestions with inline type editing
4. **Approve/Dismiss** — Approved suggestions become real relationships

## Detection Rules

| Rule | Source | Target | Type | Confidence |
|------|--------|--------|------|------------|
| Domain hierarchy | Domain | Subdomain | `contains` | 95% |
| DNS A/AAAA resolution | Domain/Subdomain | IP Address | `resolves_to` | 90% |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/relationships/suggestions` | List pending suggestions (paginated, searchable) |
| GET | `/api/v1/relationships/suggestions/count` | Count pending suggestions |
| POST | `/api/v1/relationships/suggestions/generate` | Scan and generate suggestions (rate limited: 1/30s per tenant) |
| POST | `/api/v1/relationships/suggestions/{id}/approve` | Approve and create relationship |
| POST | `/api/v1/relationships/suggestions/{id}/dismiss` | Dismiss suggestion |
| PATCH | `/api/v1/relationships/suggestions/{id}/type` | Update relationship type |
| POST | `/api/v1/relationships/suggestions/approve-batch` | Approve multiple (max 1000) |
| POST | `/api/v1/relationships/suggestions/approve-all` | Approve all pending |

## Permissions

- **Read**: `assets:read`
- **Write** (approve/dismiss/generate): `assets:write`

## Database

Table: `relationship_suggestions` (migration 000136)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant isolation |
| source_asset_id | UUID | Source asset |
| target_asset_id | UUID | Target asset |
| relationship_type | VARCHAR | Relationship type (e.g., `contains`, `resolves_to`) |
| reason | TEXT | Human-readable explanation |
| confidence | FLOAT | 0.0–1.0 confidence score |
| status | VARCHAR | `pending`, `approved`, `dismissed` |
| reviewed_by | UUID | Reviewer user ID |
| reviewed_at | TIMESTAMP | Review timestamp |

Unique constraint: `(tenant_id, source_asset_id, target_asset_id, relationship_type)`

## Design Decisions

- **`contains` for domain→subdomain** (not `cname_of`): Follows project convention that all hierarchy uses `contains` (parent→child). `cname_of` is reserved for actual DNS CNAME records.
- **`resolves_to` allows subdomain sources**: Both domains and subdomains can have A/AAAA records.
- **DeletePending before re-scan**: Ensures re-scan picks up rule changes without duplicates.
- **Pagination loop**: `fetchAllAssets()` iterates through all pages (not capped at 100) to handle large tenants.
- **Rate limiting**: Per-tenant 30-second cooldown on `/generate` to prevent resource exhaustion.

## UI Features

- Search by asset name (debounced)
- Multi-select with batch approve (confirmation dialog)
- Approve All with confirmation dialog
- Inline relationship type editing (persisted via PATCH)
- Sorted by confidence DESC
- Error state with retry hint
- Responsive table (Reason column hidden on mobile)

## Key Files

**Backend:**
- `api/internal/app/relationship_suggestion_service.go`
- `api/internal/infra/postgres/relationship_suggestion_repository.go`
- `api/internal/infra/http/handler/relationship_suggestion_handler.go`
- `api/pkg/domain/relationship/suggestion.go`

**Frontend:**
- `ui/src/app/(dashboard)/(discovery)/relationships/suggestions/page.tsx`
- `ui/src/features/relationships/api/use-relationship-suggestions.ts`
