---
title: Architecture
parent: Overview
nav_order: 1
---

# Architecture
{: .no_toc }

The components of an OpenCTEM installation, how data moves between them, how
organizations are kept apart, and where the trust boundaries are. Engineering
detail for each part is in
[api/docs/architecture](https://github.com/openctemio/openctem/tree/develop/api/docs/architecture)
in the openctem repository.

1. TOC
{:toc}

---

## Components

```mermaid
flowchart LR
    subgraph inet["Internet"]
        BR["Browsers"]
        CLI["API-key and<br/>MCP clients"]
    end
    subgraph adm["Operator networks"]
        PADM["Platform<br/>administrators"]
    end
    subgraph cip["CI provider"]
        CIJ["CI job running<br/>openctem-ci"]
    end
    subgraph cust["Customer networks"]
        SEN["Sensors<br/>(scanner, collector)"]
        TGT["Targets"]
    end
    subgraph opnet["Operator network: the platform"]
        GW["Gateway (Caddy)<br/>main HTTPS port,<br/>console site"]
        WEB["Web console<br/>(Next.js)"]
        PCON["Platform console<br/>(Next.js)"]
        API["API (Go)<br/>one process: HTTP and<br/>background work"]
        PG[("PostgreSQL")]
        RD[("Redis")]
    end
    subgraph ext["Internet: services the platform uses"]
        IDP["Identity providers<br/>Entra ID, Google, Okta, SAML"]
        TIX["Jira, GitHub, GitLab"]
        FEEDS["EPSS, CISA KEV, ctem.org,<br/>CT logs"]
        NOTIF["Slack, Teams, Telegram,<br/>email, webhooks, Splunk HEC"]
        AI["AI providers<br/>(optional)"]
    end

    BR -->|HTTPS| GW
    CLI -->|"HTTPS, oct_ key"| GW
    CIJ -->|"outbound HTTPS,<br/>job OIDC token"| GW
    SEN -->|"outbound HTTPS or gRPC<br/>with mutual TLS"| GW
    PADM -->|"HTTPS, console site<br/>(allowed networks only)"| GW
    GW -->|"console pages"| PCON
    PCON -->|"server-side proxy,<br/>console API listener"| API
    SEN --> TGT
    GW -->|"pages, console<br/>API calls"| WEB
    WEB -->|"server-side<br/>proxy"| API
    GW -->|"sensors, CI, SCIM, MCP,<br/>webhooks, WebSocket"| API
    API --> PG
    API --> RD
    API <-->|"SSO"| IDP
    API <-->|"issues, webhooks,<br/>repositories"| TIX
    API --> FEEDS
    API --> NOTIF
    API --> AI
```

The subgraphs are the trust boundaries. The platform runs in the operator's
network and accepts connections only through the gateway. The platform console
has its own site on the gateway (a port, by default 8443, or its own host
name), open only to the networks the operator allows. Sensors run in the
networks they scan and only connect out. CI jobs run at the CI provider and
prove who they are with the provider's OIDC token. The platform never opens a
connection to a sensor or a CI job, and never sends probes to targets itself.

| Component | What it does | Code |
|---|---|---|
| Gateway | The public entry point. Terminates TLS (four modes) and routes each request to the API or the web console by path and credential. On the main HTTPS port it also hands sensor connections that offer the sensor protocol's ALPN id to the API's mutual-TLS listener (`api:9443`), and it serves the platform console's own site. | [`api/deploy/gateway`](https://github.com/openctemio/openctem/tree/develop/api/deploy/gateway) |
| Web console | The organizations' user interface. Serves pages and proxies the browser's API calls (authenticated by the session cookie) to the API on the server side. The browser's WebSocket goes from the gateway straight to the API. Holds no state of its own and contains no platform-administration page. | [`web/`](https://github.com/openctemio/openctem/tree/develop/web) |
| Platform console | The operators' user interface (organizations, users, system settings, shared sensors, health): a separate application and image (`ghcr.io/openctemio/openctem-console`) on its own site, with its own sign-in and second factor. It talks to the API's console listener (`api:8081`). Holds no state of its own. See [Platform administration](../user-guide/11-platform-administration.md). | [`web/console`](https://github.com/openctemio/openctem/tree/develop/web/console) |
| API | All business logic: the REST API, the sensor protocol, ingest of scan results, the WebSocket for live updates, the console API, and the background work (see [Background work](#background-work)). One long-running process with three listeners: the main one (`:8080`), the console API (`:8081`) and the sensor mutual-TLS listener (`:9443`); none is published, the gateway reaches them. `bootstrap-admin` and the maintenance commands are separate one-shot binaries. | [`api/`](https://github.com/openctemio/openctem/tree/develop/api) |
| PostgreSQL | The system of record for every organization's data, the audit logs and the job queues that must survive a restart. | |
| Redis | Caches, permission versions, rate-limit state, the background job queue and the WebSocket fan-out. Not a system of record. | |
| Sensors | Run scans close to the targets. Connect outbound to the gateway, claim tasks, run the scanners, report results. Released separately. | [openctemio/sensor](https://github.com/openctemio/sensor), [openctemio/sdk-go](https://github.com/openctemio/sdk-go) |
| CI runner | `openctem-ci` runs one scan capability in a CI job and uploads the result with the job's OIDC identity. | [openctemio/ci](https://github.com/openctemio/ci) |

The API is a single Go binary organised in layers (domain, application services,
infrastructure adapters) per bounded context; see
[clean-arch.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/clean-arch.md)
and
[project-structure.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/project-structure.md).

## Data flow

### A scan, end to end

```mermaid
sequenceDiagram
    participant U as User or schedule
    participant API as API
    participant DB as PostgreSQL
    participant S as Sensor
    participant T as Target
    U->>API: Trigger a scan
    API->>API: Check scope, scan windows, sensors and tools
    API->>DB: Create scan run, steps and tasks
    S->>API: Heartbeat (advised interval, pending work)
    S->>API: Claim a task (lease)
    S->>T: Run the scanner
    S->>API: Report results (protocol v2 or v3)
    API->>API: Validate, bind to the sensor's organization, ingest
    API->>DB: Assets and findings (de-duplicated), next step
    API-->>U: Live update (WebSocket), notifications
```

- Sensors only connect out. The platform never opens a connection to a sensor;
  work waits in a queue until a sensor with the right tools, in the right scan
  zone, claims it, and until no other task of the organization is scanning
  its hosts. Queued work is handed out fairly across runs.
- A claimed task has a lease that every heartbeat renews. A sensor that
  disappears loses its lease, and the task goes back to the queue.
- There is no fixed task timeout. The heartbeat reports each task's progress
  (targets finished, records, output, CPU time); a task in which nothing
  moved for its stall window is stopped, its finished targets are kept, and
  only its unfinished targets are queued again.
- Results are validated, capped and bound to the organization of the sensor's
  key, never to anything the report says about itself. Sensor results are
  stored first and applied by the background ingest worker.

Details: [scan-lifecycle.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/scan-lifecycle.md),
[scan-orchestration.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/scan-orchestration.md),
[sensors.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/sensors.md).

### Other inputs

| Input | Path |
|---|---|
| CI pipelines | `openctem-ci` exchanges the job's OIDC token for a short-lived run token and uploads CTIS or SARIF. |
| Imports | Files from other scanners (Nessus, Qualys, SARIF, trivy, nuclei, ZAP and others) uploaded in the console or the API. |
| Connectors and integrations | SCM repositories (GitHub, GitLab), Tenable.sc, DefectDojo, Entra ID identity exposures, SIEM. |
| Discovery jobs | Certificate Transparency logs and DNS checks of each organization's own domains, and the automatic coverage loop that plans the checks each asset type needs, run by the API. |
| Threat intelligence | EPSS scores and the CISA KEV catalog, refreshed daily, used in prioritization. |

### Outputs

Notifications are written to an outbox in the same transaction as the change
that caused them and delivered by a background worker to Slack, Teams,
Telegram, email, webhooks or Splunk HTTP Event Collector. Jira and GitHub
issues are created and synchronised both ways.
Reports are rendered and emailed on schedules. The read-only REST API and the MCP
server serve the data to other tools; the MCP server reads with the permissions of
the person who connected the assistant (or the scopes of an API key), and its
one write tool (a finding comment) runs only after that person confirms it in
the web console.

## Background work

```mermaid
flowchart LR
    subgraph apip["API process (Go)"]
        HTTP["HTTP handlers<br/>REST API, sensor protocol v2, CI,<br/>SCIM, MCP, WebSocket, webhooks"]
        BG["Workers and controllers<br/>scheduler, recovery, ingest,<br/>feeds, SLA, retention"]
        OB["Notification<br/>outbox worker"]
        JQ["Job worker"]
    end
    HTTP --> PG[("PostgreSQL")]
    BG --> PG
    OB --> PG
    HTTP -->|"enqueue"| RD[("Redis")]
    JQ -->|"dequeue"| RD
    HTTP -->|"WebSocket fan-out,<br/>caches, rate limits"| RD
    OB --> CH["Notification channels"]
    JQ --> EXT["Email, AI providers,<br/>Jira and GitHub"]
    BG --> FEED["Threat-intel feeds,<br/>CT logs, DNS"]
```


The API process also runs the platform's background work; there is no
separate worker process. Most of it is driven by PostgreSQL (leases and
`SKIP LOCKED` queues); only the job worker uses a Redis queue. Run one API
instance (see [Scaling](../operations/scaling.md)). The main jobs:

| Work | What it does | Every |
|---|---|---|
| Scan scheduler | Starts the scans whose schedule is due | 1 minute |
| Scan timeout, retry and stalled-run repair | Enforces run deadlines, fails runs no sensor claimed (not those waiting for a scan window or their hosts), retries failed runs with a backoff, repairs runs that stopped advancing | 1 minute |
| Command recovery | Returns tasks whose sensor lease expired to the queue; asks sensors to stop stalled tasks and hand back what they finished; takes back tasks far past their time budget; fails tasks that keep failing | 1 minute |
| Command expiration | Expires tasks no sensor claimed in time | 1 minute |
| Sensor health | Marks sensors whose heartbeats stopped as offline and notifies | 30 seconds |
| Ingest worker | Applies queued results (sensor reports, and API ingest with `INGEST_MODE=async`) | 2 seconds |
| Notification outbox | Delivers notifications written in the same transaction as their cause | 5 seconds |
| Job worker (Redis queue) | Email, AI triage, Jira and GitHub status sync | on demand |
| Threat intelligence | EPSS and CISA KEV refresh, then escalates findings on known-exploited CVEs | 24 hours |
| Certificate Transparency and DNS checks | Attack surface monitoring of each organization's domains | per organization, 24 hours by default |
| SLA escalation | Warns before and on SLA breaches | 15 minutes |
| Asset coverage | Plans the checks every asset in scope needs and records when each last succeeded (see [Scoping](../user-guide/03-scoping.md#scope-policy)) | 1 minute |
| Retest scheduler, report scheduler | Continuous retests; scheduled reports by email | 1 minute |
| Approval and access expiry | Expires risk acceptances (the finding reopens), memberships and scope exclusions past their end | 1 minute to 1 hour |
| SSO domain re-verification | Re-checks the DNS proof of SSO domains | 12 hours |
| Version check | Downloads the signed release feed and compares it with the running version (off with `VERSION_CHECK_ENABLED=false`) | 24 hours |
| Retention | Purges old sessions, notifications, task logs, heartbeats, evidence and deleted assets per their retention | 1 to 24 hours |

## Tenancy and isolation

An **organization** (a tenant in the code) owns all of its data: assets,
findings, scans, sensors, integrations, users' memberships and audit log.

- **Every organization-owned table carries `tenant_id`, and every query
  filters on it** (child rows such as the steps of a scan workflow belong to a
  parent row that carries it). The
  organization comes from the authenticated credential: the session's selected
  organization, the organization of an API key, or the organization of a sensor
  key. A request body or a report never chooses it.
- **Caches are keyed by organization**, and permission changes take effect on
  the next request.
- **Credentials are per organization**: each organization's integrations and
  identity providers use their own secrets, encrypted with `APP_ENCRYPTION_KEY`.
- **Inside an organization**, roles decide what a user can do and access groups
  decide which assets (and their findings) a member can see. A member in no
  group sees no assets.
- **Platform administrators** are separate accounts that belong to no
  organization. They create organizations and run shared sensors from the
  platform console, and cannot read organization data.
- **Shared sensors** are scanning capacity run by the operator for every
  organization, for public targets. An organization uses them through scans
  but never sees or manages them (an owner can opt the organization out), and
  results are bound to the organization whose task the sensor ran.

**Planned:** PostgreSQL row-level security policies exist for the main tenant
tables but are not enabled; they will be turned on table by table as a second
layer under the application's checks.

Details:
[authorization-matrix.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/authorization-matrix.md),
[access-control-rules.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/access-control-rules.md).

## Trust boundaries

```mermaid
flowchart LR
    I((Internet)) -- "TLS, one port" --> GW[Gateway]
    subgraph P["Platform: trusts no client"]
        GW --> W[Web console]
        GW --> A[API]
        W --> A
        A --> D[(PostgreSQL / Redis)]
    end
    subgraph N["Customer network: sensor trusts its local policy"]
        S[Sensor] --> T[Targets]
    end
    S -- "outbound HTTPS or gRPC with mTLS, sensor key" --> GW
```

| Boundary | Controls |
|---|---|
| Internet to platform | One TLS port for users, sensors and API clients, plus the console's own port or host name, open only to the operator's allowed networks; internal endpoints (`/metrics`, `/ready`, `/debug`) blocked at the gateway; client addresses believed only from configured proxies; rate limits; production start-up checks for TLS to the datastores and strong secrets. |
| Platform console to API | A separate origin and process from the web console; its own sign-in, second factor and short sessions; the API serves the console API on its own listener, and the main listener answers 404 for it. |
| Browser to API | Session cookies (`Secure`, `SameSite`), CSRF protection, step-up re-authentication for sensitive actions, permission checks on every route with data scope inside the organization. |
| Automation to API | `oct_` API keys are bound to one organization and are read-only on the REST API; SCIM and CI use their own credentials. AI assistants connect to the MCP server with OAuth, as the person who approved them, within the organization's AI policy. |
| Sensor to platform | Each sensor has its own key, bound to one organization (a shared sensor to the instance); results are treated as hostile input (validated, size-capped, bound to the key's organization, quarantined when they do not match the task). |
| Platform to sensor | A sensor runs only the tools it has, can enforce a local policy set by the network owner (allowed targets, ports, tools, kill switch) whatever the platform sends, and accepts custom scanner templates only when signed. |
| Platform to outside services | Outbound URLs and SMTP hosts are checked against private, loopback and metadata addresses before connecting. |

Security model and hardening: [Security](../security/index.md). Engineering
detail:
[sensor-platform-trust.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/sensor-platform-trust.md).
