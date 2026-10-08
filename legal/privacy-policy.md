---
title: Privacy policy
parent: Legal
nav_order: 2
---

# Privacy Policy

**Last Updated: October 2026**

## 1. Introduction

This Privacy Policy describes how OpenCTEM ("we", "us", "the Service") collects, uses, stores, and protects your information when you use the OpenCTEM Continuous Threat Exposure Management platform.

OpenCTEM is an open-source, self-hosted platform. The platform operator (your organization) is the data controller. This policy describes the data handling practices built into the software. For operator-level detail, see [Data handling and privacy](../security/data-handling.md).

## 2. Information We Collect

### 2.1 Account Information

| Data | Purpose | Retention |
|------|---------|-----------|
| Email address | Authentication, notifications | Until the account is erased |
| Display name | User identification | Until the account is erased |
| Password hash (bcrypt) | Authentication | Until the account is erased |
| Identity provider user id (SSO, social sign-in) | Linking sign-ins to the account | Until the account is erased |
| Two-factor secret (encrypted) and recovery codes (hashed) | Two-factor authentication | Until 2FA is turned off or the account is erased |

### 2.2 Tenant/Organization Data

| Data | Purpose | Retention |
|------|---------|-----------|
| Organization name, slug | Organization identification | Until the organization is deleted |
| Member list and roles | Access control (RBAC) | Until the member is offboarded or the organization is deleted |
| Invitation records | User onboarding | Expire after 7 days; kept until the organization is deleted |

### 2.3 Security Data (Your Data)

| Data | Purpose | Retention |
|------|---------|-----------|
| Asset inventory | Attack surface management | Until deleted by a user (deleted assets are purged after 30 days) |
| Vulnerability findings | Risk prioritization | Until deleted by a user |
| Scan results and logs | Security validation | Scan results until deleted; per-task sensor logs 14 days |
| Compliance assessments | Regulatory tracking | Until deleted by a user |
| Remediation workflows | Issue tracking | Until deleted by a user |

### 2.4 Integration Credentials

| Data | Purpose | Storage |
|------|---------|---------|
| API tokens and credentials (Jira, Slack, GitHub, etc.) | Third-party integration | AES-256-GCM encrypted |
| SSO client secrets | Organization single sign-on | AES-256-GCM encrypted |
| Webhook secrets | Verifying inbound webhooks | AES-256-GCM encrypted |

### 2.5 Audit and Usage Data

| Data | Purpose | Retention |
|------|---------|-----------|
| Request logs (IP address, user agent, path) | Security monitoring, troubleshooting | Written to the server's log output; retention is set by the operator's log system |
| Audit trail (actions, actor, IP address, resource) | Compliance, forensics | Indefinitely by default; the operator can archive and prune entries older than 365 days or more |
| Sessions (IP address, user agent, times) | Session management, security analysis | Deleted after the session expires or is revoked (at most 30 days by default) |
| Prometheus metrics | Performance monitoring | Configured by the operator |

## 3. How We Use Your Information

We use your information solely to:

- **Provide the Service** — Authenticate users, enforce access control, manage assets and findings.
- **Security** — Detect unauthorized access, rate limit abuse, audit privileged actions.
- **Notifications** — Send alerts via configured channels (email, Slack, Teams, Telegram, webhooks).
- **Compliance** — Track compliance framework status, generate reports.

We do NOT:

- Sell your data to third parties
- Use your data for advertising
- Share your data across tenants
- Send usage telemetry to the OpenCTEM project
- Train AI models on your data

## 4. Data Security

### 4.1 Encryption

| Layer | Method |
|-------|--------|
| In transit | TLS, terminated at the gateway or ingress |
| Credentials at rest | AES-256-GCM with a per-deployment key |
| Passwords | bcrypt (cost factor 12) |
| Session, refresh and one-time tokens | SHA-256 hashed before storage |
| API keys, SCIM tokens, sensor keys | HMAC-SHA256 hashed with a server-side key; shown once at creation |

### 4.2 Access Control

- **Multi-tenant isolation**: All database queries filtered by `tenant_id`
- **RBAC**: about 160 granular permissions across all modules
- **2-layer model**: Permissions (what you can DO) + Groups (what data you can SEE)
- **Session limits**: Maximum 10 concurrent sessions per user (configurable)
- **Account lockout**: 5 failed login attempts trigger a 15-minute lockout (configurable)
- **Two-factor authentication**: available to every local account, and can be required by an organization

### 4.3 Security Measures

- SSRF protection on outbound URLs (internal IPs, localhost, metadata endpoints blocked)
- CSRF protection with constant-time token comparison
- Rate limiting on all endpoints
- Redirect URI allow-list validation for sign-in flows
- Input validation with parameterized SQL queries
- Tamper-evident audit logging for privileged operations

## 5. Data Sharing

### 5.1 Within Your Organization

