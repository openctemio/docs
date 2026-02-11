---
layout: default
title: Self-Hosted AI Agent
parent: Features
nav_order: 16
---

# Self-Hosted AI Agent

Deploy your own AI agent for complete data sovereignty and compliance requirements.

---

## Overview

The Self-Hosted AI Agent enables enterprise customers to run AI Triage entirely within their own infrastructure. This addresses critical requirements for:

- **Data Sovereignty**: Keep all security findings and analysis within your network
- **Compliance**: Meet HIPAA, GDPR, FedRAMP, SOC2, and other regulatory requirements
- **Air-Gapped Environments**: Support for networks with no external connectivity
- **Cost Control**: Use your own compute resources for high-volume analysis
- **Custom Models**: Deploy fine-tuned models optimized for your domain

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENTERPRISE NETWORK                                   │
│                                                                              │
│  ┌─────────────────────┐              ┌─────────────────────────────────┐   │
│  │  OpenCTEM Platform   │    HTTPS     │   Self-Hosted AI Agent          │   │
│  │  (SaaS or On-Prem)  │◀────────────▶│   (Customer Infrastructure)     │   │
│  │                     │              │                                 │   │
│  │  ┌───────────────┐  │              │  ┌───────────────────────────┐  │   │
│  │  │  AI Triage    │──┼─────────────▶│  │  Agent API Server         │  │   │
│  │  │  Service      │  │  Encrypted   │  │  (Go binary / Docker)     │  │   │
│  │  └───────────────┘  │  Requests    │  └─────────────┬─────────────┘  │   │
│  │                     │              │                │                │   │
│  │                     │              │                ▼                │   │
│  │                     │              │  ┌───────────────────────────┐  │   │
│  │                     │              │  │  LLM Backend              │  │   │
│  │                     │              │  │  ├── Ollama               │  │   │
│  │                     │              │  │  ├── vLLM                 │  │   │
│  │                     │              │  │  ├── llama.cpp            │  │   │
│  │                     │              │  │  ├── LocalAI              │  │   │
│  │                     │              │  │  └── OpenAI-compatible    │  │   │
│  │                     │              │  └───────────────────────────┘  │   │
│  └─────────────────────┘              └─────────────────────────────────┘   │
│                                                                              │
│                    ┌────────────────────────────────────┐                   │
│                    │  Security Boundary                 │                   │
│                    │  - VPN / Private Network           │                   │
│                    │  - mTLS Authentication             │                   │
│                    │  - No data leaves the network      │                   │
│                    └────────────────────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Request**: Platform sends finding data to Agent over HTTPS
2. **Processing**: Agent calls local LLM backend
3. **Response**: Agent returns analysis results
4. **Storage**: Results stored in Platform (no data retained in Agent)

**Key Principle**: Finding data never leaves your network when using Agent mode.

---

## AI Modes Comparison

| Feature | Platform | BYOK | Agent |
|---------|----------|------|-------|
| **Data Location** | OpenCTEM Cloud → LLM Provider | OpenCTEM Cloud → Your LLM Account | Your Infrastructure Only |
| **API Keys** | Platform-managed | Tenant-provided | Agent token |
| **Infrastructure** | None required | None required | Self-hosted agent |
| **Setup Complexity** | None | Low | Medium |
| **Data Sovereignty** | No | No | Yes |
| **Air-Gap Support** | No | No | Yes |
| **Use Case** | SMB, startups | Cost control | Enterprise, compliance |
| **Plan Required** | All plans | Pro+ | Enterprise |

---

## Agent API Specification

The self-hosted agent must implement the following API contract.

### Authentication

All requests include an `Authorization` header:

```
Authorization: Bearer <agent_api_key>
```

### Endpoints

#### POST /v1/complete

Run LLM completion for AI Triage analysis.

**Request:**

```json
{
  "system_prompt": "You are a security vulnerability analyst...",
  "user_prompt": "Analyze this SQL injection vulnerability...",
  "max_tokens": 2000,
  "temperature": 0.1,
  "json_mode": true
}
```

**Response:**

```json
{
  "content": "{\"severity_assessment\": \"high\", ...}",
  "prompt_tokens": 1250,
  "completion_tokens": 450,
  "model": "llama2-70b",
  "finish_reason": "stop"
}
```

**Error Response:**

