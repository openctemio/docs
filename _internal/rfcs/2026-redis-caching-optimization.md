---
layout: default
title: Redis Caching Optimization
parent: Implementation Plans
grand_parent: Architecture
nav_order: 2
---

# API Caching Optimization & Redis Integration Plan

**Status:** 📋 Planning
**Created:** 2026-01-24

---

## Goal

Optimize API response caching for the Next.js proxy layer to address:
- **Backend API response time**: Currently up to 874ms
- **Multi-instance deployment**: Prepare for 2+ Next.js instances on K8s
- **Scalability**: Transition from Docker Compose to Kubernetes
- **Performance**: Reduce load on Golang API backend

## Current State Analysis

### Client-Side Caching: ✅ **Already Optimized**

**Discovery**: The application is using **SWR (stale-while-revalidate)** library:
- Package: `"swr": "^2.3.7"` ([package.json:80](file:///Users/0xmanhnv/Data/Projects/openctemio/ui/package.json#L80))
- Comprehensive implementation in [hooks.ts](file:///Users/0xmanhnv/Data/Projects/openctemio/ui/src/lib/api/hooks.ts)

**SWR Configuration** ([hooks.ts:32-45](file:///Users/0xmanhnv/Data/Projects/openctemio/ui/src/lib/api/hooks.ts#L32-L45)):
```typescript
{
  revalidateOnFocus: false,        // ✅ Good: Don't refetch on tab focus
  revalidateOnReconnect: true,     // ✅ Good: Refresh on network reconnect
  shouldRetryOnError: true,        // ✅ Good: Retry failed requests
  errorRetryCount: 3,              // ✅ Good: Max 3 retries
  dedupingInterval: 2000,          // ✅ Good: Dedupe requests within 2s
  // ...error handling
}
```

**Advanced Features Already Implemented**:
- ✅ Infinite scrolling (`useSWRInfinite`)
- ✅ Mutations (`useSWRMutation`)
- ✅ Optimistic updates
- ✅ Request deduplication
- ✅ Automatic cache revalidation

> **Assessment**: Client-side caching is **already excellent**. SWR provides browser-level caching that prevents duplicate API calls and implements stale-while-revalidate pattern effectively.

---

### Server-Side Caching: ❌ **Missing**

**Current Proxy**: [route.ts](file:///Users/0xmanhnv/Data/Projects/openctemio/ui/src/app/api/v1/%5B...path%5D/route.ts)
- ❌ No caching layer
- ❌ Every request hits Golang API (even if identical)
- ❌ No shared cache across instances

**Impact with 2+ instances**:
- User A on Instance 1 fetches `/api/v1/users/me` → hits backend
- User A on Instance 2 (after load balancer switch) → hits backend again
- Result: **Cache miss, wasted backend call**

---

## Security Considerations

> [!CAUTION]
> **Critical Security Requirements**
> 
> Caching introduces security risks that MUST be addressed:
> - Cache poisoning attacks
> - Sensitive data leakage
> - Multi-tenant data isolation
> - Redis security hardening

### 1. Sensitive Data Protection

**Risk**: Caching sensitive data (tokens, passwords, PII) in Redis

**Mitigation**:

**Never cache these endpoints**:
```typescript
const NEVER_CACHE = [
  '/auth/*',           // Authentication endpoints
  '/users/me/tokens',  // API tokens
  '/users/me/sessions', // Session data
  '/billing/*',        // Payment info
  '/secrets/*',        // Any secrets
  '/api-keys/*',       // API keys
]
```

**Cache with strict TTL for sensitive data**:
```typescript
const CACHE_CONFIG = {
  '/users/me': { 
    ttl: 60,              // Only 1 minute (not 5)
    tags: ['user'],
    requireAuth: true,    // Only cache authenticated requests
  },
  '/permissions': { 
    ttl: 300,             // 5 minutes
    tags: ['permissions'],
    requireAuth: true,
  },
  // Public data can have longer TTL
  '/vulnerabilities': { 
    ttl: 3600,            // 1 hour - public CVE data
    tags: ['vulns'],
    requireAuth: false,
  },
}
```

**Sanitize response before caching**:
```typescript
function sanitizeBeforeCache(data: any, endpoint: string): any {
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'api_key', 'refresh_token']
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data }
    for (const field of sensitiveFields) {
      delete sanitized[field]
    }
    return sanitized
  }
  
  return data
}
```

---

### 2. Cache Poisoning Prevention

**Risk**: Attacker injects malicious data into cache

**Attack Scenario**:
1. Attacker sends request with malicious payload
2. Backend validates but cache doesn't
3. Malicious response cached
4. Other users receive poisoned data

**Mitigation**:

**Only cache successful, validated responses**:
```typescript
// Only cache 200 OK responses, not 201, 202, etc.
if (shouldCache && response.status === 200 && response.ok) {
  // Additional validation
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    try {
      const data = JSON.parse(responseText)
      
      // Validate response structure
      if (isValidCacheableResponse(data, path)) {
        await cacheManager.set(cacheKey, data, cacheConfig)
      } else {
        console.warn('[Cache] Response validation failed, not caching')
      }
    } catch (e) {
      // Don't cache invalid JSON
      console.error('[Cache] Invalid JSON, not caching:', e)
    }
  }
}

function isValidCacheableResponse(data: any, path: string): boolean {
  // Implement response validation based on endpoint
  // Reject responses with unexpected structure
  
  if (path === '/users/me') {
    // Must have id, email fields
    return data?.id && data?.email
  }
  
  // Add validation for other endpoints
  return true
}
```

---

### 3. Multi-Tenant Isolation

**Risk**: User A sees cached data from Tenant B

**Critical Requirement**: Cache keys MUST include tenant ID

**Vulnerable code (DON'T DO THIS)**:
```typescript
// ❌ WRONG: No tenant isolation
const cacheKey = `proxy:${path}:${url.search}`
```

**Secure implementation**:
```typescript
// ✅ CORRECT: Include tenant ID in cache key
async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/')
  
  // Extract tenant ID from request
  const tenantId = request.headers.get('x-tenant-id')
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get(TENANT_COOKIE)?.value
  
  let tenantIdForCache = tenantId
  if (!tenantIdForCache && tenantCookie) {
    try {
      const tenantInfo = JSON.parse(tenantCookie)
      tenantIdForCache = tenantInfo.id
    } catch {
      console.error('[Cache] Failed to parse tenant cookie')
    }
  }
  
  // CRITICAL: Include tenant ID in cache key
  const cacheKey = tenantIdForCache 
    ? `proxy:tenant:${tenantIdForCache}:${path}:${url.search}`
    : null // Don't cache if no tenant ID
  
  if (!cacheKey) {
    console.warn('[Cache] No tenant ID, skipping cache')
    // Continue without cache
  }
  
  // ... rest of caching logic
}
```

**Tag-based invalidation with tenant isolation**:
```typescript
// When invalidating by tag, include tenant ID
async invalidateUserCache(tenantId: string, userId: string) {
  await cacheManager.invalidateByTag(`tenant:${tenantId}:user:${userId}`)
}

// Cache with tenant-scoped tags
await cacheManager.set(cacheKey, data, {
  ttl: 300,
  tags: [`tenant:${tenantId}:user`, `tenant:${tenantId}:permissions`]
})
```

---

### 4. Redis Security Hardening

**Risk**: Unauthorized access to Redis, data breach

**Production Redis Configuration**:

```yaml
# docker-compose.prod.yml
services:
  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --protected-mode yes
      --bind 127.0.0.1         # Only local connections
      --tcp-backlog 511
      --timeout 300
      --tcp-keepalive 60
      --loglevel notice
      --databases 1             # Only 1 database needed
      --save 900 1              # Snapshot every 15min if 1 key changed
      --save 300 10             # Snapshot every 5min if 10 keys changed
      --save 60 10000           # Snapshot every 1min if 10k keys changed
      --rename-command FLUSHDB ""  # Disable dangerous commands
      --rename-command FLUSHALL ""
      --rename-command CONFIG ""
      --rename-command KEYS ""
    networks:
      - internal              # Not exposed to public
    volumes:
      - redis-data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp

networks:
  internal:
    driver: bridge
    internal: true            # No external access
```

**K8s Network Policy** (isolate Redis):
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-network-policy
spec:
  podSelector:
    matchLabels:
      app: redis
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ui              # Only Next.js pods can access
    ports:
    - protocol: TCP
      port: 6379
```

**Environment Variables** (never hardcode):
```bash
# .env.production
REDIS_HOST=redis              # Internal service name
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}  # From secrets manager
REDIS_TLS=true                # Enable TLS in production
REDIS_DB=0
```

**Connection with TLS**:
```typescript
import Redis from 'ioredis'
import fs from 'fs'

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // Production: Enable TLS
  tls: process.env.REDIS_TLS === 'true' ? {
    ca: fs.readFileSync('/path/to/ca.crt'),
    rejectUnauthorized: true
  } : undefined,
  
  // Security: Strict mode
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) return null
    return Math.min(times * 100, 3000)
  },
  
  // Connection pool limits
  lazyConnect: false,
  keepAlive: 30000,
  
  // Prevent command injection
  enableOfflineQueue: false,
})

// Validate commands (prevent injection)
redis.on('error', (err) => {
  console.error('[Redis] Error:', err)
  // Alert security team on suspicious errors
})
```

---

### 5. Cache Key Security

**Risk**: Predictable cache keys allow enumeration attacks

**Vulnerable**:
```typescript
// ❌ Predictable pattern
const cacheKey = `user:${userId}`
// Attacker can guess: user:1, user:2, user:3...
```

**Secure**:
```typescript
// ✅ Include HMAC for validation
import crypto from 'crypto'

function generateSecureCacheKey(
  tenantId: string, 
  path: string, 
  search: string
): string {
  const secret = process.env.CACHE_KEY_SECRET || 'change-me-in-production'
  
  const data = `${tenantId}:${path}:${search}`
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
    .substring(0, 16) // First 16 chars
  
  return `proxy:${tenantId}:${hmac}:${path}:${search}`
}
```

---

### 6. Rate Limiting & DoS Prevention

**Risk**: Cache flooding attack (fill Redis with junk data)

**Mitigation**:

```typescript
// Rate limit cache writes per tenant
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

async function checkCacheRateLimit(tenantId: string): Promise<boolean> {
  const limit = 1000 // Max 1000 cache writes per minute
  const window = 60 * 1000 // 1 minute
  
  const now = Date.now()
  const current = rateLimiter.get(tenantId)
  
  if (!current || now > current.resetAt) {
    rateLimiter.set(tenantId, { count: 1, resetAt: now + window })
    return true
  }
  
  if (current.count >= limit) {
    console.warn(`[Cache] Rate limit exceeded for tenant: ${tenantId}`)
    return false
  }
  
  current.count++
  return true
}

// Before caching
if (shouldCache) {
  if (!(await checkCacheRateLimit(tenantId))) {
    console.warn('[Cache] Rate limit hit, not caching')
    return proxyResponse // Return without caching
  }
  
  await cacheManager.set(cacheKey, data, cacheConfig)
}
```

**Redis maxmemory protection**:
```bash
# Prevent memory exhaustion
redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

---

### 7. Audit Logging

**Requirement**: Log all cache operations for security monitoring

```typescript
// lib/cache/audit-logger.ts
export interface CacheAuditLog {
  timestamp: Date
  action: 'GET' | 'SET' | 'DELETE' | 'INVALIDATE'
  tenantId: string
  userId?: string
  key: string
  hit: boolean
  ttl?: number
  ip?: string
}

export async function logCacheOperation(log: CacheAuditLog) {
  // Log to security monitoring system
  console.log('[Cache Audit]', JSON.stringify(log))
  
  // Send to SIEM/logging service if configured
  if (process.env.SIEM_ENDPOINT) {
    await fetch(process.env.SIEM_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(log),
    }).catch(err => console.error('Failed to send audit log:', err))
  }
}
```

**Usage**:
```typescript
// log every cache access
if (cached) {
  await logCacheOperation({
    timestamp: new Date(),
    action: 'GET',
    tenantId,
    key: cacheKey,
    hit: true,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  })
}
```

---

### 8. Security Checklist

Before deploying Phase 2 (Redis caching), verify:

- [ ] Redis password authentication enabled
- [ ] Redis not exposed to public internet
- [ ] TLS enabled for Redis connections in production
- [ ] Dangerous commands disabled (FLUSHDB, CONFIG, KEYS)
- [ ] Cache keys include tenant ID (multi-tenant isolation)
- [ ] Sensitive endpoints excluded from caching
- [ ] Response validation before caching
- [ ] Rate limiting implemented
- [ ] Audit logging configured
- [ ] Redis maxmemory policy set to LRU
- [ ] Network policies applied (K8s)
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented
- [ ] Cache encryption at rest (if storing PII)
- [ ] Secrets stored in secure vault (not .env files)

---

## Proposed Changes

### Phase 1: Optimize Current Setup (No Infrastructure Changes)

**Goal**: Improve performance without adding new services

#### 1.1 Connection Pooling

**NEW**: `ui/src/lib/api/http-agent.ts`
```typescript
// HTTP agent for connection pooling to backend
import http from 'http'

export const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
})
```

**MODIFY**: `ui/src/app/api/v1/[...path]/route.ts:158`
```typescript
const response = await fetch(backendUrl, {
  method: request.method,
  headers,
  body: ...,
  // @ts-ignore - Node.js specific option
  agent: httpAgent, // Add connection pooling
})
```

**Benefits**:
- Reuse TCP connections to backend
- Reduce connection overhead (~20-50ms per request)
- Zero infrastructure changes

---

#### 1.2 Request Timeout & Circuit Breaker

**MODIFY**: `ui/src/app/api/v1/[...path]/route.ts:156-163`
```typescript
try {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
  
  const response = await fetch(backendUrl, {
    method: request.method,
    headers,
    body: ...,
    signal: controller.signal,
  })
  
  clearTimeout(timeoutId)
  // ...rest of code
}
```

**Benefits**:
- Prevent hanging requests
- Fail fast for slow backend responses
- Better error handling

---

#### 1.3 Compression

**MODIFY**: `ui/src/app/api/v1/[...path]/route.ts:148-154`
```typescript
const forwardHeaders = [
  'accept',
  'accept-language',
  'accept-encoding', // Add this for compression
  'x-tenant-id',
  'x-csrf-token'
]
```

**Benefits**:
- Reduce payload size (gzip/brotli)
- Faster data transfer
- Lower bandwidth usage

---

### Phase 2: Add Redis Caching Layer (For K8s Multi-Instance)

**Goal**: Shared cache across Next.js instances

#### 2.1 Infrastructure Setup

**NEW**: `ui/docker-compose.redis.yml`
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
```

**NEW**: K8s manifests (for future migration)
```yaml
# k8s/redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  ports:
  - port: 6379
  selector:
    app: redis
```

---

#### 2.2 Cache Implementation

**Dependencies**:
```bash
npm install ioredis
npm install -D @types/ioredis
```

**NEW**: `ui/src/lib/cache/redis-client.ts`
```typescript
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    if (times > 3) return null // Stop retrying
    return Math.min(times * 100, 3000)
  },
  maxRetriesPerRequest: 3,
})

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err)
})

