---
layout: default
parent: Architecture
---
---
layout: default
title: Agent & API Key Management
parent: Architecture
nav_order: 5
---
# Agent & API Key Management Architecture

## Overview

This document outlines the architecture for managing agents (scanners, collectors, runners) and their API keys in OpenCTEM, based on best practices from enterprise security tools like Snyk, SonarQube, Datadog, and HashiCorp Vault.

## Design Principles

1. **Least Privilege**: Each key should have only the permissions it needs
2. **Rotation Support**: Keys can be rotated without downtime
3. **Auditability**: Track which key did what and when
4. **Isolation**: Compromised key affects only that component
5. **Automation-Friendly**: Support for auto-registration in CI/CD

## Entity Model

### Rename: Source → Agent

The term "Source" is ambiguous. We use "Agent" to represent any deployed component:

```
┌─────────────────────────────────────────────────────────────────┐
│                          Agent Types                             │
├─────────────────────────────────────────────────────────────────┤
│  Scanner     │ Runs security tools (semgrep, trivy, etc.)       │
│  Collector   │ Pulls data from external sources (GitHub, etc.)  │
│  Runner      │ Executes commands from server (CI/CD runner)     │
│  Hybrid      │ Combination of above (full agent daemon)         │
└─────────────────────────────────────────────────────────────────┘
```

## Key Types

### 1. Agent API Keys (Primary)

Each deployed agent gets its own API key(s).

**Characteristics:**
- Bound to a specific agent
- Has defined scopes (permissions)
- Optional expiration
- Multiple keys per agent (max 2 for rotation)
- Revocable

**Use Cases:**
- CI/CD pipeline integration
- Deployed scanner/collector
- Long-running agent daemon

### 2. Registration Tokens (Bootstrap)

One-time use tokens for auto-registering new agents.

**Characteristics:**
- Created by admin
- Single or limited use
- Expires after time or usage
- Pre-defines agent type and default scopes
- Consumed during registration

**Use Cases:**
- Kubernetes deployments (agent auto-registers on startup)
- Terraform/Ansible automation
- Developer self-service registration

### 3. Personal Access Tokens (Future)

For user-based API access (not agent-based).

**Use Cases:**
- CLI tools
- IDE integrations
- Ad-hoc API access

## Permission Scopes

```yaml
# Ingest permissions
ingest:write        # Push findings and assets
ingest:read         # Read ingested data (rarely needed for agents)

# Command permissions
commands:read       # Poll for pending commands
commands:execute    # Execute commands and report results
commands:write      # Create commands (admin only)

# Agent self-management
agent:heartbeat     # Send heartbeat/status updates
agent:read          # Read own agent config
agent:write         # Update own agent config

# Admin permissions (not for agents)
admin:agents        # Manage other agents
admin:keys          # Manage API keys
admin:tokens        # Manage registration tokens
```

### Predefined Scope Bundles

```yaml
# For scanners that push findings
scanner:
  - ingest:write
  - agent:heartbeat

# For collectors that pull and push data
collector:
  - ingest:write
  - agent:heartbeat
  - agent:read

# For runners that execute commands
runner:
  - commands:read
  - commands:execute
  - agent:heartbeat

# For full agents (scanner + runner)
agent:
  - ingest:write
  - commands:read
  - commands:execute
  - agent:heartbeat
  - agent:read
```

## Database Schema

### agents table (renamed from sources)

```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Basic info
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('scanner', 'collector', 'runner', 'agent')),
    description TEXT,

    -- Capabilities and config
    capabilities TEXT[] DEFAULT '{}',  -- ['sast', 'sca', 'secrets', 'iac']
    config JSONB DEFAULT '{}',         -- Agent-specific configuration
    labels JSONB DEFAULT '{}',         -- Key-value labels for filtering

    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'inactive', 'error', 'revoked')),
    status_message TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    last_error_at TIMESTAMP WITH TIME ZONE,

    -- Statistics
    total_scans BIGINT DEFAULT 0,
    total_findings BIGINT DEFAULT 0,
    total_errors BIGINT DEFAULT 0,

    -- Metadata
    version VARCHAR(50),               -- Agent software version
    hostname VARCHAR(255),             -- Where agent is running
    ip_address INET,                   -- Agent's IP

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE (tenant_id, name)
);

-- Indexes
CREATE INDEX idx_agents_tenant_id ON agents(tenant_id);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_last_seen ON agents(last_seen_at);
```

### agent_api_keys table

