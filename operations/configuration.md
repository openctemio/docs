---
layout: default
title: Environment Configuration
nav_order: 7
---
# Environment Configuration

Complete reference for all environment variables across OpenCTEM services.

## Quick Reference

| Service | Config File | Example File |
|---------|-------------|--------------|
| Backend | `.env` | `.env.example` |
| Frontend | `.env.local` | `.env.example` |
| Keycloak | `.env.keycloak.dev` | `.env.keycloak.example` |

## Backend (api)

### Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_NAME` | No | .openctem` | Application name for logging |
| `APP_ENV` | No | `development` | Environment: `development`, `staging`, `production` |
| `APP_DEBUG` | No | `true` | Enable debug mode |

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVER_HOST` | No | `0.0.0.0` | Server bind address |
| `SERVER_PORT` | No | `8080` | HTTP server port |
| `SERVER_READ_TIMEOUT` | No | `15s` | Read timeout |
| `SERVER_WRITE_TIMEOUT` | No | `15s` | Write timeout |
| `SERVER_REQUEST_TIMEOUT` | No | `30s` | Request timeout |
| `SERVER_SHUTDOWN_TIMEOUT` | No | `30s` | Graceful shutdown timeout |
| `SERVER_MAX_BODY_SIZE` | No | `1048576` | Max request body size (bytes) |

### Database (PostgreSQL)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | `localhost` | Database host |
| `DB_PORT` | No | `5432` | Database port |
| `DB_USER` | Yes | - | Database user |
| `DB_PASSWORD` | Yes | - | Database password |
| `DB_NAME` | Yes | - | Database name |
| `DB_SSLMODE` | No | `disable` | SSL mode: `disable`, `require`, `verify-ca`, `verify-full` |
| `DB_MAX_OPEN_CONNS` | No | `25` | Max open connections |
| `DB_MAX_IDLE_CONNS` | No | `5` | Max idle connections |
| `DB_CONN_MAX_LIFETIME` | No | `5m` | Connection max lifetime |

**Connection String:**
```
postgres://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME?sslmode=DB_SSLMODE
```

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | Yes | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password (empty for no auth) |
| `REDIS_DB` | No | `0` | Redis database number |
| `REDIS_POOL_SIZE` | No | `10` | Connection pool size |
| `REDIS_MIN_IDLE_CONNS` | No | `2` | Minimum idle connections |
| `REDIS_DIAL_TIMEOUT` | No | `5s` | Connection dial timeout |
| `REDIS_READ_TIMEOUT` | No | `3s` | Read timeout |
| `REDIS_WRITE_TIMEOUT` | No | `3s` | Write timeout |
| `REDIS_TLS_ENABLED` | No | `false` | Enable TLS |
| `REDIS_TLS_SKIP_VERIFY` | No | `false` | Skip TLS verification |
| `REDIS_MAX_RETRIES` | No | `3` | Max retry attempts |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_PROVIDER` | Yes | `local` | Auth mode: `local`, `oidc`, `hybrid` |

#### Local Authentication (when AUTH_PROVIDER is `local` or `hybrid`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `AUTH_JWT_ISSUER` | No | `api` | JWT issuer claim |
| `AUTH_ACCESS_TOKEN_DURATION` | No | `15m` | Access token TTL |
| `AUTH_REFRESH_TOKEN_DURATION` | No | `168h` | Refresh token TTL (7 days) |
| `AUTH_SESSION_DURATION` | No | `720h` | Session TTL (30 days) |

#### Password Policy

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_PASSWORD_MIN_LENGTH` | No | `8` | Minimum password length |
| `AUTH_PASSWORD_REQUIRE_UPPERCASE` | No | `true` | Require uppercase letter |
| `AUTH_PASSWORD_REQUIRE_LOWERCASE` | No | `true` | Require lowercase letter |
| `AUTH_PASSWORD_REQUIRE_NUMBER` | No | `true` | Require number |
| `AUTH_PASSWORD_REQUIRE_SPECIAL` | No | `false` | Require special character |

#### Security Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_MAX_LOGIN_ATTEMPTS` | No | `5` | Max failed login attempts |
| `AUTH_LOCKOUT_DURATION` | No | `15m` | Account lockout duration |
| `AUTH_MAX_ACTIVE_SESSIONS` | No | `10` | Max concurrent sessions |
| `AUTH_ALLOW_REGISTRATION` | No | `true` | Allow new user registration |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | No | `false` | Require email verification |