```json
{
  "error": {
    "code": "model_unavailable",
    "message": "LLM backend is not responding"
  }
}
```

#### GET /v1/health

Health check endpoint for monitoring and connection testing.

**Response:**

```json
{
  "status": "healthy",
  "model": "llama2-70b",
  "version": "1.0.0",
  "capabilities": ["json_mode", "streaming"],
  "backend": "ollama",
  "uptime_seconds": 86400
}
```

**Status Values:**
- `healthy`: Agent and LLM backend operational
- `degraded`: Agent running but LLM backend issues
- `unhealthy`: Agent not functioning

---

## OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: OpenCTEM AI Agent API
  version: 1.0.0
  description: API contract for self-hosted AI agents

servers:
  - url: https://ai-agent.internal.corp.com
    description: Self-hosted agent endpoint

security:
  - bearerAuth: []

paths:
  /v1/complete:
    post:
      summary: Run LLM completion
      operationId: complete
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CompletionRequest'
      responses:
        '200':
          description: Successful completion
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CompletionResponse'
        '400':
          description: Invalid request
        '401':
          description: Unauthorized
        '503':
          description: LLM backend unavailable

  /v1/health:
    get:
      summary: Health check
      operationId: health
      security: []
      responses:
        '200':
          description: Agent health status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer

  schemas:
    CompletionRequest:
      type: object
      required:
        - system_prompt
        - user_prompt
      properties:
        system_prompt:
          type: string
          description: System prompt for the LLM
        user_prompt:
          type: string
          description: User prompt with finding data
        max_tokens:
          type: integer
          default: 2000
          description: Maximum tokens in response
        temperature:
          type: number
          default: 0.1
          minimum: 0
          maximum: 2
          description: Sampling temperature
        json_mode:
          type: boolean
          default: true
          description: Enforce JSON output format

    CompletionResponse:
      type: object
      required:
        - content
      properties:
        content:
          type: string
          description: LLM response content
        prompt_tokens:
          type: integer
          description: Tokens in prompt
        completion_tokens:
          type: integer
          description: Tokens in completion
        model:
          type: string
          description: Model used for completion
        finish_reason:
          type: string
          enum: [stop, length, error]
          description: Reason for completion

    HealthResponse:
      type: object
      required:
        - status
        - version
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        model:
          type: string
          description: Default model name
        version:
          type: string
          description: Agent version
        capabilities:
          type: array
          items:
            type: string
            enum: [json_mode, streaming]
        backend:
          type: string
          description: LLM backend type (ollama, vllm, etc.)
        uptime_seconds:
          type: integer
          description: Agent uptime
```

---

## Deployment Guide

### Option 1: Docker

```bash
# Pull the agent image
docker pull ghcr.io/openctem/ai-agent:latest

# Run with Ollama backend
docker run -d \
  --name openctem-ai-agent \
  -p 8080:8080 \
  -e AGENT_API_KEY="your-secret-key" \
  -e LLM_BACKEND="ollama" \
  -e OLLAMA_URL="http://ollama:11434" \
  -e OLLAMA_MODEL="llama2:70b" \
  ghcr.io/openctem/ai-agent:latest
```

### Option 2: Docker Compose

```yaml
version: '3.8'

services:
  ai-agent:
    image: ghcr.io/openctem/ai-agent:latest
    ports:
      - "8080:8080"
    environment:
      AGENT_API_KEY: "${AGENT_API_KEY}"
      LLM_BACKEND: "ollama"
      OLLAMA_URL: "http://ollama:11434"
      OLLAMA_MODEL: "llama2:70b"
    depends_on:
      - ollama
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  ollama_data:
```

### Option 3: Kubernetes (Helm)

```bash
# Add OpenCTEM Helm repository
helm repo add openctem https://charts.openctem.io
helm repo update

# Install the AI Agent
helm install ai-agent openctem/ai-agent \
  --namespace openctem \
  --set agent.apiKey="your-secret-key" \
  --set llm.backend="ollama" \
  --set llm.ollamaUrl="http://ollama.openctem.svc:11434" \
  --set llm.model="llama2:70b" \
  --set ingress.enabled=true \
  --set ingress.host="ai-agent.internal.corp.com"
```

**Helm Values (values.yaml):**

```yaml
agent:
  apiKey: ""  # Required: Agent API key
  port: 8080
  replicas: 2

