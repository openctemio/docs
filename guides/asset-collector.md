---
layout: default
title: Asset Collector
parent: Platform Guides
nav_order: 23
---
# OpenCTEM Asset Collector

The Asset Collector pulls asset inventory from systems you already run and
keeps it current in OpenCTEM. It runs as a **sensor of type collector**.

- Source: [github.com/openctemio/asset-collector](https://github.com/openctemio/asset-collector)
  (formerly `asset-inventory`)
- Image: `ghcr.io/openctemio/asset-collector`, signed with cosign

| Collector | Source | Assets | Tool on the platform |
|-----------|--------|--------|----------------------|
| `gcp_dns_instances` | Google Cloud DNS | domains and subdomains with their A, AAAA and CNAME records | `gcp-dns` |
| `vcenters` | VMware vCenter | virtual machines and ESXi hosts | `vcenter` |
| `ldap_servers` | LDAP / Active Directory | computer objects as hosts | `ldap` |
| `splunks` | Splunk indices | hosts and network devices seen in the logs | `splunk` |
| `prtgs` | PRTG Network Monitor | monitored network devices | `prtg` |

Every collector type takes several instances, each with its own cron
schedule.

---

## How it differs from a scanner sensor

| | Scanner sensor (`openctemio/sensor`) | Collector sensor (Asset Collector) |
|---|---|---|
| Sensor type | runner, worker or sensor | **collector** |
| Work comes from | scans the platform dispatches | its own schedule |
| Tools reported | scanners (kind `scanner`) | collectors (kind `collector`) |
| Produces | findings and assets | assets |
| Can be picked in a scan | yes | no: the platform refuses scans that name a collector tool |

Both use the same SDK runtime (`sdk-go` `pkg/sensorkit`): protocol v2,
heartbeats, the sensor manifest, API-key renewal and a durable outbox for
results.

---

## Set it up

1. **Create the sensor.** Go to **Settings → Sensors → Add sensor**, choose
   type **Collector**, and copy the API key (it is shown once).
2. **Configure the collectors** in a YAML file. `config.example.yaml` in the
   repository lists every option, and `docs/COLLECTORS.md` describes each
   collector. Give each collector a read-only account.
3. **Run it** as a daemon, keeping its outbox and state on persistent
   storage:

```bash
docker run -d --name asset-collector --restart unless-stopped \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  -e API_URL=https://openctem.example.com -e API_KEY=rda_... \
  -v "$PWD/config.yaml:/app/config.yaml:ro" \
  -v collector-outbox:/var/lib/openctem/outbox \
  -v collector-state:/var/lib/openctem/state \
  ghcr.io/openctemio/asset-collector:latest
```

Docker Compose and a systemd unit are in the repository's
`docs/DEPLOY.md`.

4. **Check it.** On **Settings → Sensors**, the sensor shows online, with
   role *Collector* and one tool per configured collector type. The collected
   assets appear under **Assets**, tagged `source:<instance name>`.

---

## What the platform receives

- One CTIS report per collector run:
  - `metadata.source_type: collector`
  - `metadata.source_ref`: the instance name
  - the collector type as `tool.name`
- Reports go to the protocol v2 results API
  (`PUT /api/v2/sensor/results/{report_id}`). They pass through the
  collector's outbox first, so a platform outage delays them but loses
  nothing.
- Heartbeats every minute, with the manifest digest. The manifest lists one
  tool of kind `collector` per configured type.
- No commands: the platform never dispatches work to a collector.

The platform only accepts tool names that are in its tool catalog. The five
collector tools are in the catalog under the category **Asset Collectors**.
On a platform from before that catalog entry, the collector still delivers
assets, but its sensor lists no tools.

---

## Upgrading from asset-inventory

See `docs/UPGRADING.md` in the repository. In short:

- the binary is now `openctem-asset-collector`
- the image is now `ghcr.io/openctemio/asset-collector`
- the `agent:` config section is now `sensor:`
- `AGENT_ID` and `api.agent_id` are ignored
- the outbox and state directories need persistent volumes
