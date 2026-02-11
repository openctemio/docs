---
layout: default
title: Admin UI
has_children: true
nav_order: 6
---

# Platform Admin UI Documentation

The Platform Admin UI is a Next.js 16 application for managing platform agents, jobs, tokens, and administrators.

---

## Overview

The Admin UI provides operational management for:

- **Platform Agents** - Monitor, drain, and manage shared agents
- **Jobs** - View, cancel, and retry platform jobs
- **Bootstrap Tokens** - Create and revoke agent registration tokens
- **Administrators** - Manage admin accounts and API keys
- **Audit Logs** - View all platform activity logs

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 (canary) | React framework |
| React | 19 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | Latest | Component library |
| Zustand | 5.x | State management |
| Sonner | Latest | Toast notifications |

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- Running Platform Admin API (default: `http://localhost:8080`)

### Quick Start

```bash
# Navigate to admin-ui directory
cd admin-ui

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API URL

# Start development server
npm run dev
```

Access at [http://localhost:3000](http://localhost:3000)

### Login

1. Obtain an admin API key from the platform
2. Enter the API key on the login page
3. API key is stored in memory (not persisted)

---

## Project Structure

```
admin-ui/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Dashboard (redirect)
│   │   ├── login/              # Login page
│   │   ├── (dashboard)/        # Protected routes
│   │   │   ├── layout.tsx      # Dashboard layout with sidebar
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   ├── agents/         # Agent management
│   │   │   ├── jobs/           # Job management
│   │   │   ├── tokens/         # Token management
│   │   │   ├── admins/         # Admin management
│   │   │   └── audit-logs/     # Audit log viewer
│   │   └── api/health/         # Health check endpoint
│   │
│   ├── components/
│   │   └── ui/                 # shadcn/ui components
│   │
│   ├── lib/
│   │   ├── api-client.ts       # API client singleton
│   │   └── utils.ts            # Utility functions
│   │
│   ├── stores/
│   │   └── auth-store.ts       # Zustand auth state
│   │
│   └── types/
│       └── api.ts              # API type definitions
│
├── public/                     # Static assets
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Development compose
├── docker-compose.prod.yml     # Production compose
└── package.json
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Platform Admin API URL | `http://localhost:8080` |

### Example `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## Docker Deployment

### Standalone Development (with hot reload)

```bash
cd admin-ui

# Start with docker-compose
docker-compose up

# Or build directly
docker build --target development -t admin-ui:dev .
docker run -p 3001:3000 -v $(pwd):/app admin-ui:dev
```

### Standalone Production

```bash
cd admin-ui

# Build and run
docker-compose -f docker-compose.prod.yml up --build

# Or build directly
docker build --target production \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  -t admin-ui:prod .
docker run -p 3001:3000 admin-ui:prod
```

### With Full Platform Stack (Recommended)

The admin-ui is integrated into the main platform docker-compose files in `setup/`.

**Staging:**

```bash
cd setup

# Copy environment files
cp environments/.env.admin-ui.staging.example .env.admin-ui.staging

# Start all services including admin-ui
docker compose -f docker-compose.staging.yml up -d

# Admin UI accessible at http://localhost:3001
```

**Production:**

```bash
cd setup

# Copy and configure environment files
cp environments/.env.admin-ui.prod.example .env.admin-ui.prod
# Edit .env.admin-ui.prod with your API URL (NEXT_PUBLIC_API_URL)

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Admin UI accessible via nginx reverse proxy
```

### Health Check

The app exposes `/api/health` for container health checks:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"2026-01-26T12:00:00.000Z"}
```

---

## Pages Reference

### Dashboard (`/`)

Overview with platform statistics:
- Total/online/offline agents
- Pending/running/completed jobs
- Jobs per minute
- Active tenants

### Agents (`/agents`)

- List all platform agents with status
- Filter by status (online, offline, draining, unhealthy)
- Filter by region
- Actions: View details, Drain, Uncordon, Delete

### Jobs (`/jobs`)

- List all platform jobs
- Filter by status, agent, tenant
- Actions: View details, Cancel, Retry

### Tokens (`/tokens`)

- List bootstrap tokens
- Create new tokens with:
  - Description
  - Max uses
  - Expiration (hours)
  - Allowed regions
- Revoke tokens

### Admins (`/admins`)

- List admin accounts
- Create new admins with roles:
  - `super_admin` - Full access
  - `ops_admin` - Operations only
  - `viewer` - Read-only
- Update admin details
- Rotate API keys
- Delete admins

### Audit Logs (`/audit-logs`)

- View all platform activity
- Filter by:
  - Action type
  - Actor type
  - Date range
- View detailed event information

---

## API Integration

The Admin UI connects to the Platform Admin API. Key endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/auth/validate` | GET | Validate API key |
| `/api/v1/admin/platform/stats` | GET | Platform statistics |
| `/api/v1/admin/agents` | GET | List agents |
| `/api/v1/admin/agents/:id/drain` | POST | Drain agent |
| `/api/v1/admin/agents/:id/uncordon` | POST | Uncordon agent |
| `/api/v1/admin/jobs` | GET | List jobs |
| `/api/v1/admin/jobs/:id/cancel` | POST | Cancel job |
| `/api/v1/admin/tokens` | GET/POST | List/create tokens |
| `/api/v1/admin/tokens/:id` | DELETE | Revoke token |
| `/api/v1/admin/admins` | GET/POST | List/create admins |
| `/api/v1/admin/admins/:id/rotate-key` | POST | Rotate API key |
| `/api/v1/admin/audit-logs` | GET | List audit logs |

---

## Authentication Flow

1. User enters API key on login page
2. API key is validated against `/api/v1/admin/auth/validate`
3. On success, admin info is stored in Zustand store
4. API key is attached to all requests via `X-Admin-API-Key` header
5. On logout, state is cleared from memory

Note: API key is stored in memory only, not in localStorage or cookies.

---

## Documentation

- **[User Guide](./user-guide.md)** - Complete guide for using the Admin UI
- [Platform Agents Overview](../features/platform-agents.md)
- [Platform Admin CLI](../guides/platform-admin.md)
- [Platform Agent Runbook](../operations/platform-agent-runbook.md)
