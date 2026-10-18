---
title: Security notes
parent: Sensors
nav_order: 7.8
---

# Security notes for sensors
{: .no_toc }

A sensor sits inside your network and runs scanners against it. This page
lists what protects that network from the sensor, the sensor from the
platform, and both from a third party, and what you have to set for each.
The design is in [Security](../security/index.md).

1. TOC
{:toc}

---

## Trust model in one table

| Threat | What stops it | What you do |
|---|---|---|
| A scanner (or a hostile target answering it) reaches hosts outside the job | Tool confinement: each scan in its own network namespace, only the job's targets reachable | Run with the seccomp profile ([below](#tool-confinement)) |
| The platform (or someone who took it over) sends jobs against hosts you did not allow | Sensor-local policy, read-only on the sensor host | Set `SENSOR_ALLOWED_RANGES` or a policy file ([Network](network.md#sensor-local-policy)) |
| A fake platform answers the sensor's first contact | TLS to the platform, the CA pinned at pairing, optional `SENSOR_PLATFORM_KEY` | Trust the platform CA explicitly ([below](#tls-and-pinning)) |
| Someone pairs their own sensor into your organization | The approver compares the fingerprint, re-authenticates; new sensors are **New** (passive work only) | Compare the fingerprint word for word; promote only after review |
| The sensor's key is copied | The key never leaves the volume; two processes with one identity are flagged `identity_cloned` | Back the volume up encrypted; [re-pair](operate.md#rotate-the-sensors-key) after a leak |
| The sensor process is compromised | Non-root user, read-only root filesystem, no capabilities, `no-new-privileges` | Keep the hardened flags of the [quickstart](index.md#1-start-the-sensor) |

## Tool confinement

Every scanner runs in a per-task sandbox: a private working directory,
resource limits, `no_new_privs`, Landlock (Linux 5.13 or later) and a seccomp
filter that, among others, refuses it new namespaces. On top of that the
sensor can put each task in its own user, network and mount namespaces. The
task then has only loopback, and its only way out is a forwarder that admits
the job's targets (and, for a web job, refuses excluded paths, HTTPS
included) and nothing else, whatever the scanner does.

The sensor process needs to create those namespaces, which Docker's and
Kubernetes' default seccomp profiles refuse. The sensor's own profile,
`docker/seccomp/sensor.json` in each release, is Docker's default profile with
one rule added: `clone` and `unshare` with namespace flags. The scanners
cannot use that rule (the per-task filter refuses it to them).

| Install | How to run confined |
|---|---|
| docker run / Compose | `--security-opt seccomp=openctem-sensor-seccomp.json` ([Docker](deploy-docker.md#tool-confinement)) |
| Kubernetes, the chart's sensor | `sensor.sandbox.seccompProfile=openctem` ([Kubernetes](deploy-kubernetes.md#option-a-the-bundled-sensor-of-the-openctem-chart)) |
| Kubernetes, own manifests | A `Localhost` profile on the nodes ([Kubernetes](deploy-kubernetes.md#option-b-plain-manifests-pairing)) |
| Binary | Unprivileged user namespaces allowed for the binary ([Binary](deploy-binary.md#tool-confinement-on-a-host)) |

Check: the start-up log says `Tool network: confined`. `SENSOR_SANDBOX_NETWORK`
is `auto` by default (confine when possible, otherwise run unconfined and
warn); `required` makes the sensor refuse to start unconfined.

What confinement admits: the job's target names, the addresses each name
resolved to when the task was admitted (each address alone, with the name's
ports and scope limits; names are not resolved again during the task), and
the job's addresses and ranges. A port scanner that dials addresses works
confined from sensor v0.22.0; on older confined sensors it found no open
ports. When the forwarder refused every connection toward a target, the
target is reported failed with `egress_refused`, the task is partial, and
the run shows "could not reach N targets" instead of "produced nothing"
(sensor v0.22.0 or later, platform v0.9.6 or later for the count).

What an unconfined sensor cannot do: run a nuclei job on a host where the
organization excluded a path (it fails with `nuclei keeps to a web scope only
in a tool sandbox that confines its network`), or take a job whose targets
are limited to some ports or paths.

A confined sensor advertises the capability `net.confined@1`. The platform
sends the jobs that need confinement (nuclei with a web scope, validation and
retest jobs with a web scope, jobs limited to some ports or paths) only to
sensors that advertise it. Without one, such a task waits, and its
**Why waiting?** panel says it needs a sensor whose tool network is confined;
a job that no confined sensor of the organization can ever take is refused
with `NO_CONFINED_SENSOR`.

The platform's install commands (**Discovery > Sensors**, the sensor's
install snippets) download the profile from the platform
(`/api/v1/sensors/install/seccomp-profile`), check its SHA-256 before the
container starts, and run the sensor with it. The Helm chart's bundled sensor
uses `sensor.sandbox.seccompProfile=openctem` by default (chart 0.23.0 and
later).

## Least privilege

- **Container**: run as the image's non-root user (uid 999; 1001 for the
  per-tool images), `--read-only` with a `tmpfs` on `/tmp`, `--cap-drop ALL`,
  `no-new-privileges`. Add `NET_RAW` only for naabu SYN scans and
  `SYS_RESOURCE` only for OOM protection. Keep the runtime's default AppArmor
  profile.
- **Binary**: a dedicated system user without a shell, owning only
  `/var/lib/openctem`.
- **Grant**: give each sensor the narrowest grant profile that fits (zones,
  tools, tier). A sensor that needs no credentials should not get the
  `authenticated-scanner` profile ([Grants and trust](pairing.md#grants-and-trust)).
- **Policy file**: owned by root, mounted read-only; the platform can neither
  read its content nor change it. The kill switch (`/etc/openctem/STOP`, or
  `kill_switch: true`) stops every job at once.
- **Private targets** stay blocked until `SENSOR_ALLOW_PRIVATE_TARGETS=1`;
  loopback, link-local, cloud metadata and CGNAT addresses stay blocked even
  then.

## TLS and pinning

- The sensor talks to the platform over TLS only and refuses redirects.
- **Pairing pins the platform's TLS trust anchor** in the identity
  (`Platform TLS pinned: sha256:...` in the log). From then on a certificate
  from another CA, for example a TLS-inspecting proxy, is refused, with no
  fallback to the system trust store.
- For the **first contact**, trust the platform's CA explicitly instead of
  relying on a public CA: mount it and set `SENSOR_CA_CERT_FILE`.
- `SENSOR_CA_FINGERPRINT` (SHA-256 of a CA certificate) pins the first
  contact too, and overrides the pin stored at pairing. It matches only a
  certificate the platform **presents in its chain**, and `SENSOR_API_URL`
  must then use the host name in the certificate, not an IP address. The
  built-in gateway in TLS mode `internal` does not present its root (only its
  leaf and a weekly intermediate), so with it a root fingerprint fails with
  `the platform's certificate chain does not contain the pinned CA`: use
  `SENSOR_CA_CERT_FILE` there. See
  [Trust a private certificate authority](deploy-docker.md#trust-a-private-certificate-authority).
- `SENSOR_PLATFORM_KEY` pins the platform's pairing key (a public thumbprint
  from the console), so a fake platform cannot answer a pairing request.
- gRPC uses mutual TLS with a CA the sensor receives over the pinned HTTPS
  connection; the sensor never falls back to a weaker transport after a
  refusal.
- **Signed jobs**: a sensor paired with a platform that has a job signer pins
  its keys and runs only jobs that signer signed (`Signed jobs: on` in the
  log). See [Pairing](pairing.md).

## The data volume is a credential

`state/identity/` holds the sensor's private key, `0600` files in a `0700`
directory owned by the sensor's user; the sensor refuses looser permissions.
`outbox/` holds results not yet accepted, encrypted. Treat the volume and its
backups like a password: encrypted backups, restored only to replace the
same sensor, deleted when the sensor is removed. See
[Back up and restore](operate.md#back-up-and-restore).

## Respond to a compromise

1. **Revoke access** to the sensor in the console (or only its key). It takes effect at
   the sensor's next request; open gRPC streams end within seconds.
2. Read the sensor's **Activity** and the audit log for what it ran.
3. Rebuild the host, then pair a new sensor, or re-pair this one
   ([Rotate the sensor's key](operate.md#rotate-the-sensors-key)).