#### Keycloak (when AUTH_PROVIDER is `oidc` or `hybrid`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KEYCLOAK_BASE_URL` | Yes* | - | Keycloak server URL |
| `KEYCLOAK_REALM` | Yes* | - | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | Yes* | - | Keycloak client ID |
| `KEYCLOAK_JWKS_REFRESH_INTERVAL` | No | `1h` | JWKS cache refresh interval |
| `KEYCLOAK_HTTP_TIMEOUT` | No | `10s` | HTTP client timeout |

*Required only when using OIDC authentication

### CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | Yes | - | Allowed origins (comma-separated or `*`) |
| `CORS_ALLOWED_METHODS` | No | `GET,POST,PUT,DELETE,OPTIONS,PATCH` | Allowed HTTP methods |
| `CORS_ALLOWED_HEADERS` | No | See below | Allowed headers |
| `CORS_MAX_AGE` | No | `86400` | Preflight cache duration (seconds) |

**Default CORS Headers**: `Accept,Authorization,Content-Type,X-Request-ID,X-Admin-API-Key`

> **Important**: The `X-Admin-API-Key` header is required for Admin UI authentication. If you override `CORS_ALLOWED_HEADERS`, make sure to include it.

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | No | `true` | Enable rate limiting |
| `RATE_LIMIT_RPS` | No | `100` | Requests per second |
| `RATE_LIMIT_BURST` | No | `200` | Burst allowance |
| `RATE_LIMIT_CLEANUP` | No | `1m` | Cleanup interval |

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `debug` | Log level: `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | No | `json` | Log format: `json`, `text` |

### Integrations (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WIZ_CLIENT_ID` | No | - | Wiz API client ID |
| `WIZ_CLIENT_SECRET` | No | - | Wiz API client secret |
| `WIZ_AUTH_URL` | No | - | Wiz authentication URL |
| `WIZ_API_URL` | No | - | Wiz API URL |
| `TENABLE_ACCESS_KEY` | No | - | Tenable access key |
| `TENABLE_SECRET_KEY` | No | - | Tenable secret key |

---

## Frontend (ui)

### API Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | - | Backend API URL |
| `API_TIMEOUT` | No | `30000` | API request timeout (ms) |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_AUTH_PROVIDER` | Yes | `local` | Auth mode (must match backend) |
| `NEXT_PUBLIC_AUTH_COOKIE_NAME` | No | `auth_token` | Auth token cookie name |
| `NEXT_PUBLIC_REFRESH_COOKIE_NAME` | No | `refresh_token` | Refresh token cookie name |
| `COOKIE_MAX_AGE` | No | `604800` | Cookie max age (seconds) |

### Keycloak (OIDC)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_KEYCLOAK_URL` | Yes* | - | Keycloak server URL |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | Yes* | - | Keycloak realm |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | Yes* | - | Keycloak client ID |
| `KEYCLOAK_CLIENT_SECRET` | Yes* | - | Keycloak client secret |
| `NEXT_PUBLIC_KEYCLOAK_REDIRECT_URI` | Yes* | - | OAuth redirect URI |

*Required only when using OIDC authentication

### Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Node environment |
| `NEXT_PUBLIC_APP_URL` | Yes | - | Application base URL |

### Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECURE_COOKIES` | No | `false` | Enable HTTPS-only cookies |
| `CSRF_SECRET` | Yes | - | CSRF protection secret (min 32 chars) |
| `ENABLE_TOKEN_REFRESH` | No | `true` | Enable automatic token refresh |
| `TOKEN_REFRESH_BEFORE_EXPIRY` | No | `300` | Refresh tokens N seconds before expiry |

### Monitoring

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | No | - | Sentry DSN for error tracking |
| `SENTRY_AUTH_TOKEN` | No | - | Sentry auth token (for source maps) |
| `SENTRY_ORG` | No | - | Sentry organization |
| `SENTRY_PROJECT` | No | - | Sentry project name |

---

