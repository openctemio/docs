# Implementation Plan: OpenCTEM Full Copy & Enterprise Removal

**Created:** 2025-02-03
**Status:** In Progress
**Goal:** Tạo openctemio repos hoàn chỉnh, có thể build và chạy độc lập

---

## Overview

Hiện tại openctemio repos chỉ có cấu trúc cơ bản, thiếu nhiều code quan trọng:
- `internal/app/` - 0/66 services
- `internal/infra/` - 0/236 handlers
- `cmd/` - 0/19 entry points

**Phương án:** Copy ALL code → Remove Enterprise/Cloud modules

---

## Phase A: Full Copy (Ưu tiên cao)

### A.1 Copy openctemio/api

```bash
# Script: scripts/fullcopy/01-fullcopy-api.sh

# Source: /home/ubuntu/projects/openctemio/api
# Target: /home/ubuntu/projects/openctemio/api

# Copy toàn bộ:
- cmd/                    # Entry points (server, migrate, etc.)
- internal/app/           # 66 service files
- internal/infra/         # 236 handler/middleware/route files
- internal/server/        # DI và server setup
- pkg/                    # Đã có, verify completeness
- migrations/             # Đã có 300 files
- Dockerfile, Makefile, etc.
```

**Files to copy:**
- [ ] `cmd/server/main.go`
- [ ] `cmd/server/services.go`
- [ ] `cmd/migrate/`
- [ ] `internal/app/*.go` (66 files)
- [ ] `internal/infra/http/handler/*.go` (~50 files)
- [ ] `internal/infra/http/middleware/*.go` (~15 files)
- [ ] `internal/infra/http/routes/*.go` (~20 files)
- [ ] `internal/infra/repository/*.go` (~40 files)
- [ ] `internal/infra/llm/` (if OSS)
- [ ] `internal/server/`
- [ ] Config files (Dockerfile, Makefile, docker-compose.yml)

### A.2 Verify openctemio/ui

UI đã được copy khá đầy đủ (438 TSX files). Verify:
- [ ] `src/app/` - Next.js pages
- [ ] `src/components/` - UI components
- [ ] `src/lib/` - Utilities
- [ ] `src/hooks/` - Custom hooks
- [ ] `src/stores/` - State management
- [ ] Config files (next.config, tailwind.config, etc.)

### A.3 Verify openctemio/agent

Agent đã có 16 Go files. Verify:
- [ ] `main.go`
- [ ] `internal/executor/` - All executors
- [ ] `internal/config/`
- [ ] `internal/gate/`
- [ ] `internal/output/`
- [ ] `internal/tools/`

### A.4 Verify openctemio/sdk

SDK đã có 117 Go files, 26 packages. Should be complete.

---

## Phase B: Remove Enterprise Modules

### B.1 Enterprise Domain Packages (10 packages)

**Remove from `pkg/domain/`:**

| Package | LOC | Reason |
|---------|-----|--------|
| `licensing/` | ~500 | License management |
| `accesscontrol/` | ~400 | Custom RBAC |
| `permissionset/` | ~300 | Permission sets |
| `aitriage/` | ~600 | AI triage |
| `workflow/` | ~700 | Workflow automation |
| `sla/` | ~400 | SLA management |
| `threatintel/` | ~300 | Threat intelligence |
| `pipeline/` | ~500 | CI/CD pipelines |
| `admin/` | ~800 | Platform admin (SaaS) |
| `lease/` | ~400 | Agent lease (SaaS) |

**Script:**
```bash
# scripts/fullcopy/02-remove-enterprise-domains.sh
rm -rf pkg/domain/{licensing,accesscontrol,permissionset,aitriage,workflow,sla,threatintel,pipeline,admin,lease}
```

### B.2 Enterprise Services (~15 files)

**Remove from `internal/app/`:**

| File | Reason |
|------|--------|
| `ai_triage_service.go` | AI feature |
| `aitriage_validation.go` | AI feature |
| `aitriage_validation_test.go` | AI feature |
| `license_service.go` | Licensing |
| `workflow_service.go` | Workflow |
| `sla_service.go` | SLA |
| `permission_set_service.go` | Custom RBAC |
| `access_control_service.go` | Custom RBAC |
| `platform_admin_service.go` | SaaS |
| `threat_intel_service.go` | Threat Intel |
| `module_cache_service.go` | Module gating |

### B.3 Enterprise Handlers (~10 files)

**Remove from `internal/infra/http/handler/`:**

| File | Reason |
|------|--------|
| `licensing_handler.go` | Licensing |
| `permission_set_handler.go` | Custom RBAC |
| `ai_triage_handler.go` | AI feature |
| `workflow_handler.go` | Workflow |
| `sla_handler.go` | SLA |
| `threat_intel_handler.go` | Threat Intel |
| `platform_handler.go` | SaaS |
| `platform_agent_handler.go` | SaaS |
| `platform_job_handler.go` | SaaS |
| `platform_register_handler.go` | SaaS |

### B.4 Enterprise Middleware (~5 files)

**Remove from `internal/infra/http/middleware/`:**

| File | Reason |
|------|--------|
| `license.go` | License check |
| `module.go` | Module gating |
| `platform_auth.go` | SaaS auth |
| `admin_auth.go` | Admin auth |

**Keep (OSS):**
- `auth.go` - Basic auth
- `tenant.go` - Multi-tenant (basic)
- `rls_context.go` - Row-level security
- `cors.go`, `logging.go`, etc.

