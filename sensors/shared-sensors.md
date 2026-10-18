---
title: Shared sensors
parent: Sensors
nav_order: 5.5
---

# Shared sensors
{: .no_toc }

A **shared sensor** belongs to the installation, not to an organization. Whoever
runs the installation operates it (on a self-hosted install, the instance
administrators). It scans for every organization the administrator allows, and
no organization ever sees it as a sensor of its own. An **organization
sensor**, paired under **Discovery > Sensors**, takes only that organization's
work (see [Pairing and enrollment](pairing.md)).

Shared sensors are in every edition. They are off until a super administrator
turns them on, and an organization can always opt out.

{: .warning }
**Not available in v0.11.0.** This release does not enable shared sensors: the
platform console shows "Shared sensors are not available in this release" on
**Scanning > Platform scanning**, and no organization's scan goes to a shared
sensor. The fleet, queue, zones and settings described below appear once a
release enables them; the domain-proof policy on that page already applies to
the platform sensors.

{: .note }
Shared mode and instance enrollment need a sensor release that includes them
(`SENSOR_SHARED_MODE` and `SENSOR_INSTANCE_ENROLLMENT_TOKEN`). Sensor v0.23.2
and older do not: such a sensor cannot enroll with a token, or enrolls but
receives no shared job, because it does not advertise the `shared.isolation@1`
capability the platform requires. Check the sensor's release notes before you
install one.

1. TOC
{:toc}

---

## What a shared sensor does and does not do