llm:
  backend: "ollama"  # ollama, vllm, openai-compatible
  ollamaUrl: "http://ollama:11434"
  model: "llama2:70b"
  timeout: 60s

resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "1000m"

ingress:
  enabled: true
  className: "nginx"
  host: "ai-agent.internal.corp.com"
  tls:
    enabled: true
    secretName: "ai-agent-tls"

healthCheck:
  enabled: true
  path: "/v1/health"
  interval: 30s
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_API_KEY` | Yes | - | API key for authenticating requests from Platform |
| `LLM_BACKEND` | Yes | `ollama` | Backend type: `ollama`, `vllm`, `openai`, `localai` |
| `OLLAMA_URL` | If using Ollama | - | Ollama server URL |
| `OLLAMA_MODEL` | If using Ollama | - | Model name (e.g., `llama2:70b`) |
| `VLLM_URL` | If using vLLM | - | vLLM server URL |
| `VLLM_MODEL` | If using vLLM | - | Model name |
| `OPENAI_BASE_URL` | If using OpenAI-compatible | - | Base URL for OpenAI-compatible API |
| `OPENAI_API_KEY` | If using OpenAI-compatible | - | API key for OpenAI-compatible backend |
| `AGENT_PORT` | No | `8080` | Port for agent HTTP server |
| `AGENT_TLS_CERT` | No | - | Path to TLS certificate |
| `AGENT_TLS_KEY` | No | - | Path to TLS private key |
| `LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `REQUEST_TIMEOUT` | No | `60s` | Timeout for LLM requests |

### Tenant Configuration

Configure Agent mode in tenant settings:

```json
{
  "ai": {
    "mode": "agent",
    "agent_endpoint": "https://ai-agent.internal.corp.com",
    "agent_api_key": "enc:v1:...",
    "agent_model": "llama2:70b",
    "agent_timeout": 60,
    "agent_health_check": true,
    "fallback_enabled": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `mode` | string | Must be `"agent"` |
| `agent_endpoint` | string | HTTPS URL to your agent |
| `agent_api_key` | string | Encrypted API key |
| `agent_model` | string | Model name (informational) |
| `agent_timeout` | int | Request timeout in seconds |
| `agent_health_check` | bool | Enable periodic health checks |
| `fallback_enabled` | bool | Fall back to platform if agent unavailable |

---

## Supported LLM Backends

### Ollama

Best for: Easy setup, local development, smaller models

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama2:70b

# Run Ollama server
ollama serve
```

**Recommended Models:**
- `llama2:70b` - Best quality, requires ~40GB VRAM
- `llama2:13b` - Good balance, requires ~8GB VRAM
- `mistral:7b` - Fast, requires ~4GB VRAM
- `codellama:34b` - Code-focused, requires ~20GB VRAM

### vLLM

Best for: High throughput, production workloads

```bash
# Install vLLM
pip install vllm

# Run vLLM server
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-2-70b-chat-hf \
  --tensor-parallel-size 4
```

### LocalAI

Best for: OpenAI-compatible API, multiple model support

```bash
# Run LocalAI
docker run -p 8080:8080 \
  -v $PWD/models:/models \
  localai/localai:latest
```

---

## Security Requirements

### Network Security

1. **Private Network**: Agent should only be accessible within your private network
2. **VPN/Firewall**: Restrict access to Platform IP ranges
3. **No Public Exposure**: Never expose agent directly to the internet

### TLS/HTTPS

**Required**: All agent endpoints must use HTTPS.

```bash
# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout agent.key \
  -out agent.crt \
  -subj "/CN=ai-agent.internal.corp.com"

# Configure agent with TLS
docker run -d \
  -e AGENT_TLS_CERT=/certs/agent.crt \
  -e AGENT_TLS_KEY=/certs/agent.key \
  -v $PWD/certs:/certs:ro \
  ghcr.io/openctem/ai-agent:latest
```

### Authentication

1. **Strong API Keys**: Use long, random API keys (minimum 32 characters)
2. **Key Rotation**: Rotate agent API keys periodically
3. **Encryption**: API keys are encrypted at rest in Platform

```bash
# Generate a strong API key
openssl rand -base64 32
```

### Data Handling

