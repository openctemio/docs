---
layout: default
title: Troubleshooting Guide
nav_order: 8
---
# Troubleshooting Guide

Common issues and their solutions for OpenCTEM development and deployment.

## Quick Diagnosis

```bash
# Check all services status
docker compose ps

# Check service logs
docker compose logs -f [service_name]

# Backend health
curl http://localhost:8080/health

# Database connection
docker compose exec postgres pg_isready -U.openctem

# Redis connection
docker compose exec redis redis-cli ping
```

---

## Installation Issues

### Docker Compose Fails to Start

**Symptom:** `docker compose up` fails with errors

**Solutions:**

1. **Check Docker is running:**
   ```bash
   docker info
   ```

2. **Check port conflicts:**
   ```bash
   # Find processes using required ports
   lsof -i :3000   # Frontend
   lsof -i :8080   # Backend
   lsof -i :5432   # PostgreSQL
   lsof -i :6379   # Redis
   ```

3. **Clean Docker resources:**
   ```bash
   docker compose down -v
   docker system prune -f
   docker compose up -d
   ```

### Node Modules Issues

**Symptom:** `npm install` fails or `node_modules` corrupted

**Solution:**
```bash
cd ui

# Remove existing modules
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Fresh install
npm install
```

### Go Module Issues

**Symptom:** `go build` fails with module errors

**Solution:**
```bash
cd api

# Clear module cache
go clean -modcache

# Re-download dependencies
go mod download

# Tidy modules
go mod tidy
```

---

## Backend Issues

### Database Connection Failed

**Symptom:**
```
failed to connect to database: dial tcp 127.0.0.1:5432: connect: connection refused
```

**Solutions:**

1. **Check PostgreSQL is running:**
   ```bash
   docker compose ps postgres
   docker compose logs postgres
   ```

2. **Verify connection settings:**
   ```bash
   # In .env file
   DB_HOST=localhost      # Use 'postgres' if running in Docker network
   DB_PORT=5432
   DB_USER.openctem
   DB_PASSWORD=secret
   DB_NAME.openctem
   ```

3. **Test connection manually:**
   ```bash
   docker compose exec postgres psql -U.openctem -d.openctem -c "SELECT 1"
   ```

4. **Restart PostgreSQL:**
   ```bash
   docker compose restart postgres
   ```

### Redis Connection Failed

**Symptom:**
```
redis: connection refused
```

**Solutions:**

1. **Check Redis is running:**
   ```bash
   docker compose ps redis
   docker compose logs redis
   ```

2. **Test connection:**
   ```bash
   docker compose exec redis redis-cli ping
   # Expected: PONG
   ```

3. **Verify settings:**
   ```bash
   REDIS_HOST=localhost   # Use 'redis' if running in Docker network
   REDIS_PORT=6379
   ```

### Migration Failed

**Symptom:**
```
migration failed: error executing migration
```

**Solutions:**

1. **Check migration status:**
   ```bash
   make migrate-status
   ```

2. **Force version (if stuck):**
   ```bash
   migrate -path migrations -database "$DATABASE_URL" force <version>
   ```

3. **Drop and recreate (development only):**
   ```bash
   docker compose exec postgres psql -U.openctem -c "DROP DATABASE.openctem; CREATE DATABASE.openctem;"
   make migrate-up
   ```

### JWT Validation Failed

**Symptom:**
```
invalid token: token signature is invalid
```

**Solutions:**

1. **Check JWT secret matches:**
   - Backend: `AUTH_JWT_SECRET`
   - Must be same value used when token was generated

2. **Check token expiration:**
   - Access tokens expire after `AUTH_ACCESS_TOKEN_DURATION`
   - Refresh tokens expire after `AUTH_REFRESH_TOKEN_DURATION`

3. **Regenerate JWT secret:**
   ```bash
   openssl rand -base64 48
   # Update AUTH_JWT_SECRET in .env
   # Restart backend
   ```

### CORS Errors