export default redis
```

**NEW**: `ui/src/lib/cache/cache-manager.ts`
```typescript
import redis from './redis-client'

export interface CacheConfig {
  ttl?: number // seconds
  tags?: string[]
}

export class CacheManager {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key)
      if (!cached) return null
      return JSON.parse(cached) as T
    } catch (error) {
      console.error('[Cache] Get error:', error)
      return null // Fail gracefully
    }
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, config?: CacheConfig): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (config?.ttl) {
        await redis.setex(key, config.ttl, serialized)
      } else {
        await redis.set(key, serialized)
      }

      // Store tags for cache invalidation
      if (config?.tags) {
        for (const tag of config.tags) {
          await redis.sadd(`tag:${tag}`, key)
        }
      }
    } catch (error) {
      console.error('[Cache] Set error:', error)
      // Fail silently, don't break request
    }
  }

  /**
   * Invalidate by tag (e.g., when user updated, invalidate all user:* keys)
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const keys = await redis.smembers(`tag:${tag}`)
      if (keys.length > 0) {
        await redis.del(...keys)
        await redis.del(`tag:${tag}`)
      }
    } catch (error) {
      console.error('[Cache] Invalidate error:', error)
    }
  }

  /**
   * Delete specific key
   */
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      console.error('[Cache] Delete error:', error)
    }
  }
}

