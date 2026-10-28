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
| `identity.state_persistent` | The state directory is not on a persistent volume | Mount the data volume at `/var/lib/openctem` (Helm: `sensor.data.persistence.enabled: true`) |
| `storage.outbox_persistent` | The outbox (results not yet accepted) is not on a persistent volume | Mount the data volume at `/var/lib/openctem` (Helm: `sensor.data.persistence.enabled: true`) |
| `tool.<name>.binary` | A scanner is missing, or installed but fails to start | Use an image that ships it, or pull a fresh image |
| `tools.available` `none` | No scanner is installed and allowed: the sensor gets no scans | Use an image with scanners, or widen the local policy's `tools.allow` (or remove a deprecated `SENSOR_TOOLS`) |
| `network.scan_proxy_inherit` | Scanners inherit `HTTPS_PROXY` and send scan traffic through it | Set `SENSOR_SCAN_PROXY=direct`, or `inherit` to keep it on purpose |
| `platform.tls` | `SSL_CERT_FILE`, `SSL_CERT_DIR` or `SENSOR_CA_CERT_FILE` points at a path the sensor cannot read | Mount the CA read-only at that path |
| `runtime.oom_protect` | The sensor cannot protect itself from the out-of-memory killer | Add the `SYS_RESOURCE` capability |
| `policy.local` `absent` | No sensor-local policy | The network owner installs one ([Network](network.md#sensor-local-policy)) |
| `policy.template_keys` `missing` | The policy allows custom templates but no signing key is set | Set `SENSOR_TEMPLATE_SIGNING_KEYS` |
| `config.env_unknown`, `config.file_unknown_key` | A setting the sensor does not read, often a typo | Rename it (the check suggests the closest name) |
| `platform.ca_pin_host` `ip_url_with_pin` | `SENSOR_CA_FINGERPRINT` is set but `SENSOR_API_URL` is an IP address | Use the host name in the platform's certificate |
| `config.commands_disabled` | Platform commands are turned off, so no platform scan runs here | Remove `-enable-commands=false` / `sensor.enable_commands: false` ([Daemon without jobs](#config-commands-disabled)) |
| `config.tools_deprecated` | `SENSOR_TOOLS` or `-tools` is set; it only narrows the detected tools | Remove it; narrow with the local policy's `tools.allow` ([Deprecated tool list](#config-tools-deprecated)) |
| `runtime.sandbox_network` (sensors after v0.18.0) | Scans are not network-confined | Run with the sensor's seccomp profile ([Tool confinement](deploy-docker.md#tool-confinement)) |

The same problems are printed at start as `Warning: ...` lines, followed by
`Preflight: N passed, M warning(s), K failed`.

## Errors by message

What the sensor prints, or the platform answers, and the fix. Exit code 2
means a configuration error: the container stops and Docker restarts it in a
loop until it is fixed.

| Message | Where | Cause | Fix |
|---|---|---|---|
| `missing: [SENSOR_API_URL]` (exit 2) | sensor | No platform URL | Set `SENSOR_API_URL` |
| `environment variables a sensor no longer reads are set: API_URL (rename it to SENSOR_API_URL)` (exit 2) | sensor v0.17.0+ | An old variable name | Rename it as the message says ([Before you upgrade](operate.md#before-you-upgrade)) |
| `Error: executor: network confinement required but not available: ...` (exit 2) | sensor | `SENSOR_SANDBOX_NETWORK=required` without the seccomp profile, or the host blocks user namespaces | [Tool confinement](deploy-docker.md#tool-confinement) |
| `Warning: tool network not confined (SENSOR_SANDBOX_NETWORK=auto): ... operation not permitted` | sensor | The container's seccomp profile refuses namespaces | Add the sensor's seccomp profile |
| `... permission denied` in the same warning | sensor | The host restricts unprivileged user namespaces (Ubuntu 23.10+) | Keep the default AppArmor profile; binary: [an AppArmor profile](deploy-binary.md#tool-confinement-on-a-host) |
| `nuclei keeps to a web scope only in a tool sandbox that confines its network` | task log | A nuclei job on a host with an excluded path, on an unconfined sensor | Run the sensor confined |
| `refused by local policy: no_local_policy: ...` | task log | A sensor paired by v0.12.0+ without `SENSOR_ALLOWED_RANGES` or a policy file | Set one ([Sensor-local policy](network.md#sensor-local-policy)) |
| `refused by local policy: <rule>: ...` | task log | The target, port or tool is outside the local policy | `openctemio-sensor policy explain <file> -target <t> -tool <x>` |
| `the platform's certificate chain does not contain the pinned CA` | sensor | `SENSOR_CA_FINGERPRINT` names a CA the platform does not send in its chain (the built-in gateway's root in TLS mode `internal`), or a proxy is in between | Use `SENSOR_CA_CERT_FILE` instead ([Trust a private CA](deploy-docker.md#trust-a-private-certificate-authority)) |
| `x509: certificate signed by unknown authority` | sensor | The platform uses a private CA | [Trust it](deploy-docker.md#trust-a-private-certificate-authority) |
| `platform certificate does not match the pin stored at pairing` | sensor | The platform's CA changed since pairing, or a TLS-inspecting proxy | Re-pair, or set `SENSOR_CA_FINGERPRINT` after a deliberate change |
| `another sensor process uses this outbox directory; give each sensor its own volume` | sensor | Two processes on one volume (often an `-outbox-status` run next to the daemon) | One volume per sensor; stop the daemon first |
| `BEARER_KEYS_DISABLED`: `This organization requires key-bound identity: pair the sensor instead of creating a key` | console / API | **Install a sensor** (API key) in an organization that requires paired sensors | Pair the sensor, or turn off **Require key-bound sensor identity** (Settings > Organization > General) |
| `PUSH_INGEST_NOT_GRANTED` / `push_ingest_not_granted` | collector / audit `sensor.push_refused_grant` | A collector's reports without a job: its grant lacks push ingest, or it is not trusted | Change the grant profile to `collector` and promote it to Trusted ([Grants and trust](pairing.md#grants-and-trust)) |
| `tool-not-permitted: The report's tool is not declared by this sensor` (HTTP 422) | sensor / collector | A report for a tool the sensor's manifest does not list (often a report sent before the first manifest) | Run in daemon mode so the manifest registers; requeue the dead letter |
| `You may not scan these targets: ... no scope entry covers it` | console / API | The target is out of scope | Add a scope entry ([Scope](../scanning/scope.md)) |
| `NO_SENSOR_FOR_TOOL` | console / API | No sensor of the organization reports the tool | Install a sensor with the tool, or check the sensor's local policy `tools.allow` |
| `scan target refused by guard: DNS lookup failed for scanner target "203.0.113.7:80"` | task log | Sensor v0.22.0 or older: the target guard looked up a `host:port` target (as a port scan hands to the HTTP probe) as a name, and refused the whole task | Upgrade the sensor to v0.22.1 or later |
| `scan target refused by guard: ...` (other reasons) | task log | Up to v0.22.1 one target the guard refuses (a blocked address, a name that does not resolve) fails the whole task | Remove or fix the target; sensor v0.22.2 and later leave only that target out ([What targets need](network.md#what-targets-need)) |
| *Step* `could not reach N targets (blocked by the sensor's network confinement)` | run page | The task's confinement refused every connection the tool made toward those targets (sensor v0.22.0 or later) | Check that the targets are what the job names (a redirect to another host is refused by design). On sensor v0.21.x a confined port scan found no open ports at all: upgrade to v0.22.0 or later |
| `Max dispatch attempts exceeded` | task | The task was taken back from its sensor too many times (lease lost, overrun) | On platforms before v0.9.6 a slow task with a long step timeout was taken back at twice its budget: upgrade the platform. Otherwise check the sensor's logs for restarts |

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
| The container exits with code 2 and `missing: [SENSOR_API_URL]` | Set `SENSOR_API_URL`. |
| The container exits during pairing with `connection refused` or a TLS error | The platform URL is not reachable from the sensor, or its certificate is not trusted. Check the URL from the host (`curl https://openctem.example.com/health` with the built-in gateway) and [trust the CA](deploy-docker.md#trust-a-private-certificate-authority). |
| `x509: certificate signed by unknown authority` | The platform uses a private CA. [Trust it](deploy-docker.md#trust-a-private-certificate-authority). |
| `http 421 ... WRONG_ENDPOINT` or `API key required` | `SENSOR_API_URL` points at the web UI, or at a proxy that strips the `Authorization` header. Point it at the platform gateway or the API. |
| `platform certificate does not match the pin stored at pairing` | The platform presents a certificate from another CA than at pairing (a changed CA, or a TLS-inspecting proxy added since). Re-pair, or set `SENSOR_CA_FINGERPRINT` to the new CA after a deliberate change. |
| `This sensor is now key-bound: ...` | Not an error: a key-based sensor bound its own key. Back up its data volume and remove `SENSOR_API_KEY` from its configuration ([Bearer keys](pairing.md#bearer-keys-legacy)). |
| `certificate chain does not contain the pinned CA` | `SENSOR_CA_FINGERPRINT` does not match the CA the platform presents, or a TLS-inspecting proxy is in between. |
| An identity permission error at start | Run the `chmod` / `chown` it prints. On Kubernetes see [fsGroup](deploy-kubernetes.md#identity-files-and-fsgroup). |
| `the platform rejected the API key (HTTP 401 ...)` | A key-based sensor whose key was revoked, regenerated or expired, or whose sensor was deleted. The sensor stays up and checks again (30 s, doubling to 10 min). Rotate the key, or pair the sensor. |
| `SENSOR_ALLOW_PRIVATE_TARGETS="true" is not recognized` | Only `1` or `0` is accepted. |
| `the platform does not serve sensor protocol v2` | The platform is older than the sensor supports. Upgrade the platform. A sensor older than v0.9.0 must be upgraded instead: the platform no longer serves protocol v1. |
| A shared sensor cannot enroll (HTTP 401 at pairing) | Any unusable enrollment token answers the same 401: it was already used, expired (5 to 60 minutes after it was issued), or mistyped. Issue a new token under **Scanning > Platform scanning** in the admin console ([Shared sensors](shared-sensors.md#enroll-a-shared-sensor)). The token cannot be combined with `SENSOR_PAIRING_CODE`. |
| A shared sensor refuses to start in shared mode | `SENSOR_SHARED_MODE=1` needs the tool sandbox, network confinement and a local policy, and pinned job-signing keys; the sensor says why it stops. Run it under the sensor's seccomp profile. |
| A shared sensor is online but takes no jobs | Shared sensors are off until a super administrator turns them on, the organization must be allowed (and not opted out), and the sensor image must advertise `shared.isolation@1` (a release with shared mode). |
| A second sensor refuses to start on the same outbox | Each sensor needs its own outbox volume. |
| `the sensor's data directory is not usable: ... permission denied` (older sensors: `Error: content: mkdir /var/lib/openctem/content: permission denied`) | A host directory mounted at `/var/lib/openctem` is not owned by the sensor's user. `sudo chown -R 999:999 <host dir>` (1001 on the per-tool images, 65532 on the slim image) or use a named volume. See [Permission denied on /var/lib/openctem](run-the-sensor.md#permission-denied-on-varlibopenctem). |
| `-platform mode has been removed` | An old command line. Remove `-platform`: the sensor runs as the daemon with platform commands by default. |

## Permission denied on /var/lib/openctem
{: #permission-denied-on-varlibopenctem }

The sensor exits at start with `the sensor's data directory is not usable` and names the directory, its owner and the user the sensor runs as. A host directory mounted at `/var/lib/openctem` is not owned by that user. The fix (a `chown` to the sensor's uid, or a named volume) is in [Run the sensor](run-the-sensor.md#permission-denied-on-varlibopenctem).

## Transport

The sensor prints its transport at start and on every change:

```
  Transport: https (platform_without_grpc)      # start-up line: binding (reason)
transport: grpc                                 # a later change
transport: no binding, sending nothing (platform_certificate_refused): ...
```

The console shows the same on the sensor's sheet (**Transport:**), with the
reason in plain words (hover for the code). What the platform itself offers is
an installation detail that only platform administrators see, on
**Monitoring > Health** ([What the platform offers](transport.md#what-the-platform-offers)). A sensor on `https` or `v2` works fully;
only the lines marked **stops** need action.

| Reason | Transport | Cause | Fix |
|---|---|---|---|
| (none) | `grpc` | Best case. | |
| `platform_without_grpc` | `https` | The platform offers no gRPC endpoint this sensor can use. The platform administrator's Operations page says why (for example `foreign_certificate`: the stock gateway). A sensor older than v0.15.0 also gets this when the platform offers gRPC only on its own port. | Optional: [gRPC on port 443](transport.md#grpc-on-port-443-docker-compose), [TLS in the API itself](transport.md#the-api-terminates-tls-itself), or a [dedicated host name](transport.md#a-dedicated-sensor-host-name) for older sensors. |
| `grpc_unreachable` | `https` | The sensor cannot connect to the gRPC endpoint (DNS, firewall, timeout), although the platform's own probe can. | Allow TCP 443 (or the sensor port) from the sensor to the endpoint. Retried after 30 min, then up to every 4 h. |
| `handshake_failed` | `https` | TLS to the gRPC endpoint failed on the sensor's path. | A device on the path terminates or alters TLS. |
| `http2_refused` | `https` | Something on the path (often an HTTP proxy) does not carry HTTP/2. | Let the proxy tunnel HTTP/2, or accept HTTPS. |
| `stream_reset` | `https` | An intermediary resets HTTP/2 streams. | As above. |
| `grpc_unimplemented`, `grpc_failed` | `https` | The endpoint answered, but not as the platform's gRPC service. | Check that the endpoint routes to the API's mTLS listener. |
| `certificates_unavailable` | `https` | The sensor could not get a client certificate. | Usually temporary (issuance is rate-limited); retried within 10 minutes. With `protocol v3: the platform sent another gRPC CA bundle over an unpinned channel`, see [sensor CA replaced](#platform-certificate-refused). |
| `https_binding_unavailable` | `v2` | The HTTPS transport failed at the network level. | Check that the proxy in front of the platform forwards `/api/v3/sensor/*` to the API. |
| `platform_without_v3` | `v2` | The platform does not serve protocol v3 (an older platform, or `SENSOR_TRANSPORT_V3=off`). | Nothing, or upgrade the platform. |
| `not_key_bound` | `v2` | The sensor uses an API key. | It binds its own key by itself from sensor v0.13.0 ([Bearer keys](pairing.md#bearer-keys-legacy)). |
| `forced_by_config` | as set | `SENSOR_TRANSPORT` forces a transport. | Unset it for `auto`. |
| `identity_refused` | **stops** (heartbeat only) | The platform refused the sensor's identity: key revoked, sensor disabled, revoked or deleted. Logged as `protocol v3: the platform refused the sensor's identity`. | Enable the sensor, or [re-pair](pairing.md#re-pair-a-sensor). |
| `platform_certificate_refused` | **stops** (sends nothing) | See below. | See below. |

### `platform_certificate_refused`
{: #platform-certificate-refused }

The gRPC endpoint presented a certificate that is not from the platform's
sensor CA. The sensor sends nothing at all, not even heartbeats, so the
console shows it `late`, then `offline`. It negotiates again about every
minute and recovers by itself once the cause is gone. Log:
`protocol v3: the gRPC endpoint's certificate does not verify against the pinned platform CA; no other binding is tried`.

| Cause | Fix |
|---|---|
| A TLS-inspecting proxy between the sensor and the platform | Exempt the platform host from inspection, or set `SENSOR_TRANSPORT=https` on the sensor ([TLS-inspecting proxies](network.md#tls-inspecting-proxies)). |
| The gateway stopped routing sensor connections (the override was dropped from `docker compose`) | Put the override back. The platform withdraws the endpoint within a minute, and the sensor moves to HTTPS at its next negotiation. |
| The platform's sensor CA was replaced (the `api-data` volume was lost) | Stop the sensor, delete `transport-v3-client.pem` and `transport-v3-platform-ca.pem` from its `identity/` directory, start it. See [the sensor CA](transport.md#platform-side-the-sensor-ca). |

`SENSOR_TRANSPORT=grpc` also stops the sensor (`protocol v3 gRPC binding
unavailable (<reason>) and SENSOR_TRANSPORT=grpc: not falling back`) whenever
gRPC is unavailable; use it only to test.

## Online, but it gets no work

Check, in this order:

1. **Local policy.** A sensor paired by sensor v0.12.0 or later refuses every
   job with network targets until it has a local policy; tasks fail with
   `refused by local policy: no_local_policy: ...`. Set
   `SENSOR_ALLOWED_RANGES` or install a policy file
   ([Sensor-local policy](network.md#sensor-local-policy)).
2. **Trust level.** A newly paired sensor is **New** and receives passive
   (T0) work only: no port scans, HTTP probes or templates. Promote it to
   Trusted ([Pairing](pairing.md#grants-and-trust)).
3. **Tools.** The scan's tool must be reported installed by the sensor. Check
   the sensor's tool list, or **Settings > Scanning > Tools**, where a tool
   with no runnable sensor says why (`no_sensor`, `offline_only`,
   `outdated`, excluded by the grant or the local policy). A trigger with no
   sensor for a tool is refused with `NO_SENSOR_FOR_TOOL`.
4. **Zones.** Work routed to a zone goes only to that zone's sensors. Check
   the run's warnings for uncovered targets and the zone's sensor list.
5. **Local policy rules.** A refusal is reported on the task as `refused by local
   policy: <rule>: <detail>`. Check with
   `openctemio-sensor policy explain <file> -target <target> -tool <tool>`.
6. **Scan window.** Work outside its scan window waits for the window to open (**Why waiting?** says so); see [Scan windows](../user-guide/10-settings-and-integrations.md#scan-windows).
7. **Kill switch.** The sensor heartbeats `paused by local policy` while the
   kill switch file exists.
8. **Disabled.** A disabled sensor heartbeats, logs `paused by platform` and
   takes no jobs until it is enabled again.

## Results do not arrive

The sensor keeps every result in its outbox until the platform accepts it.
The Sensors page shows an outbox warning when results wait over an hour,
were refused for good, or were dropped by the size or age cap.

With the sensor stopped, inspect the outbox on the same volume:

```bash
docker run --rm -v openctem-sensor-data:/var/lib/openctem \
  ghcr.io/openctemio/sensor:v0.28.0 -outbox-status
# after fixing the cause of dead letters:
docker run --rm -v openctem-sensor-data:/var/lib/openctem \
  ghcr.io/openctemio/sensor:v0.28.0 -outbox-requeue-dead
```

## Cloned identity

If two running processes use the same identity or key (for example a copied
data volume, or two replicas), the sensor is flagged `identity_cloned`
(critical) and every administrator sees it in the audit log. Run one process
per identity. If the copy was not yours, [re-pair](pairing.md#re-pair-a-sensor)
the sensor and revoke the old key.

## Scanner content

`openctemio-sensor -content-status` prints the installed scanner content
(nuclei templates, and on per-tool images the trivy database and semgrep
rules). Content older than its limit makes the sensor `degraded` with
`content_stale`; a failed refresh keeps the previous version and raises
`content_refresh_failed`. **Refresh content** on the sensor, or
**Settings > Scanner content > Content freshness**, asks for a refresh now.

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
pull a fresh image, or leave the scanner out of the local policy's `tools.allow`.

### Scanner offered
{: #tool-selection }

`tool.<name>.selection`. `not_selected`: the scanner is installed but left
out by the deprecated `SENSOR_TOOLS` / `-tools` (Helm: `sensor.tools`); remove
the setting (the sensor then offers every detected tool) or add the scanner. `policy_excluded`:
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
platform cannot send the sensor any scan. Use an image with scanners, remove
a deprecated `SENSOR_TOOLS` that leaves them out, or ask the network owner to
allow them in the local policy.

### State directory on a volume
{: #identity-state-persistent }

`identity.state_persistent`. The sensor keeps its identity and its renewed
API key in the state directory (`SENSOR_STATE_DIR`, by default
`/var/lib/openctem/state`). When it is not on a mounted volume, recreating the
container loses it and the sensor starts again with a retired key (a paired
sensor would have to pair again). Mount the data volume at its parent
(Docker: `-v openctem-sensor-data:/var/lib/openctem`; Helm:
`sensor.data.persistence.enabled: true`); a volume on the state directory
itself counts too, since the sensor judges a directory by its nearest mount.
See [Volumes](deploy-docker.md#volumes).

### Outbox on a volume
{: #storage-outbox-persistent }

`storage.outbox_persistent`. The sensor writes every result to its outbox
(`SENSOR_OUTBOX_DIR`, by default `/var/lib/openctem/outbox`) before sending
it and deletes it once the platform accepted it. When the outbox is not on a
mounted volume, recreating the container during an outage loses the results
still queued. Mount the data volume at `/var/lib/openctem` (Helm:
`sensor.data.persistence.enabled: true`). Sensor images before v0.16.0
declared the outbox an unnamed volume of its own; from v0.16.0 they declare
none, so mount it.

### API key renewal
{: #identity-key-renewal }

`identity.key_renewal`. A key-based sensor renews its API key before it
expires when `SENSOR_KEY_AUTORENEW=true` (Helm: `sensor.keyAutoRenew`).
`off_not_persistent`: the sensor turned renewal off because a renewed key
would be lost; mount the data volume (see
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

`config.commands_disabled`: platform commands are turned off on this sensor
(`-enable-commands=false`, or `sensor.enable_commands: false` in its config
file), so it heartbeats but never runs a platform scan. Remove the setting:
from sensor v0.21.0 the daemon takes platform commands by default.

### Deprecated tool list
{: #config-tools-deprecated }

`config.tools_deprecated`: the sensor was started with `SENSOR_TOOLS` or
`-tools`. From sensor v0.21.0 the sensor detects its tools itself, and this
setting only narrows them; a listed tool that is not installed is ignored and
named in the check. Remove the setting, and narrow the tools with the local
policy's `tools.allow` instead.

### Retired scanner name
{: #config-tool-retired }

`config.tool_retired`: a scanner name in the sensor's configuration was
replaced by another scanner, which the sensor runs instead. Update the name.

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

### Pinned CA and an IP address
{: #platform-ca-pin-host }

`platform.ca_pin_host` `ip_url_with_pin`: `SENSOR_CA_FINGERPRINT` is set, but
`SENSOR_API_URL` names the platform by an IP address. A pinned connection
checks the certificate against the host name, so it fails. Use the host name
in the platform's certificate in `SENSOR_API_URL` (`pair` refuses an IP URL
with a pin).

### Tool network confinement
{: #runtime-sandbox-network }

`runtime.sandbox_network` (reported by sensors released after v0.18.0):
whether each scan's network is confined to its targets. `confined` is the
goal. `userns_blocked`: the container's seccomp profile refuses user
namespaces; run it with the sensor's seccomp profile. `userns_restricted`:
the host restricts unprivileged user namespaces; keep the default AppArmor
profile (binary: give it an AppArmor profile). `off` / `sandbox_off`:
`SENSOR_SANDBOX_NETWORK=off` or `SENSOR_SANDBOX=off`. `unavailable`: another
cause, shown in the excerpt. See [Tool confinement](deploy-docker.md#tool-confinement).

### Template signing keys
{: #policy-template-keys }

`policy.template_keys` `missing`: the local policy allows custom templates,
but `SENSOR_TEMPLATE_SIGNING_KEYS` is not set, so the sensor refuses every
custom template. Pin the organization's template signing public key. See
[Custom templates](../scanning/tools.md#custom-templates).
