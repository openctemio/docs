---
layout: default
title: UI Documentation
has_children: true
nav_order: 5
---

# Project Documentation

Complete documentation for the Next.js 16 application with Multi-provider authentication (Local, OAuth, OIDC, SSO) and backend API integration.

## 📁 Documentation Structure

```
ui/docs/
├── README.md                        # This file
├── ARCHITECTURE.md                  # System architecture
├── ROADMAP.md                       # Future plans
│
├── guides/                          # Development Guides
│   ├── README.md
│   ├── API_INTEGRATION.md           # API Client Guide
│   ├── ASSETS_API_INTEGRATION.md    # Assets API Guide
│   ├── CUSTOMIZE_TYPES_GUIDE.md     # Type Customization
│   └── ORGANIZING_TYPES_AT_SCALE.md # Type Organization
│
├── features/                        # Feature Documentation
│   ├── README.md
│   ├── ACCOUNT_SETTINGS.md          # Account settings
│   └── ACCESS_CONTROL.md            # Access Control
│
├── ops/                             # Operations & Deployment
│   ├── README.md
│   ├── guides/getting-started.md                # Deployment Guide
│   ├── DOCKER_SENTRY_SETUP.md       # Docker & Sentry
│   ├── ENVIRONMENT_VARIABLES.md     # Env Vars
│   └── PRODUCTION_CHECKLIST.md      # Production Checklist
│
└── examples/                        # Code Examples
    └── types.custom.example.ts
```

---

## 🚀 Quick Start

### For New Developers

**1. Setup Project**
1. Read root [CLAUDE.md](../../CLAUDE.md) - Project overview & architecture
2. Read root [README.md](../../README.md) - Setup instructions
3. Configure environment variables ([ops/ENVIRONMENT_VARIABLES.md](./ops/ENVIRONMENT_VARIABLES.md))

**2. Setup Authentication**
1. [Authentication guide](../../guides/authentication.md) - Local JWT, OAuth social, and enterprise SSO
2. [SSO setup](../../guides/sso-setup.md) - Configure per-tenant SAML / OIDC / Entra ID

**3. Connect to Backend**
1. [guides/API_INTEGRATION.md](./guides/API_INTEGRATION.md) - Setup API client
2. [guides/CUSTOMIZE_TYPES_GUIDE.md](./guides/CUSTOMIZE_TYPES_GUIDE.md) - Customize types

**4. Deploy to Production**
1. [ops/PRODUCTION_CHECKLIST.md](./ops/PRODUCTION_CHECKLIST.md) - Pre-deployment checklist
2. [ops/guides/getting-started.md](./ops/guides/getting-started.md) - Deployment guide

---

## 📚 Documentation by Topic

### 🏗️ Architecture & Setup

**[Architecture](./architecture.md)**
- System architecture overview
- Frontend + Backend interaction
- State management

### 💻 Development Guides (`guides/`)

**[API_INTEGRATION.md](./guides/API_INTEGRATION.md)**
- Setup HTTP client with auto auth headers
- Configure SWR hooks for data fetching

**[CUSTOMIZE_TYPES_GUIDE.md](./guides/CUSTOMIZE_TYPES_GUIDE.md)**
- Match TypeScript types to your backend schema
- Override default types

**[ORGANIZING_TYPES_AT_SCALE.md](./guides/ORGANIZING_TYPES_AT_SCALE.md)**
- Organize types for large projects
- Domain-driven structure

### ✨ Features (`features/`)

**[Authentication](../../guides/authentication.md)**
- Local JWT (email/password) + OAuth social (Google/GitHub/Microsoft)
- Enterprise SSO: per-tenant SAML / OIDC / Microsoft Entra ID ([SSO setup](../../guides/sso-setup.md))

**[Access Control](./features/ACCESS_CONTROL.md)**
- Group-based permissions
- Role management

**[Account Settings](./features/ACCOUNT_SETTINGS.md)**
- User profile management
- Security (password, 2FA, sessions)
- Preferences (theme, language, notifications)

### 🚀 Operations (`ops/`)

**[guides/getting-started.md](./ops/guides/getting-started.md)**
- Deploy to Vercel, Docker, or VP
- Nginx & SSL configuration

**[ENVIRONMENT_VARIABLES.md](./ops/ENVIRONMENT_VARIABLES.md)**
- `NEXT_PUBLIC_*` vs server-only variables
- Security best practices

**[DOCKER_SENTRY_SETUP.md](./ops/DOCKER_SENTRY_SETUP.md)**
- Docker multi-stage build
- Sentry error tracking

**[PRODUCTION_CHECKLIST.md](./ops/PRODUCTION_CHECKLIST.md)**
- Go-live verification steps

---

## 🔍 Quick Reference

| Task | Documentation |
|------|---------------|
| **Setup project** | [README.md](../../README.md) |
| **Understand system** | [Architecture](./architecture.md) |
| **Configure env vars** | [ops/ENVIRONMENT_VARIABLES.md](./ops/ENVIRONMENT_VARIABLES.md) |
| **Add login/logout** | [Authentication guide](../../guides/authentication.md) |
| **Call backend API** | [guides/API_INTEGRATION.md](./guides/API_INTEGRATION.md) |
| **Customize types** | [guides/CUSTOMIZE_TYPES_GUIDE.md](./guides/CUSTOMIZE_TYPES_GUIDE.md) |
| **Account settings** | [features/ACCOUNT_SETTINGS.md](./features/ACCOUNT_SETTINGS.md) |
| **Deploy** | [ops/guides/getting-started.md](./ops/guides/getting-started.md) |

---

## 📖 External Resources

- **Next.js 16:** [nextjs.org/docs](https://nextjs.org/docs)
- **React 19:** [react.dev](https://react.dev)
- **Tailwind CSS:** [tailwindcss.com](https://tailwindcss.com)
- **Microsoft Entra ID:** [learn.microsoft.com/entra/identity](https://learn.microsoft.com/entra/identity/)

---