export const cacheManager = new CacheManager()
```

---

#### 2.3 Integrate Cache into Proxy (SECURITY-HARDENED)

**MODIFY**: `ui/src/app/api/v1/[...path]/route.ts:71-248`

```typescript
import { cacheManager } from '@/lib/cache/cache-manager'
import { generateSecureCacheKey, sanitizeBeforeCache, isValidCacheableResponse } from '@/lib/cache/security'
import { logCacheOperation } from '@/lib/cache/audit-logger'
import crypto from 'crypto'

// Cache configuration by endpoint pattern (SECURITY: Reduced TTL for sensitive data)
const CACHE_CONFIG = {
  '/users/me': { ttl: 60, tags: ['user'], requireAuth: true },  // 1 min (was 5)
  '/permissions/version': { ttl: 300, tags: ['permissions'], requireAuth: true }, // 5 mins
  '/tenants': { ttl: 180, tags: ['tenants'], requireAuth: true }, // 3 mins (was 5)
  '/vulnerabilities': { ttl: 3600, tags: ['vulns'], requireAuth: false }, // 1 hour - public
  
  // SECURITY: Never cache these (explicit deny list)
  '/auth/*': null,
  '/users/me/tokens': null,
  '/users/me/sessions': null,
  '/billing/*': null,
  '/secrets/*': null,
  '/api-keys/*': null,
  '/commands/*': null,
  '/scans/*': null, // Real-time data
}