### B.5 Enterprise Routes (~3 files)

**Remove from `internal/infra/http/routes/`:**

| File | Reason |
|------|--------|
| `platform.go` | SaaS platform routes |
| `admin.go` | Admin routes |
| Licensing routes in other files | Licensing |

### B.6 Enterprise Migrations

**Remove migrations by number range:**

| Range | Edition | Action |
|-------|---------|--------|
| 000001-000049 | Core (OSS) | **KEEP** |
| 000050-000099 | Enterprise | **REMOVE** |
| 000100-000199 | Reserved | KEEP if exists |
| 000200-000299 | SaaS | **REMOVE** |

**Script:**
```bash
# Remove enterprise migrations
for f in migrations/000{050..099}*.sql; do rm -f "$f"; done
for f in migrations/000{200..299}*.sql; do rm -f "$f"; done
```

---

## Phase C: Update Imports & Fix Compilation

### C.1 Remove Enterprise Imports

Search and remove imports of enterprise packages:
```go
// Remove these imports:
"github.com/openctemio/api/pkg/domain/licensing"
"github.com/openctemio/api/pkg/domain/accesscontrol"
"github.com/openctemio/api/pkg/domain/aitriage"
// ... etc
```

### C.2 Update DI/Wire

File: `internal/server/wire.go` hoặc `cmd/server/services.go`

- Remove enterprise service injections
- Remove enterprise handler registrations
- Update route setup to exclude enterprise routes

### C.3 Update Route Registration

File: `internal/infra/http/routes/routes.go`

- Remove calls to enterprise route setup functions
- Remove middleware that depends on licensing

### C.4 Feature Flags (Optional)

Có thể dùng feature flags để disable thay vì xóa code:
```go
if config.EnableAITriage {
    // Register AI triage routes
}
```

---

## Phase D: Verification

### D.1 Build Test

```bash
cd /home/ubuntu/projects/openctemio/api
go build ./...
```

### D.2 Unit Tests

```bash
go test ./...
```

### D.3 Check for Orphaned Imports

```bash
# Find files still importing enterprise packages
grep -r "pkg/domain/licensing" --include="*.go"
grep -r "pkg/domain/aitriage" --include="*.go"
```

### D.4 Docker Build

```bash
docker build -t openctemio/api:test .
```

---

## Phase E: Update openctem repos

Sau khi openctemio hoàn thiện, openctem repos sẽ:

### E.1 openctem/api
- Import `github.com/openctemio/api` as dependency
- Add enterprise packages on top
- Override/extend services với RBAC wrappers

### E.2 openctem/ui
- Import `@openctemio/ui` as dependency
- Add enterprise features
- Add ModuleGate wrappers

### E.3 openctem/cloud
- Import both `openctemio/api` và `openctem/api`
- Add SaaS-specific features
- Platform management

---

## Execution Checklist

### Phase A: Full Copy
- [ ] A.1: Copy all code to openctemio/api
- [ ] A.2: Verify openctemio/ui completeness
- [ ] A.3: Verify openctemio/agent completeness
- [ ] A.4: Verify openctemio/sdk completeness

### Phase B: Remove Enterprise
- [ ] B.1: Remove 10 enterprise domain packages
- [ ] B.2: Remove ~15 enterprise services
- [ ] B.3: Remove ~10 enterprise handlers
- [ ] B.4: Remove ~5 enterprise middleware
- [ ] B.5: Remove enterprise routes
- [ ] B.6: Remove enterprise migrations (050-099, 200-299)

### Phase C: Fix Compilation
- [ ] C.1: Remove enterprise imports
- [ ] C.2: Update DI/Wire configuration
- [ ] C.3: Update route registration
- [ ] C.4: Add feature flags (optional)

### Phase D: Verification
- [ ] D.1: `go build ./...` passes
- [ ] D.2: `go test ./...` passes
- [ ] D.3: No orphaned imports
- [ ] D.4: Docker build succeeds

### Phase E: Update openctem
- [ ] E.1: Update openctem/api to use openctemio/api
- [ ] E.2: Update openctem/ui to use openctemio/ui
- [ ] E.3: Update openctem/cloud dependencies

---

## Scripts Location

All scripts will be in: `/home/ubuntu/projects/openctemio/scripts/fullcopy/`

```
scripts/fullcopy/
├── 01-fullcopy-api.sh
├── 02-remove-enterprise-domains.sh
├── 03-remove-enterprise-services.sh
├── 04-remove-enterprise-handlers.sh
├── 05-remove-enterprise-middleware.sh
├── 06-remove-enterprise-migrations.sh
├── 07-update-imports.sh
├── 08-verify-build.sh
└── run-all.sh
```

---

## Notes

1. **Backup first:** Trước khi remove, backup openctemio repos hiện tại
2. **Gradual removal:** Remove từng category, verify build sau mỗi step
3. **Git commits:** Commit sau mỗi phase để dễ rollback
4. **Import graph:** Cần analyze import graph trước khi remove

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase A: Full Copy | 1 hour |
| Phase B: Remove Enterprise | 2 hours |
| Phase C: Fix Compilation | 2-4 hours |
| Phase D: Verification | 1 hour |
| Phase E: Update openctem | 2 hours |
| **Total** | **8-10 hours** |

---

**Next Action:** Bắt đầu Phase A - Full Copy
