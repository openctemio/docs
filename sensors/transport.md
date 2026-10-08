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
| **v2** | Protocol v2 (JSON over HTTPS, signed, polling). | The platform does not serve protocol v3, or a sensor uses an API key instead of pairing. |

The sensor picks the transport by itself (`SENSOR_TRANSPORT=auto`): gRPC
first, HTTPS when gRPC fails at the network level, v2 when the platform has no
protocol v3. It tries gRPC again every 30 minutes. It **never** falls back
because the platform refused its identity (a revoked key, a disabled or
deleted sensor): that is an error, reported as such.

## Turn it on (platform)

Protocol v3 is off until the operator enables it.

**Docker Compose** (the built-in gateway): point a second DNS name at the
gateway, for example `sensors.example.com`, then:

```bash
SENSOR_PUBLIC_HOSTNAME=sensors.example.com \
  docker compose -f docker-compose.yml -f docker-compose.sensor-passthrough.yml up -d --build
```

The gateway passes TLS for that name straight to the API without terminating
it, on the same port 443; everything else is served as before. No public
certificate is needed for the sensor host: the platform's sensor CA signs it,
and sensors pin that CA.

**Kubernetes** (Helm chart 0.16.0 or later): set `api.sensorTransport.enabled`,
`api.sensorTransport.publicHost` and either `gatewayPassthrough` (bundled
Caddy with the layer4 module) or `dedicatedService` (a load balancer for the
sensor host). See the chart README, section "Sensor protocol v3".

`SENSOR_TRANSPORT_V3_ENABLED=true` alone serves the HTTPS transport only.

## Sensor settings

| Variable | Default | Meaning |
|---|---|---|
| `SENSOR_TRANSPORT` | `auto` | `auto`, or force `grpc` (never falls back), `https` or `v2`. |

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
| `platform_without_grpc` | The platform serves only the HTTPS transport (no sensor host configured). |
| `platform_without_v3` | The platform does not serve protocol v3. |
| `forced_by_config` | `SENSOR_TRANSPORT` forces this transport. |
| `identity_refused` | The platform refused the sensor's identity: re-pair or re-enable the sensor. |
