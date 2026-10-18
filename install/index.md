---
title: Install
nav_order: 4
has_children: true
permalink: /install/
---

# Requirements and sizing
{: .no_toc }

OpenCTEM is self-hosted. Pick a deployment, check the requirements below, then
follow the guide. These pages describe OpenCTEM v0.10.1; notes say where an
older release differs. [Versioning](../operations/versioning.md) lists how the
platform, sensor and chart versions fit together.

For a production installation, follow the [go-live runbook](production-go-live.md):
the order of work from an empty host to a monitored installation with a tested restore.

1. TOC
{:toc}

---

## Choose a deployment

| Deployment | Runs | Best for |
|---|---|---|
| [Docker Compose](docker-compose.md) | Gateway, web console, platform console, API, PostgreSQL and Redis on one host, from `api/deploy/docker-compose.yml`. | Most single-host installs. Everything included, TLS between all parts. |
| [All-in-one image](all-in-one.md) | `ghcr.io/openctemio/openctem`: gateway, web console, platform console and API in one container. PostgreSQL and Redis are yours. | You already run PostgreSQL and Redis (managed or self-hosted). |
| [Kubernetes (Helm)](kubernetes.md) | The `openctem` chart from `openctemio/helm-charts`. | Clusters, external managed datastores, GitOps. |
| [One VM with Ansible](ansible.md) | The `openctem-ansible` kit: a hardened Ubuntu VM, signed images, encrypted backups and a monitor. Two guides: [with Cloudflare Tunnel and Access](ansible-cloudflare.md) (no inbound port) and [without Cloudflare](ansible-without-cloudflare.md) (your own TLS, public or private). | A production single host you want hardened and operated the same way every time. |

All of them expose the platform on one HTTPS port through the same gateway: see
[TLS and the gateway](tls-and-gateway.md). The platform console, where platform
administrators work, is a separate app on its own site (its own port or host
name, reachable from private networks by default), never part of the public
site. After installing, create the [first administrator](first-admin.md).

Sensors, the components that run scans in your networks, are installed
separately: see [Sensors](../sensors/index.md).

## Deployment topologies

### Single host with Docker Compose

Everything on one host; only the gateway publishes a port.

```mermaid
flowchart LR
    C["Browsers, sensors,<br/>API clients"] -->|"HTTPS 443"| GW
    subgraph host["One Docker host"]
        GW["gateway<br/>(Caddy)"] --> WEB["web<br/>:3000"]
        GW --> API["api<br/>:8080"]
        GW -->|"console site"| CON["console<br/>:3000"]
        WEB --> API
        CON -->|"console listener"| API
        API -->|TLS| PG[("postgres<br/>:5432")]
        API -->|TLS| RD[("redis<br/>:6379")]
        MIG["migrate, db-roles,<br/>datastore-tls<br/>(one-shot jobs)"] -.-> PG
    end
```

### All-in-one container

One container runs the gateway, the web console and the API; PostgreSQL and
Redis are yours (managed or self-hosted).

```mermaid
flowchart LR
    C["Browsers, sensors,<br/>API clients"] -->|"HTTPS 443"| GW
    subgraph aio["ghcr.io/openctemio/openctem"]
        GW["gateway"] --> WEB["web<br/>127.0.0.1:3000"]
        GW --> API["api<br/>127.0.0.1:8080"]
        WEB --> API
    end
    API -->|TLS| PG[("Your PostgreSQL")]
    API -->|TLS| RD[("Your Redis")]
```

### Kubernetes with Helm

The chart runs the API, the web console and the migrations, and exposes them
through one entry point: its own Caddy gateway, an Ingress or a Gateway API
HTTPRoute (`gateway.mode`). PostgreSQL and Redis are external in production.

```mermaid
flowchart LR
    C["Browsers, sensors,<br/>API clients"] -->|HTTPS| ENT
    subgraph k8s["Kubernetes cluster"]
        ENT["Entry point:<br/>Caddy gateway, Ingress<br/>or HTTPRoute"] --> WEB["web<br/>(Deployment)"]
        ENT --> API["api<br/>(Deployment, 1 replica)"]
        WEB --> API
        MIG["migrations Job"]
        BS["bundled sensor<br/>(optional)"] -->|"in-cluster"| API
    end
    API -->|TLS| PG[("Managed PostgreSQL")]
    API -->|TLS| RD[("Managed Redis")]
    MIG -.-> PG
```

