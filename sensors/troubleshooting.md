---
title: Troubleshooting
parent: Sensors
nav_order: 8
---

# Troubleshooting sensors

## Start with the setup checklist

A sensor checks its own setup when it starts and sends the results to the
platform. Open the sensor under **Discovery > Sensors**, section **Setup &
health**: each problem says what the sensor saw, why it matters and how to fix
it, with a snippet for your install type (environment variables, Docker
Compose or Helm). The snippets are text: the platform never changes a
sensor's configuration. Setting values, secrets and target ranges never leave
the sensor host; only whether each setting is set and valid is reported.

The `config_health` chip on the list summarizes it: `ok`, `attention` (a
warning), `impaired` (a check failed) or `blocked` (a failed check stops all
work). A failed or warning check also makes an online sensor `degraded`.

| Check | Meaning | Usual fix |
|---|---|---|
| `identity.state_persistent` | The state directory is not on a persistent volume | Mount a volume at `/var/lib/openctem/state` (Helm: `sensor.state.persistence.enabled: true`) |
| `tool.<name>.binary` | A scanner is missing, or installed but fails to start | Use an image that ships it, or remove it from `SENSOR_TOOLS` |
| `tools.available` `none` | No scanner is installed and allowed: the sensor gets no scans | Fix `SENSOR_TOOLS`, or use an image with scanners |
| `network.scan_proxy_inherit` | Scanners inherit `HTTPS_PROXY` and send scan traffic through it | Set `SENSOR_SCAN_PROXY=direct`, or `inherit` to keep it on purpose |
| `platform.tls` | `SSL_CERT_FILE`, `SSL_CERT_DIR` or `SENSOR_CA_CERT_FILE` points at a path the sensor cannot read | Mount the CA read-only at that path |
| `runtime.oom_protect` | The sensor cannot protect itself from the out-of-memory killer | Add the `SYS_RESOURCE` capability |
| `policy.local` `absent` | No sensor-local policy | The network owner installs one ([Network](network.md#sensor-local-policy)) |
| `policy.template_keys` `missing` | The policy allows custom templates but no signing key is set | Set `SENSOR_TEMPLATE_SIGNING_KEYS` |
| `config.env_unknown`, `config.file_unknown_key` | A setting the sensor does not read, often a typo | Rename it (the check suggests the closest name) |

The same problems are printed at start as `Warning: ...` lines, followed by
`Preflight: N passed, M warning(s), K failed`.

## Read the logs

```bash
docker logs -f openctem-sensor                      # Docker
kubectl -n openctem-sensor logs deploy/openctem-sensor -f   # Kubernetes
journalctl -u openctem-sensor -f                    # systemd
```

At start the sensor prints the tools it detected, the local policy state,
the proxy settings and the sandbox state, for example
`Tools: nuclei, subfinder, dnsx, naabu, httpx, katana (detected; ...)`.
Add `-verbose` for more detail. Each task's log also reaches the platform:
open a run, then **Tasks**, then **Logs**. A task refused before any tool
started still has a log with the reason.

## Common problems

| Symptom | Cause and fix |
|---|---|
| The container exits with code 2 and `missing: [API_URL]` | Set `API_URL`. |
| The container exits during pairing with `connection refused` or a TLS error | The platform URL is not reachable from the sensor, or its certificate is not trusted. Check the URL from the host (`curl https://openctem.example.com/health` with the built-in gateway) and [trust the CA](deploy-docker.md#trust-a-private-certificate-authority). |
| `x509: certificate signed by unknown authority` | The platform uses a private CA. [Trust it](deploy-docker.md#trust-a-private-certificate-authority). |
| `http 421 ... WRONG_ENDPOINT` or `API key required` | `API_URL` points at the web UI, or at a proxy that strips the `Authorization` header. Point it at the platform gateway or the API. |
| `certificate chain does not contain the pinned CA` | `SENSOR_CA_FINGERPRINT` does not match the CA the platform presents, or a TLS-inspecting proxy is in between. |
| An identity permission error at start | Run the `chmod` / `chown` it prints. On Kubernetes see [fsGroup](deploy-kubernetes.md#identity-files-and-fsgroup). |
| `the platform rejected the API key (HTTP 401 ...)` | A key-based sensor whose key was revoked, regenerated or expired, or whose sensor was deleted. The sensor stays up and checks again (30 s, doubling to 10 min). Regenerate the key, or pair the sensor. |
| `SENSOR_ALLOW_PRIVATE_TARGETS="true" is not recognized` | Only `1` or `0` is accepted. |
| `the platform does not serve sensor protocol v2` | The platform is older than the sensor supports. Upgrade the platform. A sensor older than v0.9.0 must be upgraded instead: the platform no longer serves protocol v1. |
| A second sensor refuses to start on the same outbox | Each sensor needs its own outbox volume. |
| `-platform mode has been removed` | An old command line. Use `-daemon -enable-commands` (the default image's command). |

## Online, but it gets no work

Check, in this order:

1. **Trust level.** A newly paired sensor is **New** and receives passive
   (T0) work only: no port scans, HTTP probes or templates. Promote it to
   Trusted ([Pairing](pairing.md#grants-and-trust)).
2. **Tools.** The scan's tool must be reported installed by the sensor. Check
   the sensor's tool list, or **Settings > Scanning > Tools**, where a tool
   with no runnable sensor says why (`no_sensor`, `offline_only`,
   `outdated`, excluded by the grant or the local policy). A trigger with no
   sensor for a tool is refused with `NO_SENSOR_FOR_TOOL`.
3. **Zones.** Work routed to a zone goes only to that zone's sensors. Check
   the run's warnings for uncovered targets and the zone's sensor list.
4. **Local policy.** A refusal is reported on the task as `refused by local
   policy: <rule>: <detail>`. Check with
   `openctemio-sensor policy explain <file> -target <target> -tool <tool>`.
5. **Freeze window.** Active work is held during a freeze window.
6. **Kill switch.** The sensor heartbeats `paused by local policy` while the
   kill switch file exists.
7. **Disabled.** A disabled sensor heartbeats, logs `paused by platform` and
   takes no jobs until it is activated again.

## Results do not arrive

The sensor keeps every result in its outbox until the platform accepts it.
The Sensors page shows an outbox warning when results wait over an hour,
were refused for good, or were dropped by the size or age cap.

With the sensor stopped, inspect the outbox on the same volume:

```bash
docker run --rm -v openctem-outbox:/var/lib/openctem/outbox \
  ghcr.io/openctemio/sensor:v0.11.0 -outbox-status
# after fixing the cause of dead letters:
docker run --rm -v openctem-outbox:/var/lib/openctem/outbox \
  ghcr.io/openctemio/sensor:v0.11.0 -outbox-requeue-dead
```

## Cloned identity

If two running processes use the same identity or key (for example a copied
state volume, or two replicas), the sensor is flagged `identity_cloned`
(critical) and every administrator sees it in the audit log. Run one process
per identity. If the copy was not yours, [re-pair](pairing.md#re-pair-a-sensor)
the sensor and revoke the old key.

## Scanner content

`openctemio-sensor -content-status` prints the installed scanner content
(nuclei templates, and on per-tool images the trivy database and semgrep
rules). Content older than its limit makes the sensor `degraded` with
`content_stale`; a failed refresh keeps the previous version and raises
`content_refresh_failed`. **Refresh content** on the sensor, or
**Settings > Scanning > Scanner content**, asks for a refresh now.

## Setup check reference

Each problem under **Setup & health** links to its entry here. The fix
snippets in the console are filled in for the sensor (its paths, tool names
and settings); the entries below explain the check.

### Scanner installed
{: #tool-binary }

`tool.<name>.binary`. The sensor runs each scanner it offers to check its
version. `not_installed`: the image does not contain the scanner, so the
platform sends it no jobs for it. `broken`: the scanner is present but exits
with an error; the console shows what it printed. Use an image that ships the
scanner (the default `ghcr.io/openctemio/sensor` image, or a per-tool image),
pull a fresh image, or remove the scanner from `SENSOR_TOOLS`.

### Scanner offered
{: #tool-selection }

`tool.<name>.selection`. `not_selected`: the scanner is installed but not in
`SENSOR_TOOLS` (Helm: `sensor.tools`); add it to offer it. `policy_excluded`:
the [sensor-local policy](network.md#sensor-local-policy) does not allow it.
Only the network owner can change the policy on the sensor host.

### Scanner registration
{: #tool-registration }

`tool.<name>.registration` `register_failed`: the sensor found the scanner but
could not register it, so it is not offered. The console shows the sensor's
message; check the start-up log ([Read the logs](#read-the-logs)).

### Scanners available
{: #tools-available }

`tools.available` `none`: no scanner is both installed and allowed, so the
platform cannot send the sensor any scan. Fix `SENSOR_TOOLS`, use an image
with scanners, or ask the network owner to allow them in the local policy.

### State directory on a volume
{: #identity-state-persistent }

`identity.state_persistent`. The sensor keeps its identity and its renewed
API key in the state directory (`SENSOR_STATE_DIR`, by default
`/var/lib/openctem/state`). When it is not on a mounted volume, recreating the
container loses it and the sensor starts again with a retired key. Mount a
named volume there (Docker: `-v openctem-sensor-state:/var/lib/openctem/state`;
Helm: `sensor.state.persistence.enabled: true`). See
[Volumes](deploy-docker.md#volumes).

### API key renewal
{: #identity-key-renewal }

`identity.key_renewal`. A key-based sensor renews its API key before it
expires when `PLATFORM_KEY_AUTORENEW=true` (Helm: `sensor.keyAutoRenew`).
`off_not_persistent`: the sensor turned renewal off because a renewed key
would be lost; mount a state volume (see
[State directory on a volume](#identity-state-persistent)). `disabled` or
`start_failed`: rotate the key yourself before it expires, or
[pair the sensor](pairing.md).

### Scanner proxy
{: #network-scan-proxy }

`network.scan_proxy_inherit` `inherits_proxy`: the host sets proxy variables
(such as `HTTPS_PROXY`) and scanners inherit them, so scan traffic goes
through that proxy, which may block it or see every target. Set
`SENSOR_SCAN_PROXY=direct`, or `SENSOR_SCAN_PROXY=inherit` to keep it on
purpose. The connection to the platform keeps its own proxy setting. See
[Proxies](network.md#proxies).

### OOM protection
{: #runtime-oom-protect }

`runtime.oom_protect`. Under memory pressure the sensor asks the kernel to
stop a scanner before the sensor itself. `no_permission`: add the
`SYS_RESOURCE` capability (Docker: `--cap-add SYS_RESOURCE`; Compose:
`cap_add: [SYS_RESOURCE]`; Helm: `sensor.securityContext.capabilities.add`).
`unsupported`: the host does not allow it.

### Job polling
{: #runtime-command-poller }

`runtime.command_poller` `stopped`: the loop that fetches jobs from the
platform stopped with an error, so the sensor runs nothing. Restart the
sensor and check its log ([Read the logs](#read-the-logs)).

### Renamed setting
{: #config-alias-deprecated }

`config.alias_deprecated`: a setting still works under its old name but is
deprecated. Rename it to the name the check gives.

### Unknown environment variable
{: #config-env-unknown }

`config.env_unknown`: the sensor does not read this variable, so it has no
effect. It is often a typo; the check suggests the closest name.

### Unknown key in the config file
{: #config-file-unknown-key }

`config.file_unknown_key`: the config file has a key the sensor does not
know, so it is ignored. Remove or rename it.

### Unset variable in the config file
{: #config-file-unset-var }

`config.file_unset_var`: the config file refers to an environment variable
that is not set, so the value became empty. Set the variable in the sensor's
environment, or remove the reference.

### Daemon without jobs
{: #config-commands-disabled }

`config.commands_disabled`: the sensor was started with `-daemon` but without
`-enable-commands`, so it heartbeats but never runs a job. Start it with both
flags (the default image's command; Helm: `sensor.mode: daemon`).

### Retired scanner name
{: #config-tool-retired }

`config.tool_retired`: a name in `SENSOR_TOOLS` was replaced by another
scanner, which the sensor runs instead. Update the list.

### Platform TLS trust
{: #platform-tls }

`platform.tls`: `SSL_CERT_FILE`, `SSL_CERT_DIR` or `SENSOR_CA_CERT_FILE`
points at a file or directory the sensor cannot read, so TLS connections to
the platform fail with an unknown-authority error. Mount the CA certificate
read-only at that path. See
[Trust a private certificate authority](deploy-docker.md#trust-a-private-certificate-authority).

### Sensor-local policy
{: #policy-local }

`policy.local` `absent`: no local policy is installed on the sensor host, so
the sensor accepts any target outside its built-in deny list. The network
owner installs one (`SENSOR_LOCAL_POLICY`, mounted read-only; Helm:
`sensor.localPolicy.enabled: true`). See
[Sensor-local policy](network.md#sensor-local-policy).

### Template signing keys
{: #policy-template-keys }

`policy.template_keys` `missing`: the local policy allows custom templates,
but `SENSOR_TEMPLATE_SIGNING_KEYS` is not set, so the sensor refuses every
custom template. Pin the organization's template signing public key. See
[Custom templates](../scanning/tools.md#custom-templates).
