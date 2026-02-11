---
layout: default
title: "ADR-006: Flexible Scan Target Selection"
parent: Decisions
nav_order: 6
---

# ADR-006: Flexible Scan Target Selection

**Status:** Implemented
**Date:** 2025-01-31
**Authors:** Engineering Team

---

## Context

The NewScanDialog allows users to select targets for security scans. Previously, it supported 3 target types but only 1 worked:

| Target Type | Previous Status | Issue |
|-------------|----------------|-------|
| **Asset Groups** | ✅ Works | Uses `asset_group_id` |
| **Individual Assets** | ❌ Not implemented | No backend support |
| **Custom Targets** | ❌ Broken | API requires `asset_group_id` |

### Root Cause

The CreateScan API required `asset_group_id` as mandatory:
- Domain validation in `entity.go` enforced it
- Database constraint: `asset_group_id UUID NOT NULL`
- Used by scan executor to fetch targets dynamically

However, this constraint was **artificial** - scheduling and profiles are independent of asset groups.

### User Requirements

1. Custom targets should have **FULL feature parity** (profiles, scheduling, etc.)
2. **Validation** - Must ensure at least ONE of (can have ALL):
   - Asset Group is selected, AND/OR
   - Individual Asset is selected, AND/OR
   - Custom Target is entered

---

## Decision

### Extend CreateScan API to Support All Target Types

| Aspect | Score | Notes |
|--------|-------|-------|
| API Consistency | ✅ | Single unified API |
| Feature Parity | ✅ | All features work for all target types |
| Backward Compatible | ✅ | `asset_group_id` still works |
| Clean Architecture | ✅ | Direct target storage in scans table |

### How It Works

1. Make `asset_group_id` **optional** in CreateScan API
2. Add `targets[]` field to CreateScan API and database
3. Database constraint ensures EITHER asset_group_id OR targets is provided
4. All features (profiles, scheduling) work regardless of target type
5. UI shows all 3 sections simultaneously (not exclusive RadioGroup)

---

## Implementation Details

### Files Created/Modified

#### Backend (Go)

| File | Changes |
|------|---------|
| `api/migrations/000144_scan_optional_asset_group.up.sql` | Make asset_group_id nullable, add targets[] |
| `api/internal/domain/scan/entity.go` | Add Targets field, update Validate() |
| `api/internal/infra/http/handler/scan_handler.go` | Update CreateScanRequest struct |
| `api/internal/app/scan_service.go` | Add target validation with SSRF protection |
| `api/internal/infra/postgres/scan_repository.go` | Update SQL for nullable asset_group_id |
| `api/pkg/validator/target.go` | **NEW**: Target validation with security protections |

#### Frontend (TypeScript)

| File | Changes |
|------|---------|
| `ui/src/lib/api/scan-types.ts` | Make asset_group_id optional, add targets[] |
| `ui/src/features/scans/components/new-scan/targets-step.tsx` | RadioGroup → Collapsible multi-select |
| `ui/src/features/scans/components/new-scan/new-scan-dialog.tsx` | Update validation, combine targets |

---

### Database Schema

**Migration:** `api/migrations/000144_scan_optional_asset_group.up.sql`

```sql
-- Make asset_group_id nullable and add targets field
ALTER TABLE scans
    ALTER COLUMN asset_group_id DROP NOT NULL,
    ADD COLUMN targets TEXT[] DEFAULT '{}';

-- Add constraint: either asset_group_id OR targets must be non-empty
ALTER TABLE scans
    ADD CONSTRAINT chk_scan_has_targets
        CHECK (asset_group_id IS NOT NULL OR (targets IS NOT NULL AND array_length(targets, 1) > 0));

-- Indexes for custom target scans
CREATE INDEX IF NOT EXISTS idx_scans_custom_targets ON scans USING GIN(targets)
    WHERE asset_group_id IS NULL AND targets IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scans_has_custom_targets ON scans(id)
    WHERE array_length(targets, 1) > 0;
```

---

### Target Validation (Security)

**File:** `api/pkg/validator/target.go`

The target validator provides comprehensive validation with security protections:

#### Supported Target Formats

