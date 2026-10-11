---
title: Transport (gRPC and HTTPS)
parent: Sensors
nav_order: 7
---

# Sensor transport: gRPC over mutual TLS, HTTPS fallback

A paired sensor reaches the platform in one of three ways. The platform shows
which one each sensor uses on the sensor's detail page (**Transport**), with
the reason when it is not gRPC.

| Transport | How | When |
|---|---|---|
| **gRPC** | HTTP/2 over mutual TLS to a dedicated sensor host name. The sensor proves its identity with a short-lived client certificate for its own key; jobs are pushed to it the moment they are queued. | The platform serves it and the network lets HTTP/2 through. |
| **HTTPS** | The same calls over HTTPS on the platform address, each request signed with the sensor's key; jobs are still pushed over a long-lived response. | gRPC is blocked (a proxy without HTTP/2, a TLS-inspecting box, a closed port). |
| **v2** | Protocol v2 (JSON over HTTPS, polling). | The platform does not serve protocol v3, or the sensor still uses an API key. |

The sensor picks the transport by itself (`SENSOR_TRANSPORT=auto`): gRPC
first, HTTPS when gRPC fails at the network level, v2 when the platform has no
protocol v3. After a network failure it remembers it and tries gRPC again
after 30 minutes, then 1, 2 and at most 4 hours while it keeps failing; when
the platform does not offer gRPC yet, it asks again within 10 minutes. It
**never** falls back because the platform refused its identity (a revoked key,
a disabled or deleted sensor): it then sends only its heartbeat, reports the
error, and waits.

A sensor that still uses an API key moves to its own signing key by itself
when the platform offers it: it makes a key, binds it once (the platform
retires the API key, the sensor keeps its id and grant) and then uses protocol
v3. Back up its state directory afterwards; it holds the only credential.
`SENSOR_KEY_BIND=off` keeps the API key. An organization can require an
administrator to approve every sensor key instead (Organization settings >
"Require approval of sensor keys"); such sensors are re-paired.

## On the platform

Nothing to turn on. The platform always serves the HTTPS transport. It offers
gRPC only while its own probe reaches its gRPC endpoint the way a sensor would
(every minute, verifying the endpoint's certificate against the sensor CA), so
a sensor is never sent to an endpoint that cannot work. The Sensors page shows
which transport the platform offers and why gRPC is not offered.

The gRPC endpoint is `SENSOR_PUBLIC_HOST`, or `sensors.<platform host>` when
the platform URL uses a DNS name. Two ways to make it reachable:

**A sensor host name on port 443** (Docker Compose, the built-in gateway):
point a second DNS name at the gateway, for example `sensors.example.com`,
then:

```bash
SENSOR_PUBLIC_HOSTNAME=sensors.example.com \
  docker compose -f docker-compose.yml -f docker-compose.sensor-passthrough.yml up -d --build
```

The gateway passes TLS for that name straight to the API without terminating
it; everything else is served as before. No public certificate is needed for
the sensor host: the platform's sensor CA signs it, and sensors pin that CA.

**A port of its own** (any setup, including a platform reached by an IP
address, where routing by name is impossible): publish the API's mTLS port
(8443 in the container) and set `SENSOR_PUBLIC_HOST=<address>:<port>`, for
example `192.0.2.10:8444`.

**Kubernetes**: see the chart README, section "Sensor protocol v3".

`SENSOR_TRANSPORT_V3=off` on the API is the emergency switch: no protocol v3,
every sensor back to v2 at its next call.

## Sensor settings

| Variable | Default | Meaning |
|---|---|---|
| `SENSOR_TRANSPORT` | `auto` | `auto`, or force `grpc` (never falls back), `https` or `v2`. |
| `SENSOR_KEY_BIND` | `auto` | A sensor with an API key binds its own signing key when the platform offers it; `off` keeps the API key. |

The client certificate (7 days, renewed automatically at two thirds of its
lifetime) and the pinned platform CA are kept in the identity directory under
`SENSOR_STATE_DIR`, next to the signing key. No tool the sensor runs can read
that directory.

## Network requirements

- gRPC: outbound TCP to the sensor host name and port (443 with the gateway),
  TLS 1.3 and HTTP/2 end to end. A proxy that terminates TLS breaks it by
  design (the sensor falls back to HTTPS).
- HTTPS: the same as protocol v2 (see [Network requirements](network.md)).

## Troubleshooting

| Shown reason | Meaning |
|---|---|
| `grpc_unreachable` | The sensor host does not answer: DNS, firewall, or the platform's passthrough is off. |
| `handshake_failed` | TLS to the sensor host failed: a TLS-inspecting proxy, or the name is not routed to the API. |
| `http2_refused` | Something on the path speaks only HTTP/1.1. |
| `platform_without_grpc` | The platform offers only the HTTPS transport: no sensor host, or its own probe cannot reach the gRPC endpoint (the Sensors page shows why). |
| `platform_without_v3` | The platform does not serve protocol v3. |
| `forced_by_config` | `SENSOR_TRANSPORT` forces this transport. |
| `identity_refused` | The platform refused the sensor's identity: re-pair or re-enable the sensor. |
