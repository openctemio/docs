---
layout: default
title: Customize API Endpoints
parent: UI Guides
nav_order: 5
---

# Customize API Endpoints Guide

How to add or modify API endpoint integrations in the OpenCTEM UI.

---

## Overview

The OpenCTEM UI communicates with the Go backend through a typed API client. When adding new features or modifying existing endpoints, follow this guide to maintain consistency.

---

## Step 1: Define Types

Create TypeScript types that match the backend response:

```typescript
// src/features/my-feature/types.ts
export interface MyEntity {
  id: string
  name: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface MyEntityListResponse {
  data: MyEntity[]
  total: number
  page: number
  page_size: number
}
```

See [Customize Types Guide](./CUSTOMIZE_TYPES_GUIDE.md) for detailed type customization patterns.

---

## Step 2: Create API Hooks

Use SWR hooks for data fetching:

```typescript
// src/features/my-feature/hooks/use-my-entities.ts
import useSWR from 'swr'
import { apiClient } from '@/lib/api/client'
import type { MyEntityListResponse } from '../types'

export function useMyEntities(params?: { page?: number; search?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.search) searchParams.set('search', params.search)

  return useSWR<MyEntityListResponse>(
    `/api/v1/my-entities?${searchParams}`,
    (url) => apiClient.get(url)
  )
}
```

---

## Step 3: Create Mutation Hooks

For create/update/delete operations:

```typescript
// src/features/my-feature/hooks/use-create-my-entity.ts
import useSWRMutation from 'swr/mutation'
import { apiClient } from '@/lib/api/client'
import type { MyEntity } from '../types'

interface CreateInput {
  name: string
  status?: 'active' | 'inactive'
}

export function useCreateMyEntity() {
  return useSWRMutation<MyEntity, Error, string, CreateInput>(
    '/api/v1/my-entities',
    (url, { arg }) => apiClient.post(url, arg)
  )
}
```

---

## Step 4: Handle Errors

Use the standard error handling pattern:

```typescript
import { isApiError } from '@/lib/api/errors'

try {
  await trigger(input)
} catch (error) {
  if (isApiError(error)) {
    switch (error.status) {
      case 400:
        // Validation error
        break
      case 403:
        // Permission denied
        break
      case 409:
        // Conflict (duplicate)
        break
    }
  }
}
```

---

## Best Practices

1. **Match backend naming** — Use `snake_case` for API fields, convert in types if needed
2. **Use SWR for caching** — Automatic revalidation and caching
3. **Type everything** — No `any` types for API responses
4. **Handle loading states** — Use `isLoading`, `isValidating` from SWR
5. **Invalidate on mutation** — Call `mutate()` after create/update/delete

---

## Related Documentation

- [API Integration Guide](./API_INTEGRATION.md) — API client configuration
- [Customize Types Guide](./CUSTOMIZE_TYPES_GUIDE.md) — TypeScript type patterns
- [Assets API Integration](./ASSETS_API_INTEGRATION.md) — Real-world example
