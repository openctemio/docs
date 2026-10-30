---
title: Glossary
parent: Overview
nav_order: 4
---

# Glossary

Terms as OpenCTEM uses them, in the console, the API and these docs. Each concept has one name; the
engineering glossary in the openctem repository ([api/docs/glossary.md](https://github.com/openctemio/openctem/blob/develop/api/docs/glossary.md))
adds the API, database and code names and the Vietnamese console wording.

| Term | Meaning |
|---|---|
| **AI agent** | An AI principal that works on an organization's data under its own identity, with people who answer for it and a role: analyst, remediator, reporter, hunter or router. Everything it does carries an AI label and is audited. Always "AI agent": a bare "agent" is never a sensor. |
| **AI assistant (MCP)** | An AI application that connects to the MCP server with a sign-in flow and works with an organization's data as the person who approved it, within the organization's policy (**Settings > Access > AI assistants (MCP)**). See [Connect an AI assistant](../user-guide/12-connect-an-ai-assistant.md). |
| **API key** | A credential for scripts and AI clients, shown once as `oct_...`. Bound to one organization and the user who created it; read-only on the REST API, also used by the MCP server. |
| **Asset** | Anything an organization owns that can be attacked: domain, IP address, host, service, web endpoint, certificate, repository, cloud account, container image, identity and more. |
| **Asset group** | A named set of assets used to organise them and as scan targets. |
| **Attack path** | A chain of exposures from a public entry point to an important asset. |
| **Automation** | An event rule: when an event happens and conditions hold, take actions (assign, notify, open a ticket). |
| **Break-glass administrator** | A local platform administrator for emergencies, never bound to an identity provider; console-only (it cannot join an organization or sign in on the main site), and every sign-in is audited and alerted. |
| **CI run** | One execution of a customer's CI pipeline that reports to OpenCTEM through `openctem-ci`. |
| **Command** | Any instruction the platform queues for a sensor: a task, a configuration update, a health check. |
| **Content catalog** | The signed, versioned packages of scanner content and feeds that an instance or an organization installs, pins and rolls back from offline bundles (**Settings > Scanner content > Content catalog**). |
| **Content pack** | A signed, immutable archive of scanner content (nuclei templates, SAST rules, a wordlist), stored once and named by its SHA-256 digest. See [Scanner content and content packs](../sensors/content-delivery.md). |
| **Crown jewel** | An asset marked as business-critical; findings on it are prioritised higher. |
| **CTEM** | Continuous Threat Exposure Management: a repeating cycle of scoping, discovery, prioritization, validation and mobilization. |
| **CTEM cycle** | A period of CTEM work with objectives, scope, attacker profiles and success criteria. |
| **CTIS** | CTEM Ingest Schema: the open JSON format tools use to send assets, findings and dependencies to OpenCTEM. Specification at [openctemio/ctis](https://github.com/openctemio/ctis). |
| **Data-flow trace** | The path a SAST finding's untrusted data takes from its source to the sink, step by step with the code of each step. See [Data-flow traces](../scanning/data-flow-traces.md). |
| **Deadline** (of a run) | When a scan run ends at the latest: the scan's max duration, else the workflow's timeout, else the platform's 24-hour cap. |
| **Elevation** | Acting as one of your platform roles for 15 to 60 minutes in the platform console; without it a console session is read-only. It needs a fresh second-factor proof and a reason, and is audited. |
| **Exposure event** | An attack-surface change that is not a vulnerability, such as an open port, a public bucket, an expiring certificate or a leaked credential. |
| **Exposures** | The console section that lists findings by kind (vulnerabilities, secrets, code weaknesses, misconfigurations) next to exposure events. |
| **Finding** | One weakness on one asset, from a scan, an import or an integration. De-duplicated by fingerprint. Kinds: vulnerability, secret, misconfiguration, code weakness, compliance. |
| **Gateway** | The built-in Caddy reverse proxy that is the platform's single HTTPS entry point. |
| **Host wait** | A queued task waits while another task of the same organization is scanning one of its hosts. See [Why a task waits](../scanning/why-waiting.md). |
| **Known false positive** | A finding a person, an approved suppression rule or an approved repository claim decided is not a real issue. It stays decided when it is reported again, also by another scanner engine. See [Known false positives](../user-guide/known-false-positives.md). |
| **Live hosts first** | The default way to scan an address range: a light probe finds the live addresses, then deeper steps scan only those and the addresses already in the inventory. |
| **Organization** | The unit of isolation (a tenant): its own members, assets, findings, sensors, integrations and audit log. |
| **Owner** (organization role) | The role with full control of an organization, including deleting it. |
| **Platform administrator** | An operator account that runs the installation from the platform console with platform roles. The same account may also be an ordinary member of organizations on the main site, where it has only its organization role; the platform role counts only in the console. |
| **Platform console** | The operators' own web application, on its own site (a port, by default 8443, or a host name) with its own sign-in and second factor, for organizations, users, system settings and shared sensors. |
| **Platform role** | A console role made of `platform.*` permissions: the base roles platform owner, platform admin and read-only, and the additional roles operator, support, security auditor and billing. Never applies inside an organization. See [Roles and elevation](../console/index.md#roles-and-elevation). |
| **Playbook** | A procedure an AI agent follows, written and tested with `openctem playbook init` and `openctem playbook test`. Not an Ansible playbook. |
| **Priority** | A finding's ranking for remediation, computed from severity, EPSS, CISA KEV, asset criticality, reachability, exposure and priority rules, with an explanation. |
| **Quick scan** | One scanner run on up to 1,000 targets at once without saving a scan configuration; it can be saved afterwards. |
| **Remediation campaign** | A set of findings with an owner, a deadline and tracked progress. |
| **Retest** | A re-check of a finding by a sensor, typically after a fix. |
| **Rules pack** | The signed OpenCTEM SAST rules for opengrep ([sast-rules](https://github.com/openctemio/sast-rules)), the default rules of platform and CI static analysis. |
| **Run flow** | The Run map of a scan run: its steps as one flow, each with its state, tool, progress and results. See [The run flow](../scanning/scans-and-runs.md#the-run-flow). |
| **Scan** | A scan configuration: targets, scan workflow and schedule. A scan has runs, a run has steps, a step has tasks. |
| **Scan approval** | How much human approval an organization's scans and scope changes need: **Off** (the default), **On** (approval rules decide) or **Strict** (two approvers and a justification, and a deepest-probe ceiling on every scope entry). An operator can force a mode. |
| **Scan run** | One execution of a scan. Its kind is shown in the Runs list: scan, quick scan, retest, validation and others. |
| **Scan workflow** | A reusable graph of steps (which tools run, in which order) that scans use. |
| **Scan zone** | A set of address ranges plus the sensors that can reach them. Network scans go to the narrowest matching zone, whose sensors share the work. |
| **Scope** | What an organization may test: targets and exclusions, checked whenever a scan is triggered. |
| **Sensor** | Software run in your networks that connects out to the platform with its own key, claims tasks and reports results. Roles: scanner (assesses other hosts), collector (pushes data from systems inside your network), AI worker (runs AI agents), and endpoint (planned: reports about its own host). |
| **Sensor key** | A sensor's credential, `octs_...`. Bound to one organization (or to the platform for platform sensors). |
| **Severity** | The impact of a finding as rated by its source (critical, high, medium, low, info). Not the same as priority. |
| **Shared sensor** | A sensor the operator runs for every organization, for public targets; organizations use it through scans but never see it. An owner can opt the organization out. |
| **Sign-in method link** | A Google, GitHub or Microsoft sign-in attached to an existing account. Never made automatically: each link and unlink needs a typed authenticator code (or the password when two-factor is off). See [Linking a provider](../identity/social-login.md#linking-a-provider-to-your-account). |
| **Sign-up mode** | The operator's ceiling for public account creation, `SIGNUP_MODE`: `disabled` (the default), `domain` (only addresses on an organization's verified domain, who join that organization) or `open` (anyone, and they may create an organization). |
| **SLA** | A remediation deadline per priority or severity, with warnings before a breach. |
| **Stall window** | How long a running task may go without any progress (no target finished, no output, no CPU time) before the platform stops it and re-queues its unfinished targets. Between 5 minutes and 1 hour, set per task by the platform. |
| **Step** | One step of a scan run. |
| **Step-up** | A fresh proof of identity (an authenticator code, the password, or a new sign-in at the identity provider) that a sensitive action asks for inside a signed-in session. See [Step-up re-authentication](../identity/two-factor.md#step-up-re-authentication). |
| **Suppression rule** | An approved rule that marks matching findings as false positive or accepted risk, both the open ones when it is approved and new ones at ingest. |
| **Task** | One unit of sensor work within a step, for a chunk of targets. Also the word for a unit of remediation work (a **remediation task**); the console always shows which. Not called a job. |
| **Team** | A group of members within an organization that is assigned assets (**Settings > Access > Teams**; `/api/v1/groups` in the API). A member sees the assets (and their findings) of their teams, plus individual grants. Never the organization itself. |
| **Tenant** | Not used in these docs: an organization. The word remains in a few API paths, settings and CI inputs (for example `tenant-id`). |
| **Two-factor floor** | The lowest two-factor requirement the platform sets for every organization (`none`, `admins` or `everyone`), with a grace period; an organization can require more, never less. See [The platform two-factor floor](../identity/two-factor.md#the-platform-two-factor-floor). |
| **Unfinished targets** | The targets of a task that stopped part-way. Only these run again, as a new task; finished targets are kept. |
| **Validation** | Confirming whether a finding is really exploitable, or really fixed, with a safe check run by a sensor, and recording the evidence. |
| **Verified domain** | A domain whose control the organization proved with a DNS record. Active scanning can be limited to verified domains. |
| **Vulnerability** | A known weakness in software, usually with a CVE id, from the vulnerability catalog. A finding may point at one. See [Vulnerabilities](../user-guide/vulnerabilities.md). |
