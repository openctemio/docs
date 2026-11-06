---
title: Host requirements
parent: Sensors
nav_order: 8.5
---

# Sensor host requirements
{: .no_toc }

What the sensor host needs: user namespaces for tool network confinement, a
way to reach the platform that survives a DNS outage, and core infrastructure
kept out of intrusive scans.

1. TOC
{:toc}

## What network confinement is

Each tool run (a scan task) gets its own user, network and mount namespace. The task has only loopback, and its only way out is a forwarder in the sensor that admits the job's targets and nothing else. A tool that ignores the proxy, opens a raw socket or tries DNS exfiltration reaches nothing.

Which jobs need it: jobs with a web scope (an organization excluded a path on a host, or limited a target to some ports or paths). The platform sends them only to a sensor that advertises `net.confined@1`. Without one they wait in the queue or go to other sensors; a tool that contacts its targets runs on an unconfined sensor only when the operator acknowledged it with `SENSOR_SANDBOX=off`. Plain internal port scans and infrastructure scans still run on a sensor that is not confined.

## Why a container setting cannot fix it

A container shares the host kernel. Whether an unprivileged process may create a user namespace is decided by host-wide sysctls (`kernel.unprivileged_userns_clone` on Debian and Ubuntu, `user.max_user_namespaces`, and on Ubuntu 23.10 and later `kernel.apparmor_restrict_unprivileged_userns`). `kernel.unprivileged_userns_clone` is a global sysctl: Compose `sysctls:` cannot set it, because it is not namespaced.

## How to check

**In the console.** Open the sensor's setup checklist (Sensors > the sensor > Setup check) and find `runtime.sandbox_network`:

| Code | Meaning |
|---|---|
| `confined` | Tool runs are confined. Nothing to do. |
| `userns_disabled_host` | The host disables unprivileged user namespaces (`kernel.unprivileged_userns_clone=0` or `user.max_user_namespaces=0`). See option A. |
| `userns_restricted` | The host's AppArmor restriction applies to the sensor process. Keep the restriction on and the default container profile, or use a profile that grants `userns`. |
| `userns_blocked` | The host allows user namespaces but the container runtime's seccomp profile refuses them. Run the sensor with its seccomp profile ([Tool confinement](deploy-docker.md#tool-confinement)). |
| `off`, `sandbox_off` | `SENSOR_SANDBOX_NETWORK=off` or `SENSOR_SANDBOX=off`. Remove the setting. |
| `unavailable` | Another cause; the excerpt shows the message. |

The check's excerpt lists the host values the sensor could read from inside the container. A value it could not read is left out, never guessed.

**On the host:**

```bash
sysctl kernel.unprivileged_userns_clone kernel.apparmor_restrict_unprivileged_userns user.max_user_namespaces
```

`kernel.unprivileged_userns_clone` does not exist on every kernel; a missing key is fine. `0` for it or for `user.max_user_namespaces` disables user namespaces.

**For the container:**

{% raw %}
```bash
docker inspect -f '{{.AppArmorProfile}}' <container>
```
{% endraw %}

`docker-default` is what you want. `unconfined` is not.

## What was measured

Ubuntu host with `kernel.unprivileged_userns_clone=0`, the sensor running as non-root user 999 with `cap_drop: [ALL]`, `no-new-privileges` and the sensor's seccomp profile:

| Compose setting | Result |
|---|---|
| the recommended setting | blocked |
| `apparmor=unconfined` | blocked |
| `cap_add: [SYS_ADMIN]` as user 999 | blocked |
| `cap_add: [SYS_ADMIN]` running as root | works |
| `privileged: true` | works |

{: .warning }
The last two are not acceptable. They give the container near-root power over the host kernel and defeat the purpose of the sandbox. Never use them to make confinement work.

## Options

**A. Enable user namespaces on the host (the fix).** On the Docker host:

```bash
echo 'kernel.unprivileged_userns_clone=1' | sudo tee /etc/sysctl.d/99-openctem-sensor.conf
sudo sysctl --system
```

(or a positive `user.max_user_namespaces` when that is the knob at 0). Keep `kernel.apparmor_restrict_unprivileged_userns=1` and the container's `docker-default` AppArmor profile; never set the restriction to 0. Then recreate the container: `docker compose up -d --force-recreate`. The container keeps its non-root user, zero capabilities, read-only root and `no-new-privileges`.

Cost: unprivileged user namespaces become available to local processes on the host (Ubuntu enables them by default), limited by the AppArmor restriction for unconfined processes. If confinement still fails with the restriction on and `docker-default` applied, give the sensor container an AppArmor profile that grants `userns`; do not disable the restriction host-wide.