```sql
CREATE TABLE agent_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Key identification
    name VARCHAR(255) NOT NULL,        -- "Primary", "Rotation", "CI/CD"
    key_hash VARCHAR(64) NOT NULL,     -- SHA-256 hash
    key_prefix VARCHAR(12) NOT NULL,   -- First 12 chars for display (ct_xxx...)

    -- Permissions
    scopes TEXT[] NOT NULL DEFAULT '{}',

    -- Lifecycle
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip INET,
    use_count BIGINT DEFAULT 0,

    -- Status
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints: max 2 active keys per agent
    CONSTRAINT max_active_keys CHECK (
        revoked_at IS NOT NULL OR
        (SELECT COUNT(*) FROM agent_api_keys k
         WHERE k.agent_id = agent_api_keys.agent_id
         AND k.revoked_at IS NULL) <= 2
    )
);

-- Indexes
CREATE INDEX idx_agent_api_keys_agent_id ON agent_api_keys(agent_id);
CREATE UNIQUE INDEX idx_agent_api_keys_hash ON agent_api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_agent_api_keys_prefix ON agent_api_keys(key_prefix);
CREATE INDEX idx_agent_api_keys_expires ON agent_api_keys(expires_at) WHERE expires_at IS NOT NULL;
```

### registration_tokens table

```sql
CREATE TABLE registration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Token identification
    name VARCHAR(255) NOT NULL,        -- "K8s cluster prod", "Dev team"
    token_hash VARCHAR(64) NOT NULL,   -- SHA-256 hash
    token_prefix VARCHAR(12) NOT NULL, -- First 12 chars for display

    -- Pre-configuration for registered agents
    agent_type VARCHAR(50),            -- Pre-set agent type
    agent_name_prefix VARCHAR(100),    -- Auto-naming: prefix-{random}
    default_scopes TEXT[] DEFAULT '{"ingest:write", "commands:read", "agent:heartbeat"}',
    default_capabilities TEXT[] DEFAULT '{}',
    default_labels JSONB DEFAULT '{}',

    -- Usage limits
    max_uses INT DEFAULT 1,            -- NULL = unlimited
    uses_count INT DEFAULT 0,

    -- Lifecycle
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE (token_hash)
);

-- Indexes
CREATE INDEX idx_registration_tokens_tenant ON registration_tokens(tenant_id);
CREATE INDEX idx_registration_tokens_expires ON registration_tokens(expires_at);
```

### agent_audit_log table

```sql
CREATE TABLE agent_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    api_key_id UUID REFERENCES agent_api_keys(id) ON DELETE SET NULL,

    -- Event info
    event_type VARCHAR(50) NOT NULL,   -- 'auth', 'ingest', 'command', 'heartbeat', 'error'
    event_action VARCHAR(100) NOT NULL, -- 'push_findings', 'poll_commands', etc.
    event_status VARCHAR(20) NOT NULL,  -- 'success', 'failure', 'denied'

    -- Context
    ip_address INET,
    user_agent VARCHAR(500),
    request_id VARCHAR(100),

    -- Details
    details JSONB DEFAULT '{}',        -- Event-specific data
    error_message TEXT,

    -- Timing
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    duration_ms INT
);

-- Indexes (with partitioning consideration)
CREATE INDEX idx_agent_audit_logs_tenant ON agent_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_agent_audit_logs_agent ON agent_audit_logs(agent_id, created_at DESC);
CREATE INDEX idx_agent_audit_logs_type ON agent_audit_logs(event_type, created_at DESC);
```

## API Endpoints

### Agent Management (Admin API)

```
POST   /api/v1/agents                    # Create agent manually
GET    /api/v1/agents                    # List agents
GET    /api/v1/agents/{id}               # Get agent details
PATCH  /api/v1/agents/{id}               # Update agent
DELETE /api/v1/agents/{id}               # Delete agent (revokes all keys)

POST   /api/v1/agents/{id}/keys          # Create new API key for agent
GET    /api/v1/agents/{id}/keys          # List agent's API keys
DELETE /api/v1/agents/{id}/keys/{keyId}  # Revoke specific key
POST   /api/v1/agents/{id}/keys/{keyId}/rotate  # Rotate key (create new, mark old for expiry)
```

### Registration Token Management (Admin API)

```
POST   /api/v1/registration-tokens       # Create registration token
GET    /api/v1/registration-tokens       # List tokens
GET    /api/v1/registration-tokens/{id}  # Get token details
DELETE /api/v1/registration-tokens/{id}  # Revoke token
```

### Agent Self-Registration (Public API)

```
POST   /api/v1/register                  # Register using registration token
       Request:  { "token": "oc_reg_xxx...", "name": "my-scanner", "capabilities": [...] }
       Response: { "agent_id": "...", "api_key": "oc_live_xxx..." }  # Key shown only once!
```

### Agent API (Authenticated with Agent API Key)

