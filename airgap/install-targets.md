---
title: Install targets
parent: Air-gapped and private registry
nav_order: 9
---

# Install targets with a private registry
{: .no_toc }

Every install target runs from your registry, pinned by digest. This page
gives the settings for each. The digests come from the list the mirror step
writes (`openctem-mirrored-<version>.txt` with `name ref digest` lines, or
`trusted.txt` from the CI job).

Templates are in
[`deploy/airgap/templates/`](https://github.com/openctemio/openctem/tree/main/deploy/airgap/templates)
of the repository and in the image kit.

1. TOC
{:toc}

---

## Kubernetes with Helm

Needs chart 0.31.0 or later of `openctemio/helm-charts`. The chart adds
`image.digest` (default empty) on the API, migrations, web (`ui`), console,
gateway and sensor images, and `global.imageRegistry` (default empty). With
both empty, a render is unchanged.

- `global.imageRegistry` replaces the `ghcr.io/openctemio` prefix of every
  OpenCTEM image. The repository basenames stay (`openctem-api`, `migrations`,
  `openctem-web`, `openctem-console`, `openctem-gateway`, `sensor`). An image
  whose `repository` you overrode to another host is used as written.
- `*.image.digest` is `sha256:<64 hex>`. The chart renders
  `repository:tag@digest`. The tag stays for people; the container runtime
  pulls by the digest. A malformed value fails the render. The bootstrap,
  enrollment and migration jobs use the same references as the Deployments.
- `imagePullSecrets` applies to every pod and job of the chart.

[`values-private-registry.yaml`](https://github.com/openctemio/openctem/blob/main/deploy/airgap/templates/values-private-registry.yaml):

```yaml
# Helm (openctemio/helm-charts, chart openctem 0.31.0 or later): run OpenCTEM
# from a private registry with every OpenCTEM image pinned by digest.
#
#   helm upgrade --install openctem openctem/openctem -f values.yaml -f values-private-registry.yaml
#
# The digests come from openctem-mirrored-<version>.txt written by
# mirror-images.sh (or the bump job of .gitlab-ci.mirror.yml, which writes
# this block for you). A digest pins the exact image whatever the tag says;
# a malformed digest fails the render.

global:
  # Replaces ghcr.io/openctemio/ of every OpenCTEM image; the image names
  # (openctem-api, openctem-web, ...) stay. Third-party images below need
  # their own repositories.
  imageRegistry: registry.example.internal/openctem-trusted

# A kubernetes.io/dockerconfigjson Secret with a pull-only robot account.
imagePullSecrets:
  - name: openctem-registry

api:
  image:
    tag: "@VERSION@"
    digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
  migrations:
    image:
      tag: "@VERSION@"
      digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
ui:
  image:
    tag: "@VERSION@"
    digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
console:
  image:
    tag: "@VERSION@"
    digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
gateway:
  caddy:
    image:
      tag: "@VERSION@"
      digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000"

# Only with sensor.enabled=true (the sensor is released from openctemio/sensor;
# mirror it the same way, its signatures name that repository's workflow).
#sensor:
#  image:
#    digest: "sha256:..."

# Production uses external PostgreSQL and Redis. With the bundled ones,
# global.imageRegistry also applies to them: mirror bitnamilegacy/postgresql
# and bitnamilegacy/redis under the same registry path.
postgresql:
  enabled: false
redis:
  enabled: false

# The chart's test pod (helm test).
#tests:
#  image:
#    repository: registry.example.internal/dockerhub-proxy/library/busybox

# Backup CronJob (if enabled): its third-party images from your mirror.
#backup:
#  rclone:
#    image:
#      repository: registry.example.internal/dockerhub-proxy/rclone/rclone
#  dump:
#    image:
#      repository: registry.example.internal/dockerhub-proxy/library/postgres
```

Replace `@VERSION@` with the release and the zero digests with the digests
from the list.

Install:

```bash
helm upgrade --install openctem openctem/openctem \
  -f values.yaml -f values-private-registry.yaml
```

Create the pull secret from a pull-only robot account:

```bash
kubectl create secret docker-registry openctem-registry \
  --docker-server=registry.example.internal \
  --docker-username='robot$openctem-pull-prod' \
  --docker-password-file=/run/secrets/robot-pull
```

**Third-party images** are not changed by `global.imageRegistry`. Mirror them
and set their own keys:

| Image | Key |
|---|---|
| `helm test` pod (busybox) | `tests.image.repository` and `.tag` |
| Backup cronjob (rclone, postgres) | `backup.rclone.image.repository` and `.tag`, `backup.dump.image.repository` and `.tag` |
| Bundled PostgreSQL and Redis (evaluation only) | `postgresql.image.repository`, `redis.image.repository`. The Bitnami subcharts **also read** `global.imageRegistry`: with it set they pull `<registry>/bitnamilegacy/postgresql` and `<registry>/bitnamilegacy/redis` |

Production uses an external database: `postgresql.enabled=false` and
`redis.enabled=false`.

The digest is the integrity anchor. A mirror that serves different bytes under
that digest fails the pull. The mirror must still hold our signatures (copied
as OCI referrers), so the admission policy and `cosign verify` keep working.

Enforce signatures in the cluster with the
[Kyverno policy](reference.md#kyverno-policy).

## Docker Compose

Compose pins by tag. Make tags **immutable** in the registry (Harbor: a tag
immutability rule on `v*`), so a tag cannot be re-pointed.

`mirror-images.sh --env-out openctem-images.env` writes the fragment. Add it to
`api/deploy/.env`:

```bash
# OpenCTEM images from registry.example.internal/openctem-trusted, release vX.Y.Z
OPENCTEM_VERSION=vX.Y.Z
API_IMAGE=registry.example.internal/openctem-trusted/openctem-api
UI_IMAGE=registry.example.internal/openctem-trusted/openctem-web
CONSOLE_IMAGE=registry.example.internal/openctem-trusted/openctem-console
GATEWAY_IMAGE=registry.example.internal/openctem-trusted/openctem-gateway
MIGRATIONS_IMAGE=registry.example.internal/openctem-trusted/migrations
# Third-party images: your own copies (set a tag you mirrored)
POSTGRES_IMAGE=registry.example.internal/dockerhub-proxy/library/postgres:<tag>
REDIS_IMAGE=registry.example.internal/dockerhub-proxy/library/redis:<tag>
```

The CI bump job writes the same variables (without the third-party images) to
`openctem-images.env` in your deployment repository
([Path A2](path-ci-mirror.md#the-bump-merge-request)).

Before `docker compose up`, check the digests you run against the list:

```bash
docker compose config --images
docker compose pull
oras resolve registry.example.internal/openctem-trusted/openctem-api:vX.Y.Z
```

`oras resolve` must print the digest in `openctem-mirrored-<version>.txt`.

## All-in-one image

The all-in-one image `openctem` is in the mirror list like the others. Pull it
from your registry and pin the digest from the list:

```text
registry.example.internal/openctem-trusted/openctem:vX.Y.Z@sha256:<digest from the list>
```

Replace the image reference in your run command or manifest with it. The rest
of the setup is in [All-in-one image](../install/all-in-one.md). The Kyverno
template's `imageReferences` list `openctem-*`, `migrations*`
and `seed*` under the trusted path. The plain path `openctem` (the all-in-one
image) does not match `openctem-*`: add it to `imageReferences` if you run
that image.

## Binaries with systemd

No registry is involved. The release archives come from the release page, from
a Nexus raw proxy of `https://github.com/openctemio/` (set `base` to
`https://nexus.example.internal/repository/github-openctemio/openctem/releases/download/$V`),
or from an offline transfer. The signature check is the same for all.
See [Install from binaries](../install/binaries.md).

## Ansible kit

The `openctem-ansible` kit keeps the image digests of its `versions.yml` and
only swaps the registry prefix. It runs `cosign verify` **at the mirror** with
the release identity before pulling. The mirror must hold our signatures
(`mirror-images.sh` copies them). A mirror without them stops the run before
anything is pulled, and there is no skip.

[`group_vars-private-registry.yml`](https://github.com/openctemio/openctem/blob/main/deploy/airgap/templates/group_vars-private-registry.yml):

```yaml
# Ansible: run OpenCTEM from a private registry. Put these in group_vars/all.yml
# (or the group of your OpenCTEM hosts).
#
# The role keeps the image digests of versions.yml and only swaps the
# registry prefix; it cosign-verifies every image AT THE MIRROR with the
# release identity before pulling, so the mirror must hold our signatures
# (mirror-images.sh copies them). A mirror without them stops the run.

# ghcr.io/openctemio/<name>@sha256:... -> <this>/<name>@sha256:...
openctem_registry_mirror: registry.example.internal/openctem-trusted

# docker.io/library/postgres -> <this>/library/postgres; also redis, rclone,
# cloudflared and the cosign image the check runs in.
openctem_third_party_registry_mirror: registry.example.internal/dockerhub-proxy

# Registry login for the cosign check (a `docker login` done beforehand on
# the host with a pull-only robot account), mounted read-only.
openctem_registry_docker_config_dir: /root/.docker

# CA of the registry's TLS certificate, when it is not in the system store.
#openctem_registry_ca_file: /etc/pki/ca-trust/source/anchors/registry-ca.pem
```

| Variable | Meaning |
|---|---|
| `openctem_registry_mirror` | Replaces `ghcr.io/openctemio` for the OpenCTEM images the kit runs (API, web, gateway, migrations, console). The digest is unchanged |
| `openctem_third_party_registry_mirror` | Third-party images (PostgreSQL, Redis, rclone, cloudflared and the cosign image) are read from `<mirror>/<original path>`, digest unchanged |
| `openctem_registry_docker_config_dir` | Directory with the host's `docker login` for the cosign check, mounted read-only into the cosign container |
| `openctem_registry_ca_file` | Absolute path of the registry's CA, when it is not in the system store |

The values are a host and an optional path, without a scheme or a digest.
Plain-HTTP registries are not supported. With both mirror variables empty,
nothing changes.

## Related

[Reference](reference.md), [Lifecycle](lifecycle.md),
[Troubleshooting](troubleshooting.md)
