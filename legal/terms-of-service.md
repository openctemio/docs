# Terms of Service

**Last Updated: April 2026**

## 1. Acceptance of Terms

By accessing or using the OpenCTEM platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.

## 2. Description of Service

OpenCTEM is an open-source Continuous Threat Exposure Management (CTEM) platform that provides:

- Asset inventory and attack surface management
- Vulnerability scanning and finding management
- Risk scoring and prioritization
- Compliance tracking and reporting
- Remediation workflow automation
- Multi-tenant team collaboration

## 3. Accounts and Access

### 3.1 Account Creation

- Accounts are created through invitation by a tenant administrator or self-registration (if enabled by the platform operator).
- You must provide accurate and complete information during registration.
- You are responsible for maintaining the confidentiality of your credentials.

### 3.2 Multi-Tenancy

- Each organization operates within an isolated tenant.
- Data is strictly separated between tenants.
- You may not attempt to access data belonging to other tenants.

### 3.3 Roles and Permissions

- Access is governed by role-based access control (RBAC).
- Tenant owners and administrators manage user access and permissions.
- Platform administrators manage system-wide settings.

## 4. Acceptable Use

You agree NOT to:

- Attempt to gain unauthorized access to any part of the Service or other accounts.
- Use the Service to conduct unauthorized scanning or testing against systems you do not own or have explicit permission to test.
- Upload malicious code, malware, or exploit payloads except as part of authorized security testing within the platform.
- Reverse engineer, decompile, or disassemble any part of the Service (except as permitted by applicable open-source licenses).
- Use the Service in violation of any applicable law or regulation.
- Interfere with or disrupt the Service or servers or networks connected to the Service.
- Use automated scripts to collect information from or interact with the Service beyond the provided APIs.

## 5. Scanning and Testing

### 5.1 Authorization

- You are solely responsible for ensuring you have proper authorization before scanning any target.
- The Service provides tools for security scanning — you must only use them against assets you own or have written permission to test.
- Unauthorized scanning may violate laws including the Computer Fraud and Abuse Act (CFAA) or equivalent local legislation.

### 5.2 Findings and Data

- Security findings discovered through the Service are your responsibility to manage and remediate.
- The Service does not guarantee the accuracy or completeness of scan results.
- You should validate findings before taking remediation action.

## 6. Data and Privacy

### 6.1 Your Data

- You retain ownership of all data you input into the Service ("Your Data").
- Your Data includes: assets, findings, scan results, configurations, and team information.
- We process Your Data solely to provide the Service.

### 6.2 Data Security

- Data is encrypted in transit (TLS) and at rest (AES-256-GCM for sensitive credentials).
- Multi-tenant isolation ensures data separation between organizations.
- We implement industry-standard security practices including RBAC, audit logging, and rate limiting.

### 6.3 Data Retention

- Your Data is retained as long as your account is active.
- Upon account deletion, Your Data will be permanently removed within 30 days.
- Audit logs may be retained for up to 90 days for security and compliance purposes.

See our [Privacy Policy](privacy-policy.md) for detailed information on data handling.

## 7. Intellectual Property

### 7.1 Open Source License

- OpenCTEM is released under the GNU General Public License (GPL).
- You may use, modify, and distribute the software in accordance with the license terms.
- Contributions to the project are subject to the project's contribution guidelines.

### 7.2 Trademarks

- "OpenCTEM" and associated logos are trademarks of the OpenCTEM project.
- You may not use these trademarks without prior written permission, except as required for reasonable and customary use in describing the origin of the software.

## 8. Third-Party Integrations

- The Service integrates with third-party tools (Jira, Slack, GitHub, etc.).
- Your use of third-party integrations is subject to those providers' terms of service.
- We are not responsible for the availability, accuracy, or security of third-party services.
- Credentials for third-party integrations are encrypted using AES-256-GCM.

## 9. Service Availability

### 9.1 Self-Hosted

- For self-hosted deployments, you are responsible for infrastructure, uptime, and maintenance.
- We provide documentation and community support but no SLA for self-hosted installations.

### 9.2 No Warranty

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

## 10. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE OPENCTEM PROJECT OR ITS CONTRIBUTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, OR BUSINESS INTERRUPTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OF THE SERVICE.

## 11. Indemnification

You agree to indemnify and hold harmless the OpenCTEM project and its contributors from any claims, damages, or expenses arising from:

- Your use of the Service
- Your violation of these Terms
- Your unauthorized scanning or testing activities
- Your violation of any applicable law or regulation

## 12. Changes to Terms

We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the Service after changes constitutes acceptance of the modified Terms.

## 13. Governing Law

These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the platform operator resides, without regard to conflict of law provisions.

## 14. Contact

For questions about these Terms, please contact the platform administrator or open an issue at the project repository.

---

**OpenCTEM** — Open-Source Continuous Threat Exposure Management
