---
title: Sizing
parent: Install
nav_order: 7
---

# Sizing and resource estimates
{: .no_toc }

How much CPU, memory, disk and network each OpenCTEM component needs, for four
installation sizes, and what to grow first when load increases. The figures come
from a performance audit on a test installation. Each figure is marked:

- **measured**: observed on the test installation;
- **extrapolated**: derived from measurements, with the factor stated;
- **estimate**: a configured default or prior, not measured under load.

1. TOC
{:toc}

---

## How the figures were obtained

The test installation ran one API process (4 CPU), PostgreSQL 17 limited to
2 CPU and 6 GB, and Redis 7, on a shared 4-core host. Its data:

- one organization with 110,580 assets and 525,570 findings (two thirds closed,
  ages spread over a year), 10,000 scan runs, 20,000 sensor commands and
  300,000 audit log entries;
- 30 smaller organizations.

The load was every list and dashboard endpoint, a closed-loop mix of
virtual users, finding imports and the background jobs. The test host was
shared with other work, so the absolute latencies are pessimistic.

Load grows with the number of **findings and assets per organization** and with
how often scan results arrive, much more than with the number of users. Size by
data first.

## Sizes at a glance

| | Evaluation | Small | Medium | Large |
|---|---|---|---|---|
| Users | ≤ 5 | ≤ 50 | ≤ 500 | ≤ 5,000 (multi-tenant service) |
| Assets | ≤ 1,000 | ≤ 10,000 | ≤ 100,000 | ≤ 1,000,000 |
| Findings (about 10 per asset) | ≤ 10,000 | ≤ 100,000 | ≤ 1,000,000 | ≤ 10,000,000 |
| Sensors | 1 | 1-3 | ≤ 20 | ≤ 200 |
| Deployment | All-in-one or Compose, one host | Compose, one host | Compose on one larger host, or Kubernetes with managed PostgreSQL | Kubernetes with managed PostgreSQL |
| Total for the platform host(s), sensors not included | 2 vCPU, 4 GB, 20 GB SSD | 4 vCPU, 8 GB, 100 GB SSD | 8-12 vCPU, 24-32 GB, 250 GB SSD | 24+ vCPU, 96+ GB, 1 TB NVMe |

Notes:

