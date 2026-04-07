# Privacy Policy

**Last Updated: April 2026**

## 1. Introduction

This Privacy Policy describes how OpenCTEM ("we", "us", "the Service") collects, uses, stores, and protects your information when you use the OpenCTEM Continuous Threat Exposure Management platform.

OpenCTEM is an open-source, self-hosted platform. The platform operator (your organization) is the data controller. This policy describes the data handling practices built into the software.

## 2. Information We Collect

### 2.1 Account Information

| Data | Purpose | Retention |
|------|---------|-----------|
| Email address | Authentication, notifications | Until account deletion |
| Display name | User identification | Until account deletion |
| Password hash (bcrypt) | Authentication | Until account deletion |
| OAuth provider ID | Social login | Until account deletion |

### 2.2 Tenant/Organization Data

| Data | Purpose | Retention |
|------|---------|-----------|
| Team name, slug | Organization identification | Until tenant deletion |
| Member list and roles | Access control (RBAC) | Until membership removal |
| Invitation records | User onboarding | 7 days after acceptance/expiry |

### 2.3 Security Data (Your Data)

| Data | Purpose | Retention |
|------|---------|-----------|
| Asset inventory | Attack surface management | Until deletion by user |
| Vulnerability findings | Risk prioritization | Until deletion or resolution |
| Scan results and logs | Security validation | Until deletion by user |
| Compliance assessments | Regulatory tracking | Until deletion by user |
| Remediation workflows | Issue tracking | Until completion + configured retention |

### 2.4 Integration Credentials

| Data | Purpose | Storage |
|------|---------|---------|
| API tokens (Jira, Slack, GitHub, etc.) | Third-party integration | AES-256-GCM encrypted |
| OAuth tokens | Social login / SCM sync | AES-256-GCM encrypted |
| Webhook URLs | Notification delivery | Plaintext (validated against SSRF) |

### 2.5 Audit and Usage Data

| Data | Purpose | Retention |
|------|---------|-----------|
| API access logs | Security monitoring | Configurable (default: 90 days) |
| Audit trail (actions, actor, resource) | Compliance, forensics | Configurable (default: 1 year) |
| Login history (IP, timestamp, user agent) | Security analysis | Session duration + 30 days |
| Prometheus metrics | Performance monitoring | Configurable (in-memory or external) |

## 3. How We Use Your Information

We use your information solely to:

- **Provide the Service** — Authenticate users, enforce access control, manage assets and findings.
- **Security** — Detect unauthorized access, rate limit abuse, audit privileged actions.
- **Notifications** — Send alerts via configured channels (email, Slack, Teams, Telegram, webhooks).
- **Compliance** — Track compliance framework status, generate reports.
- **Improvement** — Aggregate anonymized usage metrics (if telemetry is enabled by the operator).

We do NOT:

- Sell your data to third parties
- Use your data for advertising
- Share your data across tenants
- Train AI models on your data (AI triage uses your data in-session only, no storage by LLM providers)

## 4. Data Security

### 4.1 Encryption

| Layer | Method |
|-------|--------|
| In transit | TLS 1.2+ (enforced by Nginx/Ingress) |
| Credentials at rest | AES-256-GCM with per-deployment key |
| Passwords | bcrypt (cost factor 12) |
| Session tokens | SHA-256 hashed before storage |
| API keys | bcrypt hashed, only prefix stored for lookup |

### 4.2 Access Control

- **Multi-tenant isolation**: All database queries filtered by `tenant_id`
- **RBAC**: 155 granular permissions across all modules
- **2-layer model**: Permissions (what you can DO) + Groups (what data you can SEE)
- **Session limits**: Maximum 10 concurrent sessions per user
- **Account lockout**: 5 failed login attempts triggers 15-minute lockout

### 4.3 Security Measures

- SSRF protection on all URL inputs (internal IPs, localhost, metadata endpoints blocked)
- CSRF protection with constant-time token comparison
- Rate limiting on all endpoints (configurable RPS)
- OAuth redirect URI whitelist validation
- Command injection prevention in scan executors
- Input validation with parameterized SQL queries
- Audit logging for all privileged operations

