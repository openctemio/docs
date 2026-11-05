---
title: Editions
parent: Overview
nav_order: 6
---

# Editions

OpenCTEM is one codebase run three ways. **Community** is the open-source
platform described in these docs and is complete for practitioners: the whole
CTEM cycle (scoping, discovery, prioritization, validation, mobilization),
sensors, integrations, AI triage with your own model, pentest campaigns, and
every security control. The **Enterprise edition** adds features for larger organizations on
top of the same platform, and a **hosted service** runs the Enterprise edition
for you.

Community never shows locked items, greyed-out features or upgrade prompts.

## What the Enterprise edition adds

| Feature | What it does | Status |
|---|---|---|
| Audit streaming | Copy of the administrators' audit log streamed off the box (syslog over TLS, HTTPS) with a resumable cursor | in Community in every release so far (v0.20.x); planned to move to Enterprise |
| Trusted organizations | Members of a trusted organization sign in with their home identity under a role ceiling and key policy you set | in Community in every release so far (v0.20.x); planned to move to Enterprise |
| SCIM provisioning and IdP group links | Create and reactivate members from your identity provider and map its groups to roles | in Community in every release so far (v0.20.x); planned to move to Enterprise |
| White-label branding | Your product name, logo and colours on the installation, reports and e-mails | in Community in every release so far (v0.20.x); planned to move to Enterprise |
| Executive summary | Board-level exposure summary with HTML and PDF export | in Community in every release so far (v0.20.x); planned to move to Enterprise |
| Attack simulation and control testing | Scheduled attack simulations and control tests with evidence linked to validation runs | in Community in every release so far (v0.20.x); planned to move to Enterprise |
| Scheduled reports | Recurring report delivery on a schedule | in Community in every release so far (v0.20.x); planned to move to Enterprise |
| Licence and subscription | Licence status, activation, usage and expiry notices in the platform console | planned |
| Evidence packs and custom frameworks | Your own frameworks and controls, evidence mapping, signed snapshots for auditors | planned |
| Legal hold and per-class retention | Holds that keep covered data from retention and erasure | planned |
| SIEM and SOAR pack | Audit and finding event streams in SIEM formats, inbound SOAR actions | planned |
| Multi-organization parent console | A parent organization manages consented child organizations | planned |
| SLA and OLA governance | Escalation chains, OLAs per team, business-hour calendars | planned |
| ServiceNow ITSM and CMDB two-way | Incidents from findings with state sync back, CI-to-asset reconciliation | planned |
| Risk in money | Expected loss per business service, with the assumptions shown | planned |
| Policy gates, risk-model governance | Organization-wide required checks; approval and back-testing of scoring models | planned |

Running SCIM provisioning or an audit sink? The features marked "planned to move
to Enterprise" are in Community today. No release and no date is committed: the
release notes of the release that moves them will say so, and an upgrade guide
will say what to do. Deprovisioning through SCIM keeps working in Community.

Two components with their own runtime are licensed separately: the **asset
collector** (on-premises estate, directory and MDM sources) and the **AI
worker** (runs AI agent playbooks on your own model endpoint).

## Always in Community

Security is never a paid feature, in any edition or hosted plan:

- sign-in, password policy and sessions;
- SSO login (OIDC, SAML) and SSO enforcement;
- multi-factor authentication and its enforcement;
- audit log view, search, export and hash-chain verification;
- SCIM deprovisioning (deactivate, suspend, delete members) and SCIM tokens;
- support-access controls;
- exporting and erasing your organization's data;
- operator limits.

## Moving between editions

An installation moves in place: same database, data, users, sensors (no
re-pairing) and keys; only the images change.

| From | To | Supported |
|---|---|---|
| Community vX | Enterprise vX | always |
| Community vX | Enterprise vY (Y > X) | along the normal upgrade path |
| Enterprise vX | Community vX | yes; Enterprise data stays in its own database schema, unused, and nothing is lost |

1. Back up the database.
2. Switch the images to the Enterprise images of the same version (Docker
   Compose image names, the Helm `edition` and registry values, or the Ansible
   kit's edition variable).
3. Start: the migrations container applies the Enterprise schema after the core
   migrations. Without a licence the Enterprise edition behaves exactly like
   Community.
4. Activate the licence in the platform console.

To go back, switch the images back.

## Build your own edition

Community has a public, versioned extension API: anyone can build an edition
with their own pages, settings, background jobs and integrations, and the
Enterprise edition is built the same way. See the extension API guide in the
repository: `api/docs/development/extension-api.md`.