1. **No Persistence**: Agent does not store finding data
2. **Memory Only**: All processing happens in memory
3. **Log Sanitization**: Sensitive data is not logged
4. **Request Isolation**: Each request is isolated

---

## Monitoring

### Health Checks

The Platform periodically checks agent health if `agent_health_check` is enabled:

```
GET https://ai-agent.internal.corp.com/v1/health
```

Health status is shown in tenant settings UI.

### Metrics (Prometheus)

The agent exposes Prometheus metrics at `/metrics`:

```
# HELP openctem_agent_requests_total Total number of requests
# TYPE openctem_agent_requests_total counter
openctem_agent_requests_total{status="success"} 1234
openctem_agent_requests_total{status="error"} 5

# HELP openctem_agent_request_duration_seconds Request duration
# TYPE openctem_agent_request_duration_seconds histogram
openctem_agent_request_duration_seconds_bucket{le="1"} 100
openctem_agent_request_duration_seconds_bucket{le="5"} 500
openctem_agent_request_duration_seconds_bucket{le="10"} 600

# HELP openctem_agent_llm_tokens_total Total tokens processed
# TYPE openctem_agent_llm_tokens_total counter
openctem_agent_llm_tokens_total{type="prompt"} 125000
openctem_agent_llm_tokens_total{type="completion"} 45000
```

### Logging

```json
{
  "level": "info",
  "ts": "2025-02-01T10:30:45Z",
  "msg": "completion_request",
  "request_id": "req_abc123",
  "model": "llama2:70b",
  "prompt_tokens": 1250,
  "completion_tokens": 450,
  "duration_ms": 3500
}
```

---

## Troubleshooting

### Connection Test Failed

**Symptom**: "Unable to connect to agent" error in Platform

**Checklist:**
1. Verify agent is running: `curl https://ai-agent.internal/v1/health`
2. Check network connectivity from Platform
3. Verify TLS certificate is valid
4. Confirm API key matches

### Slow Response Times

**Symptom**: Triage requests timing out

**Checklist:**
1. Check LLM backend health
2. Verify GPU is available (for GPU-accelerated models)
3. Consider using a smaller/faster model
4. Increase `agent_timeout` in settings

### Model Quality Issues

**Symptom**: Poor analysis quality compared to platform

**Solutions:**
1. Use a larger model (70B+ parameters recommended)
2. Try a different model architecture
3. Ensure model supports JSON mode
4. Contact support for model recommendations

### Agent Crashes

**Symptom**: Agent process terminates unexpectedly

**Checklist:**
1. Check memory limits (increase if OOM)
2. Review logs for error messages
3. Verify LLM backend is stable
4. Update to latest agent version

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `connection_refused` | Agent not reachable | Check network, verify agent running |
| `unauthorized` | Invalid API key | Verify API key in settings |
| `tls_error` | Certificate issue | Check TLS cert validity |
| `timeout` | Request timed out | Increase timeout, check LLM backend |
| `model_unavailable` | LLM backend down | Restart LLM backend |
| `json_parse_error` | Invalid JSON from LLM | Model may not support JSON mode |

---

## Upgrade Guide

### Checking Version Compatibility

```bash
# Check current agent version
curl https://ai-agent.internal/v1/health | jq .version

# Platform shows required minimum version in settings
```

### Upgrading Docker

```bash
# Pull new version
docker pull ghcr.io/openctem/ai-agent:1.2.0

# Stop current agent
docker stop openctem-ai-agent

# Start new version
docker run -d --name openctem-ai-agent \
  # ... same configuration ...
  ghcr.io/openctem/ai-agent:1.2.0
```

### Upgrading Kubernetes

```bash
# Update Helm release
helm upgrade ai-agent openctem/ai-agent \
  --namespace openctem \
  --set image.tag=1.2.0 \
  --reuse-values
```

---

## License Requirements

Self-Hosted AI Agent requires an **Enterprise** license.

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Platform AI | ✓ | ✓ | ✓ |
| BYOK Mode | - | ✓ | ✓ |
| Agent Mode | - | - | ✓ |

Contact sales@openctem.io for Enterprise licensing.

---

## Related Documentation

- [AI Triage](ai-triage.md) - AI Triage feature overview
- [ADR-007: AI Integration](../decisions/007-ai-integration.md) - Architecture Decision Record
- [Security Architecture](../architecture/security.md) - Security overview
