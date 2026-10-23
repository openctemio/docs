---
title: Scaling
parent: Operations
nav_order: 6
---

# Scaling
{: .no_toc }

Where load goes in an OpenCTEM installation and which knobs move it. Start from
the sizes in [Sizing](../install/sizing.md) and use the
[metrics](monitoring.md) to decide what to grow.

1. TOC
{:toc}

---

## Components at a glance

| Component | Scales | Notes |
|---|---|---|
| API | Vertically: one instance | Runs the request handlers and every background job (schedulers, ingest worker, feed refreshes, notification outbox, retention). |
| Web console and platform console app | Horizontally | Stateless; run two or more behind the gateway or a Service. |
| PostgreSQL | Vertically, or a managed service | Holds all data; usually the first thing to grow. |
| Redis | Vertically | Small: caches, rate-limit state, queues. |
| Sensors | Horizontally | Add sensors to share scanning work. |

## API: one instance

Run exactly one API instance. Its background jobs are not yet coordinated across
instances: with two or more, scheduled scans start twice, report emails are sent
twice and the audit log's hash chain, which needs a single writer, forks. The
Helm chart refuses more than one API replica unless
`api.allowMultipleReplicas` is set, and its production example keeps
autoscaling off.

The platform admin console's API can run as its own process: the same image with
`OPENCTEM_PLANE=admin` serves only the console API (and `/health`), while the main process runs as
`tenant` or, by default, `all`. That is a split of audiences, not a second copy of the tenant API:
there is still exactly one process that runs the background jobs. The Compose stack runs the
console app as the `console` service in front of the API's console listener (`ADMIN_LISTEN_ADDR`).

Running several tenant API instances is planned. Until then, give the one instance more
CPU and memory, and use the knobs below.

| Setting | Default | When to change |
|---|---|---|
| `DB_MAX_OPEN_CONNS` / `DB_MAX_IDLE_CONNS` | `25` / `5` | Requests wait for database connections (`ApiDbPoolSaturated` alert). Keep the total below PostgreSQL's `max_connections`. |
| `DB_INGEST_MAX_CONNS`, `INGEST_WORKERS`, `INGEST_MAX_RUNNING_PER_TENANT` | `8`, `4`, `2` | CI results and file imports are always stored, answered `202` and applied by the ingest workers, on their own database pool. Raise workers and pool together, and keep both pools below PostgreSQL's `max_connections`. |
| `INGEST_MODE` | `sync` | `async` stores scan results, answers `202` and processes them in the background, which smooths bursts from many sensors. `INGEST_MAX_PENDING_PER_TENANT` bounds each organization's queue. |
| `MAX_CONCURRENT_REQUESTS` | `1000` | Requests beyond it get `503`. |
| `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`, `RATE_LIMIT_READ_PER_MIN` | `100`, `200`, `120` | Many users behind one address, or dashboards that issue many reads. |
| `SERVER_REQUEST_TIMEOUT` | `30s` | Long reports or exports time out. |

## Web console and platform console

Neither app holds state of its own: sessions are cookies validated by the
API. Run two or more replicas for availability. The Helm chart's production
example runs 2 to 6 with a HorizontalPodAutoscaler and a PodDisruptionBudget.

### The console's CSRF key must be shared

The platform console binds each write to its session with a CSRF token: an HMAC of the
console session under a key derived from the API's session secret. Every process that serves
the console API must therefore hold the **same** `AUTH_JWT_SECRET` (set it explicitly and give
every replica the same value; unset, it is derived from `APP_ENCRYPTION_KEY`, which must then
be identical too). Production refuses to start without a valid session secret. Outside
production, with no secret, each process uses its own random key and a token verifies only on
the process that issued it, so a second replica answers 401 to console writes. Changing
`AUTH_JWT_SECRET` signs everyone out, administrators included.

## PostgreSQL

Most memory, CPU and disk go to PostgreSQL. In order:

1. Give it memory, and set `shared_buffers` and `effective_cache_size` for the
   host (or use a managed service that does).
2. Use fast SSD storage and keep at least 20% of the disk free.
3. Keep `autovacuum` on; large finding tables churn.
4. Move to managed PostgreSQL 17 when backups, failover and point-in-time
   recovery should be someone else's job.

The API turns PostgreSQL JIT off for its own sessions (`DB_JIT_ENABLED=false`):
for its short request queries the compile cost outweighs any gain.

## Redis

Redis stays small: caches with expiry, rate-limit state and the background job
queues. A few hundred MB of memory is enough for most installations; watch the
`RedisMemoryHigh` alert.

## Attachments

Attachments live on a volume (`STORAGE_PROVIDER=local`) or in an S3-compatible
bucket (`STORAGE_PROVIDER=s3` or `minio`). A bucket removes the volume from
the API host and is the option to choose for Kubernetes clusters without
ReadWriteMany storage.

## Sensors

Scanning throughput scales with sensors, not with the platform:

- Add sensors to a scan zone: the sensors of a zone share its work, and a sensor
  that stops claiming work leaves it to the others (each claimed task has a
  lease, `SENSOR_COMMAND_LEASE`, after which it returns to the queue).
- The platform places work using a load score from each sensor's heartbeat
  (job load, CPU, memory, disk and network; weights `SENSOR_LB_*`).

See [Scan zones and pools](../sensors/zones.md).

## Feeds and periodic jobs

Background discovery jobs run inside the API and are bounded per run:
`CERT_MONITOR_MAX_DOMAINS_PER_RUN`, `EASM_DNS_MAX_NAMES_PER_RUN` and
`EASM_DNS_QPS`. Lengthen their intervals or lower the caps if they compete with request
traffic on a small host. All settings:
[Environment variables reference](../configuration/environment-variables.md).