- Tenant members can access data according to their RBAC permissions and group memberships.
- Tenant owners and administrators can view audit logs.

### 5.2 Third-Party Integrations

When an administrator configures integrations, data may be shared with:

| Integration | Data Shared | Purpose |
|-------------|-------------|---------|
| Jira | Finding title, severity, description | Ticket creation |
| Slack / Teams / Telegram | Alert summaries, severity | Notifications |
| GitHub / GitLab | Repository metadata, scan status | SCM sync |
| Email (SMTP) | Alert content, invitation and password links | Notifications, invitations |
| AI providers (Anthropic Claude, OpenAI, Google Gemini) | Finding details | AI-assisted triage, if enabled |
| Webhooks / Splunk HEC | Event payloads | Custom integrations |

**AI triage** is off unless the operator enables it, and each organization chooses whether to use it with the platform's provider, its own API key, or not at all. When it is used, finding details are sent to the selected provider for analysis and are subject to that provider's data processing terms.

### 5.3 No Other Sharing

We do not share your data with any other third parties unless:
- Required by law or legal process
- Necessary to protect the rights, property, or safety of users

## 6. Data Retention

| Data Category | Default Retention | Configurable |
|---------------|-------------------|--------------|
| User accounts | Until erased | No |
| Security data (assets, findings) | Until deleted by a user | No |
| Audit logs | Indefinitely; can be archived and pruned after 365 days or more | Yes |
| Session records | Deleted once expired or revoked (sessions last at most 30 days) | Session lifetime only |
| Invitations | Expire after 7 days | No |
| In-app notification history | 90 days | No |
| Soft-deleted assets | Purged after 30 days | No |

### 6.1 Deletion

- Organization owners can offboard members and erase a former member's personal data; erasure anonymises the account. Existing audit log entries keep the details recorded at the time.
- Tenant owners can delete the entire tenant. Its database records are deleted immediately; uploaded files and backups are removed by the platform operator.
- Backup retention is managed by the platform operator.

## 7. Your Rights

Depending on your jurisdiction, you may have the following rights:

| Right | How to Exercise |
|-------|-----------------|
| **Access** | Export your data via the Service's export features, or ask your tenant administrator |
| **Correction** | Update your profile and data through the Service |
| **Deletion** | Ask your tenant administrator to offboard and erase your account |
| **Portability** | Export data in CSV/JSON format via API |
| **Objection** | Contact your tenant administrator |
| **Restriction** | Contact your tenant administrator |

For GDPR, CCPA, or other regulatory requests, contact your platform administrator.

## 8. Cookies and Local Storage

| Storage | Purpose | Duration |
|---------|---------|----------|
| `auth_token` (httpOnly cookie) | Access token | 15 minutes |
| `refresh_token` (httpOnly cookie) | Session renewal | 7 days |
| `csrf_token` (cookie) | CSRF protection | 7 days |
| `app_tenant` (cookie) | Selected organization | 7 days |
| `app_user_info`, `app_pending_tenants` (cookies) | Sign-in and organization selection | 5 minutes, 1 hour |
| `mfa_challenge` (httpOnly cookie) | Two-factor sign-in step | 5 minutes |
| `saml_authn_<org>` (cookie) | SAML sign-in in progress | Sign-in duration |
| `admin_session`, `admin_mfa`, `admin_csrf`, `admin_idp` (cookies) | Platform admin console session | Console session (at most 8 hours) |
| `locale` (cookie) | Language preference | 1 year |
| `sidebar_state` (cookie) | Sidebar open or closed | 7 days |
| `theme` and other UI preference keys (localStorage) | UI preferences (theme, dashboard view, table density, filter panels) and unsent form drafts | Persistent, in your browser only |
| Invitation token (sessionStorage) | Completing an invitation across sign-in | Until the tab is closed |

No third-party tracking cookies or analytics are used by the platform.

## 9. Children's Privacy

The Service is not intended for use by individuals under the age of 16. We do not knowingly collect personal information from children.

## 10. International Data Transfers

For self-hosted deployments, data remains within your infrastructure. The platform operator is responsible for compliance with data transfer regulations (GDPR, etc.) based on their deployment location.

When cloud-based AI triage is used, finding data is processed in the AI provider's infrastructure. Review the provider's data processing terms for details.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted with an updated "Last Updated" date. We recommend reviewing this policy periodically.

## 12. Contact

For privacy-related questions:

- **Platform administrators**: Contact your organization's IT/security team
- **Data protection inquiries**: Contact your organization's Data Protection Officer (DPO)
- **Open-source project**: [info@openctem.io](mailto:info@openctem.io)
- **Security vulnerabilities**: [security@openctem.io](mailto:security@openctem.io) (see [Vulnerability disclosure](../security/vulnerability-disclosure.md))

---

**OpenCTEM** — Open-Source Continuous Threat Exposure Management