**B. Leave it.** The sensor still scans. Jobs that need confinement go to other sensors. If this sensor's scope has no web-scope jobs (for example internal infrastructure and port scanning only), B loses nothing.

**C. A dedicated VM or host for the sensor, with option A there (recommended on shared machines).** The sysctl then affects only a machine that runs the sensor and nothing else.

A runtime that isolates the container with its own kernel, such as gVisor, is untested with the sensor; expect limits for scans that need raw sockets.

## Platform name resolution

The sensor looks up the platform host name in `SENSOR_API_URL` for every new
connection. If that lookup fails, heartbeats, job polls, logs and results all
fail, even though the platform is up. After the lease ends, the platform
gives the sensor's running jobs to another sensor. A common case is a sensor
in Docker during an intrusive scan of an internal range: the corporate DNS
server is inside the range, and an IPS blocks it or the scan knocks it over.
Docker's embedded DNS then answers
`lookup openctem.example.com on 127.0.0.11:53: server misbehaving`.

The sensor guards against this in two ways:

- **Last-known-good address.** When a lookup of the platform host fails with a
  DNS error, the sensor dials the address the last successful lookup returned.
  It does this for up to `SENSOR_CONTROL_DNS_MAX_STALE` (default `24h`; `0`
  turns it off), and logs once when it switches to the cached address and once
  when it switches back. TLS is unchanged: the sensor sends the platform host
  name and checks the certificate against it. A TLS or HTTP error never
  triggers the fallback, and neither does a plain `http://` URL. With a proxy,
  the proxy resolves the platform. The address is kept in the state directory,
  so a restart during an outage still connects. The
  [`runtime.control_dns` check](troubleshooting.md#runtime-control-dns) shows
  the state.
- **Pin the platform host** (recommended for sensors that scan internal
  networks). Then the sensor never needs DNS to reach the platform:

  ```yaml
  # docker-compose.yml, under services.sensor
  extra_hosts:
    - "openctem.example.com:192.0.2.10"
  ```

  With `docker run`, use `--add-host openctem.example.com:192.0.2.10`. In
  Kubernetes, use the pod's `hostAliases`. On a host (binary install), add the
  same entry to `/etc/hosts`. Keep the host name in `SENSOR_API_URL`, because
  TLS checks the certificate against it. Update the pin when the platform's
  address changes.

**Separate the tools' resolver.** dnsx, naabu and subfinder use
`SENSOR_DNS_RESOLVERS` when it is set. Point it at resolvers other than the
ones in `/etc/resolv.conf` (or Docker's `dns:` setting). Heavy enumeration then
cannot overload the resolver the sensor uses for the platform. Other tools,
and the network confinement forwarder, use the system resolvers.

## Core infrastructure and intrusive scans

Exclude core infrastructure from intrusive scans (port scans with high rates,
vulnerability templates, fuzzing): the DNS servers, the default gateways and
firewalls, the platform host, and the sensor host itself. If a scan knocks one
of these over, or an IPS blocks it, the scan cuts off the sensor's own
connection to the platform. The sensor loses its jobs, and every other system
that depends on that server is affected. Scan these systems on their own, in a
maintenance window, at a low rate.

The sensor reports these addresses in its
[`network.core_addresses` check](troubleshooting.md#network-core-addresses):
its resolvers (behind Docker's `127.0.0.11`, the servers Docker forwards to),
the tools' resolvers, its gateways, its own address as the platform sees it,
and the platform's addresses. When a new scan's targets cover one of them,
the console shows a warning with an **Exclude these** action. The scan is
never blocked. Firewalls that are not the default gateway are not detected:
exclude them yourself.

## When the console sees a change

The sensor sends its config report at start. A change at the container or host level (a sysctl, a profile, an environment variable) shows in the console after the container is recreated: `docker compose up -d --force-recreate`. A local policy edit needs only a reload: `docker kill -s HUP <container>` makes the sensor read the policy again, and the next task uses it. A sysctl change does not need a reload but does need the recreate, so the sensor probes again.

## Kubernetes and Helm

- The sysctl is a node setting: set `kernel.unprivileged_userns_clone=1` on the nodes that run the sensor (node image, DaemonSet or machine config), ideally a dedicated node pool with a taint and a toleration for the sensor.
- Load the sensor's seccomp profile as a `Localhost` profile (`sensor.sandbox.seccompProfile: openctem` in the chart). See [Kubernetes](deploy-kubernetes.md).
- Never `privileged: true` and never `allowPrivilegeEscalation: true` to get confinement.

See also: [Tool confinement](deploy-docker.md#tool-confinement), [Troubleshooting](troubleshooting.md#runtime-sandbox-network).
