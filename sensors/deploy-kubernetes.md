---
title: Deploy on Kubernetes
parent: Sensors
nav_order: 2
---

# Deploy a sensor on Kubernetes

There are two ways to run a sensor in a cluster:

- **Option A**: the bundled sensor of the `openctem` Helm chart, next to the
  platform in the same cluster. It pairs by default; an API key is optional.
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

By default the bundled sensor **pairs**: it makes its own key in its data
volume and logs a code and a fingerprint, which you approve under
**Discovery > Sensors > Add sensor** as for any sensor ([Pairing](pairing.md)).
Nothing secret goes through Helm values.

```bash
helm upgrade openctem openctem/openctem -n openctem --reuse-values \
  --set sensor.enabled=true \
  --set sensor.image.tag={{ site.data.versions.sensor }} \
  --set sensor.sandbox.seccompProfile=openctem \
  --set sensor.localPolicy.enabled=true \
  --set-file sensor.localPolicy.policy=sensor-policy.yaml
kubectl -n openctem logs deploy/openctem-openctem-sensor   # the code and fingerprint
```

- `sensor.sandbox.seccompProfile=openctem` installs the sensor's seccomp
  profile on the nodes (a small DaemonSet) and runs the sensor with it, so
  each scan's network is confined ([Tool confinement](#tool-confinement)).
  It is the chart's default from chart 0.23.0; with `runtime-default` (the
  runtime's own profile) the sensor runs unconfined.
