# OpenCTEM — Sổ tay sử dụng (User Guide)

> Tài liệu sử dụng chuẩn hóa cho nền tảng **OpenCTEM** — hệ thống *Continuous Threat Exposure Management* (CTEM) đa tổ chức (multi-tenant). Toàn bộ tài liệu được dựng bằng cách **đi qua trực tiếp từng tính năng trên giao diện đang chạy** (headless Chromium ⟶ stack thật: UI Next.js + API Go + PostgreSQL + Redis), chụp ảnh màn hình thực tế, và đối chiếu với mã nguồn từng trang để mô tả đúng nút/tab/trường.

Ngày dựng: 2026-06-03 · Giao diện: tiếng Anh (nhãn UI giữ nguyên tiếng Anh trong tài liệu). Bản hướng dẫn này viết bằng tiếng Việt.

---

## OpenCTEM là gì

OpenCTEM tổ chức công việc quản trị phơi nhiễm theo **5 pha CTEM** — đúng theo cấu trúc thanh điều hướng bên trái:

| Pha | Mục tiêu | Chương tài liệu |
|-----|----------|-----------------|
| **Scoping** | Xác định phạm vi & bối cảnh nghiệp vụ | [02](02-scoping.md) |
| **Discovery** | Phát hiện tài sản & phơi nhiễm | [03 — Tài sản](03-discovery-assets.md), [04 — Phơi nhiễm/Findings](04-exposures-components-findings.md) |
| **Prioritization** | Xếp ưu tiên cái cần xử lý trước | [05](05-prioritization.md) |
| **Validation** | Chứng minh phơi nhiễm là thật & kiểm thử phòng thủ | [06](06-validation.md) |
| **Mobilization** | Đưa khắc phục tới đích & tự động hóa | [07](07-mobilization.md) |

Cộng với: [01 — Bắt đầu & Dashboard](01-getting-started-dashboard.md) và [08 — Cài đặt & Quản trị](08-settings-administration.md).

---

## Bắt đầu nhanh (Quickstart)

1. Mở ứng dụng → trang **Sign in**. Đăng nhập bằng email + mật khẩu, hoặc SSO (**Google / GitHub / Microsoft**).
2. Người dùng mới: sau khi đăng ký (`/register`) → **onboarding** tạo team/tổ chức (`/onboarding/create-team`) → vào Dashboard.
3. Giao diện chung: **sidebar** nhóm theo pha CTEM · **Search/Cmd+K** (command palette) · chuông **Notifications** · nút **đổi theme** (light/dark) · **bộ chuyển tenant** · menu tài khoản.
4. Dữ liệu (tài sản, findings…) được sinh ra khi **chạy scan** — phần lớn trang danh sách hiển thị *empty state* trung thực cho tới khi có scan/ingest.

---

## Cách đọc tài liệu

Mỗi tính năng được mô tả theo khuôn mẫu: **Mục đích** → **Cách dùng** (các bước thật) → **Ghi chú** (empty state, quyền RBAC, "Coming Soon" nếu là placeholder) → **ảnh màn hình**. Mỗi chương kết thúc bằng một **Checklist** đánh dấu tính năng đã được tài liệu hóa.

---

## Danh mục tính năng đầy đủ (Master Checklist)

### 01 · Bắt đầu & Dashboard
- [x] Dashboard tổng quan (`/`) — CTEM stepper, Quick Actions, thẻ thống kê, Findings Trend, Severity Distribution, Recent Activity
- [x] Executive Summary (`/insights/executive`)
- [x] CTEM Maturity (`/insights/ctem-maturity`)
- [x] Notifications (`/notifications`)
- [x] Security Reports (`/reports`) — *backend báo cáo chưa nối; mẫu báo cáo có sẵn để chọn*
- [x] Account — Profile (`/account`)
- [x] Account — Security (`/account/security`) — *2FA hiển thị "Coming soon"*
- [x] Account — Activity (`/account/activity`)

