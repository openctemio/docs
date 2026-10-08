---
title: Kubernetes (Helm)
parent: Install
nav_order: 4
---

# Install on Kubernetes with Helm
{: .no_toc }

The `openctem` chart from
[openctemio/helm-charts](https://github.com/openctemio/helm-charts) deploys the
API, the web console, the migrations, an optional single-port gateway and an
optional bundled sensor. The chart's
[README](https://github.com/openctemio/helm-charts/blob/main/charts/openctem/README.md)
documents every value; this page covers a production install.

1. TOC
{:toc}

---

## Chart and versions

```bash
helm repo add openctem https://openctemio.github.io/helm-charts
helm repo update
helm search repo openctem/openctem
```

The chart's `appVersion` is the default tag of the API, web console and
migrations images (`ghcr.io/openctemio/openctem-api`, `openctem-web`,
`migrations`). `helm search repo openctem/openctem --versions` lists each chart
version with the OpenCTEM release it targets. Pin the chart version you tested
(`--version`).

The chart is secure by default: `api.appEnv` is `production`, so the API refuses
to start without TLS to PostgreSQL and Redis, a JWT secret of at least 64
characters, an encryption key and secure cookies. See
[Production checks](../configuration/environment-variables.md#production-checks).

## Requirements

- PostgreSQL 17 and Redis 7, external and reachable over TLS. The chart can
  bundle Bitnami PostgreSQL and Redis subcharts, for evaluation only: they are
  single instance, not backed up, and the bundled Redis cannot serve TLS, so it
  never passes the production checks.
- A default StorageClass (attachments volume, gateway data, sensor state), or
  S3-compatible storage for attachments.
- The least-privilege database roles: run
  [`least-privilege-roles.sql`](https://github.com/openctemio/openctem/blob/develop/api/deploy/postgres/least-privilege-roles.sql)
  once as a superuser (see [All-in-one image](all-in-one.md#1-prepare-the-database-roles)
  for the command). It creates `openctem_migrator` and `openctem_app`.

## 1. Create the secrets

Keep secrets in Kubernetes Secrets (or create them with External Secrets or
sealed-secrets), not in the values file. `APP_ENCRYPTION_KEY` and
`AUTH_JWT_SECRET` must stay stable for the life of the installation: a new
encryption key makes stored credentials unreadable, a new JWT secret signs
everyone out.

```bash
kubectl create namespace openctem

kubectl -n openctem create secret generic openctem-api-secrets \
  --from-literal=APP_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=AUTH_JWT_SECRET="$(openssl rand -hex 64)"

kubectl -n openctem create secret generic openctem-db \
  --from-literal=DB_USER=openctem_app \
  --from-literal=DB_PASSWORD='the openctem_app password'

kubectl -n openctem create secret generic openctem-db-migrator \
  --from-literal=DB_MIGRATE_USER=openctem_migrator \
  --from-literal=DB_MIGRATE_PASSWORD='the openctem_migrator password'

kubectl -n openctem create secret generic openctem-redis \
  --from-literal=REDIS_PASSWORD='your Redis password, 32+ characters'
```

Back up `openctem-api-secrets` outside the cluster.

## 2. Write the values file

`values.yaml` for one public hostname served by the chart's bundled gateway
(Caddy) with a Let's Encrypt certificate:

```yaml
api:
  appEnv: production
  auth:
    provider: local
    existingSecret: openctem-api-secrets
    jwtSecretKey: AUTH_JWT_SECRET
  encryption:
    existingSecret: openctem-api-secrets
    keyRef: APP_ENCRYPTION_KEY
  redis:
    tlsEnabled: true
  migrations:
    sslMode: require
  tenantCreationMode: admin_only
  bootstrapAdmin:
    enabled: true
    email: admin@example.com
    backupEmail: breakglass@example.com
    org:
      name: Example Corp
      ownerEmail: owner@example.com

    createSecret: false

postgresql:
  enabled: false
database:
  host: postgres.example.com
  port: 5432
  name: openctem
  auth:
    existingSecret: openctem-db
    createSecret: false
  migrator:
    existingSecret: openctem-db-migrator

redis:
  enabled: false
redisConfig:
  host: redis.example.com
  port: 6379
  auth:
    existingSecret: openctem-redis
    createSecret: false

gateway:
  mode: caddy
  host: ctem.example.com
  trustedProxies:
    - 10.244.0.0/16        # your cluster's pod CIDR
  caddy:
    tls:
      mode: acme
      acme:
        email: ops@example.com
```

`gateway.trustedProxies` is the pod CIDR of your cluster (`10.244.0.0/16` on
kubeadm with flannel, `10.42.0.0/16` on k3s): only those addresses may assert a
client IP to the API.

## 3. Install

```bash
helm upgrade --install openctem openctem/openctem \
  -n openctem -f values.yaml
helm test openctem -n openctem
```

The migrations run as a Job before the API starts. The gateway Service is a
`LoadBalancer` exposing port 443; point `ctem.example.com` at its address
(`kubectl -n openctem get svc`).

## First administrator

With `api.bootstrapAdmin.enabled`, a post-install Job runs `bootstrap-admin`
(see [First administrator](first-admin.md)). It prints the temporary passwords
once to its log and is kept until you delete it:

```bash
kubectl -n openctem logs job/openctem-api-bootstrap-admin
kubectl -n openctem delete job openctem-api-bootstrap-admin
```

The Job name is `<release>-openctem-api-bootstrap-admin`, or
`<release>-api-bootstrap-admin` when the release name contains `openctem`. To run
the tool later (for example to add an organization):

```bash
kubectl -n openctem exec deploy/openctem-api -- /app/bootstrap-admin \
  -email=admin@example.com -backup-email=breakglass@example.com \
  -org-name="Second Org" -org-owner-email=owner2@example.com
```

## Key values

| Value | Default | Meaning |
|---|---|---|
| `api.appEnv` | `production` | `APP_ENV`. Keep `production`. |
| `api.auth.provider` | `local` | `AUTH_PROVIDER`. |
| `api.auth.existingSecret` / `api.encryption.existingSecret` | empty | Secrets holding `AUTH_JWT_SECRET` and `APP_ENCRYPTION_KEY`. With `appEnv: production` the chart refuses to render without stable values for both. |
| `api.replicaCount` | `1` | Keep 1: see [Scaling](../operations/scaling.md). The chart refuses more unless `api.allowMultipleReplicas` is set. |
| `api.tenantCreationMode` | `admin_only` | `TENANT_CREATION_MODE`. |
| `api.attachments.storage` | `local` | `local`: a 10 GiB ReadWriteOnce volume at `/app/data`. `s3`: an S3-compatible bucket (`api.attachments.s3.*`). |
| `api.extraEnv` / `api.extraEnvFrom` | empty | Any other [API variable](../configuration/environment-variables.md), for example `SMTP_*` or `REDIS_TLS_CA_FILE`. |
| `ui.replicaCount` | `1` | Web console replicas; 2 or more in production. |
| `gateway.mode` | `none` | `none`, `ingress`, `httpRoute` or `caddy`. See below. |
| `gateway.host` / `gateway.publicUrl` | empty / `https://<host>` | Public name and origin. Sets the API's `APP_URL`, `CORS_ALLOWED_ORIGINS` and `SMTP_BASE_URL`. |
| `gateway.caddy.tls.mode` | `internal` | `internal`, `acme`, `files` or `http`, as in [TLS and the gateway](tls-and-gateway.md). |
| `postgresql.enabled` / `redis.enabled` | `true` | Bundled datastores, evaluation only. Set `false` in production. |
| `monitoring.enabled` | `false` | Sets `METRICS_TOKEN` from a generated Secret, plus optional ServiceMonitor and PrometheusRule. See [Monitoring](../operations/monitoring.md). |
| `networkPolicy.enabled` | `false` | Default-deny ingress plus the flows the platform needs. Needs a CNI that enforces NetworkPolicy and a dedicated namespace. |
| `sensor.enabled` | `false` | Run a sensor in the cluster. See [Sensors on Kubernetes](../sensors/deploy-kubernetes.md). |

### Gateway modes

| `gateway.mode` | Renders | TLS | API-key clients on any `/api/*` path |
|---|---|---|---|
| `caddy` | The gateway as a Deployment with a `LoadBalancer` Service and a volume for its CA and certificates. | `gateway.caddy.tls.mode` | Yes. |
| `httpRoute` | One Gateway API `HTTPRoute`. | Your Gateway's listener. | Yes (header matching). |
| `ingress` | One `Ingress`. | Your ingress controller (cert-manager annotations supported). | Only on the dedicated API paths: an Ingress cannot match headers. |
| `none` | Nothing; use the per-component `api.ingress` / `ui.ingress`. | | |

With TLS mode `internal`, give sensors the root certificate:

```bash
kubectl -n openctem exec deploy/openctem-gateway -- \
  cat /data/caddy/pki/authorities/local/root.crt > openctem-root-ca.crt
```

## Upgrades and rollback

```bash
helm repo update
helm upgrade openctem openctem/openctem -n openctem -f values.yaml --version <chart-version>
```

The migration Job runs before the new pods. `helm rollback` reverts the
Kubernetes objects only, not the database schema; see
[Upgrading](../operations/upgrade.md). Read the chart README's "Upgrading to"
sections for the chart versions you cross.