### Sensors in customer networks

Whichever way the platform is installed, sensors run next to their targets and
only connect out. No inbound port is opened in the scanned networks.

```mermaid
flowchart LR
    subgraph op["Operator network"]
        P["OpenCTEM platform<br/>(gateway :443)"]
    end
    subgraph dc["Data centre"]
        S1["Sensor"] --> T1["Internal hosts"]
    end
    subgraph cloud["Cloud VPC"]
        S2["Sensor"] --> T2["Cloud workloads"]
    end
    subgraph dmz["Internet-facing scanner"]
        S3["Sensor"] --> T3["Public names<br/>and addresses"]
    end
    S1 -->|"outbound HTTPS"| P
    S2 -->|"outbound HTTPS"| P
    S3 -->|"outbound HTTPS"| P
```

Group the sensors that can reach the same address ranges into
[scan zones](../sensors/zones.md); see the
[network requirements](../sensors/network.md).

### One installation for many organizations

A single installation can serve several organizations, for example a service
provider or a central security team hosting business units. Each organization
has its own members, SSO, sensors and data; platform administrators run the
installation without seeing organization data.

```mermaid
flowchart TB
    subgraph plat["One OpenCTEM installation"]
        ADM["Platform administrators<br/>(admin console)"]
        OA["Organization A<br/>SSO: Entra ID"]
        OB["Organization B<br/>SSO: SAML"]
        OC["Organization C<br/>password and 2FA"]
        PSEN["Platform sensors<br/>(shared, optional)"]
    end
    SA["Sensors of A<br/>(A's network)"] --> OA
    SB["Sensors of B<br/>(B's network)"] --> OB
    ADM --> OA
    ADM --> OB
    ADM --> OC
    ADM --> PSEN
```