| Format | Example | Regex Pattern |
|--------|---------|---------------|
| Domain | `example.com` | Standard domain validation |
| Wildcard Domain | `*.example.com` | Wildcard prefix allowed |
| IPv4 | `192.168.1.1` | Standard IPv4 octets |
| IPv6 | `2001:db8::1` | Standard IPv6 format |
| CIDR Range | `10.0.0.0/24` | IPv4 with prefix length |
| URL | `https://api.example.com` | HTTP/HTTPS URLs |
| Host:Port | `mail.example.com:587` | Domain/IP with port |

#### Security Protections

1. **SSRF Protection** - Blocks internal/private IP ranges:
   - `10.0.0.0/8` (Private Class A)
   - `172.16.0.0/12` (Private Class B)
   - `192.168.0.0/16` (Private Class C)
   - `127.0.0.0/8` (Loopback)
   - `0.0.0.0/8` (Local)
   - `169.254.0.0/16` (Link-local)
   - `fc00::/7` (IPv6 ULA)
   - `fe80::/10` (IPv6 Link-local)
   - `::1` (IPv6 Loopback)
   - `localhost`

2. **Command Injection Prevention** - Blocks dangerous characters:
   - Shell metacharacters: `; & | \` $ ( ) { } [ ] < > \\ ' " ! #`
   - Prevents command injection when targets passed to scanners

3. **Configurable Options**:
   ```go
   targetValidator := validator.NewTargetValidator(
       validator.WithAllowInternalIPs(false),  // Block internal IPs
       validator.WithAllowLocalhost(false),    // Block localhost
       validator.WithMaxTargets(1000),         // Limit target count
   )
   ```

---

### Frontend UI

The targets step now uses Collapsible sections instead of exclusive RadioGroup:

```
┌─────────────────────────────────────────┐
│ Select Targets                           │
│ Select at least one target source.       │
├─────────────────────────────────────────┤
│ ▼ Asset Groups                    [2]    │
│   ☑ Production Web Servers              │
│   ☐ Development Environment             │
│   ☑ API Gateways                        │
├─────────────────────────────────────────┤
│ ▼ Individual Assets                [5]  │
│   🔍 [Search assets...]                  │
│   ☑ api.example.com    [Domain]          │
│   ☑ 10.0.1.5           [IP]              │
│   [1/3] ◀ ▶                             │
├─────────────────────────────────────────┤
│ ▼ Custom Targets              [3 valid] │
│   ┌─────────────────────────────────┐   │
│   │ example.com                     │   │
│   │ 192.168.1.0/24                  │   │
│   │ https://api.example.com/v1      │   │
│   └─────────────────────────────────┘   │
│   ✓ All 3 targets are valid             │
│   Examples: [example.com] [10.0.0.0/8]  │
├─────────────────────────────────────────┤
│ Total Selected Targets          [25]    │
└─────────────────────────────────────────┘
```

#### Real-time Validation

The frontend provides instant feedback:
- **Green badge**: Valid targets count
- **Red badge**: Invalid targets count
- **Yellow badge**: Warnings (internal IPs)
- Format hints tooltip with all supported formats
- Clickable example buttons to add sample targets

---

## Validation Flow

```
Targets Step (all 3 sections visible):
  ├─ Asset Groups: [Checkbox list]
  ├─ Individual Assets: [Search/Select] (Coming soon)
  └─ Custom Targets: [Textarea with validation]

Click "Next" → validateCurrentStep():
  │
  ├─ assetGroupIds.length > 0? → Has targets ✓
  ├─ assetIds.length > 0? → Has targets ✓
  ├─ customTargets.length > 0? → Has targets ✓
  │
  ├─ At least ONE has data? → Proceed ✅
  └─ All empty? → Toast error, stay on step ❌

Click "Start Scan" → handleSubmit():
  │
  ├─ Combine all target sources
  ├─ asset_group_id → passed if groups selected
  ├─ targets[] → combined from individual + custom
  │
  Backend validation:
  ├─ Validate each target format
  ├─ Check for SSRF (internal IPs)
  ├─ Sanitize for command injection
  └─ Store in database
```

---

## Test Scenarios