## Keycloak (keycloak)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KEYCLOAK_ADMIN` | Yes | - | Admin username |
| `KEYCLOAK_ADMIN_PASSWORD` | Yes | - | Admin password |
| `KC_DB` | Yes | `postgres` | Database type |
| `KC_DB_URL` | Yes | - | JDBC database URL |
| `KC_DB_USERNAME` | Yes | - | Database username |
| `KC_DB_PASSWORD` | Yes | - | Database password |
| `KC_HOSTNAME` | Yes | - | Keycloak hostname |
| `KC_HTTP_ENABLED` | No | `true` | Enable HTTP |
| `KC_HTTP_PORT` | No | `8180` | HTTP port |
| `KC_HOSTNAME_STRICT` | No | `false` | Strict hostname checking |
| `KC_HEALTH_ENABLED` | No | `true` | Enable health endpoints |
| `KC_METRICS_ENABLED` | No | `true` | Enable metrics endpoints |

---

## Environment Files

### Development

```
api/.env              # Backend development config
ui/.env.local         # Frontend development config
keycloak/.env.keycloak.dev  # Keycloak development config
```

### Production

```
api/.env.production   # Backend production config
ui/.env.production    # Frontend production config (build-time)
ui/.env.production.local  # Frontend production secrets
```

---

## Generating Secrets

### JWT Secret (Backend)

```bash
# Using OpenSSL
openssl rand -base64 48

# Using Go
go run -e 'fmt.Println(base64.StdEncoding.EncodeToString(make([]byte, 48)))'
```

### CSRF Secret (Frontend)

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using npm script
cd ui && npm run generate-secret
```

### Database Password

```bash
# Generate secure password
openssl rand -base64 24

# Or use a password manager
```

---

## Configuration by Environment

### Development

```bash
# Backend
APP_ENV=development
APP_DEBUG=true
LOG_LEVEL=debug
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Frontend
NODE_ENV=development
SECURE_COOKIES=false
```

### Staging

```bash
# Backend
APP_ENV=staging
APP_DEBUG=false
LOG_LEVEL=info
CORS_ALLOWED_ORIGINS=https://staging.openctem.io

# Frontend
NODE_ENV=production
SECURE_COOKIES=true
```

### Production

```bash
# Backend
APP_ENV=production
APP_DEBUG=false
LOG_LEVEL=warn
CORS_ALLOWED_ORIGINS=https://openctem.io
DB_SSLMODE=require

# Frontend
NODE_ENV=production
SECURE_COOKIES=true
```

---

## Nginx Reverse Proxy (setup)

Configuration for the nginx reverse proxy that serves both UI and API domains.

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NGINX_HOST` | Yes | `localhost` | UI domain (e.g., `openctem.io`) |
| `API_HOST` | Yes | `api.localhost` | API domain (e.g., `api.openctem.io`) |

### Configuration by Environment

#### Local Development
```bash
NGINX_HOST=localhost
API_HOST=api.localhost
```

#### Staging
```bash
NGINX_HOST=staging.openctem.io
API_HOST=api.staging.openctem.io
```

#### Production
```bash
NGINX_HOST=openctem.io
API_HOST=api.openctem.io
```

### Rate Limiting

Different rate limits are configured for different endpoints:

| Zone | Rate | Burst | Endpoints |
|------|------|-------|-----------|
| `ui_general` | 10 req/s | 20 | UI routes |
| `api_general` | 30 req/s | 50 | General API (`/api/*`) |
| `api_auth` | 5 req/s | 10 | Authentication (`/api/v1/auth/*`) |
| `api_ingest` | 100 req/s | 200 | Agent data ingest (`/api/v1/agent/*`) |

### CORS

The API nginx configuration allows CORS requests from:
- `localhost` (development)
- `127.0.0.1` (development)
- `${NGINX_HOST}` (UI domain)
- `*.openctem.io` (all OpenCTEM subdomains)

### SSL Certificates

Place SSL certificates in `nginx/ssl/`:
- `cert.pem` - Certificate chain
- `key.pem` - Private key

See `setup/nginx/README.md` for detailed SSL setup instructions.

---

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` (gitignored)
2. **Use strong secrets** - Minimum 32 characters, randomly generated
3. **Rotate secrets regularly** - Especially JWT secrets
4. **Use TLS in production** - Enable `SECURE_COOKIES=true`
5. **Restrict CORS** - Never use `*` in production
6. **Enable rate limiting** - Protect against abuse
7. **Use SSL for database** - Set `DB_SSLMODE=require` or stricter
8. **Use Redis authentication** - Set `REDIS_PASSWORD` in production

---

## Validation

### Backend

The backend validates required environment variables at startup. Missing required variables will cause the application to fail to start.

### Frontend

Next.js validates `NEXT_PUBLIC_*` variables at build time. Missing variables will cause build errors.

```bash
# Validate frontend env
npm run build
```
