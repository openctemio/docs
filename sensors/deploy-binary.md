---
title: Deploy as a binary
parent: Sensors
nav_order: 3
---

# Deploy a sensor as a binary

Use the binary when containers are not an option. The release archive
contains only `openctemio-sensor`: the scanners it runs (nuclei, subfinder,
dnsx, naabu, httpx, katana, semgrep, trivy, betterleaks) must be installed on
the host separately. The container images bundle and pin them, so prefer
[Docker](deploy-docker.md) where you can. The tool sandbox uses Linux
features (Landlock, seccomp); run long-lived daemons on Linux.

## Download a release

Every [sensor release](https://github.com/openctemio/sensor/releases)
publishes archives for:

| OS | Architectures |
|---|---|
| Linux | `amd64`, `arm64` |
| macOS (`darwin`) | `amd64`, `arm64` |
| Windows | `amd64` |

Archives are named `openctemio-sensor_<version>_<os>_<arch>.tar.gz` (and
`.zip`), with the version without the leading `v`:

```bash
VERSION=0.11.0
curl -fsSLO "https://github.com/openctemio/sensor/releases/download/v${VERSION}/openctemio-sensor_${VERSION}_linux_amd64.tar.gz"
curl -fsSLO "https://github.com/openctemio/sensor/releases/download/v${VERSION}/checksums.txt"
curl -fsSLO "https://github.com/openctemio/sensor/releases/download/v${VERSION}/checksums.txt.sigstore.json"
```

Verify before installing. `checksums.txt` is signed keyless with cosign by
the sensor's release workflow, and lists the SHA-256 of every archive:

```bash
cosign verify-blob checksums.txt --bundle checksums.txt.sigstore.json \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity "https://github.com/openctemio/sensor/.github/workflows/release.yml@refs/tags/v${VERSION}"
sha256sum -c checksums.txt --ignore-missing
tar xzf "openctemio-sensor_${VERSION}_linux_amd64.tar.gz" openctemio-sensor
sudo install -m 0755 openctemio-sensor /usr/local/bin/
openctemio-sensor -version
```

## Install the scanners

```bash
openctemio-sensor -list-tools    # each scanner and whether it is available here
openctemio-sensor -check-tools   # what is missing, with installation instructions
```

The sensor reports to the platform only the scanners it finds. Install the
ones you want this sensor to run, or narrow the list with `SENSOR_TOOLS`.

## Run as a systemd service

Create a dedicated user and let systemd create the state, outbox and content
directories with mode `0700`:

```bash
sudo useradd --system --home-dir /var/lib/openctem --shell /usr/sbin/nologin openctem
```

`/etc/systemd/system/openctem-sensor.service`:

```ini
[Unit]
Description=OpenCTEM sensor
Wants=network-online.target
After=network-online.target

[Service]
User=openctem
Group=openctem
StateDirectory=openctem/state openctem/outbox openctem/content
StateDirectoryMode=0700
Environment=API_URL=https://openctem.example.com
Environment=SENSOR_STATE_DIR=/var/lib/openctem/state
Environment=SENSOR_OUTBOX_DIR=/var/lib/openctem/outbox
Environment=SENSOR_CONTENT_DIR=/var/lib/openctem/content
ExecStart=/usr/local/bin/openctemio-sensor -daemon -enable-commands
Restart=on-failure
TimeoutStopSec=45
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Start the service. On its first start it has no identity, so it pairs:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openctem-sensor
journalctl -u openctem-sensor -f       # read the code and fingerprint here
```

Approve the sensor as described in [Pairing](pairing.md). A sensor-local
policy goes in `/etc/openctem/sensor-policy.yaml`, owned by root and not
writable by the sensor's user (see [Network](network.md#sensor-local-policy));
reload it with `systemctl kill -s HUP openctem-sensor`.

## Build from source

The sensor needs Go 1.26:

```bash
git clone https://github.com/openctemio/sensor.git
cd sensor
go build -trimpath -o openctemio-sensor .
```

`make build` builds `bin/openctemio-sensor` with the version stamped in;
`make build-all` builds for every release platform into `bin/`.
