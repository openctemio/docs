---
layout: default
title: Attack Paths
parent: Features
nav_order: 37
---

# Attack Path Analysis

Graph-based attack path visualization using asset relationships to identify lateral movement risks.

## Overview

Attack paths are computed from the asset relationship graph. The system traverses directed edges (e.g., `runs_on`, `depends_on`, `authenticates_to`) to identify chains of assets that an attacker could exploit to reach crown jewels.

## Features

- Relationship-based path discovery
- Summary statistics (total paths, critical paths, avg path length)
- Asset type breakdown in path nodes
- Choke point identification

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/attack-paths/summary` | Summary stats + path data |

## UI

Page: `/prioritization/attack-paths`

- Summary cards (total paths, critical, avg length)
- Relationship data required indicator
- Empty state when no relationships exist

## Relationship Types Used

Attack paths traverse these relationship types:
- `runs_on`, `deployed_to` — workload placement
- `depends_on` — runtime dependencies
- `authenticates_to` — auth chains
- `has_access_to`, `granted_to` — IAM paths
- `contains` — hierarchy traversal

## Key Files

- `ui/src/app/(dashboard)/(prioritization)/attack-paths/page.tsx`
- `api/internal/infra/http/handler/attack_path_handler.go`