| Scenario | Result |
|----------|--------|
| Only Asset Groups selected | ✅ Works |
| Only Custom Targets entered | ✅ Works |
| Only Individual Assets selected | ✅ Works |
| Asset Groups + Custom Targets | ✅ Combined scan |
| All 3 types combined | ✅ All combined |
| Nothing selected → Next | ❌ Blocked: "Please select at least one target" |
| Internal IP (10.x.x.x) | ⚠️ Warning shown, blocked by backend |
| Invalid format | ❌ Shown as invalid in UI |
| Dangerous characters (;, &) | ❌ Blocked |
| Tool not in registry | ❌ Blocked: "scanner 'xyz' not found" |
| No agents available | ❌ Blocked: "No agents available" |

---

## Consequences

### Positive

- **Full Feature Parity**: All target types support profiles, scheduling, and all features
- **Flexible Selection**: Users can combine multiple target sources
- **Backward Compatible**: Existing scans with `asset_group_id` continue to work
- **Consistent UX**: No confusion about which features work with which target type
- **Security**: SSRF protection and input sanitization built-in
- **Real-time Feedback**: Frontend validation before submission

### Negative

- **Migration Required**: Database schema change needed (completed)

---

## Security Considerations

| Threat | Mitigation |
|--------|-----------|
| SSRF (Server-Side Request Forgery) | Block internal IP ranges |
| Command Injection | Sanitize dangerous characters |
| Resource Exhaustion | Limit to 1000 targets max |
| Invalid Input | Validate format before storage |

---

## Pre-Creation Validation

Before a scan can be created, the following validations are performed:

### Tool Validation

| Check | Scan Type | Error |
|-------|-----------|-------|
| Tool exists in registry | Single | `scanner 'xyz' not found in tool registry` |
| Tool is active | Single | `scanner 'xyz' is disabled` |
| Pipeline step tool exists | Workflow | `pipeline step 'step_key' uses tool 'xyz' which is not found` |
| Pipeline step tool active | Workflow | `pipeline step 'step_key' uses tool 'xyz' which is disabled` |

### Agent Availability Check

Agent availability is checked differently for create vs trigger:

| Action | Behavior | Error Message |
|--------|----------|---------------|
| **Create Scan Config** | Warning only (allows creation) | `no agent available for scan` (logged) |
| **Trigger Scan** | Blocks execution | `No agents available. Deploy a tenant agent or upgrade your plan for platform agents.` |

**Design Decision:**
- **Create**: Scans can be created without available agents (for pre-scheduling)
- **Trigger**: Requires at least one **daemon** agent online to execute

**Agent Requirements for Trigger:**
- Must be `status = 'active'` and `health = 'online'`
- Must be in **daemon mode** (`execution_mode = 'daemon'`) OR type `worker`/`collector`
- Standalone/runner agents (CI/CD) cannot receive server-triggered jobs

This allows:
- Pre-scheduling scans before deploying agents
- Creating scan configs that will execute when agents come online
- Clear error when trying to trigger without agents

---

## Future Work

1. **Target Groups**: Allow saving custom target lists for reuse
2. **Import from File**: Upload CSV/TXT of targets
3. **Bulk Validation**: API endpoint to validate targets before scan creation

---

## Related Files

### Backend
- Migration: `api/migrations/000144_scan_optional_asset_group.up.sql`
- Target Validator: `api/pkg/validator/target.go`
- Target Validator Tests: `api/pkg/validator/target_test.go`
- Scan Entity: `api/internal/domain/scan/entity.go`
- Scan Service: `api/internal/app/scan_service.go` (includes tool + agent validation)
- Agent Selector: `api/internal/app/agent_selector.go` (CheckAgentAvailability)
- Scan Handler: `api/internal/infra/http/handler/scan_handler.go`
- Scan Repository: `api/internal/infra/postgres/scan_repository.go`

### Frontend
- Frontend Types: `ui/src/lib/api/scan-types.ts`
- Targets Step: `ui/src/features/scans/components/new-scan/targets-step.tsx`
- New Scan Dialog: `ui/src/features/scans/components/new-scan/new-scan-dialog.tsx`

### Documentation
- API Reference: `docs/backend/api-reference.md`
- User Guide: `docs/guides/scan-management.md`
