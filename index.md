---
title: Home
nav_order: 1
permalink: /
---

# OpenCTEM documentation

OpenCTEM is an open-source platform for Continuous Threat Exposure Management (CTEM).
It keeps an inventory of what an organization exposes, finds and correlates the weaknesses
in it, ranks them by real risk, confirms them, and drives them to remediation. It runs the
five CTEM stages as one loop: **scoping**, **discovery**, **prioritization**, **validation**
and **mobilization**.

OpenCTEM is self-hosted and multi-tenant: one installation serves many organizations, each
isolated from the others. Scanning runs in **sensors** that you place where the targets are
reachable; sensors connect out to the platform, so nothing has to reach into your networks.

## Start here

| If you want to | Read |
|---|---|
| Try it in 15 minutes | [Quickstart](quickstart.md): install, pair a sensor, run a first scan |
| Understand what OpenCTEM does and how it is built | [Overview](overview/) and [Architecture](overview/architecture.md) |
| Install it | [Install](install/): Docker Compose, the all-in-one image, or Kubernetes with Helm |
| Configure it | [Configuration](configuration/) and the [environment variables reference](configuration/environment-variables.md) |
| Run it in production | [Operations](operations/): upgrades, backups, monitoring, troubleshooting |
| Understand its security model or report a vulnerability | [Security](security/) |
| Connect your identity provider | [Identity and access](identity/) |
| Scan your environment | [Sensors](sensors/) and [Scanning](scanning/) |
| Use the console day to day | [User guide](user-guide/) |
| Automate it or integrate with it | [API](api/) |
| Contribute or write a tool | [Developers](developers/) |

## Components

| Component | Repository | Image |
|---|---|---|
| API server and web console | [openctemio/openctem](https://github.com/openctemio/openctem) | `ghcr.io/openctemio/openctem-api`, `ghcr.io/openctemio/openctem-web`, `ghcr.io/openctemio/openctem` (all-in-one) |
| Sensor | [openctemio/sensor](https://github.com/openctemio/sensor) | `ghcr.io/openctemio/sensor` |
| CI integration | [openctemio/ci](https://github.com/openctemio/ci) | |
| Go SDK and tool contract | [openctemio/sdk-go](https://github.com/openctemio/sdk-go) | |
| CTEM Ingest Schema (CTIS) | [openctemio/ctis](https://github.com/openctemio/ctis) | |
| Helm charts | [openctemio/helm-charts](https://github.com/openctemio/helm-charts) | |

## Releases and license

Each release is described in the
[changelog](https://github.com/openctemio/openctem/blob/develop/api/CHANGELOG.md); see
[Versioning and releases](operations/versioning.md) for the release policy. OpenCTEM is
free software: the platform, sensor, SDK and CI integration are licensed under the GNU GPL v3.0,
the CTIS schema and the Helm charts under the Apache License 2.0 (see [Legal](legal/)).

To report a security vulnerability, email **security@openctem.io** and see the
[vulnerability disclosure policy](security/vulnerability-disclosure.md). For anything
else, write to info@openctem.io or open an issue in the relevant repository.