function getCacheConfig(path: string) {
  // Check deny list first
  const denyPatterns = ['/auth/', '/tokens', '/sessions', '/billing/', '/secrets/', '/api-keys/']
  if (denyPatterns.some(pattern => path.includes(pattern))) {
    return null // Never cache
  }
  
  for (const [pattern, config] of Object.entries(CACHE_CONFIG)) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      if (path.startsWith(prefix)) return config
    } else if (path === pattern || path.startsWith(pattern + '/')) {
      return config
    }
  }
  return null // Default: no cache
}

// SECURITY: Generate HMAC-based cache key with tenant isolation
function generateSecureCacheKey(
  tenantId: string,
  path: string,
  search: string
): string {
  const secret = process.env.CACHE_KEY_SECRET || crypto.randomBytes(32).toString('hex')
  const data = `${tenantId}:${path}:${search}`
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex').substring(0, 16)
  return `proxy:t:${tenantId}:${hmac}:${path}:${search}`
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const path = params.path.join('/')
  const url = new URL(request.url)
  const backendUrl = `${BACKEND_URL}/api/v1/${path}${url.search}`
  
  // SECURITY: Extract tenant ID (critical for multi-tenant isolation)
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get(TENANT_COOKIE)?.value
  let tenantId: string | null = null
  
  if (tenantCookie) {
    try {
      const tenantInfo = JSON.parse(tenantCookie)
      tenantId = tenantInfo.id
    } catch {
      console.error('[Cache] Failed to parse tenant cookie - no cache')
    }
  }
  
  // Also check header
  const tenantIdHeader = request.headers.get('x-tenant-id')
  if (tenantIdHeader && !tenantId) {
    tenantId = tenantIdHeader
  }
  
  // SECURITY: Only cache if we have tenant ID (prevents cross-tenant leaks)
  const cacheConfig = getCacheConfig(path)
  const shouldCache = request.method === 'GET' && 
                      cacheConfig !== null && 
                      tenantId !== null
  
  // Try cache first
  let cacheKey: string | null = null
  if (shouldCache && tenantId) {
    cacheKey = generateSecureCacheKey(tenantId, path, url.search)
    
    try {
      const cached = await cacheManager.get(cacheKey)
      if (cached) {
        console.log('[Proxy] Cache HIT:', cacheKey)
        
        // Audit log
        await logCacheOperation({
          timestamp: new Date(),
          action: 'GET',
          tenantId,
          key: cacheKey,
          hit: true,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        })
        
        return NextResponse.json(cached, { status: 200 })
      }
      console.log('[Proxy] Cache MISS:', cacheKey)
    } catch (error) {
      console.error('[Cache] Get error:', error)
      // Continue without cache on error
    }
  } else if (request.method === 'GET' && !tenantId) {
    console.warn('[Cache] No tenant ID - skipping cache for security')
  }
  
  // ... existing auth token logic ...
  
  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: ...,
    })
    
    // ... existing response handling ...
    
    // SECURITY: Only cache successful, validated responses
    if (shouldCache && response.status === 200 && response.ok && cacheKey && tenantId) {
      try {
        const contentType = response.headers.get('content-type')
        
        // Only cache JSON responses
        if (contentType?.includes('application/json')) {
          const data = JSON.parse(responseText)
          
          // SECURITY: Validate response structure before caching
          if (isValidCacheableResponse(data, path)) {
            // SECURITY: Sanitize sensitive fields
            const sanitized = sanitizeBeforeCache(data, path)
            
            // SECURITY: Tenant-scoped tags
            const tagsWithTenant = cacheConfig.tags?.map(
              tag => `tenant:${tenantId}:${tag}`
            )
            
            await cacheManager.set(cacheKey, sanitized, {
              ttl: cacheConfig.ttl,
              tags: tagsWithTenant,
            })
            
            console.log('[Proxy] Cached:', cacheKey, 'TTL:', cacheConfig.ttl)
            
            // Audit log
            await logCacheOperation({
              timestamp: new Date(),
              action: 'SET',
              tenantId,
              key: cacheKey,
              hit: false,
              ttl: cacheConfig.ttl,
              ip: request.headers.get('x-forwarded-for') || 'unknown',
            })
          } else {
            console.warn('[Cache] Response validation failed - not caching')
          }
        }
      } catch (e) {
        // Don't fail request if cache fails
        console.error('[Proxy] Cache set failed:', e)
      }
    }
    
    return proxyResponse
  } catch (error) {
    // ... existing error handling ...
  }
}
```

**NEW**: `ui/src/lib/cache/security.ts`
```typescript
// Security utilities for cache
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'api_key', 'refresh_token',
  'access_token', 'private_key', 'ssn', 'credit_card'
]

