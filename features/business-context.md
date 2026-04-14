---
layout: default
title: Business Context (BU + Crown Jewels)
parent: Features
nav_order: 36
---

# Business Context — Business Units & Crown Jewels

Organize assets by business unit and mark critical assets as crown jewels for risk prioritization.

## Business Units

Organize assets into business departments for aggregated risk views.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/business-units` | List business units |
| GET | `/api/v1/business-units/{id}` | Get business unit detail |
| POST | `/api/v1/business-units` | Create business unit |
| PUT | `/api/v1/business-units/{id}` | Update business unit |
| DELETE | `/api/v1/business-units/{id}` | Delete business unit |

### Database

Table: `business_units` (migration 000126)

## Crown Jewels

Mark high-value assets that require additional protection and monitoring.

### How It Works

- Assets can be flagged as crown jewels via the asset detail page
- Crown jewel status influences risk scoring (higher weight)
- Dashboard highlights crown jewels with findings

### Database

Column `is_crown_jewel` on `assets` table + `crown_jewel_reason` text field.

## Current Status

- Backend: Full CRUD API implemented
- Frontend: Read wired to real API (mock removed)
- Pending: Create/edit/delete mutations need UI wiring

## Key Files

**Backend:**
- `api/internal/app/business_unit_service.go`
- `api/internal/infra/postgres/business_unit_repository.go`
- `api/internal/infra/http/handler/business_unit_handler.go`

**Frontend:**
- `ui/src/app/(dashboard)/(scoping)/business-units/page.tsx`
- `ui/src/app/(dashboard)/(scoping)/crown-jewels/page.tsx`
