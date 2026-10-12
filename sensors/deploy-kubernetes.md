---
title: Deploy on Kubernetes
parent: Sensors
nav_order: 2
---

# Deploy a sensor on Kubernetes

There are two ways to run a sensor in a cluster:

- **Option A**: the bundled sensor of the `openctem` Helm chart, next to the
  platform in the same cluster. It authenticates with an API key.
- **Option B**: plain manifests for a sensor anywhere else (another cluster,
  another network). It pairs, like a Docker sensor.

There is no separate Helm chart for a standalone sensor.

## Option A: the bundled sensor of the openctem chart

The [`openctem` chart](https://github.com/openctemio/helm-charts/tree/main/charts/openctem)
(chart repository `https://openctemio.github.io/helm-charts`) can run one
co-located sensor. It talks to the in-cluster API service and is meant for
work the cluster itself can reach (public targets, recon, validation). An
internal network still needs a sensor inside it (option B or
[Docker](deploy-docker.md)).

The bundled sensor needs an API key, so the organization must allow key-based
sensors: turn off **Require key-bound sensor identity** in
**Settings > Organization > General** (new organizations have it on). Then:

1. **Discovery > Sensors > Install sensor**, create the sensor and copy its
   key (shown once).
2. Store the key in a Secret and enable the sensor:

   ```bash
   kubectl -n openctem create secret generic openctem-sensor --from-literal=api-key='<key>'
   helm upgrade openctem openctem/openctem -n openctem --reuse-values \
     --set sensor.enabled=true --set sensor.existingSecret=openctem-sensor
   ```

| Value | Default | Meaning |
|---|---|---|
| `sensor.enabled` | `false` | Run the bundled sensor |
| `sensor.image.repository` / `.tag` | `ghcr.io/openctemio/sensor` / a pinned release | The sensor is versioned separately from the platform |
| `sensor.existingSecret` / `.existingSecretKey` | none / `api-key` | Secret holding the API key (preferred over `sensor.apiKey`) |
| `sensor.apiUrl` | the in-cluster API service | Override `SENSOR_API_URL` |
| `sensor.tools` | `nuclei` | Scanners passed with `-tools` |
| `sensor.allowPrivateTargets` | empty | `"1"` sets `SENSOR_ALLOW_PRIVATE_TARGETS=1`; any other value fails the render |
| `sensor.data.persistence.enabled` | `true` | One PVC (8Gi) at `/var/lib/openctem`: the sensor's identity (`state/`), undelivered results (`outbox/`) and the scanner content cache (`content/`). Needs `replicaCount: 1` |
| `sensor.storageLayout` | empty | `data` (one volume) or `split` (a volume per directory: `sensor.state`, `sensor.outbox`, `sensor.content`, the layout before chart 0.19.0). Empty keeps `split` for a release that already has those PVCs. Under GitOps set it explicitly: see the chart README, "Upgrading to 0.19.0" |
| `sensor.localPolicy.enabled` | `false` | Mount a sensor-local policy from a ConfigMap at `/etc/openctem/sensor-policy.yaml`. Turn it on and replace the example range |
| `sensor.netRaw` | `false` | Add `NET_RAW` (naabu SYN scans) |
| `sensor.terminationGracePeriodSeconds` | `45` | Time to drain on shutdown |

The chart's README lists every value. The chart pins its own sensor tag
(`sensor.image.tag`). With a tag of v0.13.0 or later the bundled sensor binds
its own signing key at start and the platform retires its API key (see
[Bearer keys](pairing.md#bearer-keys-legacy)); keep
`sensor.data.persistence.enabled` on, or set `SENSOR_KEY_BIND=off` through
`sensor.extraEnv`.

## Option B: plain manifests (pairing)

These manifests run one paired sensor. They use only the sensor's documented
settings; change the namespace, the URL and the storage sizes to suit.

```yaml
# One volume for the sensor's data: state/ (its identity), outbox/
# (undelivered results) and content/ (scanner cache, re-downloadable).
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: openctem-sensor-data
  namespace: openctem-sensor
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 8Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openctem-sensor
  namespace: openctem-sensor
spec:
  # One identity and one outbox: a single replica, the old pod stops first.
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app.kubernetes.io/name: openctem-sensor
  template:
    metadata:
      labels:
        app.kubernetes.io/name: openctem-sensor
    spec:
      terminationGracePeriodSeconds: 45
      securityContext:
        runAsNonRoot: true
        runAsUser: 999          # the default image's user
        runAsGroup: 999
        fsGroup: 999
        fsGroupChangePolicy: OnRootMismatch
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: sensor
          image: ghcr.io/openctemio/sensor:v0.17.0
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
          env:
            - name: SENSOR_API_URL
              value: https://openctem.example.com
            # What this sensor may scan. Without it (or a policy file) a newly
            # paired sensor refuses every job with network targets.
            - name: SENSOR_ALLOWED_RANGES
              value: "203.0.113.0/24,*.example.com"
            # - name: SENSOR_CA_FINGERPRINT
            #   value: "<SHA-256 of the platform CA>"
            # - name: SENSOR_ALLOW_PRIVATE_TARGETS
            #   value: "1"
          volumeMounts:
            - name: data
              mountPath: /var/lib/openctem
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: openctem-sensor-data
```

Apply it, then read the pairing code and approve it as described in
[Pairing](pairing.md):

```bash
kubectl create namespace openctem-sensor
kubectl apply -f openctem-sensor.yaml
kubectl -n openctem-sensor logs deploy/openctem-sensor -f
```

The per-tool images (`-semgrep`, `-trivy`, `-betterleaks`, `-nuclei`) run as
uid and gid 1001: set `runAsUser`, `runAsGroup` and `fsGroup` to `1001` for
them.

### Identity files and fsGroup

The sensor refuses to start when its identity files are readable by their
group. With `fsGroup`, Kubernetes by default adds group read and write to
every file of a volume each time it mounts it, which would turn the
identity's `0600` files into `0660` after the first restart. Keep
`fsGroupChangePolicy: OnRootMismatch` (as above) so ownership is fixed only
when the volume is new, or prepare the volume so that it is owned by the
sensor's user and leave `fsGroup` unset.

### Add a local policy

Keep the sensor-local policy in a ConfigMap that only the owner of the
scanned network can change, and mount it read-only:

```yaml
# in the pod spec
volumes:
  - name: policy
    configMap:
      name: openctem-sensor-policy
      defaultMode: 0444
containers:
  - name: sensor
    env:
      - name: SENSOR_LOCAL_POLICY
        value: /etc/openctem/policy/sensor-policy.yaml
    volumeMounts:
      - name: policy
        mountPath: /etc/openctem/policy
        readOnly: true
```

To stop all jobs, set `kill_switch: true` in the policy and restart the pod.
The policy format is described in [Network](network.md#sensor-local-policy).

## Transport on Kubernetes

A sensor in or outside the cluster uses the **HTTPS** transport through any
ingress or load balancer in front of the platform, with nothing to configure.
Keep response buffering off and the idle timeout above 30 seconds on the
ingress for `/api/v3/sensor/*`: the platform pushes jobs over a long-lived
response.

gRPC on port 443 needs a layer-4 path to the API's mTLS listener. An ingress
controller that routes by SNI only (ssl-passthrough) cannot use the routing id
of the [Compose setup](transport.md#grpc-on-port-443-docker-compose), so on
Kubernetes it takes a dedicated sensor host name passed through by SNI. Chart
support for the automatic transport of the current platform is **coming**;
until then sensors use HTTPS.

{: .warning }
Do not set `api.sensorTransport.enabled` (charts 0.16.0 and 0.17.0) with a
current platform: the chart sets `SENSOR_TRANSPORT_V3_ENABLED`, a retired
variable the API refuses at start (`retired environment variables are set and
no longer read`). The platform serves protocol v3 without it.

## One job per pod

`openctemio-sensor -job <command id>` (or `SENSOR_JOB_ID`) runs exactly one
platform command and exits, for launchers that start one pod per job. It
sets up like a daemon, claims that command, runs it with every check a polled
command gets, waits up to 5 minutes for its results to be delivered and
exits `0` (non-zero when the claim was refused, the job was not run, or its
results were not delivered in time). Mount the outbox on a persistent
volume: results not delivered before the pod ends are otherwise lost.