```
POST   /api/v1/agent/heartbeat           # Send heartbeat
POST   /api/v1/agent/ingest              # Push findings/assets
GET    /api/v1/agent/commands            # Poll for commands
POST   /api/v1/agent/commands/{id}/ack   # Acknowledge command
POST   /api/v1/agent/commands/{id}/start # Start command
POST   /api/v1/agent/commands/{id}/complete  # Complete command
POST   /api/v1/agent/commands/{id}/fail  # Fail command
GET    /api/v1/agent/config              # Get agent config (if scoped)
```

## Key Format

### Agent API Keys
```
oc_[type]_[random_32_chars]

Examples:
oc_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6  # Production key
oc_test_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4  # Test/development key
```

### Registration Tokens
```
oc_reg_[random_32_chars]

Example:
oc_reg_abc123def456ghi789jkl012mno345pqr
```

## Key Rotation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin     │     │   Server    │     │   Agent     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ 1. Rotate Key     │                   │
       │──────────────────>│                   │
       │                   │                   │
       │ 2. New Key +      │                   │
       │    Grace Period   │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ 3. Deploy new key │                   │
       │──────────────────────────────────────>│
       │                   │                   │
       │                   │ 4. Use new key    │
       │                   │<──────────────────│
       │                   │                   │
       │                   │ 5. Grace period   │
       │                   │    expires        │
       │                   │                   │
       │                   │ 6. Old key        │
       │                   │    revoked        │
       │                   │                   │
```

## Auto-Registration Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin     │     │   Server    │     │   Agent     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ 1. Create reg     │                   │
       │    token          │                   │
       │──────────────────>│                   │
       │                   │                   │
       │ 2. Token          │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ 3. Deploy token   │                   │
       │   (K8s secret)    │                   │
       │──────────────────────────────────────>│
       │                   │                   │
       │                   │ 4. Register with  │
       │                   │    token          │
       │                   │<──────────────────│
       │                   │                   │
       │                   │ 5. Agent created  │
       │                   │    + API key      │
       │                   │──────────────────>│
       │                   │                   │
       │                   │ 6. Use API key    │
       │                   │<──────────────────│
       │                   │                   │
```

## Security Considerations

### Key Storage
- Hash keys with SHA-256 before storing
- Store only prefix for identification
- Never log full API keys
- Use secure comparison for auth (constant-time)

### SDK Security Features (v1.1+)

The SDK includes comprehensive security controls for platform agents:

#### Credential Storage
- **Encrypted storage**: Use `EncryptedFileStore` with AES-256-GCM
- **Key validation**: Path traversal and injection prevention
- **Secure clearing**: Zero credentials in memory after use
- **Constant-time comparison**: Timing attack prevention

#### Job Validation
- Job ID, tenant ID, type validation
- Allowed job types whitelist
- Payload size limits (default 10MB)
- Auth token validation with JWT claim matching
- Timeout validation (max 1 hour)

#### Lease Security
- Cryptographically secure holder identity (16-byte random nonce)
- Automatic job cancellation on lease expiry
- Grace period handling

#### Template Security
- Path traversal prevention in template names
- Template type whitelist (nuclei, semgrep, gitleaks)
- Size limits (1MB per template, 50 per command)
- Content hash verification

See [SDK Security Guide](/sdk/docs/SECURITY.md) for implementation details.

### Rate Limiting
- Limit auth attempts per key prefix
- Limit registration attempts per IP
- Exponential backoff on failures

### Monitoring
- Alert on unusual patterns (new IPs, high error rates)
- Track key usage for anomaly detection
- Audit log all key operations

### Expiration Policy
- Recommended: 90-day expiration for production keys
- Enforce max lifetime via tenant settings
- Email/webhook notifications before expiry

## Migration Plan

### Phase 1: Rename & Restructure
1. Rename `sources` table to `agents`
2. Add new columns (labels, config, etc.)
3. Update all references in code

### Phase 2: Multiple Keys
1. Create `agent_api_keys` table
2. Migrate existing keys from agents table
3. Update authentication to use new table

### Phase 3: Registration Tokens
1. Create `registration_tokens` table
2. Implement registration endpoint
3. Update SDK with auto-registration

### Phase 4: Scopes
1. Add scope checking to middleware
2. Update existing keys with default scopes
3. Implement scope validation

## References

- [Snyk Service Accounts](https://docs.snyk.io/enterprise-setup/service-accounts)
- [SonarQube Token Management](https://docs.sonarsource.com/sonarqube-server/user-guide/managing-tokens)
- [Datadog API Keys](https://docs.datadoghq.com/account_management/api-app-keys/)
- [HashiCorp Vault AppRole](https://developer.hashicorp.com/vault/tutorials/auth-methods/approle-best-practices)
