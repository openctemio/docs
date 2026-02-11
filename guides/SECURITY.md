---
layout: default
title: Security Best Practices
parent: Platform Guides
nav_order: 20
---

# Security Best Practices

Comprehensive security guidelines for deploying and operating OpenCTEM in production.

---

## Table of Contents

- [Authentication & Authorization](#authentication--authorization)
- [Secret Management](#secret-management)
- [Network Security](#network-security)
- [Data Protection](#data-protection)
- [Tenant Isolation (IDOR Prevention)](#tenant-isolation-idor-prevention)
- [Access Control](#access-control)
- [Audit & Logging](#audit--logging)
- [Dependency Security](#dependency-security)
- [Production Checklist](#production-checklist)

---

## Authentication & Authorization

### Keycloak Configuration

**Use OIDC/OAuth2** for all authentication:

```yaml
# Keycloak Realm Settings
- Enable User Registration: NO (admin-controlled)
- Require SSL: EXTERNAL (enforce HTTPS)
- Login with Email: YES
- Duplicate Emails: NOT ALLOWED
```

**Token Security:**
```yaml
Access Token Lifespan: 15 minutes (short-lived)
Refresh Token Lifespan: 7 days (long-lived, httpOnly)
Session Idle Timeout: 30 minutes
Session Max Lifespan: 10 hours
```

### Multi-Factor Authentication (MFA)

**Enable for all admin users:**

1. Navigate to Keycloak → Authentication
2. Enable **OTP Policy** (TOTP/HOTP)
3. Require MFA for `owner` and `admin` roles
4. Use authenticator apps (Google Authenticator, Authy)

### Password Policy

**Enforce strong passwords:**

```
Minimum Length: 12 characters
Require Uppercase: YES
Require Lowercase: YES
Require Numbers: YES
Require Special Characters: YES
Password History: 5 (prevent reuse)
Expire Passwords: 90 days
```

---

## Secret Management

### Environment Variables

**NEVER commit secrets to git:**

```bash
# ❌ WRONG - Hardcoded in code
export JWT_SECRET="mysecret123"

# ✅ CORRECT - Use secret management
export JWT_SECRET=$(kubectl get secret.openctem-secrets -o jsonpath='{.data.jwt-secret}' | base64 -d)
```

### Kubernetes Secrets

**Use native Kubernetes secrets:**

```bash
# Create secret
kubectl create secret generic.openctem-secrets \
  --from-literal=jwt-secret=$(openssl rand -base64 64) \
  --from-literal=csrf-secret=$(openssl rand -base64 32) \
  --from-literal=db-password=$(openssl rand -base64 32) \
  --namespace.openctem

# Reference in deployment
env:
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name:.openctem-secrets
        key: jwt-secret
```

### Secret Rotation

**Rotate secrets regularly:**

| Secret | Rotation Frequency |
|--------|-------------------|
| JWT signing keys | Every 90 days |
| API keys | Every 6 months |
| Database passwords | Annually |
| TLS certificates | Auto-renew (Let's Encrypt) |

---

## Network Security

### TLS/SSL Configuration

**Enforce HTTPS everywhere:**

```nginx
# Nginx configuration
server {
    listen 443 ssl http2;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # HSTS (Force HTTPS)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

### CORS Configuration

**Whitelist specific origins:**

```go
// Backend CORS
cors.New(cors.Options{
    AllowedOrigins: []string{
        "https://app.openctem.io",
        "https://staging.openctem.io",
    },
    AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
    AllowedHeaders: []string{"Authorization", "Content-Type"},
    AllowCredentials: true,
    MaxAge: 86400,
})
```

**Never use:**
```go
AllowedOrigins: []string{"*"}  // ❌ DANGEROUS
```

### Firewall Rules

**Whitelist only required ports:**

```bash
# Allow only HTTPS and SSH
ufw allow 443/tcp
ufw allow 22/tcp
ufw deny 80/tcp  # Or redirect to 443
ufw enable
```

**Kubernetes Network Policies:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
spec:
  podSelector:
    matchLabels:
      app: openctem-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app:.openctem-ui
    ports:
    - protocol: TCP
      port: 8080
```

---

## Data Protection

### Database Security

**PostgreSQL Hardening:**

```sql
-- Create read-only user for replicas
CREATE ROLE readonly WITH LOGIN PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE.openctem TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

-- Revoke public schema permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO.openctem_admin;

-- Enable SSL connections only
ALTER SYSTEM SET ssl = on;
```

### Encryption at Rest

**Enable database encryption:**

```bash
# PostgreSQL with LUKS
cryptsetup luksOpen /dev/sdb1 postgres_encrypted
mount /dev/mapper/postgres_encrypted /var/lib/postgresql
```

**Or use cloud-managed encryption:**
- AWS RDS: Enable encryption at rest
- GCP CloudSQL: Automatic encryption
- Azure Database: Transparent Data Encryption (TDE)

### Encryption in Transit

**All connections must use TLS:**

```yaml
# API → Database
database:
  sslmode: require
  sslrootcert: /etc/ssl/certs/ca-certificates.crt

# API → Redis
redis:
  tls: true
  tlsConfig:
    minVersion: TLSv1.2
```

### Data Retention

**Implement data retention policies:**

```sql
-- Delete old audit logs (retain 90 days)
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive old findings (retain 1 year)
INSERT INTO findings_archive 
SELECT * FROM findings 
WHERE resolved_at < NOW() - INTERVAL '1 year';

DELETE FROM findings 
WHERE resolved_at < NOW() - INTERVAL '1 year';
```

---

## Tenant Isolation (IDOR Prevention)

### Defense in Depth Architecture

OpenCTEM implements **3-layer defense** against IDOR (Insecure Direct Object Reference) attacks, which is OWASP A01:2021 - Broken Access Control.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TENANT ISOLATION - DEFENSE IN DEPTH                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Code-Level (SQL WHERE clause)                                     │
│  ├─ Repository interfaces require tenantID parameter                        │
│  ├─ Go compiler enforces parameter at compile time                          │
│  └─ WHERE tenant_id = $1 in all queries                                     │
│                                                                              │
│  Layer 2: Database-Level (PostgreSQL RLS)                                   │
│  ├─ Row Level Security policies on all tenant-scoped tables                 │
│  ├─ current_tenant_id() function reads session variable                     │
│  └─ Safety net if code-level check is bypassed                              │
│                                                                              │
│  Layer 3: Performance (Composite Indexes)                                   │
│  ├─ (tenant_id, id) indexes for efficient lookups                           │
│  └─ Query planner optimizes tenant-scoped queries                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### RLS Policy Configuration

PostgreSQL Row Level Security provides database-level enforcement:

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings FORCE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation_findings ON findings
    FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Platform admin bypass (for support/migrations)
CREATE POLICY platform_admin_bypass_findings ON findings
    FOR ALL
    USING (is_platform_admin())
    WITH CHECK (is_platform_admin());
```

### Production Database User

{: .warning }
> **CRITICAL:** RLS is bypassed by PostgreSQL superusers! Application must connect as non-superuser.

```bash
# Development (superuser - RLS NOT enforced)
DATABASE_URL=postgres://openctem:secret@localhost:5432/openctem

# Production (non-superuser - RLS ENFORCED)
DATABASE_URL=postgres://openctem_app:secure-password@db:5432/openctem
```

**Setup production user:**
```sql
CREATE ROLE openctem_app LOGIN PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE openctem TO openctem_app;
GRANT USAGE ON SCHEMA public TO openctem_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openctem_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO openctem_app;
```

### Protected Tables

| Table | RLS Enabled | Policy |
|-------|:-----------:|--------|
| `findings` | ✅ | `tenant_isolation_findings` |
| `assets` | ✅ | `tenant_isolation_assets` |
| `scans` | ✅ | `tenant_isolation_scans` |
| `agents` | ✅ | `tenant_isolation_agents` |
| `integrations` | ✅ | `tenant_isolation_integrations` |
| `exposure_events` | ✅ | `tenant_isolation_exposures` |
| `suppression_rules` | ✅ | `tenant_isolation_suppression_rules` |
| `finding_activities` | ✅ | `tenant_isolation_finding_activities` |

### Security Verification

**Run RLS integration tests:**
```bash
DATABASE_URL="postgres://openctem:secret@localhost:5432/openctem" \
DATABASE_URL_RLS_TEST="postgres://rls_test_user:test@localhost:5432/openctem" \
go test -v ./tests/integration -run TestRLS
```

See: [Tenant Isolation & RLS Architecture](../architecture/tenant-isolation-security.md) for complete technical documentation.

---

## Access Control

### Principle of Least Privilege

**Grant minimum required permissions:**

```yaml
# Bad - Too permissive
groups:
  - name: Developers
    permission_set: Full Admin  # ❌

# Good - Minimal permissions
groups:
  - name: Developers
    permission_set: Developer   # ✅
    assets: ["team-owned-repos"]
```

### Role-Based Access Control (RBAC)

**Use group-based access control:**

```
Security Core Team → Full Admin
AppSec Team → AppSec Engineer
Developers → Developer (scoped to owned assets)
Managers → Read Only
```

See: [Group-Based Access Control Guide](./group-based-access-control.md)

### API Authentication

**All API requests must be authenticated:**

```go
// API middleware
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatus(401)
            return
        }
        
        // Validate JWT
        claims, err := jwt.VerifyToken(token)
        if err != nil {
            c.AbortWithStatus(401)
            return
        }
        
        c.Set("user_id", claims.Sub)
        c.Next()
    }
}
```

---

## Audit & Logging

### Audit Logging

**Log all security-relevant events:**

```go
type AuditLog struct {
    Timestamp   time.Time
    UserID      string
    TenantID    string
    Action      string  // "login", "create_user", "delete_finding"
    Resource    string  // "users/123", "findings/456"
    IPAddress   string
    UserAgent   string
    Result      string  // "success", "failure"
}
```

**What to log:**
- ✅ Authentication (login, logout, failed attempts)
- ✅ Authorization (permission denied)
- ✅ Data access (view sensitive findings)
- ✅ Data modification (create, update, delete)
- ✅ Configuration changes
- ✅ Admin actions

**What NOT to log:**
- ❌ Passwords or tokens
- ❌ Personal identifiable information (PII)
- ❌ Credit card numbers

### Log Retention

```yaml
Audit Logs: 1 year (compliance requirement)
Application Logs: 90 days
Error Logs: 180 days
Access Logs: 30 days
```

### Security Monitoring

**Alert on suspicious activity:**

```yaml
Alerts:
  - Event: Multiple failed login attempts
    Threshold: 5 failures in 15 minutes
    Action: Lock account, notify security team
    
  - Event: Privilege escalation attempt
    Threshold: 1 occurrence
    Action: Immediate alert to security team
    
  - Event: Bulk data export
    Threshold: >1000 findings exported
    Action: Require approval, audit
```

---

## Dependency Security

### Scan Dependencies

**Regularly scan for vulnerabilities:**

```bash
# Go dependencies
go list -json -m all | nancy sleuth

# Node.js dependencies (UI)
npm audit
npm audit fix

# Docker images
trivy image openctemio/api:latest
```

### Automated Dependency Updates

**Use Dependabot or Renovate:**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### Container Security

**Minimal base images:**

```dockerfile
# ❌ Bad - Full OS
FROM ubuntu:22.04

# ✅ Good - Minimal
FROM alpine:3.18

# ✅ Better - Distroless
FROM gcr.io/distroless/static-debian11
```

**Run as non-root:**

```dockerfile
RUN adduser -D appuser
USER appuser
```

---

## Production Checklist

### Pre-Production

- [ ] All secrets in secret management (not hardcoded)
- [ ] TLS/SSL certificates configured
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Strong password policy enabled
- [ ] MFA enabled for admin users
- [ ] Database encryption at rest enabled
- [ ] Database backups configured
- [ ] Audit logging enabled
- [ ] Security headers configured (HSTS, CSP, X-Frame-Options)
- [ ] CORS whitelist configured (no wildcards)
- [ ] Rate limiting enabled
- [ ] Firewall rules configured (minimal open ports)
- [ ] Dependency scan clean (no critical vulnerabilities)
- [ ] Container images scanned (no HIGH/CRITICAL CVEs)
- [ ] **RLS enabled and verified** (non-superuser DB connection)
- [ ] **Tenant isolation tests passing**

### Post-Production

- [ ] Change all default credentials
- [ ] Rotate secrets (JWT, API keys)
- [ ] Review and lock down permissions
- [ ] Enable monitoring and alerting
- [ ] Configure log aggregation (ELK, Loki)
- [ ] Set up security scanning (weekly)
- [ ] Document incident response plan
- [ ] Schedule penetration testing

### Ongoing

- [ ] Review audit logs weekly
- [ ] Rotate secrets quarterly
- [ ] Update dependencies monthly
- [ ] Scan for vulnerabilities weekly
- [ ] Review access control quarterly
- [ ] Conduct security training annually

---

## Incident Response

### Security Incident Playbook

**1. Detection**
- Monitor alerts from SIEM/logging system
- Security team triages incident

**2. Containment**
- Isolate affected systems
- Revoke compromised credentials
- Block malicious IPs

**3. Investigation**
- Analyze audit logs
- Determine scope of breach
- Identify root cause

**4. Remediation**
- Patch vulnerabilities
- Rotate all secrets
- Update security controls

**5. Recovery**
- Restore from clean backups
- Re-enable services
- Monitor for re-compromise

**6. Post-Incident**
- Document lessons learned
- Update security controls
- Notify affected users (if required)

---

## Compliance

### SOC 2 / ISO 27001

**Key requirements:**
- Encryption in transit and at rest
- Access control and least privilege
- Audit logging (1 year retention)
- Regular vulnerability scanning
- Incident response plan
- Employee security training

### GDPR

**Data protection requirements:**
- Encrypted personal data
- Data retention policies
- Right to deletion (GDPR requests)
- Data breach notification (72 hours)
- Privacy by design

---

## Workflow Automation Security

### Overview

The Workflow Executor processes user-defined automation graphs that can trigger HTTP requests, pipelines, scans, and notifications. This creates multiple attack vectors that are mitigated through 14 security controls.

### Key Protections

| Attack Vector | Protection | Controls |
|--------------|------------|----------|
| **SSRF** | URL validation, blocked CIDRs, DNS validation, TOCTOU-safe dialer | SEC-WF02, SEC-WF09, SEC-WF13 |
| **SSTI** | Safe string interpolation (no template execution) | SEC-WF01, SEC-WF03 |
| **Resource Exhaustion** | Global semaphore, per-tenant limits, timeouts | SEC-WF04, SEC-WF07, SEC-WF10 |
| **Tenant Isolation** | Verification at trigger, load, and execution phases | SEC-WF05, SEC-WF08 |
| **ReDoS** | Expression length/complexity limits | SEC-WF11 |
| **Panic/DoS** | Panic recovery with resource cleanup | SEC-WF12 |
| **Log Injection** | Input sanitization | SEC-WF14 |

### Blocked Resources

**CIDR Ranges (SSRF Protection):**
```
127.0.0.0/8      - Loopback
10.0.0.0/8       - Private
172.16.0.0/12    - Private
192.168.0.0/16   - Private
169.254.0.0/16   - Link-local / Cloud metadata
```

**Hostname Patterns:**
```
.local, .internal, .localhost, .lan, .home, .corp, .intranet
```

### Script Execution

Script execution (`run_script` action) is **disabled by default** for security reasons. Enabling it requires:
- Sandboxed execution environment (Docker, gVisor)
- Resource limits (CPU, memory, time)
- Network restrictions
- Input validation and output sanitization

See: [Workflow Executor Architecture](../architecture/workflow-executor.md) for full technical details.

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated:** 2026-01-30
**Version:** 1.2
