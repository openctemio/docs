# Tài Liệu Triển Khai Hệ Thống OpenCTEM

> Open-Source Continuous Threat Exposure Management Platform

---

## Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Yêu Cầu Hệ Thống](#2-yêu-cầu-hệ-thống)
3. [Đánh Giá Các Phương Án Triển Khai](#3-đánh-giá-các-phương-án-triển-khai)
4. [Phương Án Đề Xuất Tối Ưu](#4-phương-án-đề-xuất-tối-ưu)
5. [Hướng Dẫn Triển Khai Chi Tiết](#5-hướng-dẫn-triển-khai-chi-tiết)
   - [5.1 Docker Compose (Single Server)](#51-docker-compose-single-server)
   - [5.2 Kubernetes (Helm Chart)](#52-kubernetes-helm-chart)
6. [Cấu Hình Hệ Thống](#6-cấu-hình-hệ-thống)
7. [Giám Sát & Monitoring](#7-giám-sát--monitoring)
8. [Backup & Disaster Recovery](#8-backup--disaster-recovery)
9. [Bảo Mật](#9-bảo-mật)
10. [Quy Trình CI/CD](#10-quy-trình-cicd)
11. [Troubleshooting](#11-troubleshooting)
12. [Sizing & Capacity Planning](#12-sizing--capacity-planning)

---

## 1. Tổng Quan Kiến Trúc

### 1.1 Sơ Đồ Kiến Trúc Tổng Thể

```
                              ┌─────────────────────────────────────────────┐
                              │              INTERNAL / USERS               │
                              └──────────────────┬──────────────────────────┘
                                                 │
                                          ┌──────▼──────┐
                                          │   DNS/CDN   │
                                          └──────┬──────┘
                                                 │
                              ┌──────────────────▼──────────────────────────┐
                              │           NGINX REVERSE PROXY               │
                              │     (SSL Termination, Rate Limiting)        │
                              │         Port 80 → 443 Redirect              │
                              ├─────────────┬───────────────┬───────────────┤
                              │ app.domain  │ api.domain    │ admin.domain  │
                              └──────┬──────┴───────┬───────┴──────┬────────┘
                                     │              │              │
                        ┌────────────▼──┐    ┌──────▼──────┐ ┌─────▼───────┐
                        │   UI (Next.js)│    │  API (Go)   │ │  Admin UI   │
                        │   Port 3000   │    │  Port 8080  │ │  Port 3000  │
                        │  React 19     │    │  gRPC: 9090 │ │  (Optional) │
                        │  TypeScript   │    │  Chi Router │ │             │
                        └───────┬───────┘    └──┬───┬──┬───┘ └─────────────┘
                                │               │   │  │
                   ┌────────────┘               │   │  │
                   │  HTTP Proxy (/api/*)       │   │  │
                   └────────────────────────────┘   │  │
                                                    │  │
              ┌─────────────────────────────────────┘  │
              │                                        │
     ┌────────▼─────────┐                   ┌──────────▼──────────┐
     │  PostgreSQL 17   │                   │     Redis 7         │
     │  (Primary Store) │                   │  (Cache/Queue)      │
     │                  │                   │                     │
     │  - Users/Tenants │                   │  - Sessions         │
     │  - Assets        │                   │  - Permission Cache │
     │  - Findings      │                   │  - Job Queue (Asynq)│
     │  - Scans         │                   │  - Agent State      │
     │  - RBAC (126 per)│                   │  - Pub/Sub          │
     └──────────────────┘                   └─────────────────────┘
                                                    │
                                            ┌───────▼───────┐
                                            │  Asynq Worker │
                                            │  (Background) │
                                            │               │
                                            │  - Scan Jobs  │
                                            │  - Notifs     │
                                            │  - AI Triage  │
                                            └───────────────┘

     ┌──────────────────────────────────────────────────────────────┐
     │                    SCANNING AGENTS                           │
     │                                                              │
     │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
     │  │  Trivy   │ │ Semgrep  │ │ Nuclei   │ │ Gitleaks │  ...  │
     │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
     │                                                              │
     │  Communication: REST API (polling) + gRPC                   │
     │  Output: SARIF format                                       │
     │  Auth: Bootstrap Token → Self-Registration                  │
     └──────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────┐
     │                  EXTERNAL INTEGRATIONS                       │
     │                                                              │
     │  ITSM: Jira, Linear, Asana                                 │
     │  SCM: GitHub, GitLab                                        │
     │  Auth: Google, GitHub, Microsoft (OAuth), Keycloak (OIDC)   │
     │  AI: Claude, OpenAI GPT-4, Gemini                          │
     │  Notif: Slack, Teams, Telegram, Email (SMTP), Webhooks     │
     └──────────────────────────────────────────────────────────────┘
```

### 1.2 Thành Phần Hệ Thống

| Thành phần         | Công nghệ                        | Vai trò                                            |
| ------------------ | -------------------------------- | -------------------------------------------------- |
| **API Backend**    | Go 1.26+, Chi Router, DDD        | Xử lý business logic, REST + gRPC API              |
| **UI Frontend**    | Next.js 16, React 19, TypeScript | Giao diện người dùng, SSR/CSR                      |
| **Admin UI**       | Next.js (Optional)               | Console quản trị nền tảng                          |
| **PostgreSQL**     | v17-alpine                       | Lưu trữ dữ liệu chính, multi-tenant                |
| **Redis**          | v7-alpine                        | Cache, session, job queue (Asynq), pub/sub         |
| **Nginx**          | v1.27-alpine                     | Reverse proxy, SSL termination, load balancing     |
| **Scanning Agent** | Go, multi-tool                   | Quét bảo mật (Trivy, Semgrep, Nuclei, Gitleaks...) |
| **Migration**      | golang-migrate                   | Quản lý schema database                            |

### 1.3 Luồng Dữ Liệu Chính

```
User Request → Nginx (SSL) → UI (SSR) → API → PostgreSQL/Redis
                                  ↓
                          API → Asynq Job → Redis Queue → Worker
                                  ↓
                          Agent ← Poll API → Execute Tool → SARIF → API → DB
                                  ↓
                          Notification → Slack/Teams/Email/Webhook
```

---

## 2. Yêu Cầu Hệ Thống

### 2.1 Yêu Cầu Phần Cứng

| Quy mô                    | CPU      | RAM    | Disk        | Mô tả                    |
| ------------------------- | -------- | ------ | ----------- | ------------------------ |
| **Small** (< 50 users)    | 4 vCPU   | 8 GB   | 100 GB SSD  | Startup, team nhỏ        |
| **Medium** (50-500 users) | 8 vCPU   | 16 GB  | 250 GB SSD  | Doanh nghiệp vừa         |
| **Large** (500+ users)    | 16+ vCPU | 32+ GB | 500+ GB SSD | Enterprise, multi-tenant |

### 2.2 Resource Allocation (Theo Docker Compose Production)

| Service            | CPU Min  | CPU Max | RAM Min    | RAM Max     |
| ------------------ | -------- | ------- | ---------- | ----------- |
| **Nginx**          | 0.1      | 1.0     | 64 MB      | 256 MB      |
| **API**            | 0.5      | 2.0     | 256 MB     | 1 GB        |
| **UI**             | 0.5      | 2.0     | 512 MB     | 2 GB        |
| **PostgreSQL**     | 0.5      | 2.0     | 512 MB     | 2 GB        |
| **Redis**          | 0.25     | 1.0     | 256 MB     | 1 GB        |
| **Tổng tối thiểu** | **1.85** | **8.0** | **1.6 GB** | **6.25 GB** |

### 2.3 Yêu Cầu Phần Mềm

| Phần mềm       | Phiên bản tối thiểu | Ghi chú                |
| -------------- | ------------------- | ---------------------- |
| Docker         | 24.x+               | Docker Engine + CLI    |
| Docker Compose | v2.20+              | Plugin hoặc standalone |
| OpenSSL        | 1.1+                | Tạo SSL certificates   |
| Git            | 2.x+                | Quản lý source code    |
| Kubernetes     | 1.28+               | Chỉ khi triển khai K8s |
| Helm           | 3.12+               | Chỉ khi triển khai K8s |

### 2.4 Yêu Cầu Network

| Port | Service    | Hướng         | Ghi chú               |
| ---- | ---------- | ------------- | --------------------- |
| 80   | Nginx      | Inbound       | HTTP → redirect HTTPS |
| 443  | Nginx      | Inbound       | HTTPS (SSL/TLS)       |
| 5432 | PostgreSQL | Internal only | Không expose ra ngoài |
| 6379 | Redis      | Internal only | Không expose ra ngoài |
| 8080 | API        | Internal only | Qua Nginx proxy       |
| 9090 | API gRPC   | Internal only | Agent communication   |
| 3000 | UI         | Internal only | Qua Nginx proxy       |

---

## 3. Đánh Giá Các Phương Án Triển Khai

### 3.1 So Sánh Tổng Quan

| Tiêu chí                 | Docker Compose (Single) | Docker Compose (Multi-node) | Kubernetes (Helm)   |
| ------------------------ | ----------------------- | --------------------------- | ------------------- |
| **Độ phức tạp**          | Thấp                    | Trung bình                  | Cao                 |
| **Thời gian setup**      | 30 phút                 | 2-4 giờ                     | 1-2 ngày            |
| **High Availability**    | Không                   | Giới hạn                    | Đầy đủ              |
| **Auto-scaling**         | Không                   | Không                       | Có (HPA)            |
| **Zero-downtime deploy** | Không                   | Hạn chế                     | Có (Rolling Update) |
| **Chi phí vận hành**     | Thấp                    | Trung bình                  | Cao                 |
| **Phù hợp**              | < 100 users             | 100-500 users               | 500+ users          |
| **Backup/DR**            | Thủ công                | Bán tự động                 | Tự động             |
| **Monitoring**           | Tùy chọn                | Cần thiết                   | Tích hợp            |
| **Team cần**             | 1 DevOps                | 1-2 DevOps                  | 2+ DevOps/SRE       |

### 3.2 Phân Tích Chi Tiết Từng Phương Án

#### Phương Án A: Docker Compose - Single Server

```
┌─────────────────────────────────────┐
│          SINGLE SERVER              │
│                                     │
│  ┌───────┐  ┌─────┐  ┌──────────┐  │
│  │ Nginx │  │ API │  │    UI    │  │
│  └───┬───┘  └──┬──┘  └────┬─────┘  │
│      │         │           │        │
│  ┌───▼─────────▼───────────▼─────┐  │
│  │      Docker Network           │  │
│  ├───────────┬───────────────────┤  │
│  │ PostgreSQL│      Redis        │  │
│  └───────────┴───────────────────┘  │
│                                     │
│  Volumes: postgres_data, redis_data │
└─────────────────────────────────────┘
```

**Ưu điểm:**

- Setup nhanh (30 phút) với Makefile tự động
- Chi phí thấp (1 server, từ $20-40/tháng)
- Dễ debug và troubleshoot
- Phù hợp POC, staging, team nhỏ
- SSL tự động với self-signed certs

**Nhược điểm:**

- Single Point of Failure (SPOF)
- Không auto-scale
- Downtime khi cập nhật
- Giới hạn tài nguyên

**Chi phí ước tính:** $20-80/tháng (cloud VPS)

---

#### Phương Án B: Docker Compose - Multi-node (Swarm)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   NODE 1    │    │   NODE 2    │    │   NODE 3    │
│  (Manager)  │    │  (Worker)   │    │  (Worker)   │
│             │    │             │    │             │
│ Nginx + API │    │  API + UI   │    │    DB       │
│    + UI     │    │             │    │  + Redis    │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                   Overlay Network
```

**Ưu điểm:**

- HA cho stateless services (API, UI)
- Dùng lại Docker Compose config
- Chi phí trung bình

**Nhược điểm:**

- Docker Swarm ít được phát triển
- HA cho database phức tạp
- Monitoring khó hơn
- Community nhỏ

**Chi phí ước tính:** $100-300/tháng

---

#### Phương Án C: Kubernetes (Helm Chart) - Đề Xuất Cho Production

```
┌──────────────────────────────────────────────────────────────┐
│                    KUBERNETES CLUSTER                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Ingress Controller (nginx-ingress + cert-manager)       │ │
│  │ - Auto SSL via Let's Encrypt                            │ │
│  │ - Rate limiting: 100 req/min                            │ │
│  └─────────┬────────────────────────────┬──────────────────┘ │
│            │                            │                    │
│  ┌─────────▼──────────┐    ┌────────────▼───────────────┐   │
│  │ API Deployment      │    │ UI Deployment              │   │
│  │ Replicas: 2→10      │    │ Replicas: 2                │   │
│  │ HPA: CPU 70%        │    │                            │   │
│  │      MEM 80%        │    │ Resources:                 │   │
│  │ Resources:          │    │   req: 100m/128Mi          │   │
│  │   req: 250m/256Mi   │    │   lim: 1cpu/512Mi          │   │
│  │   lim: 2cpu/1Gi     │    │                            │   │
│  │ PDB: minAvail=1     │    └────────────────────────────┘   │
│  └─────────┬───────────┘                                     │
│            │                                                 │
│  ┌─────────▼──────────┐    ┌─────────────────────────────┐   │
│  │ PostgreSQL          │    │ Redis Deployment            │   │
│  │ StatefulSet         │    │ PVC: 5Gi                    │   │
│  │ PVC: 50Gi           │    │ req: 100m/128Mi             │   │
│  │ req: 500m/512Mi     │    │ lim: 1cpu/1Gi               │   │
│  │ lim: 2cpu/2Gi       │    │                             │   │
│  └─────────────────────┘    └─────────────────────────────┘   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ ConfigMap (non-sensitive) + Secrets (sensitive)        │   │
│  │ ServiceAccount + PodDisruptionBudget                  │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Ưu điểm:**

- Auto-scaling (HPA: 2→10 pods API)
- Zero-downtime deployment (Rolling Update)
- Self-healing (pod restart, reschedule)
- PodDisruptionBudget đảm bảo availability
- SSL tự động qua cert-manager + Let's Encrypt
- Network Policy isolation
- Dễ mở rộng thêm Agent nodes

**Nhược điểm:**

- Cần team có kinh nghiệm K8s
- Chi phí cao hơn
- Overhead cho hệ thống nhỏ

**Chi phí ước tính:** $200-1000+/tháng (managed K8s)

---

### 3.3 Ma Trận Quyết Định

```
                        Quy mô nhỏ           Quy mô vừa          Quy mô lớn
                        (< 100 users)         (100-500 users)      (500+ users)
                    ┌─────────────────┬──────────────────────┬────────────────────┐
  Ngân sách thấp    │  ★ Docker       │  Docker Compose      │  K8s (self-hosted) │
  (< $100/mo)       │    Compose      │  + External DB       │                    │
                    ├─────────────────┼──────────────────────┼────────────────────┤
  Ngân sách TB      │  Docker Compose │  ★ K8s (Managed)     │  K8s (Managed)     │
  ($100-500/mo)     │                 │                      │                    │
                    ├─────────────────┼──────────────────────┼────────────────────┤
  Ngân sách cao     │  Docker Compose │  K8s (Managed)       │  ★ K8s (Multi-     │
  (> $500/mo)       │  + Monitoring   │  + Managed DB        │    cluster)        │
                    └─────────────────┴──────────────────────┴────────────────────┘

  ★ = Phương án đề xuất cho từng kịch bản
```

---

## 4. Phương Án Đề Xuất Tối Ưu

### Chiến Lược Triển Khai Theo Giai Đoạn (Recommended)

Tôi đề xuất **chiến lược triển khai tiến hóa** - bắt đầu đơn giản và mở rộng khi cần:

```
Phase 1 (Tháng 1-3)        Phase 2 (Tháng 3-6)       Phase 3 (Tháng 6+)
Docker Compose              Docker Compose             Kubernetes
Single Server               + Managed DB               Helm Chart
                            + Monitoring
                            + Backup tự động

┌──────────────┐        ┌──────────────────┐      ┌────────────────────┐
│ 1 Server     │        │ App Server       │      │ K8s Cluster        │
│ All-in-one   │  ───▶  │ + RDS/CloudSQL   │ ───▶ │ + Managed DB       │
│ Self-signed  │        │ + SSL (LE)       │      │ + Auto-scaling     │
│ ~$40/mo      │        │ + Monitoring     │      │ + HA               │
│              │        │ ~$150/mo         │      │ ~$400+/mo          │
└──────────────┘        └──────────────────┘      └────────────────────┘
```

### Tại Sao Phương Án Này Tối Ưu?

1. **Giảm rủi ro**: Không over-engineer từ đầu
2. **Tiết kiệm chi phí**: Chỉ trả cho những gì cần
3. **Migration path rõ ràng**: Helm chart đã sẵn sàng cho Phase 3
4. **Sẵn sàng production**: Docker Compose prod config đã được hardening
5. **Monitoring stack có sẵn**: Prometheus + Grafana + AlertManager

---

## 5. Hướng Dẫn Triển Khai Chi Tiết

### 5.1 Docker Compose (Single Server)

#### Bước 1: Chuẩn bị Server

```bash
# Ubuntu 22.04/24.04 LTS
sudo apt update && sudo apt upgrade -y

# Cài Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Cài Docker Compose plugin
sudo apt install docker-compose-plugin

# Verify
docker --version        # >= 24.x
docker compose version  # >= 2.20
```

#### Bước 2: Clone Repository

```bash
git clone https://github.com/openctemio/openctemio.git
cd openctemio/setup
```

#### Bước 3: Khởi Tạo Environment Files

```bash
# Tạo env files từ template
make init-prod

# Hoặc thủ công:
cp environments/.env.db.prod.example .env.db.prod
cp environments/.env.api.prod.example .env.api.prod
cp environments/.env.ui.prod.example .env.ui.prod
cp environments/.env.nginx.prod.example .env.nginx.prod
cp environments/.env.versions.prod.example .env.versions.prod
```

#### Bước 4: Cấu Hình Secrets

```bash
# Generate secrets tự động
make generate-secrets

# Output:
#   AUTH_JWT_SECRET: <base64-encoded-48-bytes>
#   CSRF_SECRET:     <hex-encoded-32-bytes>
#   DB/REDIS PASS:   <hex-encoded-24-bytes>

# Cập nhật vào các file .env.*.prod tương ứng
```

**File `.env.db.prod`** - cần thay đổi:

```env
DB_USER=openctem
DB_PASSWORD=<GENERATED_PASSWORD>    # ← Thay thế
DB_NAME=openctem
DB_SSLMODE=require
REDIS_PASSWORD=<GENERATED_PASSWORD> # ← Thay thế
```

**File `.env.api.prod`** - cần thay đổi:

```env
APP_ENV=production
APP_DEBUG=false
APP_ENCRYPTION_KEY=<64-hex-chars>   # ← openssl rand -hex 32
AUTH_JWT_SECRET=<GENERATED_SECRET>  # ← Thay thế
AUTH_PROVIDER=local                 # hoặc oidc, hybrid
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
SMTP_ENABLED=true                   # Nếu cần email
```

**File `.env.nginx.prod`** - cần thay đổi:

```env
NGINX_HOST=app.yourdomain.com       # ← Domain UI
API_HOST=api.yourdomain.com         # ← Domain API
ADMIN_HOST=admin.yourdomain.com     # ← Domain Admin
```

#### Bước 5: Cấu Hình SSL

**Option A: Self-signed (Dev/Internal)**

```bash
make auto-ssl
```

**Option B: Let's Encrypt (Production - Recommended)**

```bash
# Cài certbot
sudo apt install certbot

# Tạo certificate
sudo certbot certonly --standalone \
  -d app.yourdomain.com \
  -d api.yourdomain.com \
  -d admin.yourdomain.com

# Copy certificates
cp /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/app.yourdomain.com/privkey.pem nginx/ssl/key.pem

# Auto-renew (crontab)
echo "0 0 1 * * certbot renew --post-hook 'docker compose -f docker-compose.prod.yml restart nginx'" \
  | sudo tee -a /etc/crontab
```

**Option C: Cloudflare (Recommended cho production)**

```
DNS → Cloudflare Proxy (Orange Cloud) → Server
- SSL Mode: Full (Strict)
- Auto SSL tại Cloudflare edge
- DDoS protection miễn phí
- Nginx sẽ skip HTTPS redirect khi X-Forwarded-Proto: https
```

#### Bước 6: Kiểm Tra & Triển Khai

```bash
# Kiểm tra env files
make check-prod-env

# Pull images và start
make prod-up

# Theo dõi logs
make prod-logs

# Kiểm tra trạng thái
docker compose -f docker-compose.prod.yml ps
```

#### Bước 7: Bootstrap Admin User

```bash
make bootstrap-admin-prod email=admin@yourdomain.com role=super_admin
```

#### Bước 8: Verify Deployment

```bash
# Health check API
curl -k https://api.yourdomain.com/health

# Health check UI
curl -k https://app.yourdomain.com

# Xem logs từng service
make prod-logs s=api
make prod-logs s=ui
make prod-logs s=postgres
```

---

### 5.2 Kubernetes (Helm Chart)

#### Prerequisites

```bash
# Kubernetes cluster (EKS/GKE/AKS hoặc self-hosted)
kubectl version  # >= 1.28

# Helm
helm version     # >= 3.12

# cert-manager (cho auto SSL)
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# nginx-ingress
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

#### Bước 1: Tạo Namespace & Secrets

```bash
kubectl create namespace openctem

# Database secrets
kubectl create secret generic openctem-db-secrets \
  --namespace openctem \
  --from-literal=POSTGRES_PASSWORD='<strong-password>' \
  --from-literal=DATABASE_URL='postgres://openctem:<password>@openctem-postgres:5432/openctem?sslmode=require'

# API secrets
kubectl create secret generic openctem-api-secrets \
  --namespace openctem \
  --from-literal=AUTH_JWT_SECRET='<jwt-secret>' \
  --from-literal=APP_ENCRYPTION_KEY='<encryption-key>' \
  --from-literal=DB_PASSWORD='<db-password>' \
  --from-literal=REDIS_PASSWORD='<redis-password>'

# Redis secrets
kubectl create secret generic openctem-redis-secrets \
  --namespace openctem \
  --from-literal=REDIS_PASSWORD='<redis-password>'
```

#### Bước 2: Cấu Hình Values

```bash
cd setup/kubernetes/helm

# Tạo custom values
cat > values-prod.yaml << 'EOF'
global:
  imageRegistry: "ghcr.io/openctemio"

api:
  replicaCount: 3
  image:
    tag: "v0.2.0"       # Pin version cụ thể
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: "2"
      memory: 2Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

ui:
  replicaCount: 2
  image:
    tag: "v0.2.0"

postgres:
  storage:
    size: 100Gi
    storageClass: "gp3"    # AWS EBS
  resources:
    requests:
      cpu: "1"
      memory: 2Gi
    limits:
      cpu: "4"
      memory: 4Gi

redis:
  storage:
    size: 10Gi

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: app.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
          service: ui
        - path: /api
          pathType: Prefix
          service: api
  tls:
    - secretName: openctem-tls
      hosts:
        - app.yourdomain.com

podDisruptionBudget:
  enabled: true
  minAvailable: 1

networkPolicy:
  enabled: true
EOF
```

#### Bước 3: Deploy

```bash
# Install
helm install openctem ./openctem \
  --namespace openctem \
  -f values-prod.yaml

# Verify
kubectl get pods -n openctem
kubectl get svc -n openctem
kubectl get ingress -n openctem

# Xem logs
kubectl logs -n openctem -l app.kubernetes.io/component=api -f
```

#### Bước 4: Upgrade

```bash
# Update values hoặc image tags
helm upgrade openctem ./openctem \
  --namespace openctem \
  -f values-prod.yaml \
  --set api.image.tag=v0.3.0 \
  --set ui.image.tag=v0.3.0

# Rollback nếu có vấn đề
helm rollback openctem 1 --namespace openctem
```

---

## 6. Cấu Hình Hệ Thống

### 6.1 Environment Variables Quan Trọng

| Variable               | Mô tả                            | Bắt buộc | Default  |
| ---------------------- | -------------------------------- | -------- | -------- |
| `APP_ENV`              | Môi trường (production/staging)  | Có       | -        |
| `APP_ENCRYPTION_KEY`   | AES-256 encryption key (64 hex)  | Có       | -        |
| `DB_HOST`              | PostgreSQL host                  | Có       | postgres |
| `DB_PASSWORD`          | PostgreSQL password              | Có       | -        |
| `REDIS_HOST`           | Redis host                       | Có       | redis    |
| `REDIS_PASSWORD`       | Redis password                   | Có       | -        |
| `AUTH_JWT_SECRET`      | JWT signing secret (>= 64 chars) | Có       | -        |
| `AUTH_PROVIDER`        | local / oidc / hybrid            | Có       | local    |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins             | Có       | -        |
| `RATE_LIMIT_RPS`       | Requests per second              | Không    | 100      |
| `RATE_LIMIT_BURST`     | Burst size                       | Không    | 200      |
| `AI_PLATFORM_PROVIDER` | claude / openai / gemini         | Không    | -        |
| `SMTP_ENABLED`         | Enable email notifications       | Không    | false    |

### 6.2 Database Connection Tuning

```env
# PostgreSQL (production recommendations)
DB_MAX_OPEN_CONNS=25      # Max open connections
DB_MAX_IDLE_CONNS=5        # Max idle connections
DB_CONN_MAX_LIFETIME=300   # Connection max lifetime (seconds)
DB_SSLMODE=require         # SSL mode (require for production)
```

### 6.3 Multi-Tenant Configuration

Hệ thống hỗ trợ multi-tenant với:

- **Tenant isolation**: Mọi query đều filter theo `tenant_id`
- **Plans**: free, team, business, enterprise
- **RBAC**: 126 permissions với role-based access
- **Groups**: Tag-based và group-based scoping

```bash
# Quản lý tenant
make list-tenants-prod
make assign-plan-prod tenant=<uuid> plan=enterprise
```

---

## 7. Giám Sát & Monitoring

### 7.1 Monitoring Stack

Hệ thống đi kèm monitoring stack đầy đủ:

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Prometheus  │────▶│   Grafana    │     │ AlertManager │
│ :9090       │     │   :3001      │     │   :9093      │
│             │     │              │     │              │
│ Scrape:     │     │ Dashboards:  │     │ Channels:    │
│ - API /met  │     │ - API perf   │     │ - Slack      │
│ - PG export │     │ - DB metrics │     │ - Email      │
│ - Redis exp │     │ - Redis      │     │ - Webhook    │
└─────────────┘     └──────────────┘     └──────────────┘
```

```bash
# Bật monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Truy cập
# Prometheus: http://server:9090
# Grafana:    http://server:3001 (admin/admin)
# AlertManager: http://server:9093
```

### 7.2 Health Check Endpoints

| Endpoint          | Service | Mô tả              |
| ----------------- | ------- | ------------------ |
| `GET /health`     | API     | Liveness check     |
| `GET /metrics`    | API     | Prometheus metrics |
| `GET /api/health` | UI      | Frontend health    |

### 7.3 Alerts Được Cấu Hình Sẵn

- API response time > 5s
- Database connection pool exhausted
- Redis memory > 80%
- Disk usage > 85%
- Certificate expiry < 14 days
- Failed scan jobs > threshold

---

## 8. Backup & Disaster Recovery

### 8.1 Backup Strategy

```
┌──────────────────────────────────────────────────┐
│                  BACKUP PLAN                      │
├───────────────┬──────────┬────────┬──────────────┤
│ Component     │ Tần suất │ Giữ   │ Phương pháp  │
├───────────────┼──────────┼────────┼──────────────┤
│ PostgreSQL    │ Daily    │ 30 ngày│ pg_dump      │
│ PostgreSQL    │ Hourly   │ 24 giờ │ WAL archive  │
│ Redis         │ Daily    │ 7 ngày │ RDB snapshot │
│ SSL Certs     │ On change│ 3 ver  │ File copy    │
│ Env files     │ On change│ Always │ Encrypted    │
│ Docker volumes│ Weekly   │ 4 tuần │ Volume backup│
└───────────────┴──────────┴────────┴──────────────┘
```

### 8.2 Database Backup Script

```bash
#!/bin/bash
# backup-db.sh - Chạy daily qua cron

BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U openctem -d openctem -Fc > \
  "${BACKUP_DIR}/openctem_${DATE}.dump"

# Compress
gzip "${BACKUP_DIR}/openctem_${DATE}.dump"

# Cleanup old backups
find "${BACKUP_DIR}" -name "*.dump.gz" -mtime +${RETENTION_DAYS} -delete

# Optional: Upload to S3
# aws s3 cp "${BACKUP_DIR}/openctem_${DATE}.dump.gz" s3://backups/openctem/
```

### 8.3 Restore

```bash
# Restore từ backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U openctem -d openctem --clean < backup.dump
```

### 8.4 RTO/RPO Targets

| Metric              | Docker Compose       | Kubernetes             |
| ------------------- | -------------------- | ---------------------- |
| **RPO** (data loss) | < 1 giờ (hourly WAL) | < 15 phút (continuous) |
| **RTO** (downtime)  | < 2 giờ              | < 15 phút              |
| **Backup verified** | Weekly               | Daily (auto-test)      |

---

## 9. Bảo Mật

### 9.1 Security Hardening Đã Áp Dụng

Cấu hình production đã bao gồm các biện pháp bảo mật:

| Biện pháp                | Mô tả                        | Config                            |
| ------------------------ | ---------------------------- | --------------------------------- |
| **No-new-privileges**    | Container không thể escalate | `security_opt: no-new-privileges` |
| **Read-only filesystem** | API container read-only      | `read_only: true` + tmpfs         |
| **Internal network**     | DB/Redis không expose        | `expose` thay vì `ports`          |
| **SSL/TLS**              | HTTPS bắt buộc               | Nginx SSL termination             |
| **Rate limiting**        | 100 RPS + burst 200          | API middleware + Nginx            |
| **CORS**                 | Chỉ allow domains cụ thể     | `CORS_ALLOWED_ORIGINS`            |
| **Resource limits**      | CPU/Memory caps              | Docker `deploy.resources`         |
| **Log rotation**         | Giới hạn log size            | `json-file` driver + max-size     |
| **Health checks**        | Auto-restart unhealthy       | Docker healthcheck                |
| **Password policy**      | Min 8 chars, complexity      | Auth config                       |
| **Account lockout**      | 5 failed attempts → 15m lock | Auth config                       |
| **Session limit**        | Max 10 active sessions       | Auth config                       |
| **Encryption at rest**   | AES-256 cho sensitive data   | `APP_ENCRYPTION_KEY`              |

### 9.2 Checklist Bảo Mật Trước Khi Go-live

```
[ ] Thay tất cả <CHANGE_ME> trong env files
[ ] Generate unique JWT secret (>= 64 chars)
[ ] Generate unique encryption key (64 hex chars)
[ ] Đặt strong DB/Redis passwords
[ ] Cấu hình CORS chỉ cho domains cụ thể
[ ] Bật SSL/TLS (không dùng self-signed cho production)
[ ] Kiểm tra DB/Redis không expose port ra ngoài
[ ] Bật rate limiting
[ ] Review Nginx security headers
[ ] Setup backup tự động
[ ] Setup monitoring & alerting
[ ] Kiểm tra firewall rules (chỉ mở 80, 443)
[ ] Disable debug mode (APP_DEBUG=false)
[ ] Review và giới hạn CORS origins
```

---

## 10. Quy Trình CI/CD

### 10.1 Pipeline Tổng Quan

```
┌──────┐    ┌──────┐    ┌───────┐    ┌─────────┐    ┌──────────┐
│ Push │───▶│ Lint │───▶│ Test  │───▶│  Build  │───▶│  Deploy  │
│      │    │      │    │       │    │  Image  │    │          │
│ main │    │ vet  │    │ unit  │    │ GHCR    │    │ staging  │
│ tag  │    │ fmt  │    │ integ │    │         │    │ prod     │
└──────┘    └──────┘    └───────┘    └─────────┘    └──────────┘
                                          │
                                    ┌─────▼─────┐
                                    │ Security  │
                                    │ Scan      │
                                    │ (Trivy)   │
                                    └───────────┘
```

### 10.2 Deployment Workflow

```bash
# Staging deployment
cd setup

# Pull latest images
docker compose -f docker-compose.staging.yml pull

# Deploy with zero-ish downtime
docker compose -f docker-compose.staging.yml up -d --remove-orphans

# Verify
make staging-logs s=api

# Production deployment (after staging verification)
make prod-up
```

### 10.3 Rollback

```bash
# Docker Compose - chỉ định version cũ
API_VERSION=v0.1.9 UI_VERSION=v0.1.9 make prod-up

# Kubernetes
helm rollback openctem <revision> --namespace openctem
```

---

## 11. Troubleshooting

### 11.1 Common Issues

| Vấn đề                   | Nguyên nhân          | Giải pháp                               |
| ------------------------ | -------------------- | --------------------------------------- |
| API không start          | DB chưa ready        | Kiểm tra `make prod-logs s=postgres`    |
| Migration failed         | Schema conflict      | `make migrate-prod` thủ công            |
| SSL error                | Cert expired/invalid | Renew cert, kiểm tra nginx/ssl/         |
| 502 Bad Gateway          | API down             | `make prod-restart s=api`               |
| Redis connection refused | Password sai         | Kiểm tra `.env.db.prod` REDIS_PASSWORD  |
| UI blank page            | API URL sai          | Kiểm tra `.env.ui.prod` BACKEND_API_URL |
| Slow queries             | Missing indexes      | Kiểm tra PostgreSQL logs, EXPLAIN       |
| Out of memory            | Resource limits      | Tăng `memory` trong compose file        |

### 11.2 Debug Commands

```bash
# Xem trạng thái containers
docker compose -f docker-compose.prod.yml ps

# Xem logs real-time
make prod-logs s=api

# Exec vào container
docker compose -f docker-compose.prod.yml exec api sh

# Database shell
make db-shell-prod

# Redis shell
make redis-shell-prod

# Kiểm tra network
docker network inspect setup_app-network

# Resource usage
docker stats
```

---

## 12. Sizing & Capacity Planning

### 12.1 Sizing theo Quy Mô

```
┌────────────────────────────────────────────────────────────────────┐
│                     CAPACITY PLANNING                              │
├────────────┬──────────────┬──────────────┬────────────────────────┤
│            │   Small      │   Medium     │   Large                │
│            │  < 50 users  │  50-500      │  500+ users            │
├────────────┼──────────────┼──────────────┼────────────────────────┤
│ Server     │ 1x 4C/8G     │ 1x 8C/16G   │ K8s cluster (3+ nodes)│
│ API        │ 1 instance   │ 2 instances  │ 3-10 pods (HPA)       │
│ UI         │ 1 instance   │ 1 instance   │ 2 pods                │
│ PostgreSQL │ 2C/2G        │ 4C/4G        │ Managed (RDS/CloudSQL)│
│ Redis      │ 1C/1G        │ 1C/2G        │ 1C/2G (or managed)    │
│ Disk       │ 100 GB SSD   │ 250 GB SSD   │ 500+ GB SSD           │
│ Agents     │ 1-2          │ 5-10         │ 10+ (distributed)     │
│ Est. Cost  │ $40-80/mo    │ $150-400/mo  │ $400-1500/mo          │
├────────────┼──────────────┼──────────────┼────────────────────────┤
│ Deploy     │ Docker       │ Docker +     │ Kubernetes             │
│ Method     │ Compose      │ Managed DB   │ Helm Chart             │
└────────────┴──────────────┴──────────────┴────────────────────────┘
```

### 12.2 Growth Indicators (Khi nào nên upgrade)

| Indicator           | Threshold      | Action                            |
| ------------------- | -------------- | --------------------------------- |
| CPU usage sustained | > 70%          | Scale up hoặc add replicas        |
| Memory usage        | > 80%          | Tăng RAM                          |
| DB connections      | > 20 (of 25)   | Tăng pool size hoặc read replicas |
| API latency P95     | > 2s           | Scale API, optimize queries       |
| Disk usage          | > 75%          | Expand volume, archive old data   |
| Concurrent users    | > 80% capacity | Plan migration to K8s             |

---

## Phụ Lục

### A. Quick Reference Commands

```bash
# === STAGING ===
make init-staging          # Tạo env files
make staging-up            # Start staging
make staging-up seed=true  # Start + seed data
make staging-down          # Stop staging
make staging-logs          # Xem all logs
make staging-logs s=api    # Xem API logs
make staging-restart       # Restart all
make staging-restart s=api # Restart API only
make staging-status        # Container status

# === PRODUCTION ===
make init-prod             # Tạo env files
make check-prod-env        # Validate env
make generate-secrets      # Generate secrets
make auto-ssl              # Self-signed SSL
make prod-up               # Start production
make prod-down             # Stop production
make prod-logs             # Xem all logs
make prod-restart          # Restart all

# === DATABASE ===
make migrate-prod          # Run migrations
make db-shell-prod         # PostgreSQL shell
make redis-shell-prod      # Redis shell

# === ADMIN ===
make bootstrap-admin-prod email=admin@domain.com
make list-tenants-prod
make assign-plan-prod tenant=<uuid> plan=enterprise
```

### B. Domain Configuration

```
DNS Records:
  app.yourdomain.com    → A    → Server IP
  api.yourdomain.com    → A    → Server IP
  admin.yourdomain.com  → A    → Server IP

  (Hoặc CNAME nếu dùng load balancer)
```

### C. Recommended Cloud Providers

| Provider         | Service          | Ghi chú                         |
| ---------------- | ---------------- | ------------------------------- |
| **Hetzner**      | VPS              | Giá rẻ nhất, EU datacenter      |
| **DigitalOcean** | Droplet/K8s      | Đơn giản, giá tốt               |
| **AWS**          | EC2/EKS/RDS      | Enterprise, nhiều region        |
| **GCP**          | GCE/GKE/CloudSQL | Tốt cho K8s                     |
| **Azure**        | VM/AKS           | Enterprise, Microsoft ecosystem |