- The local policy is the network owner's list of what the sensor may scan;
  without it a paired sensor refuses every job with network targets
  ([Sensor-local policy](network.md#sensor-local-policy)).

To use an API key instead (an organization that turned off **Require key-bound
sensor identity** in **Settings > Organization > General**; new organizations
have it on), create the sensor with **Discovery > Sensors > Install a sensor**,
copy its key (shown once) and:

```bash
kubectl -n openctem create secret generic openctem-sensor --from-literal=api-key='<key>'
helm upgrade openctem openctem/openctem -n openctem --reuse-values \
  --set sensor.enabled=true --set sensor.existingSecret=openctem-sensor
```

| Value | Default | Meaning |
|---|---|---|
| `sensor.enabled` | `false` | Run the bundled sensor |
| `sensor.image.repository` / `.tag` | `ghcr.io/openctemio/sensor` / a pinned release | The sensor is versioned separately from the platform. Chart 0.28.0 pins v0.23.0; older charts pin older releases (a chart that pins v0.21.1 finds no open ports with confined port scans, fixed in v0.22.0), so set `sensor.image.tag` to the release you want |
| `sensor.sandbox.seccompProfile` | `openctem` | The sensor's own seccomp profile, installed on the nodes by a DaemonSet (`sensor.sandbox.installProfile`), so scans are network-confined. `runtime-default` where a DaemonSet with a host path cannot run; tasks then run unconfined |
| `sensor.sandbox.network` | `auto` | `SENSOR_SANDBOX_NETWORK`: `required` refuses to run a task unconfined |
| `sensor.caFingerprint` / `sensor.platformKey` | empty | `SENSOR_CA_FINGERPRINT` and `SENSOR_PLATFORM_KEY` pins (see [Security notes](security.md#tls-and-pinning)) |
| `sensor.existingSecret` / `.existingSecretKey` | none / `api-key` | Secret holding an API key (preferred over `sensor.apiKey`). Empty: the sensor pairs |
| `sensor.apiUrl` | the in-cluster API service | Override `SENSOR_API_URL` |
| `sensor.tools` | empty | Deprecated (`-tools`): from sensor v0.21.0 the sensor detects its tools and this only narrows them. Leave it empty and narrow with `tools.allow` in `sensor.localPolicy` |
| `sensor.allowPrivateTargets` | empty | `"1"` sets `SENSOR_ALLOW_PRIVATE_TARGETS=1`; any other value fails the render |
| `sensor.data.persistence.enabled` | `true` | One PVC (8Gi) at `/var/lib/openctem`: the sensor's identity (`state/`), undelivered results (`outbox/`) and the scanner content cache (`content/`). Required while the sensor pairs; needs `replicaCount: 1` |
| `sensor.storageLayout` | empty | `data` (one volume) or `split` (a volume per directory: `sensor.state`, `sensor.outbox`, `sensor.content`, the layout before chart 0.19.0). Empty keeps `split` for a release that already has those PVCs. Under GitOps set it explicitly: see the chart README, "Upgrading to 0.19.0" |
| `sensor.localPolicy.enabled` | `false` | Mount a sensor-local policy from a ConfigMap at `/etc/openctem/sensor-policy.yaml`. Turn it on and replace the example range |
| `sensor.netRaw` | `false` | Add `NET_RAW` (naabu SYN scans) |
| `sensor.terminationGracePeriodSeconds` | `45` | Time to drain on shutdown |

The chart's README lists every value. A sensor started with an API key binds
its own signing key at start and the platform retires its API key (see
[Bearer keys](pairing.md#bearer-keys-legacy)); keep
`sensor.data.persistence.enabled` on, or set `SENSOR_KEY_BIND=off` through
`sensor.extraEnv`.

## Option B: plain manifests (pairing)

These manifests run one paired, hardened sensor. They use only the sensor's
documented settings; change the namespace, the URL and the storage sizes to
suit.

For network confinement, put the sensor's seccomp profile on every node that
may run the pod, under the kubelet's seccomp directory (by default
`/var/lib/kubelet/seccomp/`), with the name the manifest uses:

```bash
# on each node, as root
mkdir -p /var/lib/kubelet/seccomp/openctem
curl -fsSLo /var/lib/kubelet/seccomp/openctem/sensor-{{ site.data.versions.sensor }}.json \
  https://raw.githubusercontent.com/openctemio/sensor/{{ site.data.versions.sensor }}/docker/seccomp/sensor.json
```

A pod whose `Localhost` profile is missing on its node does not start
(`CreateContainerError`). Without node access, use `RuntimeDefault` instead:
the sensor then runs unconfined ([Tool confinement](#tool-confinement)).

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
          # The sensor's profile, installed on the node (see above).
          # RuntimeDefault works too, but the sensor then runs unconfined.
          type: Localhost
          localhostProfile: openctem/sensor-{{ site.data.versions.sensor }}.json
      containers:
        - name: sensor
          image: ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }}
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              # Add NET_RAW only for naabu SYN scans.
              drop: ["ALL"]
          env:
            - name: SENSOR_API_URL
              value: https://openctem.example.com
            # The tools keep their settings under /tmp (read-only root).
            - name: XDG_CONFIG_HOME
              value: /tmp/.config
            - name: XDG_CACHE_HOME
              value: /tmp/.cache
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
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: openctem-sensor-data
        - name: tmp
          emptyDir: {}
```

Apply it, then read the pairing code and approve it as described in
[Pairing](pairing.md):

```bash
kubectl create namespace openctem-sensor
kubectl apply -f openctem-sensor.yaml
kubectl -n openctem-sensor logs deploy/openctem-sensor -f
```

After approval, check the start-up lines:

```bash
kubectl -n openctem-sensor logs deploy/openctem-sensor | grep -E 'Tool network:|Transport:|Preflight:'
```

`Tool network: confined` and `Preflight: ... 0 failed` mean the sensor is
ready; [Check that it works](index.md#4-check-that-it-works) explains each
line.

The per-tool images (`-opengrep`, `-semgrep`, `-trivy`, `-betterleaks`, `-nuclei`) run as
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

gRPC on port 443 needs a layer-4 path to the API's mTLS listener (port 9443 in
the cluster; `api.sensorTransport.mtls.port`). An ingress controller that
routes by SNI only (ssl-passthrough) cannot use the routing id of the
[Compose setup](transport.md#grpc-on-port-443-docker-compose). With the chart's
bundled gateway (image `ghcr.io/openctemio/openctem-gateway`, which carries the
layer-4 module) the chart enables the routing by itself
(`gateway.caddy.sensorGateway`, default `alpn` when the image has the module;
`passthrough` adds a dedicated sensor host name, `off` keeps HTTPS), and
expects the gateway in a TLS mode other than `http`. Without the bundled
gateway use a dedicated sensor host name passed through by SNI
(`api.sensorTransport.publicHost`), or the API terminating TLS itself
([The API terminates TLS itself](transport.md#the-api-terminates-tls-itself)).
The `openctem` chart README describes the options ("Sensor protocol v3" and
"Single-port gateway"). Every other setup uses HTTPS, which runs every scan.

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

## Tool confinement

The sensor confines each scan's network only when its seccomp profile allows
new namespaces. With the runtime's default profile (`RuntimeDefault`) it logs
`Warning: tool network not confined` and runs unconfined: most scans run, but
a nuclei job on a host with an excluded path fails, and a job limited to some
ports or paths goes only to a confined sensor. Use the `Localhost` profile
above (Option B) or `sensor.sandbox.seccompProfile=openctem` (Option A).

The node must also allow unprivileged user namespaces. On Ubuntu 23.10 and
later (`kernel.apparmor_restrict_unprivileged_userns=1`), the container
runtime's default AppArmor profile allows them; do not set the pod's AppArmor
profile to `Unconfined`. More in [Security notes](security.md#tool-confinement).

## Upgrade and remove

Change the image tag (and, for Option B, install the seccomp profile of the
new release on the nodes and change `localhostProfile`), then apply. The
`Recreate` strategy stops the old pod before the new one starts, so the
identity and the outbox move over. Rollback, backups and removal:
[Upgrade, back up and remove](operate.md).