- The Large size is **extrapolated** from the 525k-finding measurements.
- It assumes that heavy aggregate reads are cached (see
  [Scaling rules](#scaling-rules)).
- It still runs a single API process, so availability of the API depends on
  that one process until multi-instance support ships.

## Per component

### API

| | Evaluation | Small | Medium | Large |
|---|---|---|---|---|
| Instances | 1 | 1 | 1 | 1 |
| CPU request / limit | 0.25 / 1 | 0.5 / 2 | 2 / 4 | 4 / 8 |
| Memory request / limit | 256 MiB / 1 GiB | 512 MiB / 2 GiB | 2 GiB / 4 GiB | 4 GiB / 8 GiB |
| `GOMEMLIMIT` | 800MiB | 1600MiB | 3400MiB | 6800MiB |
| `DB_MAX_OPEN_CONNS` | 25 | 25 | 40 | 80 |

- **One instance.** Run exactly one API instance: see
  [Scaling](../operations/scaling.md#api-one-instance). It runs the request
  handlers and every background job (ingest worker, schedulers, feed refreshes).
- **CPU (measured).** The API used under 15% of its 4 CPUs while PostgreSQL was
  saturated, so the database is the bottleneck long before the API. The API's
  CPU goes to JSON encoding of large lists, attack-path graph traversal
  (about 230 ms of CPU per call at 110k assets) and imports.
- **Memory (measured).**
  - 95 MB resident when idle.
  - About 500 MB at peak during a burst of 50 concurrent dashboard loads.
  - Set `GOMEMLIMIT` to about 80-85% of the container limit, so the Go runtime
    collects garbage before the limit is hit.
- **Ingest (measured).**
  - One import stream writes about 900 new findings/s, or about 1,000/s for
    findings seen again in a rescan.
  - Scan results from sensors go through one ingest worker per API process.
    That is roughly **3 million findings per hour** (extrapolated from the
    per-stream rate).
  - Use `INGEST_MODE=async` with more than a few sensors.

### Web console

| | Evaluation | Small | Medium | Large |
|---|---|---|---|---|
| Replicas | 1 | 1 | 2-4 | 3-8 |
| CPU request / limit | 0.1 / 1 | 0.1 / 1 | 0.2 / 1 | 0.25 / 2 |
| Memory request / limit | 256 MiB / 512 MiB | 256 MiB / 512 MiB | 256 MiB / 768 MiB | 384 MiB / 1 GiB |

- The console is stateless; add replicas for availability, not for data size.
- Always run the production image. A development server (`next dev`) needs
  3-5 GB of memory and is several times slower (measured on a test host).
- In the production image, a page change is ready in about 130 ms on first
  visit and about 50 ms on repeat visits (measured). First-load JavaScript is
  435-550 KB compressed.

### Gateway

| | Evaluation | Small | Medium | Large |
|---|---|---|---|---|
| CPU request | 0.05 | 0.05 | 0.25 | 0.5 |
| Memory request / limit | 64 MiB / 256 MiB | 64 MiB / 256 MiB | 128 MiB / 512 MiB | 256 MiB / 1 GiB |

- The gateway terminates TLS and compresses API and console responses. JSON
  shrinks 6-13 times: a 100-row findings page goes from 179 KB to 27 KB.
- Idle, it uses 15-60 MB of memory and almost no CPU (measured).
- Compression costs CPU in proportion to traffic: add about one core per few
  thousand requests per second (estimate).

### PostgreSQL

PostgreSQL takes most of the CPU, memory and disk.

| | Evaluation | Small | Medium | Large |
|---|---|---|---|---|
| vCPU | 1 | 2 | 4-8 | 16+ (plus a read replica) |
| Memory | 1 GB | 3-4 GB | 16 GB | 64 GB+ |
| `shared_buffers` | 256 MB | 1 GB | 4 GB | 16 GB |
| `effective_cache_size` | 768 MB | 3 GB | 12 GB | 48 GB |
| Disk (first year, with headroom) | 10 GB | 50-100 GB | 250 GB | 1 TB+ |
| Storage | SSD | SSD | SSD, ≥ 3,000 IOPS | NVMe or provisioned IOPS, ≥ 10,000 IOPS |
| `max_connections` | 100 | 100 | 150 | 200 (or a pooler) |

**Why these numbers.**

- **CPU (measured).** With 2 CPUs and 525,000 findings in one organization, an
  interactive mix of lists and statistics ran at 13-18 requests/s with no
  errors.
  - Tenant-wide statistics (finding and asset counts, dashboard metrics)
    produced about 70% of that load.
  - Each of those reads covers the organization's findings, so their cost grows
    linearly with findings per organization: about 2x at 1M findings
    (extrapolated).
- **Memory.** Keep the hot set in memory: the findings table, its rollup index
  and the primary keys. That is about **3.6 KB per finding** (measured), so
  1 million findings need about 3.6 GB of cache.
  - Moving from PostgreSQL's built-in defaults (128 MB `shared_buffers`,
    `random_page_cost` 4) to the values above raised throughput by 37% and
    cut median latency by 40% on the test installation (measured).
  - The Docker Compose stack sets these values through `PG_*` variables (see
    [below](#docker-compose)).
- `work_mem` 16 MB, `maintenance_work_mem` 256 MB-1 GB, `random_page_cost` 1.1
  on SSD, `max_wal_size` 2 GB or more.

**Growth per row (measured, table plus indexes).**

| Row | Bytes | Notes |
|---|---|---|
| Finding | about 4,000 | 3,236 for the row and its indexes, plus fingerprint, activity and priority history |
| Asset | about 2,500-3,000 | Includes relationships, identifiers, state history and software links |
| Audit log entry | about 600 | Kept for `AUDIT_RETENTION_DAYS` (365 by default) |
| Scan run | about 1,600 | Including its steps |
| Threat intelligence feeds | about 210 MB | Fixed, shared by all organizations (EPSS, KEV) |

**Estimating disk:**

- Data: findings x 4 KB + assets x 3 KB + audit entries per year x 0.6 KB.
- Double it for WAL, table bloat and the room that online index builds need.
- Then keep at least 20% of the disk free: PostgreSQL stops when its disk is
  full.

Example (Medium):

- 1M findings ≈ 4 GB, 100k assets ≈ 0.3 GB.
- Audit: 500 users x 100 entries/day x 365 ≈ 18M entries ≈ 11 GB/year.
- That is about 16 GB of data, about 32 GB with headroom. 250 GB leaves room for
  growth and local backups.

**Retention.** The audit log dominates long-term growth at higher user counts.
Lower `AUDIT_RETENTION_DAYS`, or archive with `AUDIT_ARCHIVE_DIR`, before you buy
disk for it. Closed findings stay until the retention jobs remove their scanner
output.

### Redis

| | Evaluation | Small | Medium | Large |
|---|---|---|---|---|
| Memory | 128 MB | 256 MB | 512 MB | 1-2 GB |
| CPU | 0.1 | 0.1 | 0.25 | 0.5 |

Redis holds caches with expiry, rate-limit state and job queues. A live
installation uses under 10 MB (measured). Persistence matters only for queued
jobs.

### Sensors

A sensor is one process plus the scanner tools it runs. Size it from the
concurrent jobs you want, using the per-tool costs the sensor itself uses to
admit work. These are its defaults, replaced by measured history after a few
jobs.

| Tool (scan type) | CPU per job | Memory per job | Typical time per target |
|---|---|---|---|
| nuclei (vulnerability templates) | 1.0 | 512 MiB | 20 s |
| katana (crawling) | 1.0 | 512 MiB | 60 s |
| httpx, subfinder, naabu, nmap (discovery) | 0.5 | 256 MiB | 5-30 s |
| dnsx (DNS) | 0.5 | 128 MiB | 2 s |
| trivy (containers, SCA) | 1.0 | 1 GiB | 60 s |
| semgrep (SAST) | 1.0 | 1.5 GiB | 120 s |
| codeql (SAST) | 2.0 | 4 GiB | 600 s |
| betterleaks (secrets) | 0.5 | 256 MiB | 30 s |

These are **estimates** (the sensor's admission priors). The sensor process
itself uses about 280 MB idle (measured).

**Examples:**

| Sensor profile | CPU | Memory | Disk |
|---|---|---|---|
| Discovery and EASM, 4 concurrent jobs (subfinder, httpx, naabu, dnsx, nuclei) | 2-4 vCPU | 2-4 GB | 20 GB |
| Vulnerability scanning, 8 concurrent nuclei jobs | 8 vCPU | 6 GB | 20 GB |
| Code and container scanning (semgrep, trivy, codeql) | 4-8 vCPU | 8-16 GB | 50 GB+ (checkouts and images) |

- **Disk.**
  - The content cache (templates, rule packs, databases) is bounded at 8 GiB by
    default.
  - The encrypted result outbox holds 1 GiB by default
    (`SENSOR_OUTBOX_MAX_BYTES`). Give it room for the results of a platform
    outage you want to ride out.
  - The Helm chart's volumes default to data 8Gi, content 5Gi, outbox 2Gi and
    state 128Mi.
- **Network.** Scan traffic goes to your targets and follows the scan's rate
  limits. Traffic to the platform is small: heartbeats every 5-45 s, plus
  results compressed in segments.
- **Concurrency.** Leave `SENSOR_MAX_JOBS` unset to size the slots from CPU,
  memory and these tool costs.

### Sensors per API process

The platform aims for at most **50 heartbeats per second per API process**, and
stretches the heartbeat interval as the fleet grows (between 5 and 45 seconds):

- about 750 sensors at a 15-second interval;
- about 2,250 at the 45-second maximum.

These counts are extrapolated from that budget. On a live installation the
heartbeat takes 29 ms at the 95th percentile (measured, small fleet). All four
sizes fit within the budget.

### Observability stack

The optional stack in `deploy/observability` (Prometheus, Alertmanager and the
exporters) needs about 1 GB of memory and 0.25 vCPU. Prometheus is the largest
part: 90-140 MB with 15 days of retention on a small installation (measured).
Give it 2-10 GB of disk depending on retention and the number of sensors.

### Backups

- A compressed `pg_dump -Fc` is about **15-25% of the database size**. Indexes
  are not dumped.
- On the test installation, a 3.7 GB database dumped to 266 MB in 23 seconds,
  using 2 CPUs (measured). Synthetic data compresses better than real data, so
  plan for the upper end.
- Budget about 150 MB/s of database size per dump on SSD, and about 3x that
  time to restore, because indexes are rebuilt.
- Keep backups off the database disk. See
  [Backup and restore](../operations/backup-restore.md).

### All-in-one image

The all-in-one image runs the gateway, the web console and the API in one
container. Give it the sum of those three rows, for example
**1 vCPU / 2 GB for Evaluation** and **2.5 vCPU / 3 GB for Small**. PostgreSQL
and Redis are yours: size them from the tables above. The all-in-one image is
not meant for Medium or Large.

## Docker Compose

Set limits and PostgreSQL memory in `.env` next to `docker-compose.yml`. The
`PG_*` variables need a release that includes them; check `.env.example`.

Small (8 GB host):

```bash
API_MEMORY_LIMIT=2g
WEB_MEMORY_LIMIT=1g
GATEWAY_MEMORY_LIMIT=512m
PG_SHARED_BUFFERS=1GB
PG_EFFECTIVE_CACHE_SIZE=3GB
PG_WORK_MEM=16MB
PG_MAINTENANCE_WORK_MEM=256MB
```

Medium (32 GB host running everything):

```bash
API_MEMORY_LIMIT=4g
WEB_MEMORY_LIMIT=1g
GATEWAY_MEMORY_LIMIT=512m
PG_SHARED_BUFFERS=4GB
PG_EFFECTIVE_CACHE_SIZE=12GB
PG_WORK_MEM=32MB
PG_MAINTENANCE_WORK_MEM=1GB
PG_MAX_WAL_SIZE=4GB
PG_SHM_SIZE=1g
```

The API reads `GOMEMLIMIT` and `DB_MAX_OPEN_CONNS` from the environment. Add them
to the `api` service's environment for Medium (`3400MiB`, `40`).

## Kubernetes

The Helm chart ships three presets: `values-small.yaml`, `values-medium.yaml`
and `values-large.yaml`. Each sets requests, limits, replicas, `GOMEMLIMIT`,
`DB_MAX_OPEN_CONNS` and sensor volume sizes. Layer one over your production
values:

```bash
helm upgrade --install openctem openctemio/openctem -n openctem \
  -f values-production.yaml -f values-medium.yaml
```

The Medium preset, for reference:

```yaml
api:
  replicaCount: 1
  resources:
    requests: { cpu: "2", memory: 2Gi }
    limits: { cpu: "4", memory: 4Gi }
  extraEnv:
    - { name: GOMEMLIMIT, value: "3400MiB" }
    - { name: DB_MAX_OPEN_CONNS, value: "40" }
ui:
  replicaCount: 2
  resources:
    requests: { cpu: 200m, memory: 256Mi }
    limits: { cpu: "1", memory: 768Mi }
  autoscaling: { enabled: true, minReplicas: 2, maxReplicas: 4 }
gateway:
  caddy:
    resources:
      requests: { cpu: 250m, memory: 128Mi }
      limits: { memory: 512Mi }
sensor:
  resources:
    requests: { cpu: "2", memory: 4Gi }
    limits: { cpu: "4", memory: 8Gi }
```

PostgreSQL and Redis run outside the chart in production. Use the PostgreSQL and
Redis tables above for a managed service's instance class.

## Scaling rules

Grow in this order:

1. **PostgreSQL memory and settings.** The cheapest gain. Check that
   `shared_buffers` and `effective_cache_size` match the host, and that
   `random_page_cost` is 1.1 on SSD.
2. **PostgreSQL CPU.**
   - Most CPU goes to tenant-wide statistics.
   - When the `ApiDbPoolSaturated` alert fires or list p95 passes about 1 s,
     add vCPU before you raise `DB_MAX_OPEN_CONNS`. More connections on
     saturated CPUs only lengthen the queue.
3. **API CPU and memory.** Grow the one API process when its CPU stays above
   about 70% or its memory approaches the limit, for example during large
   imports.
4. **Ingest.** Switch to `INGEST_MODE=async` before the sensor count reaches
   the tens. Watch `ingest_queue_depth`. One worker drains about 3M findings an
   hour.
5. **Sensors.** Scanning throughput scales with sensors, not with the platform.
   Add sensors to a scan zone.
6. **Read replica and partitioning.**
   - From the Large size on, move reports, exports and dashboards to a read
     replica.
   - Partition or archive the audit log once it passes about 100 million rows.
   - Consider a narrower findings layout once an organization passes about
     5 million findings.

Each organization runs at most four tenant-wide statistics reads at a time.
Extra requests queue, so one organization's dashboard burst cannot take every
database connection from the others.

A dashboard overview is reused for 15 seconds per user session. The first load
of the dashboard on a 525,000-finding organization takes 3-6 seconds (measured).
Later loads take under 100 ms.

## Service level objectives

Use these as alert thresholds:

| Measure | Objective |
|---|---|
| List endpoints (findings, assets, scans, audit log), p95 | < 300 ms |
| Statistics and dashboard endpoints, p95 | < 1 s |
| Dashboard overview, p95 | < 1 s warm, < 3 s cold |
| Import throughput | ≥ 900 findings/s per stream |
| Sensor heartbeat, p95 | < 100 ms |
| Free disk on the database volume | ≥ 20% |
