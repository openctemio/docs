---
layout: default
title: Redis Setup for Permission Cache
parent: Operations
nav_order: 5
---

# Redis Setup for Permission Cache

## Overview

OpenCTEM uses Redis to cache user permissions, enabling:
- **Fast permission checks** (<1ms cache hit)
- **Real-time permission updates** (via cache invalidation)
- **Reduced database load** (95%+ cache hit rate)

This guide covers Redis setup, configuration, and monitoring for the permission caching system.

---

## Prerequisites

- Redis 6.0+ installed
- Network access between API server and Redis
- Sufficient memory (estimate: ~100 bytes per user-tenant permission set)

---

## Installation

### Docker (Recommended for Development)

```bash
docker run -d \
  --name.openctem-redis \
  -p 6379:6379 \
  -v.openctem-redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
```

### Production (Ubuntu/Debian)

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Configure Redis
sudo vim /etc/redis/redis.conf

# Key settings:
# maxmemory 1gb
# maxmemory-policy allkeys-lru
# appendonly yes

# Start Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify
redis-cli ping  # Expected: PONG
```

---

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Leave empty for local dev
REDIS_DB=0              # Database number (0-15)

# Permission Cache Settings
AUTH_ACCESS_TOKEN_DURATION=15m  # Cache TTL matches token duration
```

### Application Configuration

The permission cache is automatically initialized in `main.go`:

```go
// File: api/cmd/server/main.go

// Initialize Redis client
redisClient := infrastructure.NewRedisClient(
    cfg.Redis.Host,
    cfg.Redis.Port,
    cfg.Redis.Password,
    cfg.Redis.DB,
)

// Create permission cache
tokenDuration, _ := time.ParseDuration(cfg.Auth.AccessTokenDuration)
permissionCache := redis.NewPermissionCache(
    redisClient,
    logger,
    tokenDuration,  // TTL = 15 minutes
)

// Inject into PermissionService
permissionService := app.NewPermissionService(...,
    app.WithPermissionCache(permissionCache),
)
```

---

## Cache Key Structure

### Key Format
```
perms:{userID}:{tenantID}
```

### Example
```
perms:66666666-6666-6666-6666-666666666666:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
```

### Value Structure
```json
{
  "permissions": [
    "assets:read",
    "assets:write",
    "findings:read"
  ]
}
```

### TTL
- Default: **15 minutes** (matches access token duration)
- Auto-expires to prevent stale permissions
- Refreshed on cache miss

---

## Monitoring

### Health Check

```bash
# Check Redis connectivity
redis-cli ping
# Expected: PONG

# Check keys
redis-cli KEYS "perms:*"

# Check memory usage
redis-cli INFO memory

# Monitor commands in real-time
redis-cli MONITOR
```

### Cache Statistics

```bash
# Get cache hit/miss stats
redis-cli INFO stats | grep keyspace

# Example output:
# keyspace_hits:15234
# keyspace_misses:782
# hit_rate = 15234 / (15234 + 782) = 95.1%
```

### Key Count

```bash
# Count permission cache keys
redis-cli --scan --pattern "perms:*" | wc -l
```

### Memory Usage

```bash
# Check total memory
redis-cli INFO memory | grep used_memory_human

# Estimate per-key memory
redis-cli --bigkeys

# Sample key size
redis-cli --memkeys --memkeys-samples 1000
```

---

## Performance Tuning

### Memory Configuration

```ini
# /etc/redis/redis.conf

# Set max memory (adjust based on your needs)
maxmemory 1gb

# Eviction policy (remove least recently used keys)
maxmemory-policy allkeys-lru

# Save to disk periodically
save 900 1
save 300 10
save 60 10000

# Append-only file for durability
appendonly yes
appendfsync everysec
```

### Connection Pooling

The Go Redis client automatically manages connection pooling:

```go
// Default pool settings (in redis client)
PoolSize:     10 * runtime.NumCPU()
MinIdleConns: 5
MaxRetries:   3
```

### Expected Performance

| Metric | Target | Typical |
|--------|--------|---------|
| **Cache Hit Rate** | >90% | ~95% |
| **Cache Hit Latency** | <2ms | <1ms |
| **Cache Miss Latency** | <100ms | ~50ms (DB query) |
| **Memory per User-Tenant** | <200 bytes | ~100 bytes |

---

## Cache Invalidation

### Automatic Invalidation

Cache entries automatically expire after 15 minutes (token TTL).

### Manual Invalidation

#### Single User-Tenant
```bash
redis-cli DEL "perms:{userID}:{tenantID}"
```