export function sanitizeBeforeCache(data: any, endpoint: string): any {
  if (typeof data !== 'object' || data === null) return data
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data }
  
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      delete sanitized[field]
    }
  }
  
  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeBeforeCache(sanitized[key], endpoint)
    }
  }
  
  return sanitized
}

export function isValidCacheableResponse(data: any, path: string): boolean {
  if (!data || typeof data !== 'object') return false
  
  // Validate based on endpoint
  if (path === '/users/me') {
    return !!(data.id && data.email)
  }
  
  if (path.startsWith('/permissions')) {
    return Array.isArray(data) || !!(data.version)
  }
  
  // Default: basic validation
  return true
}
```
```

**Benefits**:
- Shared cache across instances
- Reduce backend API load by 40-70%
- Tag-based invalidation (e.g., invalidate all user data when user updates)
- Graceful degradation (if Redis fails, proxy still works)

---

### Phase 3: Cache Invalidation Strategy

**NEW**: `ui/src/app/api/v1/cache/route.ts`
```typescript
// Internal endpoint for cache invalidation (called after mutations)
import { cacheManager } from '@/lib/cache/cache-manager'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tag = searchParams.get('tag')
  const key = searchParams.get('key')
  
  if (tag) {
    await cacheManager.invalidateByTag(tag)
    return NextResponse.json({ message: `Invalidated tag: ${tag}` })
  }
  
  if (key) {
    await cacheManager.delete(key)
    return NextResponse.json({ message: `Deleted key: ${key}` })
  }
  
  return NextResponse.json({ error: 'Missing tag or key' }, { status: 400 })
}
```