- `SIGNUP_MODE=disabled` (the default): no public sign-up, and only platform
  administrators create organizations. `domain` and `open` allow public
  sign-up ([First administrator](first-admin.md#sign-up-and-more-organizations)).
- Organization sensors take only their own organization's work. Platform
  sensors (shared sensors) are capacity run by the operator for the
  organizations it allows; they are off until a super administrator turns them
  on (see [Shared sensors](../sensors/shared-sensors.md) and
  [Sensors](../sensors/how-it-works.md#organization-sensors-and-platform-sensors)).
- Whether platform sensors need a verified domain before they scan a target
  is an admin console setting (**System > Platform scanning**), off by
  default (see [Scope](../scanning/scope.md#platform-guardrails)).

## Images

Every release tag `vX.Y.Z` publishes these images to the GitHub Container
Registry, for `linux/amd64` and `linux/arm64`, signed with cosign and with SBOMs
attached to the release:

| Image | Contents |
|---|---|
| `ghcr.io/openctemio/openctem-api` | API server, `bootstrap-admin`, migrations and configuration files. |
| `ghcr.io/openctemio/openctem-web` | Web console. |
| `ghcr.io/openctemio/openctem-console` | Platform console (its own app and site). |
| `ghcr.io/openctemio/openctem-gateway` | Gateway: Caddy with the layer-4 module, for the Compose stack and the chart. |
| `ghcr.io/openctemio/openctem` | All-in-one: API, web console, platform console and gateway. |
| `ghcr.io/openctemio/migrations` | Database migration runner. |
| `ghcr.io/openctemio/admin-cli` | `bootstrap-admin` on its own. |
| `ghcr.io/openctemio/seed` | Demo and test data. Not for production. |

The `openctem-api`, `openctem-web`, `openctem` and `admin-cli` names start with
v0.9.0. Releases up to v0.8.0 exist as `ghcr.io/openctemio/api` and
`ghcr.io/openctemio/ui`, which keep receiving identical copies for a transition
period. Pin an exact tag in production, never `latest`.

The sensor image (`ghcr.io/openctemio/sensor`) is versioned separately.

## Software

| Component | Version |
|---|---|
| PostgreSQL | 17 (the version the Compose stack bundles and CI tests). Extensions `pgcrypto`, `pg_trgm` and `uuid-ossp` must be available. |
| Redis | 7. TLS and a password of at least 32 characters in production. |
| Docker | Engine with the Compose plugin 2.24 or later, for Compose and the all-in-one image. |
| Kubernetes | A cluster supported by Helm 3; a default StorageClass for the volumes the chart creates. |

In production (`APP_ENV=production`) the API refuses to connect to PostgreSQL or
Redis without TLS. The Compose stack sets this up for its bundled datastores;
managed services usually provide it. See
[Production checks](../configuration/environment-variables.md#production-checks).

## Sizing

OpenCTEM's load grows with the number of findings and assets per organization
and with how often scan results arrive, more than with the number of users. The
[sizing guide](sizing.md) has per-component figures (API, web console, gateway,
PostgreSQL, Redis, sensors, monitoring, backups) for four sizes, growth per row,
and the order in which to scale. In short:

| Size | Typical use | Platform host(s) |
|---|---|---|
| Evaluation | ≤ 5 users, ≤ 1,000 assets | 2 vCPU, 4 GB, 20 GB SSD |
| Small | ≤ 50 users, ≤ 10,000 assets, 1-3 sensors | 4 vCPU, 8 GB, 100 GB SSD |
| Medium | ≤ 500 users, ≤ 100,000 assets, ≤ 20 sensors | 8-12 vCPU, 24-32 GB, 250 GB SSD; managed PostgreSQL recommended |
| Large | ≤ 5,000 users, ≤ 1,000,000 assets, ≤ 200 sensors | Kubernetes, managed PostgreSQL with 16+ vCPU and 64 GB+ |

- PostgreSQL takes most of the CPU, memory and disk; the API and the web console
  are light. Run one API instance: see [Scaling](../operations/scaling.md).
- Disk holds the database, attachments and evidence, container logs (Compose
  rotates them at 50 MB with 5 files per container) and backups. Keep at least
  20% free: PostgreSQL stops when its disk fills.
- The optional [monitoring stack](../operations/monitoring.md) needs about 1 GB of
  memory more.

## Network

### Inbound

| Port | Who connects | Notes |
|---|---|---|
| 443/TCP | Browsers, sensors, API clients, SCIM, identity providers, Jira and GitHub webhooks | The only required port. |
| 80/TCP | Browsers | Optional: redirects to HTTPS, and Let's Encrypt HTTP-01 in TLS mode `acme`. |
| 8443/TCP (`OPENCTEM_ADMIN_PORT`) | Platform administrators | The platform console in port mode (the default for Compose and the all-in-one image). It answers only the networks in `OPENCTEM_ADMIN_ALLOWED_CIDRS` (private networks by default): reach it over a VPN or an SSH tunnel. In host mode the console has its own DNS name on 443 and needs no extra port. |

Nothing else is published. Internally the API listens on 8080 (its console
listener on 8081), the web console and the platform console on 3000,
PostgreSQL on 5432 and Redis on 6379; keep them off public networks. Sensors
reach the platform on 443 (the gateway routes them by ALPN to the API's
mutual-TLS listener on 9443 when the sensor passthrough is on; see
[Sensor transport](../sensors/transport.md)).

### Outbound (from the API)

| Destination | Why | Needed |
|---|---|---|
| `acme-v02.api.letsencrypt.org` | Certificates in TLS mode `acme`. | Mode `acme` only. |
| `epss.empiricalsecurity.com`, `www.cisa.gov`, `raw.githubusercontent.com` | EPSS scores and the CISA KEV catalog for prioritization. | Recommended. |
| `crt.sh`, `api.certspotter.com` | Certificate Transparency discovery. | Optional (`CERT_MONITOR_ENABLED=false` turns it off). |
| `ctem.org` | CTEM-ID catalog feed. | Optional. |
| Your SMTP server | Invitations, verification and password-reset email. | Recommended. |
| Integration endpoints | Jira, GitHub or GitLab, Slack, Teams, Telegram, webhook channels, identity providers, AI providers. | Per integration. |

Webhook and integration URLs that resolve to private addresses (RFC 1918) are
refused unless their range is listed in `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS`;
loopback, link-local and cloud metadata addresses are always refused.

### DNS

One name (or a fixed IP address) for the platform, the same for browsers and
sensors: `OPENCTEM_HOSTNAME`. TLS mode `acme` needs a public DNS name that
resolves to the host. Mode `internal` also works with a bare IP address.