**Symptom:**
```
Access to fetch at 'http://localhost:8080' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solutions:**

1. **Check CORS settings:**
   ```bash
   # In api/.env
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   ```

2. **For multiple origins:**
   ```bash
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

3. **Restart backend after changes:**
   ```bash
   make dev
   # or
   docker compose restart app
   ```

---

## Frontend Issues

### API Connection Failed

**Symptom:** Network errors when calling API

**Solutions:**

1. **Verify backend is running:**
   ```bash
   curl http://localhost:8080/health
   ```

2. **Check environment variable:**
   ```bash
   # In ui/.env.local
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

3. **Restart frontend after env changes:**
   ```bash
   # Stop and restart
   npm run dev
   ```

### Authentication Not Working

**Symptom:** Login fails or user not authenticated

**Solutions:**

1. **Check AUTH_PROVIDER matches:**
   ```bash
   # Frontend (.env.local)
   NEXT_PUBLIC_AUTH_PROVIDER=local

   # Backend (.env)
   AUTH_PROVIDER=local
   ```

2. **Clear browser cookies:**
   - Open DevTools > Application > Cookies
   - Delete all cookies for localhost

3. **Check cookie settings:**
   ```bash
   # In .env.local
   NEXT_PUBLIC_AUTH_COOKIE_NAME=auth_token
   SECURE_COOKIES=false  # Must be false for localhost
   ```

### Build Errors

**Symptom:** `npm run build` fails

**Solutions:**

1. **Check for TypeScript errors:**
   ```bash
   npx tsc --noEmit
   ```

2. **Check for ESLint errors:**
   ```bash
   npm run lint
   ```

3. **Check missing environment variables:**
   - All `NEXT_PUBLIC_*` variables must be set at build time

4. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run build
   ```

### Hydration Errors

**Symptom:**
```
Hydration failed because the initial UI does not match what was rendered on the server
```

**Solutions:**

1. **Check for browser-only code in Server Components:**
   - Move `window`, `document`, `localStorage` usage to Client Components

2. **Use dynamic imports for client-only components:**
   ```tsx
   import dynamic from 'next/dynamic'
   const ClientComponent = dynamic(() => import('./ClientComponent'), { ssr: false })
   ```

3. **Check for date/time mismatches:**
   - Server and client may have different timezones
   - Use `suppressHydrationWarning` for date displays

---

## Keycloak Issues

### Keycloak Not Starting

**Symptom:** Keycloak container fails to start

**Solutions:**

1. **Check logs:**
   ```bash
   docker compose logs keycloak
   ```

2. **Verify database connection:**
   ```bash
   # In .env.keycloak.dev
   KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak
   ```

3. **Check port availability:**
   ```bash
   lsof -i :8180
   ```

### OIDC Authentication Failed

**Symptom:** Keycloak login redirects fail

**Solutions:**

1. **Verify Keycloak URLs match:**
   ```bash
   # Frontend
   NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8180

   # Backend
   KEYCLOAK_BASE_URL=http://localhost:8180
   ```

2. **Check redirect URI is configured:**
   - In Keycloak Admin Console
   - Clients > ui > Valid redirect URIs
   - Add: `http://localhost:3000/*`

3. **Verify client secret:**
   ```bash
   # Must match secret in Keycloak
   KEYCLOAK_CLIENT_SECRET=your-secret
   ```

---

## Scan Issues

### Scan Creation Failed

**Symptom:** Cannot create new scan, error message displayed

**Common Error Messages and Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| `scanner 'xyz' not found in tool registry` | Tool doesn't exist | Check tool name spelling, ensure tool is registered |
| `scanner 'xyz' is disabled` | Tool is inactive | Enable the tool in Tool Management |
| `pipeline step 'step_key' uses tool 'xyz' which is not found` | Workflow uses missing tool | Update pipeline to use existing tools |
| `No agents available. Deploy a tenant agent or upgrade your plan` | No agents can execute scan | Deploy a tenant agent or upgrade for platform agents |
| `No tenant agent available. Deploy an agent or enable platform agents` | Tenant-only mode with no agents | Deploy a tenant agent |