**Usage in SWR mutations**:
```typescript
// After successful mutation, invalidate cache
export function useUpdateCurrentUser() {
  return useSWRMutation(
    endpoints.users.updateMe(),
    async (url, { arg }: { arg: UpdateUserRequest }) => {
      const result = await put<User>(url, arg)
      
      // Invalidate user cache
      await fetch('/api/v1/cache?tag=user', { method: 'DELETE' })
      
      return result
    }
  )
}
```

---

### Phase 4: Monitoring & Observability

**NEW**: `ui/src/lib/cache/metrics.ts`
```typescript
// Cache metrics for monitoring
export class CacheMetrics {
  private hits = 0
  private misses = 0
  private errors = 0
  
  recordHit() { this.hits++ }
  recordMiss() { this.misses++ }
  recordError() { this.errors++ }
  
  getStats() {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%',
    }
  }
  
  reset() {
    this.hits = 0
    this.misses = 0
    this.errors = 0
  }
}

export const cacheMetrics = new CacheMetrics()
```

**NEW**: `ui/src/app/api/v1/cache/stats/route.ts`
```typescript
import { cacheMetrics } from '@/lib/cache/metrics'
import { NextResponse } from 'next/server'
import redis from '@/lib/cache/redis-client'

export async function GET() {
  const stats = cacheMetrics.getStats()
  const redisInfo = await redis.info('stats')
  
  return NextResponse.json({
    cache: stats,
    redis: {
      connected: redis.status === 'ready',
      info: redisInfo,
    },
  })
}
```