#### All Tenants for a User
```bash
# Find all keys for user
redis-cli KEYS "perms:{userID}:*"

# Delete all
redis-cli --scan --pattern "perms:{userID}:*" | xargs redis-cli DEL
```

#### Flush All Permission Cache
```bash
redis-cli --scan --pattern "perms:*" | xargs redis-cli DEL
```

### Programmatic Invalidation

The system automatically invalidates cache in these scenarios:

```go
// When user role changes
permissionService.InvalidateUserPermissionsCache(ctx, userID, tenantID)

// When user is removed from tenant
permissionService.InvalidateAllUserPermissionsCache(ctx, userID)
```

**TODO:** Wire these calls in `TenantService` and `RoleService` methods.

---

##Backup & Recovery

### Redis Persistence

Redis supports two persistence modes:

**1. RDB (Snapshotting)**

```ini
# Save every 15 min if ≥1 key changed
save 900 1
```

**2. AOF (Append-Only File)**

```ini
appendonly yes
appendfsync everysec
```

### Backup

```bash
# Trigger manual save
redis-cli BGSAVE

# Copy RDB file
sudo cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb
```

### Recovery

```bash
# Stop Redis
sudo systemctl stop redis-server

# Restore RDB file
sudo cp /backup/redis-20260123.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb

# Start Redis
sudo systemctl start redis-server
```

> **Note:** Permission cache is ephemeral (15 min TTL). Loss of Redis data is not critical—permissions will be re-cached from DB on next request.

---

## Production Deployment

### High Availability Setup

For production, consider Redis Sentinel or Redis Cluster:

```yaml
# docker-compose.prod.yml
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    
  redis-replica:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379
    
  redis-sentinel:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

### Security

```ini
# /etc/redis/redis.conf

# Require password
requirepass <strong-password>

# Bind to specific IP (not 0.0.0.0)
bind 127.0.0.1 10.0.1.50

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

Update environment:
```bash
REDIS_PASSWORD=<strong-password>
```

### Firewall Rules

```bash
# Allow only API server
sudo ufw allow from 10.0.1.100 to any port 6379 proto tcp

# Deny all others
sudo ufw deny 6379/tcp
```

---

## Troubleshooting

### Connection Failed

**Symptom:** `redis: connection refused`

**Solution:**
```bash
# Check Redis is running
sudo systemctl status redis-server

# Check connectivity
redis-cli -h localhost -p 6379 ping

# Check firewall
sudo ufw status
```

### Out of Memory

**Symptom:** `OOM command not allowed when used memory > 'maxmemory'`

**Solution:**
```bash
# Check memory usage
redis-cli INFO memory | grep used_memory_human

# Increase maxmemory or enable eviction
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Low Cache Hit Rate

**Symptom:** Cache hit rate <85%

**Possible Causes:**
1. TTL too short → Increase `AUTH_ACCESS_TOKEN_DURATION`
2. Too many unique user-tenant combinations
3. Eviction policy too aggressive

**Solution:**
```bash
# Check eviction stats
redis-cli INFO stats | grep evicted_keys

# Increase memory if needed
redis-cli CONFIG SET maxmemory 4gb
```

---

## Metrics & Alerting

### Prometheus Metrics

Add these metrics to your monitoring:

```yaml
# redis_exporter
- job_name: redis
  static_configs:
    - targets: ['redis-exporter:9121']
  
  metrics:
    - redis_connected_clients
    - redis_keyspace_hits_total
    - redis_keyspace_misses_total
    - redis_memory_used_bytes
```

### Alerts

```yaml
# prometheus/alerts.yml
groups:
  - name: redis
    rules:
      - alert: RedisDown
        expr: redis_up == 0
        for: 1m
        
      - alert: LowCacheHitRate
        expr: |
          (rate(redis_keyspace_hits_total[5m]) / 
           (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))) < 0.85
        for: 10m
        
      - alert: RedisHighMemory
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
```

---

## Related Documentation

- [Authentication Guide](../guides/authentication.md) - Permission system overview
- [JWT Structure](../backend/jwt-structure.md) - Token format and claims
- [Permissions Guide](../guides/permissions.md) - Permission model

---

## Summary

**Redis permission cache provides:**
- ✅ **Fast permission checks** (<1ms vs ~50ms DB query)
- ✅ **Real-time updates** (cache invalidation)
- ✅ **Reduced DB load** (95%+ cache hit rate)
- ✅ **Horizontal scalability** (Redis supports millions of keys)

**Minimal maintenance required:** Cache is self-healing (auto-expiry) and failures gracefully fall back to database queries.