## 5. Data Sharing

### 5.1 Within Your Organization

- Tenant members can access data according to their RBAC permissions and group memberships.
- Tenant owners and administrators can view audit logs.

### 5.2 Third-Party Integrations

When you configure integrations, data may be shared with:

| Integration | Data Shared | Purpose |
|-------------|-------------|---------|
| Jira / Linear / Asana | Finding title, severity, description | Ticket creation |
| Slack / Teams / Telegram | Alert summaries, severity | Notifications |
| GitHub / GitLab | Repository metadata, scan status | SCM sync |
| Email (SMTP) | Alert content, invitation links | Notifications, invitations |
| AI Providers (Claude, OpenAI, Gemini) | Finding details (in-session only) | AI-powered triage |
| Webhooks | Event payloads (configurable) | Custom integrations |

**Important**: AI triage sends finding details to the configured LLM provider for analysis. Data is processed in-session and subject to the provider's data processing terms. No data is stored by the LLM provider beyond the session.

### 5.3 No Other Sharing

We do not share your data with any other third parties unless:
- Required by law or legal process
- Necessary to protect the rights, property, or safety of users

## 6. Data Retention

| Data Category | Default Retention | Configurable |
|---------------|-------------------|--------------|
| User accounts | Until deleted | No |
| Security data (assets, findings) | Until deleted by user | No |
| Audit logs | 1 year | Yes |
| API access logs | 90 days | Yes |
| Session records | 30 days after expiry | Yes |
| Invitation tokens | 7 days | Yes |
| Notification history | 90 days | Yes |
| Expired scan results | Indefinite | Yes (via data retention policies) |

### 6.1 Deletion

- Users can delete their own data through the Service interface.
- Tenant owners can delete the entire tenant and all associated data.
- Upon deletion, data is permanently removed from the database within 30 days.
- Backup retention is managed by the platform operator.

## 7. Your Rights

Depending on your jurisdiction, you may have the following rights:

| Right | How to Exercise |
|-------|-----------------|
| **Access** | Export your data via the Service's export features |
| **Correction** | Update your profile and data through the Service |
| **Deletion** | Delete your account or request deletion from your tenant admin |
| **Portability** | Export data in CSV/JSON format via API |
| **Objection** | Contact your tenant administrator |
| **Restriction** | Contact your tenant administrator |

For GDPR, CCPA, or other regulatory requests, contact your platform administrator.

## 8. Cookies and Local Storage

| Storage | Purpose | Duration |
|---------|---------|----------|
| `access_token` (httpOnly cookie) | Authentication | 15 minutes |
| `refresh_token` (httpOnly cookie) | Session renewal | 7 days |
| `csrf_token` (cookie) | CSRF protection | Session |
| `locale` (localStorage) | Language preference | Persistent |
| `theme` (localStorage) | UI theme preference | Persistent |
| `direction` (localStorage) | RTL/LTR layout | Persistent |

No third-party tracking cookies or analytics are used by the platform.

## 9. Children's Privacy

The Service is not intended for use by individuals under the age of 16. We do not knowingly collect personal information from children.

## 10. International Data Transfers

For self-hosted deployments, data remains within your infrastructure. The platform operator is responsible for compliance with data transfer regulations (GDPR, etc.) based on their deployment location.

When using cloud-based AI triage (Claude, OpenAI, Gemini), finding data may be processed in the AI provider's infrastructure. Review the provider's data processing terms for details.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted with an updated "Last Updated" date. We recommend reviewing this policy periodically.

## 12. Contact

For privacy-related questions:

- **Platform administrators**: Contact your organization's IT/security team
- **Open-source project**: Open an issue at the project repository
- **Data protection inquiries**: Contact your organization's Data Protection Officer (DPO)

---

**OpenCTEM** — Open-Source Continuous Threat Exposure Management