---

## Environment Variables

**NEW**: `.env.local`
```bash
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional, for production
REDIS_DB=0

# Cache Settings
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300  # 5 minutes
```

**UPDATE**: `ui/src/lib/env.ts`
```typescript
export const env = {
  // ... existing ...
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    redisHost: process.env.REDIS_HOST || '127.0.0.1',
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
    redisPassword: process.env.REDIS_PASSWORD,
    defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
  },
}
```

---

## Verification Plan

### Phase 1 Testing (Local Development)

**1. Connection Pooling Test**
```bash
# Terminal 1: Start dev server
cd ui
npm run dev

# Terminal 2: Load test
npm install -g autocannon
autocannon -c 50 -d 10 http://localhost:3000/api/v1/users/me

# Expected: Lower latency due to connection reuse
# Before: ~100ms average
# After: ~70-80ms average
```

**2. Timeout & Circuit Breaker Test**
```bash
# Simulate slow backend (add delay in Go API)
# Or use network throttling

# Expected: 
# - Requests timeout after 10s
# - Proper error response (502 Gateway Timeout)
```

---

### Phase 2 Testing (Redis Cache)

**1. Start Redis**
```bash
cd ui
docker-compose -f docker-compose.redis.yml up -d

# Verify Redis is running
docker exec -it ui-redis-1 redis-cli ping
# Expected: PONG
```

**2. Cache Hit/Miss Test**
```bash
# First request (cache miss)
curl http://localhost:3000/api/v1/users/me
# Check logs: "[Proxy] Cache MISS: proxy:users/me:"

# Second request (cache hit)
curl http://localhost:3000/api/v1/users/me
# Check logs: "[Proxy] Cache HIT: proxy:users/me:"

# Verify from Redis directly
docker exec -it ui-redis-1 redis-cli
> KEYS proxy:*
> GET proxy:users/me:
```

**3. Cache Invalidation Test**
```bash
# Update user profile (should invalidate cache)
curl -X PUT http://localhost:3000/api/v1/users/me \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Next GET should be cache MISS
curl http://localhost:3000/api/v1/users/me
# Check logs: "[Proxy] Cache MISS: ..."
```