**Troubleshooting Steps:**

1. **Check available tools:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/v1/tools | jq '.data[].name'
   ```

2. **Check agent status:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/v1/agents
   ```

3. **For workflow scans, verify pipeline steps:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/v1/pipelines/{id}/steps
   ```

### Scan Created but Not Running

**Symptom:** Scan is created but stays in "pending" status

**Solutions:**

1. **Check agent is online:**
   - View Agents page in UI
   - Ensure at least one agent shows "Online" status

2. **Check scan configuration:**
   - Verify schedule is set correctly
   - Check if scan is in "active" status (not paused/disabled)

3. **Check agent capabilities:**
   - Agent must support the scanner tool
   - Check agent's registered capabilities

### Target Validation Errors

**Symptom:** Custom targets rejected during scan creation

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `internal IP addresses are not allowed (SSRF protection)` | Private IP blocked | Use public IPs or enable internal IPs for tenant |
| `localhost addresses are not allowed` | Localhost blocked | Use actual domain/IP |
| `contains invalid characters` | Shell metacharacters | Remove `;`, `&`, `\|`, etc. |
| `invalid domain format` | Malformed domain | Check domain syntax |
| `CIDR range too large` | Range > 65536 hosts | Use smaller CIDR (e.g., /16 max) |

---

## Performance Issues

### Slow API Responses

**Solutions:**

1. **Enable query logging:**
   ```bash
   LOG_LEVEL=debug
   ```

2. **Check database indexes:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM assets WHERE ...;
   ```

3. **Check connection pool:**
   ```bash
   DB_MAX_OPEN_CONNS=25
   DB_MAX_IDLE_CONNS=5
   ```

### High Memory Usage

**Solutions:**

1. **Backend (Go):**
   ```bash
   # Profile memory
   go tool pprof http://localhost:8080/debug/pprof/heap
   ```

2. **Frontend (Next.js):**
   ```bash
   # Analyze bundle size
   npm run analyze
   ```

### Slow Frontend Build

**Solutions:**

1. **Use Turbopack (default in dev):**
   ```bash
   npm run dev  # Uses Turbopack automatically
   ```

2. **Check for large dependencies:**
   ```bash
   npx depcheck
   ```

---

## Docker Issues

### Container Keeps Restarting

**Solution:**
```bash
# Check logs
docker compose logs [service]

# Check exit code
docker compose ps -a

# Increase memory limits if OOM
docker compose up -d --scale app=1
```

### Volume Permission Issues

**Symptom:** Permission denied errors

**Solution:**
```bash
# Fix ownership
sudo chown -R $(id -u):$(id -g) ./data

# Or use named volumes
docker volume create app_data
```

### Network Issues Between Containers

**Solution:**
```bash
# Use service names, not localhost
DB_HOST=postgres  # Not localhost
REDIS_HOST=redis  # Not localhost
```

---

## Debugging Tools

### Backend

```bash
# Enable debug logging
LOG_LEVEL=debug

# Access pprof
curl http://localhost:8080/debug/pprof/

# View goroutines
curl http://localhost:8080/debug/pprof/goroutine?debug=2
```

### Frontend

```bash
# Enable verbose logging
DEBUG=* npm run dev

# Check React DevTools
# Install React Developer Tools browser extension

# Check Network tab
# Open DevTools > Network > Filter by XHR
```

### Database

```bash
# Connect to database
docker compose exec postgres psql -U.openctem -d.openctem

# View active connections
SELECT * FROM pg_stat_activity;

# View slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

---

## Getting Help

If you can't resolve the issue:

1. **Search existing issues:**
   - [GitHub Issues](https://github.com/openctemio/api/issues)

2. **Create a new issue with:**
   - OS and version
   - Docker/Node/Go versions
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs (sanitize secrets!)
   - Environment (development/staging/production)

3. **Include diagnostics:**
   ```bash
   # System info
   uname -a
   docker --version
   docker compose version
   node --version
   go version

   # Service status
   docker compose ps
   ```