### 02 · Scoping
- [x] Attack Surface Overview (`/attack-surface`)
- [x] Asset Groups (`/asset-groups`)
- [x] Scope Configuration (`/scope-config`)
- [x] Business Services (`/business-services`)
- [x] Business Units & mô hình mức trọng yếu (`/business-units`) — criticality + phân cấp, effective criticality (MAX), CIA impact, cờ `is_control_plane`
- [x] CTEM Cycles (`/cycles`)
- [x] Attacker Profiles (`/attacker-profiles`)
- [x] Relationship Suggestions (`/relationships/suggestions`)
- [x] Compliance Requirements (`/compliance`)
- [x] Business Impact Analysis (`/business-impact`)

### 03 · Discovery — Scans & Asset Inventory
- [x] Scan Management (`/scans`) — wizard tạo scan 4 bước
- [x] Asset Inventory — bảng hợp nhất (`/assets`)
- [x] Domains & Subdomains (`/assets/domains`)
- [x] IP Addresses (`/assets/ip-addresses`)
- [x] Websites (`/assets/websites`)
- [x] APIs (`/assets/apis`)
- [x] Hosts (`/assets/hosts`)
- [x] Services (`/assets/services`)
- [x] Containers & Kubernetes (`/assets/containers`)
- [x] Databases (`/assets/databases`)
- [x] Storage Buckets (`/assets/storage`)
- [x] Cloud Accounts (`/assets/cloud-accounts`)
- [x] Network & Security Devices (`/assets/networks`)
- [x] Mobile Apps (`/assets/mobile`)
- [x] Certificates (`/assets/certificates`)
- [x] Identity & Access (`/assets/identity`)
- [x] Repositories (`/assets/repositories`)

### 04 · Discovery — Exposures, Components & Findings
- [x] Security Findings — workbench (`/findings`) — *tính năng trung tâm: bảng, lọc severity/status, KEV/EPSS, bulk actions, AI triage, chi tiết*
- [x] Exposure Events (`/exposures`)
- [x] Vulnerability Exposures (`/exposures/vulnerabilities`)
- [x] Misconfiguration Exposures (`/exposures/misconfigurations`)
- [x] Secret Exposures (`/exposures/secrets`)
- [x] Code Vulnerabilities (`/exposures/code`)
- [x] Credential Leaks (`/credentials`)
- [x] Software Components (`/components`)
- [x] All Components (`/components/all`)
- [x] Vulnerable Components (`/components/vulnerable`)
- [x] Package Ecosystems (`/components/ecosystems`)
- [x] License Compliance (`/components/licenses`)
- [x] Export SBOM (`/components/sbom-export`) — CycloneDX/SPDX, JSON/XML

### 05 · Prioritization
- [x] Điểm ưu tiên minh bạch "Why this priority" — `(Impact+Likelihood+Exposure)×(1−control)` thang 0–15, panel trên chi tiết finding
- [x] Threat Intelligence (`/threat-intel`) — EPSS, CISA KEV
- [x] Risk Analysis (`/risk-analysis`) — **Coming Soon (placeholder)**
- [x] Business Impact Analysis (`/business-impact`)
- [x] Priority Override Rules (`/settings/priority-rules`) — rule builder + Dry-Run
- [x] Scoring Configuration (`/settings/scoring`)

### 06 · Validation
- [x] Automated finding validation — Re-verify (RFC-011.2): safe-check reachability, verdict confirm-or-downgrade, downgrade %
- [x] Pentest Campaigns (`/pentest/campaigns`)
- [x] Pentest Findings (`/pentest/findings`)
- [x] Retest Management (`/pentest/retests`)
- [x] Pentest Reports (`/pentest/reports`)
- [x] Finding Templates (`/pentest/templates`)
- [x] MITRE ATT&CK Coverage (`/pentest/mitre-coverage`) — *Export đang disabled*
- [x] Breach & Attack Simulation (`/attack-simulation`) — *tạo mới "coming soon"*
- [x] Control Testing (`/control-testing`)
- [x] Compensating Controls (`/controls`)