**4. Cache Metrics Test**
```bash
# After some requests, check stats
curl http://localhost:3000/api/v1/cache/stats

# Expected response:
{
  "cache": {
    "hits": 45,
    "misses": 12,
    "errors": 0,
    "hitRate": "78.95%"
  },
  "redis": {
    "connected": true
  }
}
```

---

### Phase 3 Testing (Multi-Instance Simulation)

**1. Start 2 Next.js instances**
```bash
# Terminal 1
PORT=3000 npm run dev

# Terminal 2  
PORT=3001 npm run dev

# Both should connect to same Redis
```

**2. Shared Cache Test**
```bash
# Request from instance 1
curl http://localhost:3000/api/v1/users/me
# Check logs: Cache MISS

# Request from instance 2 (should hit cache)
curl http://localhost:3001/api/v1/users/me
# Check logs: Cache HIT

# Verify: Both instances share cache
```

---

### Phase 4 Testing (K8s Deployment)

**Prerequisites**: K8s cluster ready

**1. Deploy Redis**
```bash
kubectl apply -f k8s/redis-deployment.yaml
kubectl get pods | grep redis
# Expected: redis-xxx Running
```

**2. Deploy Next.js with 2 replicas**
```bash
kubectl apply -f k8s/ui-deployment.yaml
kubectl scale deployment ui --replicas=2
kubectl get pods | grep ui
# Expected: ui-xxx-1 Running, ui-xxx-2 Running
```

**3. Load Test**
```bash
# Get LoadBalancer IP
kubectl get svc ui

# Run load test
autocannon -c 100 -d 30 http://<LB_IP>/api/v1/users/me

# Expected:
# - High cache hit rate (>70%)
# - No duplicate backend calls
# - Consistent response times
```

---

## Performance Benchmarks

**Target Metrics**:

| Metric | Before | After Phase 1 | After Phase 2 |
|--------|--------|---------------|---------------|
| Avg Response Time | 874ms | 650ms | 150ms |
| P95 Response Time | 1200ms | 900ms | 250ms |
| Backend API Calls | 100% | 100% | 30-40% |
| Cache Hit Rate | N/A | N/A | >70% |

---

## Rollback Plan

### Phase 1
- Remove connection pooling agent (single line change)
- Remove timeout logic (restore original fetch)
- Zero risk, no dependencies

### Phase 2  
- Set `CACHE_ENABLED=false` in env
- Cache layer will be bypassed
- Keep Redis running (no data loss)

### Phase 3
- Stop Redis service
- Remove Redis from docker-compose
- Proxy falls back to direct backend calls

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Phase 1: Optimize current setup | Low | 2-3 hours |
| Phase 2: Redis integration | Medium | 1 day |
| Phase 3: Cache invalidation | Low | 3-4 hours |
| Phase 4: Monitoring | Low | 2-3 hours |
| **Total** | | **1.5-2 days** |

---

## Recommendations

### Phased Rollout (Recommended)

1. ✅ **Start with Phase 1** (this week)
   - Low risk, immediate improvement
   - No infrastructure changes
   - Test in production

2. ✅ **Add Phase 2** (before K8s migration)
   - Add Redis to docker-compose
   - Test with 2 instances locally
   - Measure cache hit rate

3. ✅ **Deploy to K8s** (after validation)
   - Use same Redis setup
   - Scale to 2+ instances
   - Monitor metrics

---

## Related Documentation

- [API Proxy Implementation](file:///Users/0xmanhnv/Data/Projects/openctemio/ui/src/app/api/v1/%5B...path%5D/route.ts)
- [SWR Hooks](file:///Users/0xmanhnv/Data/Projects/openctemio/ui/src/lib/api/hooks.ts)
- [Docker Compose Setup](file:///Users/0xmanhnv/Data/Projects/openctemio/ui/docker-compose.yml)

---

## Decision Log

**2026-01-24**: Initial plan created
- Assessed client-side caching (SWR) - already optimal
- Identified server-side caching gap
- Designed 4-phase implementation strategy
- Target: 874ms → 150ms response time
- Preparation for K8s multi-instance deployment
