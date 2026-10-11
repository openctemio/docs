---
title: Transport (gRPC and HTTPS)
parent: Sensors
nav_order: 7
---

# Sensor transport: gRPC, HTTPS and v2
{: .no_toc }

A paired sensor reaches the platform in one of three ways and picks the best
one by itself. Nothing has to be configured on the sensor. On the platform,
gRPC on port 443 needs one Compose override; everything else works as
installed. Which setup gives which transport is summarized in
[Choose your setup](index.md#choose-your-setup).

Design: [RFC-059](https://github.com/openctemio/openctem/blob/develop/api/docs/rfcs/RFC-059-sensor-transport-v3.md).

1. TOC
{:toc}

---

## The three transports

| Transport | Console label | How |
|---|---|---|
| `grpc` | gRPC, mutual TLS | HTTP/2 with mutual TLS straight to the API. The sensor proves its identity with a short-lived client certificate for its own key and trusts only the platform's sensor CA for the server. Jobs are pushed the moment they are queued. |
| `https` | HTTPS (fallback) | The same calls over HTTPS on the platform URL (`/api/v3/sensor`), each request signed with the sensor's key. Jobs are still pushed, over a long-lived response. |
| `v2` | Protocol v2 | JSON over HTTPS (`/api/v2/sensor`), polling. For a platform without protocol v3 and for sensors that still use an API key. |

All three run every scan with the same checks and limits.

## How the sensor picks

With `SENSOR_TRANSPORT=auto` (the default) the sensor asks the platform what
it offers, then:

1. **gRPC**, when the platform names a gRPC endpoint. The sensor first gets a
   client certificate over HTTPS, then connects.
2. **HTTPS**, when the platform offers no gRPC endpoint, or gRPC fails at the
   network level (unreachable, TLS handshake, no HTTP/2, stream reset). The
   failure is remembered in the state directory: the sensor tries gRPC again
   after 30 minutes, then 1, 2 and at most 4 hours while it keeps failing,
   also across restarts. When the platform offers no gRPC yet, the sensor asks
   again within 10 minutes.
3. **v2**, when the platform does not serve protocol v3.

Two cases never fall back:

- **The platform refuses the sensor's identity** (a revoked key, a disabled,
  revoked or deleted sensor): reason `identity_refused`. The sensor sends only
  its heartbeat, logs the error and waits. A weaker transport would not help
  and would hide the problem.
- **The gRPC endpoint presents a certificate not signed by the platform's
  sensor CA** (a TLS-inspecting proxy, a gateway that stopped routing sensor
  connections, a replaced sensor CA): reason `platform_certificate_refused`.
  The sensor sends **nothing**, not even its heartbeat, and negotiates again
  about every minute. See [Troubleshooting](troubleshooting.md#platform-certificate-refused).

Protocol v3 needs a paired (key-bound) sensor. A sensor that still uses an API
key (from sensor v0.13.0) makes its own key and binds it once when the
platform offers it: the platform retires the API key, the sensor keeps its id,
grant and history, and moves to protocol v3. Its state directory then holds
its only credential. `SENSOR_KEY_BIND=off` keeps the API key. If the
organization turned on **Require approval of sensor keys** (Settings >
Organization), the bind is refused and the sensor must be
[re-paired](pairing.md#re-pair-a-sensor) instead.

## What the platform offers

The platform always serves the HTTPS transport (unless
`SENSOR_TRANSPORT_V3=off`). It offers gRPC only while a self-probe confirms
that a sensor can reach the gRPC listener:

1. The API knows the endpoint: `SENSOR_PUBLIC_HOST`, or else the host and port
   of its own public URL (`SENSOR_PUBLIC_API_URL`, else `APP_URL`; `https://`
   only, not `localhost`). With Compose that is `OPENCTEM_PUBLIC_URL`, a host
   name or an IP address.
2. The API's mTLS listener (`:8443` in the container) runs, with a server
   certificate from the sensor CA.
3. Every minute (every 30 seconds while failing) the API dials the endpoint
   the way a sensor does and accepts only a certificate from its sensor CA.
   Only the mTLS listener holds one, so the probe passes only when the path
   through the gateway really reaches it.

Platform admins see the result on **Console > Operations**, in the Sensor
fleet card: a *Sensor connection* row (gRPC and HTTPS, HTTPS, Checking, or
Protocol v2) and, when gRPC is not offered for a reason an operator can
change, a short note on what would let sensors use it, with the reason code.
HTTPS is a normal, signed transport, not a fault. Organization members do not
see this installation detail.

| Platform reason | Cause | Fix |
|---|---|---|
| `foreign_certificate` | The endpoint answers with another certificate: the gateway terminates TLS instead of passing sensor connections through. This is the normal state of the stock gateway image. | Nothing, or [gRPC on port 443](#grpc-on-port-443-docker-compose). |
| `unreachable` | Nothing answers at the endpoint, seen from the API container. | Check the port, and that the API container can reach the platform's public address (the probe goes out and back in through the published port). |
| `dns_failed` | The endpoint's host name does not resolve inside the API container. | Make the name resolvable there, or set `SENSOR_PUBLIC_HOST`. |
| `handshake_failed` | TLS to the endpoint failed. | A TLS-terminating device on the path; see [Choose your setup](index.md#choose-your-setup). |
| `http2_refused` | The path does not carry HTTP/2. | As above. |
| `no_public_host` | No `SENSOR_PUBLIC_HOST` and no `https://` platform URL. | Set `OPENCTEM_PUBLIC_URL` (Compose) or `SENSOR_PUBLIC_HOST`. |
| `sensor_ca_unavailable` | The sensor CA could not be loaded or created. | Check the API log (`sensor CA not loaded`) and the `api-data` volume. |
| `listener_failed` | The mTLS listener could not start. | Check the API log; another process may hold `SENSOR_MTLS_LISTEN_ADDR`. |
| `probe_pending` | The first probe has not finished. | Wait a minute. |
| `transport_off` | `SENSOR_TRANSPORT_V3=off`. | Unset it. |

The same state is in `GET /api/v1/admin/operations` (field
`sensor_transport`, platform admins), in the metrics `openctem_sensor_transport_grpc_advertised`
and `openctem_sensor_transport_grpc_probe_total{result}`, and in one API log
line per change, for example
`sensor protocol v3 gRPC binding reachable: advertised to sensors`.

## gRPC on port 443 (Docker Compose)

The built-in gateway can pass sensor gRPC connections through to the API on
the same port 443 as the console, whether the platform is reached by an IP
address or by one host name. It needs a gateway image with the layer-4 module,
which the override file builds:

```bash
cd openctem/api/deploy
docker compose -f docker-compose.yml -f docker-compose.sensor-passthrough.yml up -d --build
```

- The gateway looks at each TLS connection before terminating it. A
  connection that offers the sensor routing id (the ALPN protocol
  `openctem-sensor/3`) goes, untouched, to the API's mTLS listener; every other
  connection (browsers, API clients, sensors on HTTPS or v2) is served as
  before. The id only routes: the API still checks the client certificate,
  the key and the sensor on every connection and every call.
- The API derives the endpoint from `OPENCTEM_PUBLIC_URL` and offers it once
  its probe passes, usually within a minute. No public certificate and no DNS
  change are needed: the API makes the server certificate from its sensor CA,
  and sensors pin that CA.
- The gateway adds a PROXY protocol header with the sensor's address; the API
  believes it only from the gateway's fixed address
  (`SENSOR_MTLS_TRUSTED_PROXIES`, set by the override).
- Switching the gateway image restarts it: a few seconds without console or
  API.
- `--build` downloads the Caddy build image and the layer-4 module. On a host
  without internet access, build the image elsewhere from
  `api/deploy/gateway/Dockerfile` and set `GATEWAY_L4_IMAGE` to it.

Keep the override in every later `docker compose` command (or in
`COMPOSE_FILE`), otherwise the next `up` returns to the stock gateway and
sensors move back to HTTPS.

Sensors v0.15.0 and later (not released yet; sensor
[#207](https://github.com/openctemio/sensor/pull/207)) offer the routing id and
move to gRPC at their next negotiation. Older sensors stay on HTTPS with
`platform_without_grpc`, because the platform names this endpoint only to
sensors that can use it; give them a [dedicated host name](#a-dedicated-sensor-host-name).

The gateway refuses to start, with a message starting `openctem-gateway:`,
when the sensor routing is asked for in TLS mode `http` (it must see the TLS
handshake), on an image without the layer-4 module, or with an invalid
`SENSOR_PUBLIC_HOSTNAME`.

### A dedicated sensor host name

A second DNS name that points at the same gateway, routed by its server name
(SNI) as well as by the routing id, so sensors v0.12.0 to v0.14.0 reach gRPC
too:

```bash
OPENCTEM_SENSOR_GATEWAY=passthrough \
SENSOR_PUBLIC_HOSTNAME=sensors.example.com \
SENSOR_PUBLIC_HOST=sensors.example.com:443 \
  docker compose -f docker-compose.yml -f docker-compose.sensor-passthrough.yml up -d --build
```

Put the three variables in `.env` to keep them. `SENSOR_PUBLIC_HOSTNAME` is a
host name only (no port) and must differ from `OPENCTEM_HOSTNAME`. No
certificate is needed for it.

### A port of its own

Only when you want a separate port, for example in front of a setup without
the built-in gateway: publish the API's mTLS port (8443 in the container)
directly or through a TCP load balancer that does not terminate TLS, and set
`SENSOR_PUBLIC_HOST=<host>:<port>` on the API, for example
`203.0.113.10:8444`. Without a proxy that sends the PROXY protocol, leave
`SENSOR_MTLS_TRUSTED_PROXIES` empty.

### Kubernetes

See [Transport on Kubernetes](deploy-kubernetes.md#transport-on-kubernetes).

## Platform side: the sensor CA

The API signs sensor client certificates (7 days, renewed at two thirds of
their lifetime) and its own gRPC server certificate with a **sensor CA**. It is
created on the first start in `SENSOR_MTLS_CA_DIR` (`/app/data/sensor-ca` in
the image, on the `api-data` volume in Compose), or loaded from
`SENSOR_MTLS_CA_CERT_FILE` and `SENSOR_MTLS_CA_KEY_FILE`. The API logs its
fingerprint at start (`sensor CA loaded`). It is separate from the key that
signs jobs: a certificate opens a channel, it never authorizes a job.

Back it up with the `api-data` volume. If it is lost or replaced, the API
creates or uses the new CA, and sensors that were on gRPC stop with
`platform_certificate_refused` until they hold a certificate from the new CA.
To move such a sensor on at once, stop it, delete
`transport-v3-client.pem` and `transport-v3-platform-ca.pem` from its
`identity/` directory, and start it: it then fetches a new certificate and CA
over HTTPS.

## Settings

Sensor (see also [Settings](settings.md)):

| Variable | Default | Meaning |
|---|---|---|
| `SENSOR_TRANSPORT` | `auto` | `auto`, or force `grpc` (never falls back; sends nothing while gRPC is unavailable), `https` or `v2`. |
| `SENSOR_KEY_BIND` | `auto` | A sensor with an API key binds its own signing key when the platform offers it; `off` keeps the API key. |

API:

| Variable | Default | Meaning |
|---|---|---|
| `SENSOR_TRANSPORT_V3` | `auto` | `auto`: HTTPS always, gRPC while its probe passes. `off`: no protocol v3; every sensor is back on v2 at its next call (emergency switch). The older `SENSOR_TRANSPORT_V3_ENABLED` is refused at start. |
| `SENSOR_PUBLIC_HOST` | the host and port of the platform URL | Endpoint sensors dial for gRPC. Set it only for a dedicated host name or a port of its own. |
| `SENSOR_MTLS_LISTEN_ADDR` | `:8443` | The mTLS listener. |
| `SENSOR_MTLS_CA_DIR` | `data/sensor-ca` (`/app/data/sensor-ca`) | Where the sensor CA is created. |
| `SENSOR_MTLS_CA_CERT_FILE`, `SENSOR_MTLS_CA_KEY_FILE` | none | Your own sensor CA (PEM). |
| `SENSOR_MTLS_CERT_TTL` | `168h` | Client certificate lifetime, 1h to 720h. |
| `SENSOR_MTLS_TRUSTED_PROXIES` | none | CIDRs whose PROXY protocol header the mTLS listener believes. The override sets the gateway's address. |

Gateway (with the override file):

| Variable | Default | Meaning |
|---|---|---|
| `OPENCTEM_SENSOR_GATEWAY` | `off` (`alpn` with the override) | `alpn`: route connections that offer the sensor routing id; `passthrough`: that, and `SENSOR_PUBLIC_HOSTNAME` by SNI. |
| `SENSOR_PUBLIC_HOSTNAME` | none | Dedicated sensor host name for `passthrough`. |
| `GATEWAY_L4_IMAGE` | `openctem-gateway-l4:local` | The gateway image with the layer-4 module. |

## Files on the sensor

The transport keeps its files next to the signing key, in
`<state dir>/identity/`, where no tool the sensor runs can read them:

| File | Holds |
|---|---|
| `signing.key`, `identity.json` | The sensor's key and identity (from pairing) |
| `transport-v3-client.pem` | The current client certificate |
| `transport-v3-platform-ca.pem` | The sensor CA the sensor trusts for the gRPC endpoint |
| `transport-v3-state.json` | The outcome of the last gRPC attempt (the backoff) |