### 07 · Mobilization
- [x] Remediation Tasks (`/remediation`) — campaign có chủ sở hữu/SLA
- [x] Vé cấp kỹ sư — Mobilization Brief (Definition of Done + acceptable fixes vào body Jira/GitHub)
- [x] Remediation Groups (`/remediations`) — bulk-resolve theo solution family (RFC-015)
- [x] Automation Workflows (`/workflows`) — trình dựng node (xyflow)
- [x] Scan Pipelines (`/pipelines`) + trình dựng trực quan (`/pipelines/[id]/builder`)
- [x] Program Health (`/insights/program-health`) + SLA compliance + Scope refinement (khép vòng lặp về Scoping)

### 08 · Cài đặt & Quản trị
- [x] Tenant Settings (`/settings/tenant`)
- [x] General Settings (`/settings/general`) — *bộ chọn ngôn ngữ có sẵn nhưng UI hiện chỉ tiếng Anh*
- [x] User Management (`/settings/users`)
- [x] Roles — RBAC (`/settings/roles`)
- [x] Teams (`/settings/access-control/groups`)
- [x] Assignment Rules (`/settings/access-control/assignment-rules`)
- [x] Module Management (`/settings/modules`)
- [x] Audit Log (`/settings/audit`)
- [x] Asset Lifecycle (`/settings/asset-lifecycle`)
- [x] Integrations hub (`/settings/integrations`)
- [x] SCM Connections (`/settings/integrations/scm`)
- [x] Notification Integrations (`/settings/integrations/notifications`)
- [x] Ticketing Integration (`/settings/integrations/ticketing`)
- [x] SIEM Integration (`/settings/integrations/siem`) — **Coming Soon**
- [x] CI/CD Integration (`/settings/integrations/cicd`) — **Coming Soon**
- [x] Platform Agents (`/agents`)
- [x] Tools catalog (`/tools`)
- [x] Scanner Templates (`/scanner-templates`)
- [x] Template Sources (`/template-sources`)
- [x] Secret Store (`/secret-store`)
- [x] Scan Profiles (`/scan-profiles`)
- [x] Capabilities (`/capabilities`)

---

## Ghi nhận trong quá trình đi qua hệ thống (Walkthrough notes)

- 🐞 **Bug đã phát hiện & sửa khi test thực:** mở `/findings` khi có dữ liệu finding mang một `status` mà UI chưa biết → `FindingStatusBadge` ném lỗi (`Cannot read properties of undefined (reading 'icon')`) làm **trắng toàn bộ trang Findings**. Đã sửa (fallback an toàn) — PR `ui#142`.
- ✅ **Empty state trung thực:** Dashboard và các trang dữ liệu hiển thị "No … data / Start scanning" thay vì số liệu giả — đúng chuẩn cho sản phẩm bảo mật.
- ✅ **Dark mode** sạch trên các bề mặt chính (đã kiểm light + dark).
- ⏳ **Placeholder (Coming Soon):** Risk Analysis, SIEM Integration, CI/CD Integration, tạo Attack Simulation. Reports backend chưa nối.
- 🌐 **i18n:** tầng dịch chưa nối — UI hiện tiếng Anh (bộ chọn ngôn ngữ có sẵn nhưng chỉ đổi hướng RTL, chưa dịch chuỗi).

---

## Phương pháp dựng tài liệu

1. Đăng nhập headless (Playwright/Chromium) vào UI dev trỏ tới API thật (Docker).
2. Duyệt **toàn bộ 87 route** trong cấu hình sidebar, chụp **full-page screenshot** từng trang vào `screenshots/`.
3. Seed dữ liệu findings mẫu để các trang dữ liệu (Findings/Dashboard/Exposures) hiển thị nội dung thật.
4. Mỗi chương do một người soạn đối chiếu **mã nguồn trang** để mô tả đúng thao tác.
5. Seed thêm 14 tài sản (10 loại) + 10 findings để Dashboard/Assets/Findings/Exposures hiển thị dữ liệu thật.
6. Chụp **cả light và dark mode** cho mỗi tính năng (mỗi mục có ảnh sáng + ảnh tối).

> Tái tạo: xem ghi chú vận hành trong bộ nhớ dự án (`project-ui-expert-review-2026-06`) cho recipe chạy dev server + đăng nhập + seed.