- It scans **public targets**. Internal addresses, asset groups and targets in
  an organization's scan zone run on the organization's own sensors, unless the
  administrator turned on **Shared sensors may scan internal zones** and
  assigned the organization an [instance scan zone](#instance-scan-zones).
- It never scans bug-bounty program targets.
- Every job runs in a private working directory with every tool sandboxed and
  network-confined; nothing writable is shared between jobs. The sensor
  refuses to start in shared mode (`SENSOR_SHARED_MODE=1`) when the tool
  sandbox, network confinement or a local policy is missing, and runs only jobs
  the platform signed for this sensor (the platform needs its job signer, `SIGNER_SOCKET`, and the sensor pins
  its keys at enrollment; see [TLS and pinning](security.md#tls-and-pinning)). trivy tasks are refused in shared
  mode. 
- It uses signed public content only, never an organization's own content
  pack, tool settings or credentials.
- Results are written into the organization of the job it holds. Organizations
  see no sensor name, version or load: a task only says that it runs on shared
  sensors.

## Turn shared sensors on

In the platform admin console open **Scanning > Platform scanning**. Only super
administrators change these settings; each change needs a fresh authenticator
code and a reason, is written to the admin audit log and e-mailed to the other
administrators.

| Setting | Meaning |
|---|---|
| **Turn on shared sensors** | Off by default: no organization sends scans to shared sensors. The switch is refused until the shared job queue is ready. |
| **Organizations without a decision** | **Allow**: every organization may use shared sensors unless you deny it. **Deny**: only organizations you allow. You must choose one to turn the switch on; unset means refuse. |
| **Require a verified domain before platform sensors scan a target** | Off by default; an installation started with `MANAGED_SERVICE=true` (a hosted multi-tenant service) defaults to on until a value is saved here, and a saved value always wins. On: shared sensors scan only targets under a domain the organization verified, and intrusive checks need a verified domain on any sensor. See [Scope](../scanning/scope.md#proof-of-control). |
| **Shared sensors may scan internal zones** | Off by default. On: an internal target may go to a shared sensor, but only inside an instance scan zone assigned to that organization. Keep it off on a public multi-tenant service. |
| **Egress addresses** | The public addresses (or ranges) shared sensors scan from, per region or for all regions. Organizations that may use shared sensors see them on their **Sensors** page so they can allowlist the scanners. Private, loopback, link-local, metadata and carrier-grade NAT ranges are refused. |
| **Shared sensor anomaly alerts** | Per organization and UTC day: distinct domains, failed jobs and deny-list hits. When a count reaches its threshold, every administrator is e-mailed once and an audit entry is written. `0` turns a signal off. Only counts are kept, never targets. |

A super administrator can also allow or deny one organization with
`PUT /api/v1/admin/tenants/{tenantId}/shared-sensors` (same step-up and audit).
A deny wins over the default.

## Enroll a shared sensor

A shared sensor enrolls with a **single-use instance enrollment token** instead
of an approval in an organization.

1. In **Scanning > Platform scanning**, card **Enroll a shared sensor**, give
   the sensor a name (optional) and a lifetime (5 to 60 minutes) and choose
   **Issue token**. Confirm with a reason and your authenticator code.
2. Copy the token (`octe_` followed by 49 letters or digits). It is shown once
   and works for one sensor.
3. Start the sensor in shared mode with the token, within its lifetime:

   ```bash
   docker run -d --name openctem-shared-sensor --restart unless-stopped \
     --read-only --tmpfs /tmp --cap-drop ALL \
     --security-opt no-new-privileges:true \
     --security-opt seccomp="$PWD/openctem-sensor-seccomp.json" \
     -e XDG_CONFIG_HOME=/tmp/.config -e XDG_CACHE_HOME=/tmp/.cache \
     -e SENSOR_API_URL=https://openctem.example.com \
     -e SENSOR_SHARED_MODE=1 \
     -e SENSOR_INSTANCE_ENROLLMENT_TOKEN=octe_... \
     -v ./sensor-policy.yaml:/etc/openctem/sensor-policy.yaml:ro \
     -v openctem-shared-sensor-data:/var/lib/openctem \
     ghcr.io/openctemio/sensor:<version>
   ```

   `<version>` is a sensor release with shared mode (see the note above).

   The sensor makes its own key, enrolls without a further approval and logs
   `Enrolled: shared sensor ...`. It has no organization and the
   least-privilege grant. The token is spent, never printed and ignored once
   the sensor is enrolled. The sensor's `state/` directory holds its only
   credential: back it up like a pairing identity
   ([Where the identity lives](pairing.md#where-the-identity-lives)).

The local policy file is mandatory in shared mode; start from the example in
the sensor repository (public targets only by default) and see
[Sensor-local policy](network.md#sensor-local-policy).

### The bundled sensor of the Compose install

The Compose stack has an optional overlay that runs one shared sensor next to
the platform. `setup.sh` writes a token into `.env` and copies
`sensor/sensor-policy.example.yaml` to `sensor/sensor-policy.yaml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.sensor.yml up -d
docker compose -f docker-compose.yml -f docker-compose.sensor.yml logs sensor
# "Enrolled: shared sensor ..."
```

A one-shot `sensor-enrollment` service registers the token (valid one hour,
single use, audited) with `bootstrap-admin sensor-token -from-env
SENSOR_INSTANCE_ENROLLMENT_TOKEN` before the sensor starts. If the token
expired before the sensor enrolled, put a new value in `.env` (`octe_` and 49
letters or digits) and run the same `up` again. The sensor runs read-only with
all capabilities dropped under the sensor release's own seccomp profile
(`sensor/seccomp.json`); the host must allow unprivileged user namespaces. On a
host that cannot confine its tools the sensor refuses to start and says why.

An existing sensor paired as an organization sensor stays an organization
sensor: a sensor's scope is fixed when it is created. To replace it, retire it
under **Sensors**, stop it and start the overlay with a fresh data volume.

Even when enrolled, a shared sensor takes no organization's jobs until shared
sensors are turned on and the organization is allowed.

## Operate the fleet

**Scanning > Platform scanning > Shared sensors** lists the shared fleet, the queue and who uses it:

- **Fleet**: status (*Active*, *Paused*, *Retired*), health, version, tools and
  current jobs per sensor. **Pause** stops a sensor taking new jobs (the jobs
  it holds run to the end) and **Resume** undoes it. **Retire** revokes the
  sensor's key at once; it cannot be resumed, enroll a new sensor instead.
  These actions need a super administrator with a fresh authenticator code.
- **Queue per tool**: jobs waiting and running per tool.
- **Use per organization**: counts only (queued, running, done and failed in
  the last 24 hours).
- **Jobs**: organization, tool, state and time. **Targets and logs** opens a
  job's details only for a super or operations administrator with a reason;
  the view is audited and rate-limited. Results and findings are never shown.

API: `GET /api/v1/admin/shared-sensors` (fleet), `/queue`, `/jobs`,
`POST /api/v1/admin/shared-sensors/{sensor_id}/disable`, `/enable`, `/revoke`
and `POST /api/v1/admin/shared-sensors/enrollment-tokens`.

## Instance scan zones

An **instance scan zone** is a set of private ranges that shared sensors may
scan for the organizations you assign the zone to, while **Shared sensors may
scan internal zones** is on. In **Scanning > Platform scanning > Instance scan
zones** choose **Add zone** and enter:

- **Name** and **Description**;
- **Ranges**: one CIDR or address per line, inside `10.0.0.0/8`,
  `172.16.0.0/12`, `192.168.0.0/16` or `fc00::/7`;
- **Shared sensor IDs** that serve the zone (only shared sensors can);
- **Organization IDs** the zone is assigned to. Empty assigns it to no one.

Overlapping ranges of different organizations stay apart: an organization uses
only the zones assigned to it. Each change is recorded by the job signer, a
zone's ranges reach a sensor only inside its signed job, and the sensor
refuses anything outside them.

## What an organization sees

- **Discovery > Sensors** has a **Shared sensors** card when the organization
  may use them: availability (*Available*, *Busy, jobs wait*, *Unavailable,
  jobs wait*), regions, tool names, the organization's own job counts, the
  egress addresses and whether every target needs a verified domain. A job
  that waits for a free slot fails after the queue limit shown there.
- A scan's **Sensor** setting offers **Auto** (organization sensors first, then
  shared sensors), **Organization sensors** and **Shared sensors**.
- The organization owner can switch on **Never use shared sensors** in
  **Settings > Organization > General**: the organization's scans then run only
  on its own sensors.
- Per-organization limits (`platform_scans_per_day`,
  `platform_scans_concurrent`) cap the shared scans an organization starts per
  UTC day and runs at once; installs have no limit unless the administrator
  sets one.

See also [Why is a task waiting?](../scanning/why-waiting.md).
