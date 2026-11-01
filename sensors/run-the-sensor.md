---
title: Run the sensor
parent: Sensors
nav_order: 0.5
---

# Run the sensor
{: .no_toc }

The complete guide to running the OpenCTEM sensor in Docker: from the first
prerequisite to troubleshooting. For the settings behind it see
[Deploy with Docker](deploy-docker.md) and the [settings reference](settings.md).

1. TOC
{:toc}

---

## Prerequisites

| Need | Detail |
|---|---|
| Docker | Docker Engine 24 or later on Linux (amd64 or arm64). Docker Compose v2.20 or later for the Compose file (`docker compose version`). Linux 5.13 or later lets the tool sandbox use Landlock; older kernels work with a warning. |
| Size | 2 CPUs and 2 GiB of RAM for a small sensor; 4 CPUs and 4 GiB if several scans run at once. Disk: 10 GiB free for the data volume (scanner content is about 1 GiB, the workspace budget 4 GiB, the outbox up to 1 GiB by default). The sensor stops claiming work when the volume is nearly full, see [Troubleshooting](#low-disk-the-sensor-stops-claiming-work). |
| Network | Outbound HTTPS (443, or the port of your platform URL) to the platform API. A platform with sensor mTLS also needs outbound TCP to its mTLS port (9443 by default; the platform's install snippet shows it). No inbound port. The host also needs to reach the targets it scans. |
| Proxy | Optional. If the host reaches the platform through an HTTP proxy, set `HTTPS_PROXY` (and `NO_PROXY`). A TLS-inspecting proxy needs `SENSOR_TRANSPORT=https`. |
| Clock | Synchronised (chrony or systemd-timesyncd). Signatures allow 2 minutes of difference. |
| Platform | The platform URL and someone with the **Pair sensors** and **Approve sensors** permissions. |

## Get the command and a pairing code

In the console open **Discovery > Sensors > Add sensor**, pick where the
sensor will run and choose **Show the command**. The command already holds
your platform URL and a single-use code like `K7QM-4ZTD`; keep it private
until the sensor has used it. The sensor prints the same code, a link to
approve it on and its fingerprint, and the console finds it by itself.

Started a sensor another way, without a code? It prints a code and a link
too: open the link, or enter the code on the **Approve a sensor** page. Either
way, pick the fingerprint the sensor prints among the three the console
offers before approving ([Pairing](pairing.md#add-a-sensor-one-command-one-approval)).

## Start the sensor

Use a **named volume** for `/var/lib/openctem`. Docker creates it with the
sensor's owner, so there is nothing to `chown`.

```bash
SENSOR_VERSION={{ site.data.versions.sensor }}   # the release to run
docker run --rm "ghcr.io/openctemio/sensor:${SENSOR_VERSION}" seccomp-profile > openctem-sensor-seccomp.json

docker run -d --name openctem-sensor --restart unless-stopped \
  --stop-timeout 45 \
  --read-only --tmpfs /tmp --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --security-opt seccomp="$PWD/openctem-sensor-seccomp.json" \
  --dns-search . \
  -e XDG_CONFIG_HOME=/tmp/.config -e XDG_CACHE_HOME=/tmp/.cache \
  -e SENSOR_API_URL=https://openctem.example.com \
  -e SENSOR_PAIRING_CODE=XXXX-XXXX \
  -e SENSOR_ALLOWED_RANGES='203.0.113.0/24,*.example.com' \
  -v openctem-sensor-data:/var/lib/openctem \
  "ghcr.io/openctemio/sensor:${SENSOR_VERSION}"

docker logs -f openctem-sensor
```

With Compose, use [`docker-compose.example.yml`](https://github.com/openctemio/sensor/blob/main/docker-compose.example.yml)
(it matches this guide): put `SENSOR_API_URL` and `SENSOR_PAIRING_CODE` in a
`.env` file next to it, then `docker compose up -d`.

The log should end with `Tool network: confined` and `Preflight: ... 0
failed`, and the console shows the sensor online. After the first start the
pairing code is ignored.

### A bind mount instead of a named volume

A host directory mounted at `/var/lib/openctem` keeps the image's ownership
out: the sensor runs as a non-root user and cannot write a directory another
user owns. Give it the directory first:

```bash
sudo mkdir -p /srv/openctem-sensor
sudo chown -R 999:999 /srv/openctem-sensor
docker run ... -v /srv/openctem-sensor:/var/lib/openctem ...
```

| Image | User (uid:gid) |
|---|---|
| default (`ghcr.io/openctemio/sensor:<version>`) | `999:999` |
| the per-tool images (`-opengrep`, `-semgrep`, `-trivy`, `-betterleaks`, `-nuclei`) | `1001:1001` |
| the slim image (no tools) | `65532:65532` (distroless `nonroot`) |

The ids differ per image because each image has always run as that user and a
volume written by one release must stay readable by the next; they are not
changed. Use the uid of the image you run. With SELinux add `:Z` to the mount
(`-v /srv/openctem-sensor:/var/lib/openctem:Z`). With rootless Docker or user
namespaces the host owner is the mapped id, not 999: use a named volume.

The sensor checks its data directories before it does anything else. If it
cannot write them it exits with code 1 and prints the path, the owner, its own
uid:gid and the two fixes.

## What lives in /var/lib/openctem

Mount **one** volume at `/var/lib/openctem`. The image declares no `VOLUME`
on purpose: an anonymous volume looks persistent and is lost with the
container.

| Directory | Holds | Keep it? |
|---|---|---|
| `state/` | The sensor's identity: its private key, client certificate and pinned CAs, and the renewed API key | **Yes.** It is the sensor's only credential. Back it up encrypted, never share it, never run two sensors from one copy. Without it the sensor must be paired again. |
| `store/` | The encrypted local store: keys of the sealed outbox items, the job journal, `master.key` | **Yes**, with the outbox. `SENSOR_STORE_KEY_FILE` can point at a mounted secret to keep the key off the volume. |
| `outbox/` | Results not yet accepted by the platform (encrypted) | **Yes.** Without it, results queued during an outage or an upgrade are lost. One sensor per outbox. |
| `workspaces/` | Per-job scratch directories, removed when a job ends | No. Swept at start. |
| `content/` | Scanner content (nuclei templates; trivy database and semgrep rules on the per-tool images) | No. A cache, downloaded again when missing. |

Back up (the `content/` cache can be left out):

```bash
docker run --rm -v openctem-sensor-data:/data:ro -v "$PWD":/backup alpine \
  tar -C /data --exclude=./content --exclude=./workspaces -czf /backup/openctem-sensor-data.tgz .
```

Restore with the old sensor stopped, into a new volume (`tar -xzpf` keeps
owners and modes). See [Upgrade, back up and remove](operate.md).

## Environment variables

The common ones. Every setting is in the
[settings reference](settings.md).

| Group | Variable | Default | Meaning |
|---|---|---|---|
| Platform | `SENSOR_API_URL` | none (required) | The platform URL. Must reach the API directly; redirects are refused. |
| Pairing | `SENSOR_PAIRING_CODE` | none | The code of the command from **Add sensor** (`XXXX-XXXX`). Used while the sensor has no identity; ignored once paired. |
| Pairing | `SENSOR_API_KEY` | none | A legacy bearer key instead of pairing. |
| Pairing | `SENSOR_INSTANCE_ENROLLMENT_TOKEN` | none | A single-use token for a sensor shared by every organization. |
| Identity | `SENSOR_NAME` | `sensor-<hostname>` | The name the sensor proposes; the approver may change it. |
| TLS | `SENSOR_CA_CERT_FILE` | none | A PEM file with the platform's private CA. |
| TLS | `SENSOR_CA_SHA256` | none | SHA-256 of the platform's private root CA (the console's command sets it): the sensor fetches the CA from the platform and trusts only that root. |
| TLS | `SENSOR_CA_FINGERPRINT` | none | SHA-256 fingerprint of the platform CA (from the install snippet) to pin. |
| Network | `HTTPS_PROXY`, `NO_PROXY` | none | A proxy to the platform. |
| Network | `SENSOR_CONTROL_PROXY` | none | A proxy for the control channel only. |
| Network | `SENSOR_TRANSPORT` | `auto` | Leave it. `https` behind a TLS-inspecting proxy. |
| Scope | `SENSOR_ALLOWED_RANGES` | none | What the sensor may scan (CIDRs, IPs, names, `*.domain`). Optional: without it or a policy file the sensor follows the platform's signed scope. |
| Scope | `SENSOR_ALLOW_PRIVATE_TARGETS` | off | `1` allows RFC 1918 and IPv6 ULA targets. |
| Content | `SENSOR_CONTENT` | on | `off` turns managed scanner content off. |
| Content | `SENSOR_CONTENT_DIR` | `/var/lib/openctem/content` | Where content is kept. |
| Content | `SENSOR_CONTENT_REFRESH_INTERVAL`, `SENSOR_CONTENT_KEEP` | see settings | How often content refreshes and how many versions stay. |
| Data | `SENSOR_STATE_DIR`, `SENSOR_OUTBOX_DIR`, `SENSOR_STORE_DIR`, `SENSOR_WORKSPACE_DIR` | under `/var/lib/openctem` | Move a directory elsewhere. Each is checked at start. |
| Limits | `SENSOR_MAX_JOBS` | from CPU, memory and tool cost | Cap on jobs at once, 1 to 100. |
| Limits | `SENSOR_OUTBOX_MAX_BYTES`, `SENSOR_OUTBOX_MAX_AGE` | `1GiB`, `168h` | Outbox disk cap and age. |
| Limits | `SENSOR_NUCLEI_MAX_RATE_LIMIT`, `SENSOR_NUCLEI_MAX_CONCURRENCY`, `SENSOR_NUCLEI_MAX_BULK_SIZE` | 150, 25, 25 | The operator's ceilings for nuclei. |
| Safety | `SENSOR_SANDBOX_NETWORK` | `auto` | `required` refuses to start without network confinement. |
| Shutdown | `SENSOR_DRAIN_GRACE` | `30s` | How long running jobs may finish on stop. Keep `--stop-timeout` above it. |

Container limits (`--memory`, `--cpus`) work as usual; the sensor sizes its
job slots from what it sees.

## Capabilities and seccomp

- Run with `--cap-drop ALL`. Add `--cap-add NET_RAW` only if you want naabu
  SYN port scans; without it naabu uses connect scans.
- The seccomp profile lets the sensor confine each scan's network. Print the
  profile of the image you run: `docker run --rm ghcr.io/openctemio/sensor:<version>
  seccomp-profile > openctem-sensor-seccomp.json`, and pass it with
  `--security-opt seccomp=...`. Do not use `--privileged` or
  `seccomp=unconfined`.
- `--read-only` with `--tmpfs /tmp` is supported; the data volume is the only
  writable mount besides `/tmp`.
- Never mount the Docker socket into the sensor.

## Upgrade

```bash
docker pull ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }}
docker run --rm ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} seccomp-profile > openctem-sensor-seccomp.json
docker rm -f openctem-sensor
# run the same docker run command with the new tag and the same volume
```

With Compose: change the tag, then `docker compose pull && docker compose up -d`.
The identity, the outbox and the content cache carry over, and the sensor
does not pair again. Read the release notes first.

## Several sensors on one host

When one host scans for several organizations or platforms, run one sensor
for each from one directory with
[`deploy/multi`](https://github.com/openctemio/sensor/blob/main/deploy/multi/README.md)
of the sensor repository (sensor v0.30.0 and later): one Compose file, one
service per sensor. Each sensor has its own env file (platform URL and
pairing code, mode 0600), its **own data volume**, its own network and its
own policy directory with its own kill switch. The release (`SENSOR_VERSION`
in `.env`) and the hardening of this page are set once for all of them.

```bash
SENSOR_VERSION={{ site.data.versions.sensor }}
mkdir -p ~/openctem-sensors && cd ~/openctem-sensors
for f in compose.yaml sensors.sh .env.example .gitignore; do
  curl -fsSLO "https://raw.githubusercontent.com/openctemio/sensor/${SENSOR_VERSION}/deploy/multi/$f"
done
chmod +x sensors.sh && cp .env.example .env

./sensors.sh add acme --api-url https://openctem.example.com
```

`add` writes the sensor's settings, starts only that sensor and prints a link
to open in the console, its code and its fingerprint:

```
  Pair this sensor: open https://openctem.example.com/activate?code=K7QM-4ZTD
  Code:        K7QM-4ZTD
  Fingerprint: 821 · melon · basil · bagel
```

Open the link while signed in as an administrator of the organization the
sensor is for, pick the fingerprint this terminal shows and approve. `add`
ends by itself once the sensor is paired and clears a spent code from the
sensor's `sensor.env`. It gives up waiting after 15 minutes
(`PAIR_WAIT_SECONDS`); Ctrl-C stops the waiting, not the sensor
(`./sensors.sh pair acme` watches again). The image is pulled with progress
and the pull stops with a hint after 10 minutes (`PULL_TIMEOUT_SECONDS`).
Nothing needs editing: the sensor follows the organization's scope.

| Command | What it does |
|---|---|
| `./sensors.sh add NAME --api-url URL` | Add, start and pair one sensor. `--ca-sha256 HEX[,HEX]` pins a private platform CA; `--ca-file FILE` installs one and prints the subject and SHA-256 of every certificate in it; `--pairing-code XXXX-XXXX` pairs with a code made in the console or the API (automation); `--no-start` only writes the sensor. |
| `./sensors.sh pair NAME [--pairing-code CODE]` | Start one sensor and watch its pairing again (with a new code: write it and recreate the container). |
| `./sensors.sh status` | One plain line per sensor: "running and paired", "waiting for approval: open *link*", or why not (an untrusted certificate authority, a refusal). |
| `./sensors.sh stop NAME`, `start NAME` | Stop or start one sensor; its key and queued results stay. |
| `./sensors.sh down` | Remove every container; the volumes are never removed. `up` starts every sensor again. |
| `./sensors.sh logs NAME` | Follow one sensor's log. |
| `./sensors.sh upgrade [--self-update] vX.Y.Z` | Verify the image signature (cosign), pull with progress, set `SENSOR_VERSION`, recreate the containers. Identity, outbox and caches stay; no sensor pairs again. |
| `./sensors.sh self-update vX.Y.Z` | Replace the kit's own files with the release's after a signed-checksum check ([below](#update-the-kit-itself)). |
| `./sensors.sh set-ca NAME --sha256 HEX[,HEX]` or `--file FILE` | Trust a platform behind a private CA on an existing sensor ([below](#a-platform-behind-a-private-ca)). |
| `./sensors.sh set-policy NAME --allow-all` or `--platform-scope` | Write or stop reading a local policy that allows every target the platform signs ([below](#local-policy-and-scan-headers-of-a-kit-sensor)). |
| `./sensors.sh set-header NAME HEADER VALUE`, `unset-header NAME HEADER` | Mark this sensor's scan traffic ([below](#local-policy-and-scan-headers-of-a-kit-sensor)). |
| `./sensors.sh repair NAME --pairing-code CODE [--yes]` | Answer the console's Re-pair for one sensor ([below](#re-pair-one-sensor-of-the-kit)). |
| `./sensors.sh remove NAME [--purge] [--yes]` | Stop and remove one sensor, its `sensors/NAME/` directory and its `compose.yaml` blocks; `--purge` also deletes its data volume. |

A sensor that was stopped before anyone approved it keeps its key: start it
again (`./sensors.sh pair acme`) and open its new link. A key that was
approved once never pairs again: the sensor then says its key is already
registered, and needs its identity back or a re-pair.

### The local policy is optional

A sensor scans only what its organization's scope allows. The owner of the
host may narrow one sensor further: write
`sensors/acme/policy/sensor-policy.yaml` (it can only narrow; the platform
never writes it), uncomment `SENSOR_LOCAL_POLICY` in
`sensors/acme/sensor.env`, then `./sensors.sh stop acme && ./sensors.sh start
acme`. `touch sensors/acme/policy/STOP` stops every job of that sensor while
the file exists. A directory set up with a kit older than sensor v0.33.0 has
`SENSOR_LOCAL_POLICY` in the `x-sensor` block of `compose.yaml`, so every
sensor there needs a policy file (`add` then writes one that narrows
nothing): run `self-update` to convert it.

### A platform behind a private CA

When the platform's certificate comes from a private certificate authority,
`./sensors.sh status` says the authority is not trusted. Pin the platform's
**root** CA by its SHA-256 (from the console's install command; the sensor's
own message lists every certificate the platform presented, intermediates
included, so compare the root's hash with the console's before using it):

```bash
./sensors.sh set-ca acme --sha256 <root-ca-sha256>   # hex, colons optional, a,b for a rotation
./sensors.sh set-ca acme --file platform-ca.pem      # air-gapped: the CA itself
```

`--sha256` sets `SENSOR_CA_SHA256` in `sensors/acme/sensor.env`; the sensor
fetches the CA from the platform and accepts it only if a certificate in it
has that hash and signs the platform's chain. `--file` installs the file as
`sensors/acme/policy/platform-ca.pem` and sets `SENSOR_CA_CERT_FILE` (on a
sensor host this variable is the CA the sensor trusts). Both keep `sensor.env`
at mode 0600 and recreate the container.

### Local policy and scan headers of a kit sensor

```bash
./sensors.sh set-policy acme --allow-all        # writes sensors/acme/policy/sensor-policy.yaml, recreates acme
./sensors.sh set-policy acme --platform-scope   # stop reading the file (the file stays)
./sensors.sh set-header acme X-Netops dc1       # send X-Netops: dc1 on every request of every job
./sensors.sh unset-header acme X-Netops
```

`--allow-all` writes a policy with `targets.allow: ["*"]`, sets
`SENSOR_LOCAL_POLICY` and recreates the container. The built-in deny list and
the private-range rules still apply, and an existing file is kept as
`sensor-policy.yaml.bak-<UTC time>`. The `"*"` form needs sensor v0.35.0 or
newer; on an older one the command refuses and names the upgrade.

`set-header` and `unset-header` manage `http.headers` of the policy
([Mark this sensor's scan traffic](network.md#mark-this-sensors-scan-traffic)):
at most 4 headers, rules checked before anything is written, sensor v0.35.0 or
newer, the container recreated. The policy keeps its scope: without a policy
file `set-header` writes one with no `targets` section, so the sensor still
follows the platform's scope. An existing policy keeps its content (it must
already be `openctem.io/sensor-policy/v1`, the only schema) and is backed up.
The headers live in a block the script owns; a policy with its own `http:`
section is never rewritten, so add `http.headers` there by hand.

### Update the kit itself

`upgrade` moves the image only. The kit's own files (`sensors.sh`,
`compose.yaml`, `README.md`, `.env.example`) change between releases, so
update them with:

```bash
./sensors.sh self-update vX.Y.Z      # or: ./sensors.sh upgrade --self-update vX.Y.Z
./sensors.sh up                      # recreate the sensors with the new compose.yaml
```

It downloads the release's kit files and a keyless cosign-signed checksum
list, verifies the signature and every checksum before changing anything,
backs the current files up as `<file>.bak-<UTC time>`, re-inserts your
existing services, volumes and networks unchanged, checks `docker compose
config` and restores the backups if that fails. It never touches `sensors/`,
volumes or containers, and it converts an older kit's `compose.yaml` that
hard-wires a local policy file. Releases before v0.34.0 have no signed kit
files; update those by hand.

### Re-pair one sensor of the kit

In the console open **Sensors > the sensor > Re-pair...**, create the code,
then:

```bash
./sensors.sh repair acme --pairing-code XXXX-XXXX
```

It states that the current key keeps working until you approve the re-pair
(unless you revoked it in the console) and asks for confirmation (`--yes`
skips it). It stops the sensor, deletes only its identity directory on the
data volume (the outbox and caches stay, so queued results are delivered
under the new key), writes the code and pairs it again: approve it in the
console as in [Re-pair a sensor](pairing.md#re-pair-a-sensor).

Removing a sensor does not stop its key from working: also revoke or delete
it in the console (**Revoke access** or **Delete**). Without `--purge` the
volume stays, so adding the same name again finds its key; with `--purge` the
key and any results the platform has not accepted yet are lost.

| Setup | Use when |
|---|---|
| One sensor (this page) | One organization, one sensor on the host. |
| `deploy/multi` | One host runs sensors for several organizations or platforms, each paired and administered separately. |
| A [shared sensor](shared-sensors.md) | The instance administrator runs one sensor that takes jobs of every organization. |
| Separate hosts | The organizations must not share a kernel, a host administrator or a network vantage point, or one host cannot carry the load. |

Never share a volume or copy one: a second process on the same outbox refuses
to start, and a cloned identity is flagged `identity_cloned`. Sensors on one
host share its kernel, CPU, disk and outbound address, and anyone with Docker
access on the host can read every sensor's volume.

## Kubernetes

Use the bundled sensor of the `openctem` Helm chart or the Deployment in
[Deploy on Kubernetes](deploy-kubernetes.md).
The pod runs as uid/gid 999 and needs `fsGroup: 999` on the persistent volume
(the chart sets it).

## Uninstall and re-pair

Uninstall:

1. In the console open the sensor and choose **Revoke access**.
2. `docker rm -f openctem-sensor && docker volume rm openctem-sensor-data`
   (a bind mount: delete the host directory).
3. Delete backups of the volume; they hold a revoked key.

Re-pair (lost or corrupted identity, or a moved host): open the sensor in the
console, choose **Re-pair...**, create the re-pair code, remove the old
volume (or run `pair -repair`, see `openctemio-sensor -help`), and start the
sensor with the new `SENSOR_PAIRING_CODE`. See
[Re-pair a sensor](pairing.md#re-pair-a-sensor).

## Troubleshooting

### Permission denied on /var/lib/openctem
{: #permission-denied-on-varlibopenctem }

The container exits right after start:

```
Error: the sensor's data directory is not usable: mkdir /var/lib/openctem/content: permission denied
  path:               /var/lib/openctem/content
  owner of /var/lib/openctem: uid 1000, gid 1000 (mode 0755)
  the sensor runs as: uid 999, gid 999
```

You mounted a host directory that the sensor's user does not own. Either
`sudo chown -R 999:999 <host dir>` (1001 on a per-tool image, 65532 on the slim image), or use a named
volume (`-v openctem-sensor-data:/var/lib/openctem`). If the host directory
holds an older sensor's data, chown keeps it.

### Pairing failed

| The log says | Fix |
|---|---|
| A code and a link are printed and nothing happens | An administrator must open the link (or enter the code on the **Approve a sensor** page), pick the fingerprint and approve it. Or start with the code of the Add sensor command (`SENSOR_PAIRING_CODE`). |
| The sensor says its key is already registered (HTTP 409, `pairing-key-registered`) | The sensor's key is already registered. Re-pair it from the console, or remove its data volume to pair it as a new sensor. |
| `The pairing request expired` | Nobody approved within 10 minutes; the sensor starts a new request. |
| `Rate limited ... HTTP 429` | Pairing starts are limited per address. Wait; avoid restart loops. |
| `x509: certificate signed by unknown authority` | The platform uses a private CA: use the console's install command (it pins the root, `SENSOR_CA_SHA256`), set `SENSOR_CA_SHA256` to the root's SHA-256, or mount the CA and set `SENSOR_CA_CERT_FILE`. |

### Clock skew (HTTP 401 on start)

`this machine's clock is 4h10m0s ahead of the platform's clock` or `HTTP 401
... Invalid credentials`: signatures allow 2 minutes of difference. Check
both hosts with `timedatectl` (`System clock synchronized: yes`) and `chronyc
tracking`; step the clock with `sudo chronyc makestep`.

### Cannot reach the API

`connection refused`, a timeout or a TLS error. From the sensor's host:
`curl -v https://openctem.example.com/health`. Check the firewall for the
platform port and the mTLS port, `HTTPS_PROXY`, and that `SENSOR_API_URL` is
the platform URL (not the web UI behind a proxy that strips `Authorization`).

### Low disk, the sensor stops claiming work

The sensor cleans up harder when less than 15% of the volume is free, and stops
claiming new jobs below 5% free (or 256 MiB, whichever is more). It reports
this on its heartbeat. Free space on the volume (`docker system df -v`, remove
unused images and volumes), or move `content/` and `workspaces/` to larger
storage with `SENSOR_CONTENT_DIR` and `SENSOR_WORKSPACE_DIR`.

### Tools missing

`openctemio-sensor -list-tools` (run it with
`docker run --rm ghcr.io/openctemio/sensor:<version> -list-tools`) shows each
scanner and whether its binary is installed and passes its check. The default
image carries nuclei and the recon tools; opengrep, semgrep, trivy and
betterleaks are in their own images. A tool the local policy's `tools.allow`
does not list is disabled by choice.

### More

[Troubleshooting](troubleshooting.md) has the full table of messages and the setup checklist.
